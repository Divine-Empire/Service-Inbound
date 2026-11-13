import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Modal } from "../../components/ui/modal";
import { useToast } from "../../hooks/use-toast";
import { ListToolbar, ListTable, StatusBadge } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { Loader2Icon } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { formatDate, formatDateTimeShort, formatDelayLabel, delayTone } from "../../lib/format";
import { machineText } from "../../lib/machines";
import { enquiryTypeText } from "../../lib/enquiryType";

const linkCell = (url) =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
      View
    </a>
  ) : null;

// Machine Handover (after Invoice). Pending: inbound_invoice.machine_handover_planned set and no
// inbound_machine_handover row yet. History: adds the handover details.
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onProcess }) => (
    <Button size="sm" variant="outline" onClick={() => onProcess(r)} data-testid={`button-handover-${r.ticketId}`}>Process</Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 220, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "invoiceNo", label: "Invoice No.", defaultVisible: true, strong: true, text: (r) => r.invoiceNo },
  { key: "invoiceCopy", label: "Invoice Copy", defaultVisible: true, cell: (r) => linkCell(r.invoiceCopy) },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: true, wrap: true, width: 180, text: (r) => r.enquiryType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: true, text: (r) => r.enquiryReceiverName },
  { key: "gstNo", label: "GST No.", defaultVisible: true, text: (r) => r.gstNo },
  { key: "machineName", label: "Machine Name", defaultVisible: false, wrap: true, width: 180, text: (r) => r.machineName },
  { key: "handoverPlanned", label: "Handover Planned", defaultVisible: false, tabs: ["pending"], text: (r) => formatDateTimeShort(r.handoverPlanned) },
  { key: "personTransporterName", label: "Person/Transporter Name", defaultVisible: false, tabs: ["history"], text: (r) => r.personTransporterName },
  { key: "handoverPhone", label: "Handover Phone No.", defaultVisible: false, tabs: ["history"], text: (r) => r.handoverPhone },
  { key: "docketNo", label: "Docket No.", defaultVisible: false, tabs: ["history"], text: (r) => r.docketNo || "N/A" },
  { key: "handoverDate", label: "Handover Date", defaultVisible: false, tabs: ["history"], text: (r) => formatDate(r.handoverDate) },
  { key: "receivingCopy", label: "Receiving Copy", defaultVisible: false, tabs: ["history"], cell: (r) => linkCell(r.receivingCopy) },
  { key: "delay", label: "Delay", defaultVisible: false, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={delayTone(r.delayMinutes)}>{formatDelayLabel(r.delayMinutes)}</StatusBadge>
  ) },
];

const EMPTY_FORM = { personTransporterName: "", phoneNumber: "", docketNo: "", handoverDate: "" };

