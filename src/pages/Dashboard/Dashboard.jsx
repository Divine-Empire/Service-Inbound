import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import StatusBadge from "../../components/shared/StatusBadge";
import { Loader2, PhoneCall, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase/client";
import { enquiryTypeList } from "../../lib/enquiryType";

// The Service-Inbound pipeline stages this dashboard covers. Each stage's own page implements the
// authoritative pending/history logic; this dashboard mirrors it rather than reinventing it, so keep
// the two in sync if a stage's rule changes.
const serviceStages = [
  { id: 1, name: "Machine Received", color: "bg-sky-500", route: "/machine-received" },
  { id: 2, name: "Quotation", color: "bg-cyan-500", route: "/quotation" },
  { id: 3, name: "Follow-Up", color: "bg-teal-500", route: "/followup" },
  { id: 4, name: "CRM Verification", color: "bg-emerald-500", route: "/crm-verification" },
  { id: 5, name: "Invoice", color: "bg-amber-500", route: "/invoice" },
  { id: 6, name: "Machine Handover", color: "bg-orange-500", route: "/machine-handover" },
  { id: 7, name: "Calibration", color: "bg-purple-500", route: "/calibration" },
];

// Fallback "who owns this stage" map for the PDF report, used only when
// tat_config.responsible_person (admin-editable via Master > TAT Config) hasn't been filled in yet
// for that stage.
const STAGE_RESPONSIBLE = {
  "Machine Received": "-",
  "Quotation": "PIYUSH TIWARI",
  "Follow-Up": "PIYUSH TIWARI",
  "CRM Verification": "-",
  "Invoice": "Accountant",
  "Machine Handover": "-",
  "Calibration": "-",
};

// Dashboard stage names -> tat_config stage_name values.
const TAT_CONFIG_STAGE_NAME = {
  "Machine Received": "Machine-Received",
  "Quotation": "Quotation",
  "Follow-Up": "Follow-Up",
  "CRM Verification": "CRM Verification",
  "Invoice": "Invoice",
  "Machine Handover": "Machine-Handover",
  "Calibration": "Calibration",
};

// Skeleton blocks live at module level so they keep a stable identity across renders.
const SkeletonCard = () => (
  <Card className="flex items-center gap-3 p-4">
    <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
    <div className="flex-1">
      <div className="mb-2 h-4 w-1/2 animate-pulse rounded bg-secondary" />
      <div className="h-6 w-1/4 animate-pulse rounded bg-secondary" />
    </div>
  </Card>
);

const SkeletonTable = () => (
  <Card className="p-6">
    <div className="mb-4 h-6 w-1/3 animate-pulse rounded bg-secondary" />
    <div className="h-64 animate-pulse rounded bg-secondary" />
  </Card>
);

function KpiCard({ icon: Icon, label, value }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [fetchLoading, setFetchLoading] = useState(false);
  const [allTicketsCount, setAllTicketsCount] = useState(0);
  const [quotationPendingCount, setQuotationPendingCount] = useState(0);
  const [crmPendingCount, setCrmPendingCount] = useState(0);
  const [invoicePendingCount, setInvoicePendingCount] = useState(0);
  const [stageCounts, setStageCounts] = useState({});
  const [stageOverdueCounts, setStageOverdueCounts] = useState({});
  const [followUpCategoryBreakdown, setFollowUpCategoryBreakdown] = useState({});
  // Detail rows for the PDF report's Follow-Up page. Collected once in fetchData so Generate Report
  // doesn't need its own re-fetch.
  const [followUpDetailRows, setFollowUpDetailRows] = useState([]);
  const [responsiblePersonByStage, setResponsiblePersonByStage] = useState({});
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const formatDate = (raw) => {
    if (!raw) return "-";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      const { data: ticketsRaw, error: ticketsError } = await supabase
        .from("inbound_tickets")
        .select("uuid, ticket_id, enquiry_type, company_name, site_address, machine_received_planned, current_stage, created_at");
      if (ticketsError) throw ticketsError;

      const tickets = ticketsRaw || [];
      setAllTicketsCount(tickets.length);

      const [
        { data: receivedRows, error: e1 },
        { data: quotationRows, error: e2 },
        { data: followUpRows, error: e3 },
        { data: crmRows, error: e4 },
        { data: invoiceRows, error: e5 },
        { data: handoverRows, error: e6 },
        { data: calibrationRows, error: e7 },
        { data: tatConfigRows, error: e8 },
      ] = await Promise.all([
        supabase.from("inbound_material_received").select("ticket_uuid, quotation_planned"),
        supabase.from("inbound_quotations").select("ticket_uuid, follow_up_planned, basic_amount"),
        supabase.from("inbound_follow_up").select("ticket_uuid, stage, payment_mode, crm_verification_planned, what_did_customer_say, next_date_of_call, created_at").order("created_at", { ascending: true }),
        supabase.from("inbound_crm_verification").select("ticket_uuid, invoice_planned"),
        supabase.from("inbound_invoice").select("ticket_uuid, machine_handover_planned, calibration_planned"),
        supabase.from("inbound_machine_handover").select("ticket_uuid"),
        supabase.from("inbound_calibration").select("ticket_uuid"),
        supabase.from("inbound_tat_config").select("stage_name, responsible_person"),
      ]);
      for (const err of [e1, e2, e3, e4, e5, e6, e7, e8]) if (err) throw err;

      // Admin-editable per-stage owner (Master > TAT Config) — falls back to STAGE_RESPONSIBLE when a
      // stage has no tat_config row, or responsible_person was never filled in.
      const responsiblePersonByTatStageName = new Map(
        (tatConfigRows || []).map((r) => [r.stage_name, r.responsible_person])
      );
      const responsibleMap = {};
      serviceStages.forEach((s) => {
        const tatStageName = TAT_CONFIG_STAGE_NAME[s.name];
        responsibleMap[s.name] =
          (tatStageName && responsiblePersonByTatStageName.get(tatStageName)) || STAGE_RESPONSIBLE[s.name] || "-";
      });
      setResponsiblePersonByStage(responsibleMap);

      const receivedByTicket = new Map((receivedRows || []).map((m) => [m.ticket_uuid, m]));
      const quotationByTicket = new Map((quotationRows || []).map((q) => [q.ticket_uuid, q]));
      const crmByTicket = new Map((crmRows || []).map((c) => [c.ticket_uuid, c]));
      const invoiceByTicket = new Map((invoiceRows || []).map((i) => [i.ticket_uuid, i]));
      const handoverTicketIds = new Set((handoverRows || []).map((h) => h.ticket_uuid));
      const calibrationTicketIds = new Set((calibrationRows || []).map((c) => c.ticket_uuid));

      // follow_up is append-only (several log rows per ticket): the LATEST row feeds the PDF detail
      // page; a ticket is "ordered" once an 'Order Received' row carries its payment_mode (the same
      // rule FollowUp.jsx uses to take a ticket out of Pending); crm_verification_planned sits on
      // that Order Received row.
      const latestFollowUpByTicket = new Map();
      const orderedTicketIds = new Set();
      const crmPlannedByTicket = new Map();
      (followUpRows || []).forEach((f) => {
        latestFollowUpByTicket.set(f.ticket_uuid, f);
        if (f.stage === "Order Received") {
          if (f.payment_mode) orderedTicketIds.add(f.ticket_uuid);
          if (f.crm_verification_planned) crmPlannedByTicket.set(f.ticket_uuid, f.crm_verification_planned);
        }
      });

      const now = new Date();
      const counts = {};
      const overdueCounts = {};
      serviceStages.forEach((s) => {
        counts[s.name] = 0;
        overdueCounts[s.name] = 0;
      });
      const bump = (stageName, planned) => {
        counts[stageName]++;
        if (new Date(planned) < now) overdueCounts[stageName]++;
      };
      const followUpCategories = {};
      const fuDetailRows = [];
      let zeroValueQuotations = 0;

      tickets.forEach((t) => {
        // Cancelled tickets leave every stage.
        if (t.current_stage === "Cancelled") return;
        const uuid = t.uuid;
        const mr = receivedByTicket.get(uuid);
        const q = quotationByTicket.get(uuid);
        const stillOpen = !orderedTicketIds.has(uuid);
        const enquiryTypes = enquiryTypeList(t.enquiry_type);
        const enquiryText = enquiryTypes.join(", ") || "-";

        // Machine Received — gated by tickets.machine_received_planned; pending = no row yet.
        if (t.machine_received_planned && !mr) bump("Machine Received", t.machine_received_planned);

        // Quotation — gated by material_received.quotation_planned; stays pending until the ticket's
        // follow-up shows an Order Received (same rule as Quotation.jsx).
        if (mr?.quotation_planned && stillOpen) {
          bump("Quotation", mr.quotation_planned);
          // Dashboard card: pending quotations whose basic_amount is 0 or blank.
          if (!Number(q?.basic_amount)) zeroValueQuotations++;
        }

        // Follow-Up — gated by quotation.follow_up_planned, same exit condition as Quotation (a ticket
        // can be pending at both at once — by design).
        if (q?.follow_up_planned && stillOpen) {
          bump("Follow-Up", q.follow_up_planned);
          const isOverdue = new Date(q.follow_up_planned) < now;
          (enquiryTypes.length ? enquiryTypes : ["Unspecified"]).forEach((cat) => {
            if (!followUpCategories[cat]) followUpCategories[cat] = { pending: 0, overdue: 0 };
            followUpCategories[cat].pending++;
            if (isOverdue) followUpCategories[cat].overdue++;
          });

          const latestFu = latestFollowUpByTicket.get(uuid);
          fuDetailRows.push({
            stage: "Follow-Up",
            date: formatDate(q.follow_up_planned || t.created_at),
            companyName: t.company_name || "-",
            category: enquiryText,
            siteAddress: t.site_address || "-",
            followUpStage: latestFu?.stage || "-",
            basicAmount: q.basic_amount ?? "-",
            whatDidCustomerSay: latestFu?.what_did_customer_say || "-",
            dateOfLastFollowUp: formatDate(latestFu?.next_date_of_call),
          });
        }

        // CRM Verification — gated by the Order Received row's crm_verification_planned.
        const crmPlanned = crmPlannedByTicket.get(uuid);
        if (crmPlanned && !crmByTicket.has(uuid)) bump("CRM Verification", crmPlanned);

        // Invoice — gated by crm_verification.invoice_planned; pending = no invoice row yet.
        const invoicePlanned = crmByTicket.get(uuid)?.invoice_planned;
        const inv = invoiceByTicket.get(uuid);
        if (invoicePlanned && !inv) bump("Invoice", invoicePlanned);

        // Machine Handover / Calibration — gated by the invoice row's planned columns.
        if (inv?.machine_handover_planned && !handoverTicketIds.has(uuid)) bump("Machine Handover", inv.machine_handover_planned);
        if (inv?.calibration_planned && !calibrationTicketIds.has(uuid)) bump("Calibration", inv.calibration_planned);
      });

      setQuotationPendingCount(zeroValueQuotations);
      setCrmPendingCount(counts["CRM Verification"]);
      setInvoicePendingCount(counts["Invoice"]);
      setStageCounts(counts);
      setStageOverdueCounts(overdueCounts);
      setFollowUpCategoryBreakdown(followUpCategories);
      setFollowUpDetailRows(fuDetailRows);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ReportDocument } = await import("./report-pdf");

      const summaryData = [];
      serviceStages.forEach((s) => {
        const pending = stageCounts[s.name] || 0;
        if (pending > 0) {
          summaryData.push({ stage: s.name, pending, responsible: responsiblePersonByStage[s.name] || STAGE_RESPONSIBLE[s.name] || "-" });
          if (s.name === "Follow-Up") {
            Object.entries(followUpCategoryBreakdown).forEach(([category, data]) => {
              if (data.pending > 0) {
                summaryData.push({ stage: `  - ${category}`, pending: data.pending, responsible: "" });
              }
            });
          }
        }
      });

      const detailedData = followUpDetailRows;
      const followUpCategoryCounts = Object.fromEntries(
        Object.entries(followUpCategoryBreakdown).map(([cat, data]) => [cat, data.pending])
      );

      const blob = await pdf(
        <ReportDocument
          summaryData={summaryData}
          detailedData={detailedData}
          followUpCategoryBreakdown={followUpCategoryCounts}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Service_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to generate report");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonTable />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard icon={PhoneCall} label="Enquiries" value={allTicketsCount} />
        <KpiCard icon={FileText} label="Quotations" value={quotationPendingCount} />
        <KpiCard icon={FileText} label="CRM Verifications" value={crmPendingCount} />
        <KpiCard icon={FileText} label="Invoices" value={invoicePendingCount} />
      </div>

      {/* Pending Items by Stage */}
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 p-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold">Pending Items by Stage</CardTitle>
          <Button
            className="h-9 gap-2 text-xs font-medium"
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
          >
            {isGeneratingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {isGeneratingReport ? "Generating..." : "Generate Report"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Stage</TableHead>
                <TableHead className="w-[90px] text-right text-xs">Pending</TableHead>
                <TableHead className="w-[110px] text-right text-xs">Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceStages.map((stage) => {
                const dynamicCount = stageCounts[stage.name] || 0;
                const overdueCount = stageOverdueCounts[stage.name] || 0;

                const rowsToRender = [];

                rowsToRender.push(
                  <TableRow
                    key={stage.id}
                    className="cursor-pointer"
                    onClick={() => navigate(stage.route)}
                  >
                    <TableCell className="text-sm font-medium">
                      <Link
                        to={stage.route}
                        className="flex items-center gap-2 font-semibold text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stage.color}`} aria-hidden="true" />
                        {stage.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{dynamicCount}</TableCell>
                    <TableCell className="text-right">
                      {overdueCount > 0 ? <StatusBadge tone="danger">{overdueCount}</StatusBadge> : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  </TableRow>
                );

                if (stage.name === "Follow-Up" && Object.keys(followUpCategoryBreakdown).length > 0) {
                  Object.entries(followUpCategoryBreakdown).forEach(([category, data]) => {
                    rowsToRender.push(
                      <TableRow key={`followup-${category}`} className="bg-secondary/40">
                        <TableCell className="pl-8 text-xs text-muted-foreground">
                          ↳ {category}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {data.pending}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {data.overdue > 0 ? data.overdue : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  });
                }

                return rowsToRender;
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
