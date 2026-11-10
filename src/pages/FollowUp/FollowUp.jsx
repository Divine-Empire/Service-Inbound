import { useState, useEffect } from "react";
import { MultiSelect } from "../../components/ui/multi-select";
import { Button } from "../../components/ui/button";
import { useToast } from "../../hooks/use-toast";
import { Download } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { fetchDropdownRows } from "../../lib/supabase/dropdown";
import { exportCsv } from "../../lib/exportCsv";
import { ColumnSelector } from "../../components/shared/ColumnSelector";
import StatusTabs from "../../components/shared/StatusTabs";
import { FilterSearch } from "../../components/shared/FilterBar";
import ListTable from "../../components/shared/ListTable";
import { useClientList } from "../../hooks/useClientList";
import useAuth from "../../hooks/useAuth";
import { useSessionState } from "../../hooks/useSessionState";
import FilterDialog, { FilterSection } from "../../components/shared/FilterDialog";
import { FOLLOW_UP_COLUMNS, toCsvTable } from "./columns";
import FollowUpFormModal from "./FollowUpFormModal";
import EditHistoryModal from "./EditHistoryModal";
import { enquiryTypeText } from "../../lib/enquiryType";

// Order Received form dropdown categories.
const DROPDOWN_CATEGORY_TO_KEY = {
  payment_term: "Payment Terms",
  payment_mode: "Payment Mode",
  acceptance_via: "Acceptance Via",
  senior_approved_by: "Senior Approved By",
};

