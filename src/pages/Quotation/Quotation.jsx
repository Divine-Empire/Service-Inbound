import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { useToast } from "../../hooks/use-toast";
import MakeQuotation from "./MakeQuotation";
import { supabase } from "../../lib/supabase/client";
import { fetchDropdownRows } from "../../lib/supabase/dropdown";
import { ListToolbar, ListTable } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import useAuth from "../../hooks/useAuth";
import { COLUMNS, COLUMNS_NON_ADMIN } from "./columns";
import QuotationFormModal from "./QuotationFormModal";
import { enquiryTypeText } from "../../lib/enquiryType";

export default function Quotation() {
  const [masterData, setMasterData] = useState({});
  // The Create / Revise form: null = closed, { ticket, historyEdit } = open.
  const [quotationForm, setQuotationForm] = useState(null);

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showMakeQuotationModal, setShowMakeQuotationModal] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for Quotation (inbound_material_received.quotation_planned set — i.e. the
      // machine was received).
      const { data: receivedRows, error: receivedError } = await supabase
        .from("inbound_material_received")
        .select("ticket_uuid, quotation_planned")
        .not("quotation_planned", "is", null);

      if (receivedError) throw receivedError;

      const ticketUuids = (receivedRows || []).map((r) => r.ticket_uuid);

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

      const { data: quotationRows, error: quotationError } = await supabase
        .from("inbound_quotations")
        .select("*")
        .in("ticket_uuid", ticketUuids);

      if (quotationError) throw quotationError;

      const quotationByTicket = new Map(
        (quotationRows || []).map((q) => [q.ticket_uuid, q])
      );

      // Pending and History are two independent views over the same gated set, not a partition:
      // pending = every gated ticket (revising a quotation never removes it); history = the subset
      // that's been quoted at least once. (There is no Follow-Up stage on inbound tickets yet, so
      // nothing closes a ticket out of Pending.)
      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const q = quotationByTicket.get(t.uuid);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          enquiryType: enquiryTypeText(t.enquiry_type),
          sourceOfEnquiry: t.source_of_enquiry || "",
          callType: t.call_type || "",
          enquiryReceiverName: t.enquiry_receiver_name || "",
          clientType: t.client_type || "",
          companyName: t.company_name || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          siteAddress: t.site_address || "",
          gstNo: t.gst_no || "",
          machineName: t.machine_name || "",
          mentionIssue: t.mention_issue || "",
          hasQuotation: !!q,
          quotationNo: q?.quotation_no || "",
          basicAmount: q?.basic_amount ?? "",
          totalQutation: q?.total_amount ?? "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          quotationShareBy: q?.quotation_share_by || "",
          shareThrough: q?.share_through || "",
          remarks: q?.remarks || "",
          delayMinutes: q?.delay_minutes,
        };

        pending.push(base);
        if (q) history.push(base);
      });

      setPendingData(pending);
      setHistoryData(history);
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

  const DROPDOWN_CATEGORY_TO_KEY = {
    quotation_share_by: "Quotation Share by",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // isHistoryEdit: opened from the History tab's admin-only "Edit" action, which lets a later
  // inbound_make_quotations revision be pulled in for a ticket already past this stage. "Cancel Ticket" is
  // hidden in that mode (see migration 0063 for the current_stage-regression fix this relies on).
  const handleQuotationClick = (ticket, { isHistoryEdit = false } = {}) =>
    setQuotationForm({ ticket, historyEdit: isHistoryEdit });

  const list = useClientList({
    key: "quotation",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber", "quotationNo"],
    filters: [
      // Quotation Copy = the "Quotation PDF" column; "Not Uploaded" = that cell is blank.
      { key: "quotationCopy", label: "Quotation Copy", allLabel: "All Quotation Copy", get: (r) => (String(r.quotationPdfLink || "").trim() ? "Uploaded" : "Not Uploaded") },
      { key: "shareBy", label: "Share By", allLabel: "All Share By", get: (r) => r.quotationShareBy, tabs: ["history"] },
    ],
    columns: isAdmin ? COLUMNS : COLUMNS_NON_ADMIN,
  });

  return (
    <div className="space-y-3">
      <ListToolbar
        list={list}
        searchPlaceholder="Search by ticket ID, client, company, phone or quotation no..."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowMakeQuotationModal(true);
            }}
          >
            Make Quotation
          </Button>
        }
      />
      <ListTable
        list={list}
        ctx={{
          onQuote: (t) => handleQuotationClick(t),
          onEdit: (t) => handleQuotationClick(t, { isHistoryEdit: true }),
        }}
        rowKey={(r) => r.ticketId}
        cardTitle={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending quotations found.", history: "No quotation history found." }}
        ariaLabel="Quotations"
      />

      {quotationForm && (
        <QuotationFormModal
          key={quotationForm.ticket.ticketId}
          ticket={quotationForm.ticket}
          historyEdit={quotationForm.historyEdit}
          masterData={masterData}
          onClose={() => setQuotationForm(null)}
          onSaved={fetchData}
          onCancelled={(ticketId) => setPendingData((prev) => prev.filter((t) => t.ticketId !== ticketId))}
        />
      )}

      <Modal
        isOpen={showMakeQuotationModal}
        onClose={() => setShowMakeQuotationModal(false)}
        title="Make Quotation"
        size="6xl"
      >
        <MakeQuotation ticket={null} />
      </Modal>

    </div>
  );
}
