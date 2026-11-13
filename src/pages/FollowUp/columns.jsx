import { Button } from "../../components/ui/button";
import { formatDate } from "../../lib/format";

// Column definitions for the Follow-Up tables. `text(row)` is the plain value
// (used for CSV export and as the default cell); `cell(row)` overrides the
// on-screen rendering (links). The Action column is `fixed` and never exported.

const linkCell = (url, label = "View") =>
  url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
    >
      {label}
    </a>
  ) : (
    <span className="text-gray-400">No file</span>
  );

const col = (key, label, text, extra = {}) => ({
  key,
  label,
  text,
  width: 150,
  defaultVisible: false,
  ...extra,
});

// Pending-tab rows (built from inbound_quotations + tickets + latest follow-up log).
export const PENDING_COLUMNS = [
  { key: "action", label: "Action", fixed: true, width: 120 },
  col("date", "Date", (r) => formatDate(r.timeStemp), { defaultVisible: true, width: 120, strong: true }),
  col("ticketId", "Ticket-ID", (r) => r.ticketId, { defaultVisible: true, width: 120, strong: true }),
  col("companyName", "Company Name", (r) => r.companyName, { defaultVisible: true, width: 200 }),
  col("clientName", "Client Name", (r) => r.clientName, { defaultVisible: true, }),
  col("phoneNumber", "Phone Number", (r) => r.phoneNumber, { defaultVisible: true, }),
  col("quotationNo", "Quotation No.", (r) => r.quotationNo, { defaultVisible: true, width: 120, strong: true }),
  col("quotationPdf", "Quotation Copy", (r) => r.quotationPdfLink, { defaultVisible: true,
    cell: (r) => linkCell(r.quotationPdfLink, "Download"),
  }),
  col("enquiryType", "Enquiry Type", (r) => r.enquiryType || "-", { defaultVisible: true, wrap: true, width: 180 }),
  col("enquiryReceiverName", "Enquiry Receiver Name", (r) => r.enquiryReceiverName, { defaultVisible: true, width: 180 }),
  col("gstNo", "GST No.", (r) => r.gstNo, { defaultVisible: true }),
  col("lastCallDate", "Last Call Date", (r) => formatDate(r.lastCallDate), { defaultVisible: true }),
  col("lastRemarks", "Last Remarks", (r) => r.lastRemarks, { defaultVisible: true, wrap: true, width: 220 }),
  col("nextCallDate", "Next Call Date", (r) => formatDate(r.nextCallDate), { defaultVisible: true }),
  col("nextAction", "Next Action", (r) => r.nextAction, { defaultVisible: true, wrap: true, width: 200 }),
  col("sourceOfEnquiry", "Source of enquiry", (r) => r.sourceOfEnquiry),
  col("callType", "Call type", (r) => r.callType),
  col("clientType", "Client Type", (r) => r.clientType),
  col("siteAddress", "Site Address", (r) => r.siteAddress, { width: 200 }),
  col("machineName", "Machine Name", (r) => r.machineName),
  col("mentionIssue", "Mention Issue", (r) => r.mentionIssue, { wrap: true, width: 220 }),
  col("basicAmount", "Basic Amount", (r) => r.basicAmount),
  col("totalAmount", "Total Amount", (r) => r.totalAmoutWithTex, { }),
  col("clientApproval", "Client Approval", (r) => r.clientAttachment, {
    cell: (r) => linkCell(r.clientAttachment),
  }),
  col("sharedBy", "Shared By", (r) => r.quotationShareByPersonName),
  col("shareThrough", "Share Through", (r) => r.ShareThrough),
  col("lastUpdatedBy", "Last Updated By", (r) => r.lastUpdatedBy ?? r.last_updated_by ?? "", { width: 160 }),
];

