import { useState, useEffect } from "react";
import { Loader2Icon, Plus, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Modal } from "../../components/ui/modal";
import { ListToolbar, ListTable, StatusBadge } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { useToast } from "../../hooks/use-toast";
import useAuth from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase/client";
import { computeStagePlanned } from "../../lib/supabase/stagePlanning";
import { formatDate } from "../../lib/format";
import { machineText } from "../../lib/machines";
import { enquiryTypeText } from "../../lib/enquiryType";

// Pending: Action + ticket columns. History: same plus the Machine Received outcome.
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending", "hold"], cell: (r, { onProcess }) => (
    <Button onClick={() => onProcess(r)} size="sm" variant="outline" className="font-medium">Process</Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, strong: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 200, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: true, wrap: true, width: 180, text: (r) => r.enquiryType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: true, text: (r) => r.enquiryReceiverName },
  { key: "gstNo", label: "GST No.", defaultVisible: true, text: (r) => r.gstNo },
  { key: "sourceOfEnquiry", label: "Source of enquiry", defaultVisible: false, text: (r) => r.sourceOfEnquiry },
  { key: "callType", label: "Call type", defaultVisible: false, text: (r) => r.callType },
  { key: "clientType", label: "Client Type", defaultVisible: false, text: (r) => r.clientType },
  { key: "siteAddress", label: "Site Address", defaultVisible: false, wrap: true, width: 200, text: (r) => r.siteAddress },
  { key: "machineName", label: "Machine Name", defaultVisible: false, wrap: true, width: 160, text: (r) => r.machineName },
  { key: "mentionIssue", label: "Mention Issue", defaultVisible: false, wrap: true, width: 200, text: (r) => r.mentionIssue },
  { key: "followUpCount", label: "Follow-Ups", defaultVisible: true, tabs: ["pending", "hold"], text: (r) => String(r.followUpCount || 0) },
  { key: "lastFollowUpAt", label: "Last Follow-Up", defaultVisible: true, tabs: ["pending", "hold"], text: (r) => (r.followUpCount ? formatDate(r.lastFollowUpAt) : "N/A") },
  { key: "nextFollowUpDate", label: "Next Follow-Up Date", defaultVisible: true, tabs: ["pending", "hold"], cell: (r) =>
    r.nextFollowUpDate ? (
      <StatusBadge tone={r.nextFollowUpDate < todayYmd() ? "danger" : "info"}>{formatDate(r.nextFollowUpDate)}</StatusBadge>
    ) : "N/A" },
  { key: "customerSaid", label: "What Customer Said", defaultVisible: true, tabs: ["pending", "hold"], wrap: true, width: 220, text: (r) => r.customerSaid || "N/A" },
  { key: "machineReceived", label: "Machine Received", defaultVisible: false, tabs: ["history", "hold"], cell: (r) => (
    <StatusBadge tone={r.machineReceived === "yes" ? "success" : "warning"}>{RECEIVED_LABEL[r.machineReceived] || "N/A"}</StatusBadge>
  ) },
  { key: "warrantyCheck", label: "Warranty Check", defaultVisible: false, tabs: ["history", "hold"], cell: (r) => (
    r.warrantyCheck ? <StatusBadge tone={r.warrantyCheck === "yes" ? "success" : "danger"}>{r.warrantyCheck === "yes" ? "Yes" : "No"}</StatusBadge> : "N/A"
  ) },
  { key: "srnNumbers", label: "SRN Numbers", defaultVisible: false, tabs: ["history", "hold"], wrap: true, width: 200, text: (r) => (r.srnNumbers || []).join(", ") || "N/A" },
  { key: "challanCopy", label: "Challan Copy", defaultVisible: false, tabs: ["history", "hold"], cell: (r) =>
    r.challanCopyUrl ? (
      <a href={r.challanCopyUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">View</a>
    ) : "N/A" },
  { key: "remarks", label: "Remarks", defaultVisible: false, tabs: ["history", "hold"], wrap: true, width: 200, text: (r) => r.remarks || "N/A" },
  { key: "lastUpdatedBy", label: "Last Updated By", defaultVisible: false, tabs: ["history", "hold"], text: (r) => r.lastUpdatedBy || "N/A" },
  { key: "receivedAt", label: "Processed At", defaultVisible: false, tabs: ["history", "hold"], text: (r) => formatDate(r.receivedAt) },
];

