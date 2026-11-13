import { useState, useEffect } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { ListToolbar, ListTable, StatusBadge } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { useToast } from "../../hooks/use-toast";
import useAuth from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase/client";
import { computeStagePlanned } from "../../lib/supabase/stagePlanning";
import { machineText } from "../../lib/machines";
import { enquiryTypeText } from "../../lib/enquiryType";

// CRM Verification (Service-Inbound) — the stage after Follow-Up "Order Received".
//   Pending: inbound_follow_up Order Received row with crm_verification_planned set and no
//            inbound_crm_verification row for the ticket yet.
//   History: an inbound_crm_verification row exists.
// Submitting generates invoice_planned (Invoice TAT), except for FOC orders (payment_mode = 'FOC').

// Not the lib/format versions: these keep an unparseable value as-is and omit seconds.
const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${formatDate(value)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fileLink = (url) =>
  url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
    >
      View
    </a>
  ) : (
    <span className="text-muted-foreground">-</span>
  );

const COLUMNS = [
  { key: "select", label: "Select", fixed: true, tabs: ["pending"], cell: (r, { selectedIds, onToggle }) => (
    <input
      type="checkbox"
      checked={selectedIds.includes(r.ticketId)}
      onChange={() => onToggle(r.ticketId)}
      aria-label={`Select ${r.ticketId}`}
      className="h-4 w-4"
      data-testid={`checkbox-crm-${r.ticketId}`}
    />
  ) },
  { key: "date", label: "Date", defaultVisible: true, strong: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 180, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "quotationNo", label: "Quotation No.", defaultVisible: true, text: (r) => r.quotationNo },
  { key: "quotationCopy", label: "Quotation Copy", defaultVisible: true, cell: (r) => fileLink(r.quotationPdfLink) },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: true, wrap: true, width: 180, text: (r) => r.enquiryType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: true, text: (r) => r.enquiryReceiverName },
  { key: "gstNo", label: "GST No.", defaultVisible: true, text: (r) => r.gstNo },
  { key: "machineName", label: "Machine Name", defaultVisible: false, wrap: true, width: 160, text: (r) => r.machineName },
  { key: "paymentMode", label: "Payment Mode", defaultVisible: false, text: (r) => r.paymentMode },
  { key: "clientApproval", label: "Client Approval", defaultVisible: false, cell: (r) => fileLink(r.clientApproval) },
  { key: "seniorApproval", label: "Senior Approval", defaultVisible: false, cell: (r) => fileLink(r.seniorApproval) },
  { key: "advancePayment", label: "Advance Payment", defaultVisible: false, cell: (r) => fileLink(r.advancePayment) },
  { key: "planned", label: "Planned", defaultVisible: false, tabs: ["pending"], text: (r) => formatDateTime(r.planned) },
  { key: "verifiedBy", label: "Verified By", defaultVisible: false, tabs: ["history"], text: (r) => r.verifiedBy },
  { key: "verifiedAt", label: "Verified On", defaultVisible: false, tabs: ["history"], text: (r) => formatDateTime(r.verifiedAt) },
  { key: "invoicePlanned", label: "Invoice Planned", defaultVisible: false, tabs: ["history"], cell: (r) =>
    r.invoicePlanned ? formatDateTime(r.invoicePlanned) : <StatusBadge tone="warning">No invoice (FOC)</StatusBadge> },
];