// Proforma Inv. tab rows: pending-style ticket rows plus the PI details from the ticket's Make PI row.
export const PROFORMA_COLUMNS = [
  { key: "action", label: "Action", fixed: true, width: 140 },
  col("date", "Date", (r) => formatDate(r.timeStemp), { defaultVisible: true, width: 120, strong: true }),
  col("ticketId", "Ticket-ID", (r) => r.ticketId, { defaultVisible: true, width: 120, strong: true }),
  col("companyName", "Company Name", (r) => r.companyName, { defaultVisible: true, width: 200 }),
  col("clientName", "Client Name", (r) => r.clientName, { defaultVisible: true }),
  col("phoneNumber", "Phone Number", (r) => r.phoneNumber, { defaultVisible: true }),
  col("quotationNo", "Quotation No.", (r) => r.quotationNo, { defaultVisible: true, width: 120, strong: true }),
  col("piNumber", "PI Number", (r) => r.piNumber, { defaultVisible: true, width: 130, strong: true }),
  col("piAmount", "PI Amount", (r) => r.piAmount, { defaultVisible: true, width: 120 }),
  col("piUpload", "PI Copy", (r) => r.piUpload, { defaultVisible: true, cell: (r) => linkCell(r.piUpload, "View") }),
  col("piDate", "PI Date", (r) => formatDate(r.piDate), { defaultVisible: true, width: 120 }),
  col("piRemarks", "PI Remarks", (r) => r.piRemarks, { defaultVisible: true, wrap: true, width: 200 }),
  col("enquiryType", "Enquiry Type", (r) => r.enquiryType || "-", { wrap: true, width: 180 }),
  col("machineName", "Machine Name", (r) => r.machineName),
  col("totalAmount", "Total Amount", (r) => r.totalAmoutWithTex),
  col("quotationPdf", "Quotation Copy", (r) => r.quotationPdfLink, { cell: (r) => linkCell(r.quotationPdfLink, "Download") }),
  col("lastUpdatedBy", "Last Updated By", (r) => r.piUpdatedBy ?? "", { width: 160 }),
];

