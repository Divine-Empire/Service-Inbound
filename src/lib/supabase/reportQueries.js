// Read-only query layer for the Report stage (Service-Inbound). No tables, no writes: every
// function takes the supabase client (so it can also be exercised from a node script) and
// returns plain rows / aggregates.
//
// Cost rules applied throughout:
//  - select only the columns that are used,
//  - always filter by a date window on the server (never "fetch the whole
//    table and filter in JS"),
//  - page past PostgREST's 1000-row cap with a FRESH query builder per page
//    (reusing one builder across concurrent .range() calls races),
//  - `.in()` lists are capped at 100 ids per request (URL length).

import { enquiryTypeList } from "../enquiryType";

const PAGE = 1000;
const IN_CHUNK = 100;

// Report columns, one per enquiry type. inbound_tickets.enquiry_type is a text[]; a ticket with
// several types is counted in each of its columns (TOTAL counts it once).
export const CATS = ["SPARE", "SERVICE", "AUTO-LEVEL", "TOTAL-STATION"];

const ENQUIRY_TYPE_TO_CAT = {
  SPARE: "SPARE",
  SERVICE: "SERVICE",
  "AUTO-LEVEL-CALIBRATION": "AUTO-LEVEL",
  "TOTAL-STATION-CALIBRATION": "TOTAL-STATION",
};
const CALIBRATION_CATS = ["AUTO-LEVEL", "TOTAL-STATION"];

/** Report columns a ticket belongs to (unique, in CATS order). */
export function ticketCategories(enquiryType) {
  const found = new Set(enquiryTypeList(enquiryType).map((t) => ENQUIRY_TYPE_TO_CAT[t]).filter(Boolean));
  return CATS.filter((c) => found.has(c));
}

// "YYYY-MM-DD" (local) helpers. Range inputs are local calendar days;
// start = 00:00:00.000 local, end = 23:59:59.999 local, both inclusive.
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function defaultRange(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { from: ymd(start), to: ymd(end) };
}
function dayStart(ymdStr) {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function dayEnd(ymdStr) {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}
export function rangeBounds(from, to) {
  return { start: dayStart(from), end: dayEnd(to) };
}

// Pages through a query. `build()` must return a NEW builder each call and
// must include a deterministic .order().
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function fetchByIds(supabase, table, columns, idColumn, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) chunks.push(unique.slice(i, i + IN_CHUNK));
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase.from(table).select(columns).in(idColumn, chunk);
      if (error) throw error;
      return data || [];
    })
  );
  return results.flat();
}

const emptyBucket = () => ({
  outgoingEnq: 0,
  outgoingValue: 0,
  incomingEnq: 0,
  incomingValue: 0,
  tillDatePending: 0,
  tillDatePendingValue: 0,
  totalBilling: 0,
  invoiceValue: 0,
});

// ───────────────────────── Weekly report ─────────────────────────
// Enquiries   = inbound_tickets created in the range, split by call_type; value = the ticket's
//               inbound_quotations.basic_amount.
// Pending ENQ = last 60 days, still waiting at Machine Received (no inbound_material_received row)
//               or at Quotation (quotation_planned set, no inbound_quotations row yet).
// Billing     = inbound_invoice rows created in the range. Invoice value: SPARE = spare basic,
//               SERVICE = service basic, AUTO-LEVEL / TOTAL-STATION = service + spare basic.
//               The TOTAL column counts every ticket/invoice once (service + spare).

