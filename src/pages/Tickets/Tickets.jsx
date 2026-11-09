import { useState, useEffect, useMemo } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useToast } from "../../hooks/use-toast";
import { Plus, Calendar, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { supabase } from "../../lib/supabase/client";
import { ListToolbar, ListTable } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { formatDate } from "../../lib/format";
import { COLUMNS } from "./columns";
import { useEnquiryMasters } from "./useEnquiryMasters";
import EnquiryFormModal from "./EnquiryFormModal";
import { enquiryTypeText, enquiryTypeList } from "../../lib/enquiryType";

// Once a ticket reaches one of these stages, editing it here no longer
// makes sense (billing/downstream paperwork has already started on it) —
// it's dropped from this page's list entirely, not just its Edit button.
// "Cancelled" is set by the inbound_cancelled_tickets trigger.
const EDIT_EXCLUDED_STAGES = ["Invoice", "Calibration", "Calibration Certificate", "Machine Handover", "Cancelled"];

export default function Tickets() {
  const [pendingData, setPendingData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const { masterData, companyDetails, ensureCompanies } = useEnquiryMasters();

  // Filter States
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  // The enquiry form: null = closed, { ticket: null } = new enquiry, { ticket } = edit.
  const [enquiryForm, setEnquiryForm] = useState(null);

  const { toast } = useToast();

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("inbound_tickets")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const allData = (data || []).map((row) => ({
        ticketId: row.ticket_id,
        timeStemp: row.created_at || "",
        sourceOfEnquiry: row.source_of_enquiry || "",
        callType: row.call_type || "",
        enquiryReceiverName: row.enquiry_receiver_name || "",
        clientType: row.client_type || "",
        companyName: row.company_name || "",
        clientName: row.client_name || "",
        phoneNumber: row.phone_number || "",
        siteAddress: row.site_address || "",
        gstNo: row.gst_no || "",
        gstAddress: row.gst_address || "",
        machineName: row.machine_name || "",
        enquiryType: enquiryTypeText(row.enquiry_type),
        enquiryTypes: enquiryTypeList(row.enquiry_type),
        category: row.category || "",
        mentionIssue: row.mention_issue || "",
        serviceLocation: row.service_location || "",
        challanCopy: row.challan_copy || "",
        machinePhoto: row.machine_photo || "",
        videoCall: row.video_call || "",
        subCategory: row.sub_category || "",
        videoCallTime: row.video_call_time || "",
        engineerAssign: row.engineer_assign || "",
        otp: row.otp || "",
        currentStage: row.current_stage || "",
        enquiryItemList: row.enquiry_item_list || "",
        remarks: row.remarks || "",
      }));

      // Show all tickets in the system
      setPendingData(allData);
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

  const handleEditClick = (ticket) => {
    ensureCompanies();
    setEnquiryForm({ ticket });
  };
  const handleNewEnquiryClick = () => {
    ensureCompanies();
    setEnquiryForm({ ticket: null });
  };

  const editableData = useMemo(
    () => pendingData.filter((item) => !EDIT_EXCLUDED_STAGES.includes(item.currentStage)),
    [pendingData]
  );

  // Date range narrows the rows before the list hook (same semantics as before);
  // search and category go through the hook.
  const dateFilteredData = useMemo(
    () =>
      editableData.filter((item) => {
        if (item.timeStemp) {
          let ticketDateObj = null;
          if (typeof item.timeStemp === "string" && item.timeStemp.includes("/")) {
            const datePart = item.timeStemp.split(" ")[0];
            const parts = datePart.split("/");
            if (parts.length === 3) {
              ticketDateObj = new Date(parts[2], parts[1] - 1, parts[0]);
            }
          } else {
            ticketDateObj = new Date(item.timeStemp);
          }

          if (ticketDateObj && !isNaN(ticketDateObj.getTime())) {
            ticketDateObj.setHours(0, 0, 0, 0);

            if (dateRange.start) {
              const fromDateObj = new Date(dateRange.start);
              fromDateObj.setHours(0, 0, 0, 0);
              if (ticketDateObj < fromDateObj) return false;
            }

            if (dateRange.end) {
              const toDateObj = new Date(dateRange.end);
              toDateObj.setHours(23, 59, 59, 999);
              if (ticketDateObj > toDateObj) return false;
            }
          }
        } else if (dateRange.start || dateRange.end) {
          return false;
        }
        return true;
      }),
    [editableData, dateRange]
  );

  const list = useClientList({
    key: "tickets",
    data: { all: dateFilteredData },
    tabLabels: { all: "All Tickets" },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],
    filters: [{ key: "category", label: "Category", allLabel: "All Categories", get: (r) => r.category }],
    columns: COLUMNS,
  });
  const hasDateRange = !!(dateRange.start || dateRange.end);

  return (
    <div className="space-y-3">
      <ListToolbar
        list={list}
        searchPlaceholder="Search Ticket, Client..."
        extraFilters={
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDateModalOpen(true)}
              className={`whitespace-nowrap ${hasDateRange ? "border-primary bg-brand-50" : ""}`}
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              {hasDateRange ? (
                <span className="text-xs font-semibold">
                  {dateRange.start && dateRange.end
                    ? `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
                    : (dateRange.start ? `From ${formatDate(dateRange.start)}` : `To ${formatDate(dateRange.end)}`)}
                </span>
              ) : "Date Range"}
            </Button>
            {hasDateRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDateRange({ start: "", end: "" })}
                className="px-2 text-xs"
                title="Clear date range"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Clear dates
              </Button>
            )}
          </div>
        }
        actions={
          <Button size="sm" onClick={handleNewEnquiryClick} className="shrink-0">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Enquiry
          </Button>
        }
      />
      <ListTable
        list={list}
        ctx={{ onEdit: handleEditClick }}
        rowKey={(r) => r.ticketId}
        cardTitle={(r) => r.companyName || "No Company"}
        emptyTitle="No enquiries found."
        ariaLabel="Tickets and enquiries"
      />

      {enquiryForm && (
        <EnquiryFormModal
          key={enquiryForm.ticket?.ticketId || "new"}
          ticket={enquiryForm.ticket}
          masterData={masterData}
          companyDetails={companyDetails}
          onClose={() => setEnquiryForm(null)}
          onSaved={fetchData}
        />
      )}

      <Dialog open={isDateModalOpen} onOpenChange={setIsDateModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white border-brand-100">
          <DialogHeader>
            <DialogTitle className="text-brand-800 flex items-center">
              <Calendar className="mr-2 h-5 w-5 text-brand-600" />
              Filter by Date Range
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="start" className="text-brand-700 font-medium">Start Date</Label>
              <Input
                id="start"
                type="date"
                className="border-brand-200 focus:ring-brand-500"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end" className="text-brand-700 font-medium">End Date</Label>
              <Input
                id="end"
                type="date"
                className="border-brand-200 focus:ring-brand-500"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-between gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => setDateRange({ start: "", end: "" })}
              className="border-brand-200 text-brand-600 hover:bg-brand-50"
            >
              Reset Range
            </Button>
            <Button
              onClick={() => setIsDateModalOpen(false)}
              className="px-8"
            >
              Apply Filter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}