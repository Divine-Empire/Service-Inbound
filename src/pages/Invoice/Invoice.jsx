import { useState, useEffect, useMemo } from "react";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { MultiSelect } from "../../components/ui/multi-select";
import { useToast } from "../../hooks/use-toast";
import { ListToolbar, ListTable } from "../../components/shared";
import FilterDialog, { FilterSection } from "../../components/shared/FilterDialog";
import { useClientList } from "../../hooks/useClientList";
import { supabase } from "../../lib/supabase/client";
import { fetchDropdownRows } from "../../lib/supabase/dropdown";
import { COLUMNS } from "./columns";
import { enquiryTypeText, enquiryTypeList } from "../../lib/enquiryType";
import InvoiceForm from "./InvoiceForm";
import EditInvoiceModal from "./EditInvoiceModal";
import AdvanceDetailsModal from "./AdvanceDetailsModal";

export default function Invoice() {
  const [invoiceTicket, setInvoiceTicket] = useState(null);
  // History-tab-only filters. invoice_date is a plain `date` column (YYYY-MM-DD), so string
  // comparison is inclusive on both ends and timezone-safe.
  const [invoiceDateFrom, setInvoiceDateFrom] = useState("");
  const [invoiceDateTo, setInvoiceDateTo] = useState("");
  const [enquiryTypeFilter, setEnquiryTypeFilter] = useState([]);
  const { toast } = useToast();

  const [masterData, setMasterData] = useState({});

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  // "Advance Details" eye icon on the Pending tab.
  const [advanceDetailsTicket, setAdvanceDetailsTicket] = useState(null);
  // History tab's "Edit" action.
  const [editingHistoryRow, setEditingHistoryRow] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Tickets ready for Invoice: inbound_crm_verification.invoice_planned set (FOC orders get none).
      const { data: crmPlannedRows, error: crmPlannedError } = await supabase
        .from("inbound_crm_verification")
        .select("ticket_uuid")
        .not("invoice_planned", "is", null);

      if (crmPlannedError) throw crmPlannedError;

      const ticketUuids = [...new Set((crmPlannedRows || []).map((o) => o.ticket_uuid))];

      if (ticketUuids.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("inbound_tickets")
        .select("*")
        .in("uuid", ticketUuids)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      // Quotation No./PDF are display-only here - joined from their owning stage.
      const { data: quotationRows, error: quotationError } = await supabase
        .from("inbound_quotations")
        .select("ticket_uuid, quotation_no, quotation_pdf_link")
        .in("ticket_uuid", ticketUuids);

      if (quotationError) throw quotationError;

      const quotationByTicket = new Map((quotationRows || []).map((q) => [q.ticket_uuid, q]));

      // The follow-up 'Order Received' row carries the order details (Payment Term/Mode, Senior
      // Approval, Advance Payment) and the Client Approval attachment.
      const { data: orderRows, error: orderRowsError } = await supabase
        .from("inbound_follow_up")
        .select("ticket_uuid, client_attachment_url, payment_term, payment_mode, senior_approval, advance_payment_attachment, created_at")
        .in("ticket_uuid", ticketUuids)
        .eq("stage", "Order Received")
        .order("created_at", { ascending: false });

      if (orderRowsError) throw orderRowsError;

      const orderRowByTicket = new Map();
      (orderRows || []).forEach((f) => {
        if (!orderRowByTicket.has(f.ticket_uuid)) orderRowByTicket.set(f.ticket_uuid, f);
      });

      const { data: invoiceRows, error: invoiceError } = await supabase
        .from("inbound_invoice")
        .select("*")
        .in("ticket_uuid", ticketUuids);

      if (invoiceError) throw invoiceError;

      const invoiceByTicket = new Map((invoiceRows || []).map((i) => [i.ticket_uuid, i]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const q = quotationByTicket.get(t.uuid);
        const orderReceived = orderRowByTicket.get(t.uuid);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          companyName: t.company_name || "",
          siteAddress: t.site_address || "",
          gstNo: t.gst_no || "",
          gstAddress: t.gst_address || "",
          // enquiryTypes (array) decides calibration_planned at submit time - see stagePlanning.js.
          enquiryType: enquiryTypeText(t.enquiry_type),
          enquiryTypes: enquiryTypeList(t.enquiry_type),
          quotationNo: q?.quotation_no || "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          paymentTerm: orderReceived?.payment_term || "",
          paymentMode: orderReceived?.payment_mode || "",
          seniorApproval: orderReceived?.senior_approval || "",
          advancePaymentAttachment: orderReceived?.advance_payment_attachment || "",
          clientApproval: orderReceived?.client_attachment_url || "",
        };

        const inv = invoiceByTicket.get(t.uuid);
        if (inv) {
          history.push({
            ...base,
            invoicePostedBy: inv.invoice_posted_by || "",
            invoiceDate: inv.invoice_date || "",
            invoiceNoSERVICE: inv.invoice_no_service || "",
            invoiceNoSPARE: inv.invoice_no_spare || "",
            serviceAmountBasic: inv.service_amount_basic,
            serviceAmountGst: inv.service_amount_gst,
            spareAmountBasic: inv.spare_amount_basic,
            spareAmountGst: inv.spare_amount_gst,
            attachmentService: inv.attachment_service || "",
            attachmentSpare: inv.attachment_spare || "",
            delayMinutes: inv.delay_minutes,
            // This invoice row's own creation moment - the base time calibration_planned adds TAT to,
            // so editing Enquiry Type later recomputes it from the same base, not "now".
            invoiceCreatedAt: inv.created_at || null,
          });
        } else {
          pending.push(base);
        }
      });

      setPendingData(pending);
      setHistoryData(history);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  };

  const DROPDOWN_CATEGORY_TO_KEY = {
    invoice_posted_by: "Invoice Posted By",
    // Same category as the Tickets form's Enquiry Type - offered in the History tab's Edit modal.
    inbound_enquiry_type: "Enquiry Type",
  };

  const fetchMasterSheet = async () => {
    try {
      const data = await fetchDropdownRows(Object.keys(DROPDOWN_CATEGORY_TO_KEY));

      const structuredData = {};
      (data || []).forEach(({ category, value }) => {
        const key = DROPDOWN_CATEGORY_TO_KEY[category];
        if (!key) return;
        if (!structuredData[key]) structuredData[key] = [];
        structuredData[key].push(value);
      });

      setMasterData([structuredData]);
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({
        title: "Error",
        description: "Failed to load master data",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchMasterSheet();
    fetchData();
  }, []);

  const handleInvoiceClick = (ticket) => setInvoiceTicket(ticket);
  const handleEditClick = (ticket) => setEditingHistoryRow(ticket);

  // History-only filters (invoice date range, enquiry type) narrow the data before the list
  // hook sees it, so tab counts, search and paging all follow them.
  const historyEnquiryTypeOptions = [
    ...new Set(historyData.flatMap((i) => i.enquiryTypes || [])),
  ].sort((a, b) => a.localeCompare(b));

  const filteredHistory = useMemo(
    () =>
      historyData.filter((item) => {
        const d = String(item.invoiceDate || "").slice(0, 10);
        if (invoiceDateFrom && (!d || d < invoiceDateFrom)) return false;
        if (invoiceDateTo && (!d || d > invoiceDateTo)) return false;
        if (enquiryTypeFilter.length > 0 && !enquiryTypeFilter.some((t) => (item.enquiryTypes || []).includes(t))) return false;
        return true;
      }),
    [historyData, invoiceDateFrom, invoiceDateTo, enquiryTypeFilter]
  );

  const activeFilterCount =
    (invoiceDateFrom ? 1 : 0) + (invoiceDateTo ? 1 : 0) + (enquiryTypeFilter.length > 0 ? 1 : 0);
  const clearHistoryFilters = () => {
    setInvoiceDateFrom("");
    setInvoiceDateTo("");
    setEnquiryTypeFilter([]);
  };

  const list = useClientList({
    key: "invoice",
    data: { pending: pendingData, history: filteredHistory },
    loading: fetchLoading,
    searchKeys: ["ticketId", "clientName", "companyName", "quotationNo", "phoneNumber"],
    columns: COLUMNS,
  });

  return (
    <div className="space-y-3">
      <ListToolbar
        list={list}
        searchPlaceholder="Search by ticket ID, client, company, phone or quotation no..."
        extraFilters={
          list.tab === "history" && (
            <FilterDialog activeCount={activeFilterCount} onClear={clearHistoryFilters}>
              <FilterSection title="Invoice date">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="invoice-date-from" className="text-xs text-muted-foreground">From</Label>
                    <Input id="invoice-date-from" type="date" value={invoiceDateFrom} onChange={(e) => setInvoiceDateFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="invoice-date-to" className="text-xs text-muted-foreground">To</Label>
                    <Input id="invoice-date-to" type="date" value={invoiceDateTo} onChange={(e) => setInvoiceDateTo(e.target.value)} />
                  </div>
                </div>
              </FilterSection>
              <FilterSection title="Enquiry type">
                <MultiSelect options={historyEnquiryTypeOptions} value={enquiryTypeFilter} onChange={setEnquiryTypeFilter} placeholder="All" />
              </FilterSection>
            </FilterDialog>
          )
        }
      />
      <ListTable
        list={list}
        ctx={{ onInvoice: handleInvoiceClick, onEdit: handleEditClick, onAdvance: setAdvanceDetailsTicket }}
        rowKey={(r, tab) => (tab === "history" ? "h-" + r.ticketUuid : "p-" + r.ticketId)}
        cardTitle={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending invoices found.", history: "No invoice history found." }}
        ariaLabel="Invoices"
      />

      {invoiceTicket && (
        <InvoiceForm
          key={invoiceTicket.ticketId}
          ticket={invoiceTicket}
          masterData={masterData}
          onClose={() => setInvoiceTicket(null)}
          onSaved={fetchData}
          onCancelled={(ticketId) => setPendingData((prev) => prev.filter((t) => t.ticketId !== ticketId))}
        />
      )}
      {editingHistoryRow && (
        <EditInvoiceModal
          key={editingHistoryRow.ticketUuid}
          row={editingHistoryRow}
          masterData={masterData}
          onClose={() => setEditingHistoryRow(null)}
          onSaved={fetchData}
        />
      )}
      {advanceDetailsTicket && (
        <AdvanceDetailsModal ticket={advanceDetailsTicket} onClose={() => setAdvanceDetailsTicket(null)} />
      )}
    </div>
  );
}