export default function CrmVerification() {
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { userName } = useAuth();

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      const { data: orderRows, error: orderError } = await supabase
        .from("inbound_follow_up")
        .select("*")
        .eq("stage", "Order Received")
        .not("crm_verification_planned", "is", null)
        .order("crm_verification_planned", { ascending: true });

      if (orderError) throw orderError;

      const ticketUuids = (orderRows || []).map((o) => o.ticket_uuid);
      if (ticketUuids.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        setSelectedIds([]);
        return;
      }

      const [
        { data: ticketsData, error: ticketsError },
        { data: crmRows, error: crmError },
        { data: quotationRows, error: quotationError },
      ] = await Promise.all([
        supabase
          .from("inbound_tickets")
          .select("ticket_id, uuid, created_at, client_name, company_name, phone_number, machine_name, enquiry_type, enquiry_receiver_name, gst_no")
          .in("uuid", ticketUuids),
        supabase.from("inbound_crm_verification").select("*").in("ticket_uuid", ticketUuids),
        supabase.from("inbound_quotations").select("ticket_uuid, quotation_no, quotation_pdf_link").in("ticket_uuid", ticketUuids),
      ]);

      if (ticketsError) throw ticketsError;
      if (crmError) throw crmError;
      if (quotationError) throw quotationError;

      const ticketByUuid = new Map((ticketsData || []).map((t) => [t.uuid, t]));
      const crmByUuid = new Map((crmRows || []).map((c) => [c.ticket_uuid, c]));
      const quotationByUuid = new Map((quotationRows || []).map((q) => [q.ticket_uuid, q]));

      const pending = [];
      const history = [];

      (orderRows || []).forEach((o) => {
        const t = ticketByUuid.get(o.ticket_uuid) || {};
        const row = {
          ticketId: o.ticket_id,
          ticketUuid: o.ticket_uuid,
          clientName: t.client_name || "",
          companyName: t.company_name || "",
          phoneNumber: t.phone_number || "",
          machineName: machineText(t.machine_name),
          timeStemp: t.created_at || "",
          enquiryType: enquiryTypeText(t.enquiry_type),
          enquiryReceiverName: t.enquiry_receiver_name || "",
          gstNo: t.gst_no || "",
          quotationNo: quotationByUuid.get(o.ticket_uuid)?.quotation_no || "",
          quotationPdfLink: quotationByUuid.get(o.ticket_uuid)?.quotation_pdf_link || "",
          clientApproval: o.client_attachment_url || "",
          seniorApproval: o.senior_approval || "",
          advancePayment: o.advance_payment_attachment || "",
          planned: o.crm_verification_planned,
          paymentMode: o.payment_mode || "",
        };

        const crm = crmByUuid.get(o.ticket_uuid);
        if (crm) {
          history.push({
            ...row,
            verifiedBy: crm.verified_by || "",
            verifiedAt: crm.created_at,
            invoicePlanned: crm.invoice_planned,
            delayMinutes: crm.delay_minutes,
          });
        } else {
          pending.push(row);
        }
      });

      setPendingData(pending);
      setHistoryData(history.reverse());
      setSelectedIds([]);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoadError(error.message || "Failed to load data");
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useClientList({
    key: "crm-verification",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber", "quotationNo"],
    filters: [
      { key: "payment", label: "Payment Mode", allLabel: "All Payment Modes", get: (r) => r.paymentMode },
    ],
    columns: COLUMNS,
    sort: "none", // pending: oldest planned first; history is already reversed above
  });

  // Select-all covers every pending row matching the search/filters, across pages.
  const selectableIds = list.tab === "pending" ? list.allFiltered.map((p) => p.ticketId) : [];
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  const toggleSelected = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () => setSelectedIds(allSelected ? [] : selectableIds);

  // The Select column header carries the select-all checkbox.
  const tableList = {
    ...list,
    activeColumns: list.activeColumns.map((c) =>
      c.key === "select"
        ? {
            ...c,
            label: (
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all pending tickets"
                className="h-4 w-4"
                data-testid="checkbox-crm-all"
              />
            ),
          }
        : c
    ),
  };

  const handleSubmit = async () => {
    const rows = pendingData.filter((p) => selectedIds.includes(p.ticketId));
    if (rows.length === 0) return;

    setIsSubmitting(true);
    try {
      const invoicePlanned = await computeStagePlanned("invoice", {
        orderReceivedSubmittedAt: new Date(),
      });
      const verifiedBy = userName || localStorage.getItem("currentUsername") || null;

      const { error } = await supabase.from("inbound_crm_verification").insert(
        rows.map((r) => ({
          ticket_id: r.ticketId,
          ticket_uuid: r.ticketUuid,
          verified_by: verifiedBy,
          // FOC orders end at CRM Verification — no invoice.
          invoice_planned: r.paymentMode === "FOC" ? null : invoicePlanned,
        }))
      );

      if (error) throw error;

      toast({
        title: "Success",
        description: `${rows.length} ticket(s) verified`,
      });
      setShowConfirm(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting CRM verification:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit CRM verification",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <ListToolbar
        list={list}
        searchPlaceholder="Search by ticket ID, client, company, phone or quotation no..."
        actions={
          list.tab === "pending" && (
            <Button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={selectedIds.length === 0 || isSubmitting}
              data-testid="button-submit-crm"
            >
              Submit ({selectedIds.length})
            </Button>
          )
        }
      />
      <ListTable
        list={tableList}
        ctx={{ selectedIds, onToggle: toggleSelected }}
        rowKey={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending CRM verifications.", history: "No CRM verification history found." }}
        ariaLabel="CRM verification"
      />

      <Modal
        isOpen={showConfirm}
        onClose={() => !isSubmitting && setShowConfirm(false)}
        title="Confirm CRM Verification"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-foreground">
            Verify <span className="font-semibold">{selectedIds.length}</span> ticket(s)? This moves
            them to History and generates their Invoice planned date (FOC orders get no invoice).
          </p>
          <p className="break-words text-sm text-muted-foreground">{selectedIds.join(", ")}</p>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              data-testid="button-confirm-crm"
            >
              {isSubmitting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