export default function MachineHandover() {
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const { toast } = useToast();

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The file is only HELD on selection; it uploads at submit time, so cancelling the form never
  // leaves an orphaned upload behind.
  const [receivingCopyFile, setReceivingCopyFile] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for Machine Handover (inbound_invoice.machine_handover_planned set).
      const { data: invoiceRows, error: invoiceError } = await supabase
        .from("inbound_invoice")
        .select("ticket_uuid, invoice_no_service, invoice_no_spare, attachment_service, attachment_spare, machine_handover_planned")
        .not("machine_handover_planned", "is", null);

      if (invoiceError) throw invoiceError;

      const ticketUuids = [...new Set((invoiceRows || []).map((i) => i.ticket_uuid))];

      if (ticketUuids.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const [
        { data: ticketsData, error: ticketsError },
        { data: handoverRows, error: handoverError },
      ] = await Promise.all([
        supabase.from("inbound_tickets").select("*").in("uuid", ticketUuids).order("created_at", { ascending: true }),
        supabase.from("inbound_machine_handover").select("*").in("ticket_uuid", ticketUuids),
      ]);

      if (ticketsError) throw ticketsError;
      if (handoverError) throw handoverError;

      const invoiceByTicket = new Map((invoiceRows || []).map((i) => [i.ticket_uuid, i]));
      const handoverByTicket = new Map((handoverRows || []).map((h) => [h.ticket_uuid, h]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const inv = invoiceByTicket.get(t.uuid);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          companyName: t.company_name || "",
          machineName: machineText(t.machine_name),
          enquiryType: enquiryTypeText(t.enquiry_type),
          enquiryReceiverName: t.enquiry_receiver_name || "",
          gstNo: t.gst_no || "",
          invoiceNo: inv?.invoice_no_service || inv?.invoice_no_spare || "",
          invoiceCopy: inv?.attachment_service || inv?.attachment_spare || "",
          handoverPlanned: inv?.machine_handover_planned || "",
        };

        const h = handoverByTicket.get(t.uuid);
        if (h) {
          history.push({
            ...base,
            personTransporterName: h.person_transporter_name || "",
            handoverPhone: h.phone_number || "",
            docketNo: h.docket_no || "",
            handoverDate: h.handover_date || "",
            receivingCopy: h.receiving_copy || "",
            delayMinutes: h.delay_minutes,
          });
        } else {
          pending.push(base);
        }
      });

      setPendingData(pending);
      setHistoryData(history);
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

  const handleClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData(EMPTY_FORM);
    setReceivingCopyFile(null);
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadToStorage = async (file) => {
    const path = `machine_handover/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("inbound_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("inbound_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.personTransporterName.trim()) {
      toast({ title: "Validation Error", description: "Please enter Person/Transporter Name", variant: "destructive" });
      return;
    }
    if (!formData.phoneNumber.trim()) {
      toast({ title: "Validation Error", description: "Please enter Phone Number", variant: "destructive" });
      return;
    }
    if (!formData.handoverDate) {
      toast({ title: "Validation Error", description: "Please select Handover Date", variant: "destructive" });
      return;
    }
    if (!receivingCopyFile) {
      toast({ title: "Validation Error", description: "Please select a Receiving Copy file", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload only now that Submit was actually clicked.
      const receivingCopyUrl = await uploadToStorage(receivingCopyFile);

      const { error } = await supabase.from("inbound_machine_handover").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        person_transporter_name: formData.personTransporterName.trim(),
        phone_number: formData.phoneNumber.trim(),
        docket_no: formData.docketNo.trim() || null,
        handover_date: formData.handoverDate,
        receiving_copy: receivingCopyUrl,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Machine handover details saved successfully" });
      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting machine handover:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save machine handover details",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const list = useClientList({
    key: "machine-handover",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber", "invoiceNo"],
    columns: COLUMNS,
  });

  return (
    <div className="space-y-3">
      <ListToolbar list={list} searchPlaceholder="Search by ticket ID, client, company, phone or invoice no..." />
      <ListTable
        list={list}
        ctx={{ onProcess: handleClick }}
        rowKey={(r, tab) => tab + "-" + r.ticketId}
        cardTitle={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending machine handovers found.", history: "No handover history found." }}
        ariaLabel="Machine handover tickets"
      />

      <Modal
        isOpen={showModal}
        onClose={() => !isSubmitting && setShowModal(false)}
        title="Machine Handover"
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Ticket ID</Label>
            <Input value={selectedTicket?.ticketId || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label>Client Name</Label>
            <Input value={selectedTicket?.clientName || ""} disabled className="bg-slate-50" />
          </div>

          <div>
            <Label>Person/Transporter Name *</Label>
            <Input
              placeholder="Enter person or transporter name"
              value={formData.personTransporterName}
              onChange={(e) => handleInputChange("personTransporterName", e.target.value)}
              disabled={isSubmitting}
              data-testid="input-person-transporter-name"
            />
          </div>
          <div>
            <Label>Phone Number *</Label>
            <Input
              type="tel"
              placeholder="Enter phone number"
              value={formData.phoneNumber}
              onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
              disabled={isSubmitting}
              data-testid="input-handover-phone"
            />
          </div>
          <div>
            <Label>Docket No.</Label>
            <Input
              placeholder="Enter docket no. (optional)"
              value={formData.docketNo}
              onChange={(e) => handleInputChange("docketNo", e.target.value)}
              disabled={isSubmitting}
              data-testid="input-docket-no"
            />
          </div>
          <div>
            <Label>Handover Date *</Label>
            <Input
              type="date"
              value={formData.handoverDate}
              onChange={(e) => handleInputChange("handoverDate", e.target.value)}
              disabled={isSubmitting}
              data-testid="input-handover-date"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Receiving Copy *</Label>
            <Input
              type="file"
              onChange={(e) => setReceivingCopyFile(e.target.files[0] || null)}
              disabled={isSubmitting}
              data-testid="input-receiving-copy"
            />
            {receivingCopyFile && (
              <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {receivingCopyFile.name}</p>
            )}
          </div>

          <div className="md:col-span-2 flex space-x-4 pt-4">
            <Button type="submit" disabled={isSubmitting} data-testid="button-submit-handover" className="px-6">
              {isSubmitting ? (
                <span className="flex items-center">
                  <Loader2Icon className="animate-spin mr-2 w-4 h-4" />
                  Uploading & Submitting...
                </span>
              ) : (
                "Submit"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