export default function FollowUp() {
  // Filters / search are remembered for the browser tab (per user), so re-fetching after a
  // submit — or a refresh — keeps them. See hooks/useSessionState.js.
  const [dateFilterTab, setDateFilterTab] = useSessionState("followup", "dateChip", "");
  // Independent of the Today/Overdue/Pending chips (combined with them via
  // AND): keeps only rows whose last call was logged today.
  const [lastCallTodayOnly, setLastCallTodayOnly] = useSessionState("followup", "lastCallToday", false);

  // The Follow-Up form (a pending ticket) and the History edit modal (a follow-up row): null = closed.
  const [followUpTicket, setFollowUpTicket] = useState(null);
  const [editHistoryRow, setEditHistoryRow] = useState(null);
  const [followUpData, setFollowUpData] = useState([]);
  const [searchItem, setSearchItem] = useSessionState("followup", "pageSearch", "");
  // "Last Updated By" filters are per tab (Pending / History each list their own names).
  const [pendingUpdatedBy, setPendingUpdatedBy] = useSessionState("followup", "pendingUpdatedBy", [], Array.isArray);
  const [historyUpdatedBy, setHistoryUpdatedBy] = useSessionState("followup", "historyUpdatedBy", [], Array.isArray);
  // Full name stamped into inbound_follow_up.last_updated_by on every write.
  const { userName } = useAuth();
  const updatedByName = userName || localStorage.getItem("currentUsername") || null;

  const { toast } = useToast();
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [masterData, setMasterData] = useState({});

  const [ticketsMap, setTicketsMap] = useState({});
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for Follow-Up (inbound_quotations.follow_up_planned set).
      const { data: quotationRows, error: quotationError } = await supabase
        .from("inbound_quotations")
        .select("ticket_uuid, follow_up_planned, quotation_no, basic_amount, total_amount, quotation_pdf_link, quotation_share_by, share_through, remarks")
        .not("follow_up_planned", "is", null);

      if (quotationError) throw quotationError;

      const ticketUuids = (quotationRows || []).map((q) => q.ticket_uuid);

      if (ticketUuids.length === 0) {
        setPendingData([]);
        setFollowUpData([]);
        setTicketsMap({});
        return;
      }

      const quotationByTicket = new Map((quotationRows || []).map((q) => [q.ticket_uuid, q]));

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("inbound_tickets")
        .select("*")
        .in("uuid", ticketUuids)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      // Every submission is a permanent log row (append-only, multiple rows per ticket allowed).
      const { data: followUpRows, error: followUpError } = await supabase
        .from("inbound_follow_up")
        .select("*")
        .in("ticket_uuid", ticketUuids)
        .order("created_at", { ascending: true });

      if (followUpError) throw followUpError;

      // Machine Received outcome per ticket: 'quotation_shared' means the machine has not arrived
      // yet (Quotation Shared tab there), so the Order Received stage stays blocked here.
      const { data: receivedRows, error: receivedError } = await supabase
        .from("inbound_material_received")
        .select("ticket_uuid, machine_received")
        .in("ticket_uuid", ticketUuids);

      if (receivedError) throw receivedError;

      const machineReceivedByTicket = new Map((receivedRows || []).map((m) => [m.ticket_uuid, m.machine_received]));

      // A ticket leaves pending once its 'Order Received' row carries the order details (payment_mode).
      const orderReceivedRowByTicket = new Map();
      (followUpRows || []).forEach((f) => {
        if (f.stage === "Order Received") orderReceivedRowByTicket.set(f.ticket_uuid, f);
      });

      // Latest follow_up log per ticket (rows are fetched created_at ascending, so the last one wins).
      const latestFollowUpByTicket = new Map();
      (followUpRows || []).forEach((f) => {
        latestFollowUpByTicket.set(f.ticket_uuid, f);
      });

      const ticketsMapObj = {};
      const pending = [];
      
      (ticketsData || []).forEach((t) => {
        const q = quotationByTicket.get(t.uuid);
        const latestFollowUp = latestFollowUpByTicket.get(t.uuid);
        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          sourceOfEnquiry: t.source_of_enquiry || "",
          enquiryType: enquiryTypeText(t.enquiry_type),
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
          engineerAssign: t.engineer_assign || "",
          orderBlocked: machineReceivedByTicket.get(t.uuid) === "quotation_shared",
          quotationNo: q?.quotation_no || "",
          basicAmount: q?.basic_amount ?? "",
          totalAmoutWithTex: q?.total_amount ?? "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          quotationShareByPersonName: q?.quotation_share_by || "",
          ShareThrough: q?.share_through || "",
          quotationremarks: q?.remarks || "",
          // Pending tab's "Last Call Date / Last Remarks / Next Call Date /
          // Next Action" — sourced from this ticket's own latest follow_up
          // log row (if any), not from the quotation.
          lastCallDate: latestFollowUp?.created_at || "",
          lastRemarks: latestFollowUp?.what_did_customer_say || "",
          lastUpdatedBy: latestFollowUp?.last_updated_by || "",
          nextCallDate: latestFollowUp?.next_date_of_call || "",
          nextAction: latestFollowUp?.next_action || "",
        };

        ticketsMapObj[t.ticket_id] = base;

        const orderRow = orderReceivedRowByTicket.get(t.uuid);
        if (!orderRow) {
          pending.push(base);
        } else if (!orderRow.payment_mode) {
          pending.push({
            ...base,
            legacyOrderRow: orderRow,
            clientAttachment: orderRow.client_attachment_url || "",
          });
        }
      });

      setTicketsMap(ticketsMapObj);
      setPendingData(pending);
      setFollowUpData(followUpRows || []);
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

  const fetchMasterData = async () => {
    try {
      const rows = await fetchDropdownRows(Object.keys(DROPDOWN_CATEGORY_TO_KEY));
      const structured = {};
      (rows || []).forEach(({ category, value }) => {
        const key = DROPDOWN_CATEGORY_TO_KEY[category];
        if (!key || !value) return;
        if (!structured[key]) structured[key] = [];
        structured[key].push(value);
      });
      setMasterData(structured);
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({
        title: "Error",
        description: "Failed to load dropdown options",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchData();
    fetchMasterData();
  }, []);

  const handleFollowUpClick = (ticket) => setFollowUpTicket(ticket);
  const handleEditHistoryAttachmentClick = (row) => setEditHistoryRow(row);

  const filteredPendingData = pendingData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.quotationNo || "").toLowerCase().includes(q);


      const matchesUpdatedBy =
        pendingUpdatedBy.length === 0 || pendingUpdatedBy.includes(String(item.lastUpdatedBy ?? item.last_updated_by ?? "").trim());

      return matchesSearch && matchesUpdatedBy;
    })
    .reverse();

  const enrichedFollowUpData = followUpData.map((item) => {
    const ticketDetails = ticketsMap[item.ticket_id] || {};
    return {
      ...item,
      // 16 core pipeline properties
      timeStemp: ticketDetails.timeStemp || item.created_at || "",
      timestamp: item.created_at || "",
      ticketId: item.ticket_id || "",
      what_did_the_customer_say: item.what_did_customer_say || "",
      "client-attachment": item.client_attachment_url || "",
      sourceOfEnquiry: ticketDetails.sourceOfEnquiry || "",
      enquiryType: ticketDetails.enquiryType || "",
      callType: ticketDetails.callType || "",
      enquiryReceiverName: ticketDetails.enquiryReceiverName || "",
      clientType: ticketDetails.clientType || "",
      companyName: ticketDetails.companyName || "",
      clientName: ticketDetails.clientName || "",
      phoneNumber: ticketDetails.phoneNumber || "",
      siteAddress: ticketDetails.siteAddress || "",
      gstNo: ticketDetails.gstNo || "",
      machineName: ticketDetails.machineName || "",
      mentionIssue: ticketDetails.mentionIssue || "",

      quotationNo: ticketDetails.quotationNo || "",
      quotationPdfLink: ticketDetails.quotationPdfLink || "",

          engineer_assign: item.engineer_assign || ticketDetails.engineerAssign || "",
    };
  });

  const filteredHistoryData = enrichedFollowUpData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.quotationNo || "").toLowerCase().includes(q);


      const matchesUpdatedBy =
        historyUpdatedBy.length === 0 || historyUpdatedBy.includes(String(item.lastUpdatedBy ?? item.last_updated_by ?? "").trim());

      return matchesSearch && matchesUpdatedBy;
    })
    .reverse();

  // Pending-tab rows carry nextCallDate/lastCallDate (from the ticket's
  // latest follow_up log), History-tab rows are raw inbound_follow_up rows
  // (next_date_of_call/created_at). Both are normalized to a local
  // YYYY-MM-DD string so comparisons are timezone-safe.
  const toLocalYmd = (raw) => {
    if (!raw) return "";
    const s = String(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const todayYmd = toLocalYmd(new Date());
  const nextCallYmd = (item) => toLocalYmd(item.nextCallDate ?? item.next_date_of_call);
  const lastCallYmd = (item) => toLocalYmd(item.lastCallDate ?? item.created_at);

  const matchesDateChip = (item, chip) => {
    const next = nextCallYmd(item);
    if (chip === "today") return next === todayYmd;
    if (chip === "overdue") return next !== "" && next < todayYmd;
    // Pending: no next call date yet, or one that is still ahead.
    if (chip === "pending") return next === "" || next > todayYmd;
    return true;
  };

  const filterByDateCategory = (data) =>
    data.filter(
      (item) =>
        matchesDateChip(item, dateFilterTab) &&
        (!lastCallTodayOnly || lastCallYmd(item) === todayYmd)
    );

  const chipCount = (data, chip) =>
    data.filter(
      (item) =>
        matchesDateChip(item, chip) &&
        (!lastCallTodayOnly || lastCallYmd(item) === todayYmd)
    ).length;
  const lastCallTodayCount = (data) =>
    data.filter(
      (item) =>
        matchesDateChip(item, dateFilterTab) && lastCallYmd(item) === todayYmd
    ).length;

  const attachmentFilteredPendingData = filteredPendingData;

  const finalFilteredPendingDataa = filterByDateCategory(attachmentFilteredPendingData);
  const finalFilteredHistoryDataa = filterByDateCategory(filteredHistoryData);

  // Rows are already searched / category- / date-chip-filtered above; the list hook only
  // owns the tab, paging and visible columns. Tab counts are therefore the filtered counts.
  const columns = FOLLOW_UP_COLUMNS;
  const list = useClientList({
    key: "followup",
    data: {
      pending: finalFilteredPendingDataa,
      history: finalFilteredHistoryDataa,
    },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    columns,
    sort: "none",
  });
  const activeTab = list.tab;
  const chipBase = activeTab === "history" ? filteredHistoryData : attachmentFilteredPendingData;
  // Search / category / chips live on the page, so send the list back to page 1 when they change.
  const { setPage } = list;
  useEffect(() => {
    setPage(1);
  }, [searchItem, pendingUpdatedBy, historyUpdatedBy, dateFilterTab, lastCallTodayOnly, setPage]);



  const handleExportCsv = () => {
    const cols = list.activeColumns;
    const rows =
      activeTab === "history"
        ? finalFilteredHistoryDataa
        : finalFilteredPendingDataa;
    if (rows.length === 0) {
      toast({ title: "Nothing to export", description: "No rows match the current filters.", variant: "destructive" });
      return;
    }
    const { headers, rows: body } = toCsvTable(cols, rows);
    exportCsv(`followup_${activeTab}_${todayYmd}`, headers, body);
  };

  // Everything that narrows the list besides the search box lives in the Filters dialog.
  const dateChipsApply = true;
  // Names offered in "Last Updated By": whoever appears in that tab's own rows.
  const updatedByOptions = (rows) =>
    Array.from(new Set(rows.map((r) => String(r.lastUpdatedBy ?? r.last_updated_by ?? "").trim()).filter(Boolean))).sort();
  const pendingUpdatedByOptions = updatedByOptions(pendingData);
  const historyUpdatedByOptions = updatedByOptions(enrichedFollowUpData);
  const activeFilterCount =
    (activeTab === "pending" && pendingUpdatedBy.length > 0 ? 1 : 0) +
    (activeTab === "history" && historyUpdatedBy.length > 0 ? 1 : 0) +
    (dateChipsApply && dateFilterTab ? 1 : 0) +
    (dateChipsApply && lastCallTodayOnly ? 1 : 0);
  const clearAllFilters = () => {
    setPendingUpdatedBy([]);
    setHistoryUpdatedBy([]);
    setDateFilterTab("");
    setLastCallTodayOnly(false);
  };
  const chipClass = (on, tone = "primary") =>
    `rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
      on
        ? tone === "danger"
          ? "border-destructive bg-destructive text-destructive-foreground"
          : "border-primary bg-primary text-primary-foreground"
        : "border-input bg-card text-foreground hover:bg-accent"
    }`;

  // console.log("finalFilteredPendingDataa", finalFilteredPendingDataa);
  // console.log("finalFilteredHistoryDataa", finalFilteredHistoryDataa);


  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-full overflow-x-auto scrollbar-hide">
          <StatusTabs tabs={list.tabs} activeTab={list.tab} onChange={list.setTab} label="Follow-up views" />
        </div>
        <FilterSearch
          value={searchItem}
          onChange={setSearchItem}
          placeholder="Search by ticket ID, client, company, phone or quotation no..."
          className="min-w-[220px]"
        />
      <FilterDialog activeCount={activeFilterCount} onClear={clearAllFilters}>
        {dateChipsApply && (
          <FilterSection title="Follow-up date">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={dateFilterTab === "today"}
                onClick={() => setDateFilterTab(dateFilterTab === "today" ? "" : "today")}
                className={chipClass(dateFilterTab === "today")}
              >
                Today ({chipCount(chipBase, "today")})
              </button>
              <button
                type="button"
                aria-pressed={dateFilterTab === "overdue"}
                onClick={() => setDateFilterTab(dateFilterTab === "overdue" ? "" : "overdue")}
                className={chipClass(dateFilterTab === "overdue", "danger")}
              >
                Overdue ({chipCount(chipBase, "overdue")})
              </button>
              <button
                type="button"
                aria-pressed={dateFilterTab === "pending"}
                onClick={() => setDateFilterTab(dateFilterTab === "pending" ? "" : "pending")}
                className={chipClass(dateFilterTab === "pending")}
              >
                Pending ({chipCount(chipBase, "pending")})
              </button>
            </div>
          </FilterSection>
        )}

        {dateChipsApply && (
          <FilterSection title="Last call">
            <button
              type="button"
              aria-pressed={lastCallTodayOnly}
              onClick={() => setLastCallTodayOnly((v) => !v)}
              className={chipClass(lastCallTodayOnly)}
            >
              Last Call: Today ({lastCallTodayCount(chipBase)})
            </button>
          </FilterSection>
        )}

        {activeTab === "pending" && (
          <FilterSection title="Last Updated By">
            <MultiSelect options={pendingUpdatedByOptions} value={pendingUpdatedBy} onChange={setPendingUpdatedBy} placeholder="All Users" />
          </FilterSection>
        )}
        {activeTab === "history" && (
          <FilterSection title="Last Updated By">
            <MultiSelect options={historyUpdatedByOptions} value={historyUpdatedBy} onChange={setHistoryUpdatedBy} placeholder="All Users" />
          </FilterSection>
        )}

        <FilterSection title="Export">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-2"
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Export CSV
          </Button>
          <p className="text-xs text-muted-foreground">
            Downloads the current tab with the filters above and the visible columns.
          </p>
        </FilterSection>
      </FilterDialog>
        <ColumnSelector {...list.columnPanel} />
      </div>

      <ListTable
        list={list}
        ctx={{
          onFollowUp: handleFollowUpClick,
          onEditHistory: handleEditHistoryAttachmentClick,
        }}
        rowKey={(r, tab) => (tab === "pending" ? r.ticketId : r.id ?? r.ticket_id + "-" + r.created_at)}
        cardTitle={(r) => r.ticketId}
        emptyTitle={{
          pending: "No pending follow-ups found.",
          history: "No follow-up history found.",
        }}
        ariaLabel="Follow-ups"
      />

      {followUpTicket && (
        <FollowUpFormModal
          key={followUpTicket.ticketId}
          ticket={followUpTicket}
          masterData={masterData}
          updatedByName={updatedByName}
          onClose={() => setFollowUpTicket(null)}
          onSaved={fetchData}
          onCancelled={(ticketId) => setPendingData((prev) => prev.filter((t) => t.ticketId !== ticketId))}
        />
      )}

      {editHistoryRow && (
        <EditHistoryModal
          key={editHistoryRow.id}
          row={editHistoryRow}
          masterData={masterData}
          updatedByName={updatedByName}
          onClose={() => setEditHistoryRow(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