export async function fetchWeeklyReport(supabase, { from, to }) {
  const { start, end } = rangeBounds(from, to);
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const pendingWindowStart = new Date(now);
  pendingWindowStart.setDate(pendingWindowStart.getDate() - 60);
  pendingWindowStart.setHours(0, 0, 0, 0);
  // Everything created before this can't matter: enquiry counts need [start,end], "till date
  // pending" needs the last 60 days.
  const windowStart = new Date(Math.min(start.getTime(), pendingWindowStart.getTime())).toISOString();

  const [tickets, receivedRows, quotationRows, invoiceRows] = await Promise.all([
    fetchAll(() =>
      supabase
        .from("inbound_tickets")
        .select("uuid, ticket_id, enquiry_type, call_type, created_at, machine_received_planned, current_stage")
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .order("ticket_id", { ascending: true })
    ),
    fetchAll(() =>
      supabase
        .from("inbound_material_received")
        .select("ticket_uuid, quotation_planned")
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
    ),
    fetchAll(() =>
      supabase
        .from("inbound_quotations")
        .select("ticket_uuid, basic_amount")
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
    ),
    fetchAll(() =>
      supabase
        .from("inbound_invoice")
        .select("ticket_uuid, created_at, spare_amount_basic, service_amount_basic")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
    ),
  ]);

  // An invoice can belong to a ticket older than windowStart; look up just those enquiry types
  // instead of loading every ticket.
  const known = new Map(tickets.map((t) => [t.uuid, t]));
  const missingIds = invoiceRows.map((i) => i.ticket_uuid).filter((id) => !known.has(id));
  const extraTickets = await fetchByIds(supabase, "inbound_tickets", "uuid, enquiry_type", "uuid", missingIds);
  const enquiryTypeByTicket = new Map(tickets.map((t) => [t.uuid, t.enquiry_type]));
  extraTickets.forEach((t) => enquiryTypeByTicket.set(t.uuid, t.enquiry_type));

  const receivedByTicket = new Map(receivedRows.map((m) => [m.ticket_uuid, m]));
  const quotationByTicket = new Map(quotationRows.map((q) => [q.ticket_uuid, q]));

  const result = { TOTAL: emptyBucket() };
  CATS.forEach((cat) => {
    result[cat] = emptyBucket();
  });

  tickets.forEach((t) => {
    const ts = t.created_at ? new Date(t.created_at) : null;
    if (!ts || t.current_stage === "Cancelled") return;
    const cats = ticketCategories(t.enquiry_type);
    // A ticket is added to each of its columns, and once to TOTAL.
    const buckets = [...cats.map((c) => result[c]), result.TOTAL];
    const basicValue = Number(quotationByTicket.get(t.uuid)?.basic_amount) || 0;

    if (ts >= start && ts <= end) {
      if (t.call_type === "Outgoing") {
        buckets.forEach((b) => {
          b.outgoingEnq++;
          b.outgoingValue += basicValue;
        });
      }
      if (t.call_type === "Incoming") {
        buckets.forEach((b) => {
          b.incomingEnq++;
          b.incomingValue += basicValue;
        });
      }
    }

    // Till-date pending: last 60 days, ticket waiting at Machine Received or at Quotation.
    if (ts >= pendingWindowStart) {
      const mr = receivedByTicket.get(t.uuid);
      const pendingMachine = !!t.machine_received_planned && !mr;
      const pendingQuotation = !!mr?.quotation_planned && !quotationByTicket.has(t.uuid);
      if (pendingMachine || pendingQuotation) {
        buckets.forEach((b) => {
          b.tillDatePending++;
          b.tillDatePendingValue += basicValue;
        });
      }
    }
  });

  invoiceRows.forEach((inv) => {
    const cats = ticketCategories(enquiryTypeByTicket.get(inv.ticket_uuid));
    const spare = Number(inv.spare_amount_basic) || 0;
    const service = Number(inv.service_amount_basic) || 0;

    result.TOTAL.totalBilling++;
    result.TOTAL.invoiceValue += spare + service;

    cats.forEach((cat) => {
      const bucket = result[cat];
      bucket.totalBilling++;
      if (cat === "SPARE") bucket.invoiceValue += spare;
      else if (cat === "SERVICE") bucket.invoiceValue += service;
      else if (CALIBRATION_CATS.includes(cat)) bucket.invoiceValue += spare + service;
    });
  });

  return { result, start, end };
}