// History-tab rows (raw inbound_follow_up rows enriched with ticket details).
export const HISTORY_COLUMNS = [
  { key: "action", label: "Action", fixed: true, width: 120 },
  col("date", "Date", (r) => formatDate(r.timeStemp), { defaultVisible: true, strong: true }),
  col("ticketId", "Ticket-ID", (r) => r.ticketId, { defaultVisible: true, strong: true }),
  col("companyName", "Company Name", (r) => r.companyName, { defaultVisible: true, width: 200 }),
  col("clientName", "Client Name", (r) => r.clientName, { defaultVisible: true, }),
  col("phoneNumber", "Phone Number", (r) => r.phoneNumber, { defaultVisible: true }),
  col("quotationNo", "Quotation No.", (r) => r.quotationNo, { defaultVisible: true, strong: true }),
  col("quotationPdf", "Quotation Copy", (r) => r.quotationPdfLink, { defaultVisible: true,
    cell: (r) => linkCell(r.quotationPdfLink, "View"),
  }),
  col("enquiryType", "Enquiry Type", (r) => r.enquiryType || "-", { defaultVisible: true, wrap: true, width: 180 }),
  col("enquiryReceiverName", "Enquiry Receiver Name", (r) => r.enquiryReceiverName, { defaultVisible: true, width: 180 }),
  col("gstNo", "GST No.", (r) => r.gstNo, { defaultVisible: true }),
  col("lastCallDate", "Last Call Date", (r) => formatDate(r.timestamp), { defaultVisible: true }),
  col("customerSay", "Last Remarks", (r) => r.what_did_the_customer_say, { defaultVisible: true, wrap: true,
    width: 240,
  }),
  col("nextDate", "Next Call Date", (r) => formatDate(r.next_date_of_call), { defaultVisible: true }),
  col("nextAction", "Next Action", (r) => r.next_action, { defaultVisible: true, wrap: true, width: 200 }),
  col("sourceOfEnquiry", "Source of enquiry", (r) => r.sourceOfEnquiry),
  col("callType", "Call type", (r) => r.callType),
  col("clientType", "Client Type", (r) => r.clientType),
  col("siteAddress", "Site Address", (r) => r.siteAddress, { width: 200 }),
  col("machineName", "Machine Name", (r) => r.machineName),
  col("mentionIssue", "Mention Issue", (r) => r.mentionIssue, { wrap: true, width: 220 }),
  col("stage", "Stage", (r) => r.stage, { strong: true }),
  col("piNumber", "PI Number", (r) => r.pi_number),
  col("piAmount", "PI Amount", (r) => r.pi_amount),
  col("piUpload", "PI Copy", (r) => r.pi_upload, { cell: (r) => (r.pi_upload ? linkCell(r.pi_upload) : "") }),
  col("engineerAssign", "Engineer Assign", (r) => r.engineer_assign),
  col("clientApproval", "Client Approval", (r) => r["client-attachment"], {
    cell: (r) => (r["client-attachment"] ? linkCell(r["client-attachment"]) : ""),
  }),
  col("paymentTerm", "Payment Term", (r) => r.payment_term),
  col("acceptanceVia", "Acceptance Via", (r) => r.acceptance_via),
  col("paymentMode", "Payment Mode", (r) => r.payment_mode, { }),
  col("advancePayment", "Advance Payment", (r) => r.advance_payment_attachment, {
    cell: (r) => (r.advance_payment_attachment ? linkCell(r.advance_payment_attachment) : ""),
  }),
  col("seniorApproval", "Senior Approval", (r) => r.senior_approval, {
    cell: (r) => (r.senior_approval ? linkCell(r.senior_approval) : ""),
  }),
  col("seniorApprovedBy", "Senior Approved By", (r) => r.senior_approved_by),
  col("lastUpdatedBy", "Last Updated By", (r) => r.lastUpdatedBy ?? r.last_updated_by ?? "", { width: 160 }),
];

// Headers + rows for CSV: visible, non-fixed columns of the given rows.
export const toCsvTable = (visibleColumns, rows) => {
  const cols = visibleColumns.filter((c) => !c.fixed);
  return {
    headers: cols.map((c) => c.label),
    rows: rows.map((r) => cols.map((c) => c.text(r) ?? "")),
  };
};

// ── Combined config for useClientList / ListTable ─────────────────────────────
// Keys are prefixed with the tab so each tab keeps its own visible-column choice.
// Fixed columns get their cell here; the handlers arrive through ListTable's `ctx`.
const scoped = (cols, tab) => cols.map((c) => ({ ...c, key: tab + ":" + c.key, tabs: [tab] }));

const CELLS = {
  "pending:action": (r, { onFollowUp }) => (
    <div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onFollowUp(r)}
        data-testid={"button-followup-" + r.ticketId}
      >
        {r.legacyOrderRow ? "Order Details" : "Follow-Up"}
      </Button>
      {r.legacyOrderRow && (
        <p className="mt-1 whitespace-nowrap text-xs text-amber-700">Order details pending</p>
      )}
    </div>
  ),
  "proforma:action": (r, { onFollowUp }) => (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onFollowUp(r)}
      data-testid={"button-order-received-" + r.ticketId}
    >
      Order Received
    </Button>
  ),
  "history:action": (r, { onEditHistory }) =>
    r.stage === "Make PI" ? null : (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onEditHistory(r)}
      data-testid={"button-edit-history-" + r.id}
    >
      Edit
    </Button>
  ),
};

export const FOLLOW_UP_COLUMNS = [
  ...scoped(PENDING_COLUMNS, "pending"),
  ...scoped(PROFORMA_COLUMNS, "proforma"),
  ...scoped(HISTORY_COLUMNS, "history"),
].map((c) => (CELLS[c.key] ? { ...c, cell: CELLS[c.key] } : c));