const RECEIVED_LABEL = { yes: "Yes", quotation_shared: "Quotation Shared" };
const todayYmd = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

// Read-only (pre-filled) fields look flat and muted; editable fields keep a white background
// with a stronger border, so the two are easy to tell apart.
const READONLY_INPUT = "bg-slate-100 text-slate-500 border-dashed border-slate-300 cursor-not-allowed";
const ACTIVE_FIELD = "bg-white border-slate-400 text-slate-900 shadow-sm";

const MAX_SRN = 15;
const EMPTY_FORM = { machineReceived: "", warrantyCheck: "", remarks: "", srn: [""], nextFollowUpDate: "", customerSaid: "" };
const CHALLAN_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";
const cleanSrn = (list) => list.map((v) => v.trim()).filter(Boolean);

export default function MachineReceived() {
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [challanFile, setChallanFile] = useState(null);
  const [followUpLogs, setFollowUpLogs] = useState([]);

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [holdData, setHoldData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { userName } = useAuth();

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("inbound_tickets")
        .select("*")
        .not("machine_received_planned", "is", null)
        .order("created_at", { ascending: true });
      if (ticketsError) throw ticketsError;

      const { data: receivedData, error: receivedError } = await supabase
        .from("inbound_material_received")
        .select("*");
      if (receivedError) throw receivedError;

      const { data: latestData, error: latestError } = await supabase
        .from("inbound_machine_follow_up_latest")
        .select("*");
      if (latestError) throw latestError;
      const latestByTicket = new Map((latestData || []).map((f) => [f.ticket_uuid, f]));

      const receivedByTicket = new Map((receivedData || []).map((m) => [m.ticket_uuid, m]));

      const pending = [];
      const history = [];
      const hold = [];

      (ticketsData || []).forEach((t) => {
        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          sourceOfEnquiry: t.source_of_enquiry || "",
          callType: t.call_type || "",
          enquiryReceiverName: t.enquiry_receiver_name || "",
          enquiryType: enquiryTypeText(t.enquiry_type),
          clientType: t.client_type || "",
          companyName: t.company_name || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          siteAddress: t.site_address || "",
          gstNo: t.gst_no || "",
          machineName: machineText(t.machine_name),
          mentionIssue: t.mention_issue || "",
          followUpCount: Number(latestByTicket.get(t.uuid)?.follow_up_count) || 0,
          lastFollowUpAt: latestByTicket.get(t.uuid)?.last_follow_up_at || "",
          nextFollowUpDate: latestByTicket.get(t.uuid)?.next_follow_up_date || "",
          customerSaid: latestByTicket.get(t.uuid)?.customer_said || "",
        };

        const m = receivedByTicket.get(t.uuid);
        if (m) {
          const row = {
            ...base,
            machineReceived: m.machine_received || "",
            warrantyCheck: m.warranty_check || "",
            remarks: m.remarks || "",
            srnNumbers: m.srn_numbers || [],
            srnText: (m.srn_numbers || []).join(" "),
            challanCopyUrl: m.challan_copy_url || "",
            lastUpdatedBy: m.last_updated_by || "",
            receivedAt: m.created_at || "",
            isHold: m.machine_received === "quotation_shared",
          };
          (row.isHold ? hold : history).push(row);
        } else {
          pending.push(base);
        }
      });

      setPendingData(pending);
      setHistoryData(history);
      setHoldData(hold);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoadError(error.message || "Failed to load data");
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProcessClick = (ticket) => {
    setSelectedTicket(ticket);
    // Quotation Shared rows re-open with their saved values; the user then picks the final outcome.
    setFormData(
      ticket.isHold
        ? { ...EMPTY_FORM, warrantyCheck: ticket.warrantyCheck || "", remarks: ticket.remarks || "", srn: ticket.srnNumbers?.length ? [...ticket.srnNumbers] : [""] }
        : EMPTY_FORM
    );
    setChallanFile(null);
    setFollowUpLogs([]);
    setShowModal(true);
    if (ticket.followUpCount) {
      supabase
        .from("inbound_machine_follow_up")
        .select("id, next_follow_up_date, customer_said, remarks, created_by, created_at")
        .eq("ticket_uuid", ticket.ticketUuid)
        .order("created_at", { ascending: false })
        .then(({ data }) => setFollowUpLogs(data || []));
    }
  };

  const uploadChallan = async (ticketId, file) => {
    const path = `machine_received/${ticketId}_${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("inbound_enquiry").upload(path, file, { contentType: file.type });
    if (error) throw error;
    return supabase.storage.from("inbound_enquiry").getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.machineReceived) {
      toast({ title: "Validation Error", description: "Please select Machine-Received option.", variant: "destructive" });
      return;
    }

    const isYes = formData.machineReceived === "yes";
    const isFollowUp = formData.machineReceived === "follow_up";

    if (isYes && !formData.warrantyCheck) {
      toast({ title: "Validation Error", description: "Please select Warranty Check option.", variant: "destructive" });
      return;
    }
    if (isFollowUp && !formData.nextFollowUpDate) {
      toast({ title: "Validation Error", description: "Please select the Next Follow-Up Date.", variant: "destructive" });
      return;
    }
    if (isFollowUp && !formData.customerSaid.trim()) {
      toast({ title: "Validation Error", description: "Please enter what the customer said.", variant: "destructive" });
      return;
    }
    if (isYes && !challanFile && !(selectedTicket.isHold && selectedTicket.challanCopyUrl)) {
      toast({ title: "Validation Error", description: "Please attach the Challan Copy.", variant: "destructive" });
      return;
    }
    if (isYes && cleanSrn(formData.srn).length === 0) {
      toast({ title: "Validation Error", description: "Please enter at least one SRN number.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isFollowUp) {
        // Machine not received yet: append a follow-up log; the ticket stays where it is (Pending / Quotation Shared).
        const { error: followUpError } = await supabase.from("inbound_machine_follow_up").insert({
          ticket_uuid: selectedTicket.ticketUuid,
          ticket_id: selectedTicket.ticketId,
          next_follow_up_date: formData.nextFollowUpDate,
          customer_said: formData.customerSaid.trim(),
          remarks: formData.remarks.trim() || null,
          created_by: userName || localStorage.getItem("currentUsername") || null,
        });
        if (followUpError) throw followUpError;
        toast({ title: "Success", description: "Follow-up saved" });
        setShowModal(false);
        fetchData();
        return;
      }

      const challanUrl = isYes && challanFile ? await uploadChallan(selectedTicket.ticketId, challanFile) : null;
      const srnList = isYes ? cleanSrn(formData.srn) : [];
      const updatedBy = userName || localStorage.getItem("currentUsername") || null;

      if (selectedTicket.isHold) {
        // Quotation Shared tab: update the same row (by ticket uuid). Yes releases the hold; No / Quotation
        // Received keep it on hold (Follow-Up stays blocked) and only refresh warranty / remarks.
        const release = formData.machineReceived === "yes";
        const { error: updateError } = await supabase
          .from("inbound_material_received")
          .update({
            machine_received: release ? "yes" : "quotation_shared",
            warranty_check: isYes ? formData.warrantyCheck : null,
            remarks: formData.remarks.trim() || null,
            srn_numbers: srnList,
            ...(challanUrl ? { challan_copy_url: challanUrl } : {}),
            last_updated_by: updatedBy,
          })
          .eq("ticket_uuid", selectedTicket.ticketUuid);
        if (updateError) throw updateError;

        toast({
          title: release ? "Success" : "Still on hold",
          description: release ? "Machine received - order released from hold" : "Details saved; the order stays on hold until the machine is received",
        });
        setShowModal(false);
        fetchData();
        return;
      }

      // Yes and Quotation Shared both open Quotation: submit time + TAT.
      const quotationPlanned = await computeStagePlanned("quotationFromMachineReceived", {
        machineReceived: formData.machineReceived,
        machineReceivedSubmittedAt: new Date(),
      });

      const { error } = await supabase.from("inbound_material_received").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        machine_received: formData.machineReceived,
        warranty_check: isYes ? formData.warrantyCheck : null,
        quotation_planned: quotationPlanned,
        remarks: formData.remarks.trim() || null,
        srn_numbers: srnList,
        challan_copy_url: challanUrl,
        last_updated_by: updatedBy,
      });
      if (error) throw error;

      toast({ title: "Success", description: "Machine received details submitted successfully" });
      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting machine received:", error);
      toast({ title: "Error", description: error.message || "Failed to save details", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const list = useClientList({
    key: "machine-received",
    data: { pending: pendingData, hold: holdData, history: historyData },
    tabLabels: { pending: "Pending", hold: "Quotation Shared", history: "History" },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber", "srnText"],
    filters: [
      { key: "enquiryType", label: "Enquiry Type", allLabel: "All Enquiry Types", get: (r) => r.enquiryType },
      { key: "clientType", label: "Client Type", allLabel: "All Client Types", get: (r) => r.clientType },
      { key: "received", label: "Machine Received", allLabel: "All", get: (r) => RECEIVED_LABEL[r.machineReceived] || "N/A", tabs: ["history", "hold"] },
      { key: "warranty", label: "Warranty Check", allLabel: "All", get: (r) => (r.warrantyCheck === "yes" ? "Yes" : r.warrantyCheck === "no" ? "No" : "N/A"), tabs: ["history", "hold"] },
    ],
    columns: COLUMNS,
  });

  return (
    <div className="space-y-3">
      <ListToolbar list={list} searchPlaceholder="Search by ticket ID, client, company, phone or SRN..." filtersInDialog />
      <ListTable
        list={list}
        ctx={{ onProcess: handleProcessClick }}
        rowKey={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending machine received entries found.", hold: "No quotation shared orders.", history: "No history found." }}
        ariaLabel="Machine received"
      />

      <Modal
        isOpen={showModal}
        onClose={() => {
          if (!isSubmitting) setShowModal(false);
        }}
        title="Machine Received"
        size="lg"
      >
        <div className="rounded-lg bg-card">
          <div className="p-4">
            {/* Fixed-height form: the fields scroll, the Cancel / Submit footer stays in view. */}
            <form onSubmit={handleSubmit} className="flex h-[min(75vh,520px)] flex-col gap-3">
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="mr-ticketId" className="font-medium text-muted-foreground">Ticket ID</Label>
                  <Input id="mr-ticketId" value={selectedTicket?.ticketId || ""} disabled className={READONLY_INPUT} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mr-clientName" className="font-medium text-muted-foreground">Client Name</Label>
                  <Input id="mr-clientName" value={selectedTicket?.clientName || ""} disabled className={READONLY_INPUT} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mr-phoneNumber" className="font-medium text-muted-foreground">Phone Number</Label>
                  <Input id="mr-phoneNumber" value={selectedTicket?.phoneNumber || ""} disabled className={READONLY_INPUT} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mr-machineName" className="font-medium text-muted-foreground">Machine Name</Label>
                  <Input id="mr-machineName" value={selectedTicket?.machineName || ""} disabled className={READONLY_INPUT} />
                </div>
              </div>

              <div className="space-y-3 border-t pt-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="mr-machineReceived" className="font-medium text-muted-foreground">Machine-Received *</Label>
                    <Select
                      value={formData.machineReceived}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, machineReceived: value }))}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="mr-machineReceived" className={ACTIVE_FIELD}>
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200 shadow-md">
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="follow_up">Follow-Up</SelectItem>
                        <SelectItem value="quotation_shared">Quotation Shared</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.machineReceived === "yes" && (
                <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="mr-warrantyCheck" className="font-medium text-muted-foreground">Warranty Check *</Label>
                    <Select
                      value={formData.warrantyCheck}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, warrantyCheck: value }))}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="mr-warrantyCheck" className={ACTIVE_FIELD}>
                        <SelectValue placeholder="Select Yes/No" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200 shadow-md">
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mr-challan" className="font-medium text-muted-foreground">Challan Copy *</Label>
                  <Input
                    id="mr-challan"
                    type="file"
                    accept={CHALLAN_ACCEPT}
                    className={ACTIVE_FIELD}
                    disabled={isSubmitting}
                    onChange={(e) => setChallanFile(e.target.files?.[0] || null)}
                  />
                  {!challanFile && selectedTicket?.challanCopyUrl && (
                    <p className="text-xs text-muted-foreground">A challan is already attached; choose a file only to replace it.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="font-medium text-muted-foreground">SRN Number(s) *</Label>
                  {formData.srn.map((value, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={value}
                        placeholder={"SRN " + (idx + 1)}
                        className={ACTIVE_FIELD}
                        disabled={isSubmitting}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, srn: prev.srn.map((v, i) => (i === idx ? e.target.value : v)) }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={"Delete SRN " + (idx + 1)}
                        disabled={isSubmitting}
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, srn: prev.srn.length === 1 ? [""] : prev.srn.filter((_, i) => i !== idx) }))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting || formData.srn.length >= MAX_SRN}
                      onClick={() => setFormData((prev) => ({ ...prev, srn: [...prev.srn, ""] }))}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add
                    </Button>
                    <span className="text-xs text-muted-foreground">{formData.srn.length}/{MAX_SRN} - one SRN per machine</span>
                  </div>
                </div>
                </>
                )}

                {formData.machineReceived === "follow_up" && (
                <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="mr-nextFollowUp" className="font-medium text-muted-foreground">Next Follow-Up Date *</Label>
                    <Input
                      id="mr-nextFollowUp"
                      type="date"
                      min={todayYmd()}
                      className={ACTIVE_FIELD}
                      value={formData.nextFollowUpDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, nextFollowUpDate: e.target.value }))}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mr-customerSaid" className="font-medium text-muted-foreground">What did customer say *</Label>
                  <Textarea
                    id="mr-customerSaid"
                    placeholder="Enter what the customer said"
                    rows={2}
                    className={ACTIVE_FIELD}
                    value={formData.customerSaid}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customerSaid: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
                </>
                )}

                <div className="space-y-1">
                  <Label htmlFor="mr-remarks" className="font-medium text-muted-foreground">Remarks</Label>
                  <Textarea
                    id="mr-remarks"
                    placeholder="Enter remarks"
                    rows={3}
                    className={ACTIVE_FIELD}
                    value={formData.remarks}
                    onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {followUpLogs.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <Label className="font-medium text-muted-foreground">Previous follow-ups ({followUpLogs.length})</Label>
                  <ul className="space-y-2">
                    {followUpLogs.map((f) => (
                      <li key={f.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                        <div className="flex justify-between gap-2 font-medium text-slate-700">
                          <span>{formatDate(f.created_at)}{f.created_by ? " - " + f.created_by : ""}</span>
                          <span>Next: {formatDate(f.next_follow_up_date)}</span>
                        </div>
                        <p className="mt-1 text-slate-600">{f.customer_said}</p>
                        {f.remarks && <p className="mt-1 text-slate-500">Remarks: {f.remarks}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t pt-3">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  );
}
