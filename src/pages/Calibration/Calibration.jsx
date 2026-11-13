import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Modal } from "../../components/ui/modal";
import { ListToolbar, ListTable, StatusBadge } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { useToast } from "../../hooks/use-toast";
import { Loader2Icon } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { formatDate, formatDateTimeShort, formatDelayLabel, delayTone } from "../../lib/format";
import { enquiryTypeText, enquiryTypeList } from "../../lib/enquiryType";

const linkCell = (url) =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
      View
    </a>
  ) : null;

// Calibration uploads: one per calibration Enquiry Type present on the ticket (each is mandatory when shown).
const UPLOADS = [
  { type: "AUTO-LEVEL-CALIBRATION", field: "autoLevelUpload", label: "Auto-Level" },
  { type: "TOTAL-STATION-CALIBRATION", field: "totalStationUpload", label: "Total Station" },
];
const uploadsFor = (ticket) => UPLOADS.filter((u) => (ticket?.enquiryTypes || []).includes(u.type));

// Pending: Action + invoice attachments. History: invoice number/copy + calibration details.
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onCalibrate }) => (
    <Button size="sm" variant="outline" onClick={() => onCalibrate(r)} data-testid={`button-calibration-${r.ticketId}`}>
      Calibration
    </Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, strong: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "companyName", label: "Company Name", defaultVisible: true, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "quotationNo", label: "Quotation Number", defaultVisible: true, strong: true, text: (r) => r.quotationNo },
  { key: "quotationCopy", label: "Quotation Copy", defaultVisible: true, cell: (r) => linkCell(r.quotationPdfLink) },
  { key: "invoiceNo", label: "Invoice Number", defaultVisible: true, strong: true, tabs: ["history"], text: (r) => r.invoiceNo },
  { key: "invoiceCopy", label: "Invoice Copy", defaultVisible: true, tabs: ["history"], cell: (r) => linkCell(r.invoiceCopy) },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: true, wrap: true, width: 180, text: (r) => r.enquiryType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: true, text: (r) => r.enquiryReceiverName },
  { key: "gstNo", label: "GST No.", defaultVisible: true, text: (r) => r.gstNo },
  { key: "attachmentService", label: "Attachment (Service)", defaultVisible: false, tabs: ["pending"], cell: (r) => linkCell(r.attachmentService) },
  { key: "invoiceDate", label: "Invoice Date", defaultVisible: false, text: (r) => formatDate(r.invoiceDate) },
  { key: "calibrationPlanned", label: "Calibration Planned", defaultVisible: false, text: (r) => formatDateTimeShort(r.calibrationPlanned) },
  { key: "calibrationDate", label: "Calibration Date", defaultVisible: false, tabs: ["history"], text: (r) => formatDate(r.calibrationDate) },
  { key: "calibrationPeriodMonth", label: "Calibration Period (Month)", defaultVisible: false, tabs: ["history"], text: (r) => r.calibrationPeriodMonth },
  { key: "calibrationDueDate", label: "Calibration Due Date", defaultVisible: false, tabs: ["history"], text: (r) => formatDate(r.calibrationDueDate) },
  { key: "autoLevelUpload", label: "Calibration Upload (Auto-Level)", defaultVisible: false, tabs: ["history"], cell: (r) => linkCell(r.autoLevelUpload) },
  { key: "totalStationUpload", label: "Calibration Upload (Total Station)", defaultVisible: false, tabs: ["history"], cell: (r) => linkCell(r.totalStationUpload) },
  { key: "delay", label: "Delay", defaultVisible: false, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={delayTone(r.delayMinutes)}>{formatDelayLabel(r.delayMinutes)}</StatusBadge>
  ) },
];

export default function Calibration() {
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const { toast } = useToast();

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // File is only HELD here on selection — actual upload happens at submit
  // time in handleSubmit, so cancelling the form never leaves an orphaned
  // upload behind, and nothing hits Storage until Submit is clicked.
  const [uploadFiles, setUploadFiles] = useState({});

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for Calibration: inbound_invoice.calibration_planned set (only tickets whose
      // Enquiry Type includes AUTO-LEVEL-CALIBRATION / TOTAL-STATION-CALIBRATION get one).
      const { data: invoiceRows, error: invoiceError } = await supabase
        .from("inbound_invoice")
        .select("ticket_uuid, invoice_date, invoice_no_service, invoice_no_spare, attachment_service, attachment_spare, calibration_planned")
        .not("calibration_planned", "is", null);

      if (invoiceError) throw invoiceError;

      const ticketUuids = [...new Set((invoiceRows || []).map((i) => i.ticket_uuid))];

      if (ticketUuids.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const [
        { data: ticketsData, error: ticketsError },
        { data: calibrationRows, error: calibrationError },
        { data: quotationRows },
      ] = await Promise.all([
        supabase.from("inbound_tickets").select("*").in("uuid", ticketUuids).order("created_at", { ascending: true }),
        supabase.from("inbound_calibration").select("*").in("ticket_uuid", ticketUuids),
        supabase.from("inbound_quotations").select("ticket_uuid, quotation_no, quotation_pdf_link").in("ticket_uuid", ticketUuids),
      ]);

      if (ticketsError) throw ticketsError;
      if (calibrationError) throw calibrationError;

      const calibrationByTicket = new Map((calibrationRows || []).map((c) => [c.ticket_uuid, c]));
      const quotationByTicket = new Map((quotationRows || []).map((q) => [q.ticket_uuid, q]));
      const invoiceByTicket = new Map((invoiceRows || []).map((i) => [i.ticket_uuid, i]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const q = quotationByTicket.get(t.uuid);
        const inv = invoiceByTicket.get(t.uuid);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          companyName: t.company_name || "",
          enquiryReceiverName: t.enquiry_receiver_name || "",
          gstNo: t.gst_no || "",
          enquiryType: enquiryTypeText(t.enquiry_type),
          enquiryTypes: enquiryTypeList(t.enquiry_type),
          quotationNo: q?.quotation_no || "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          calibrationPlanned: inv?.calibration_planned || "",
          invoiceDate: inv?.invoice_date || "",
          invoiceNo: inv?.invoice_no_service || inv?.invoice_no_spare || "",
          invoiceCopy: inv?.attachment_service || inv?.attachment_spare || "",
          attachmentService: inv?.attachment_service || "",
        };

        const cal = calibrationByTicket.get(t.uuid);
        if (cal) {
          history.push({
            ...base,
            calibrationDate: cal.calibration_date || "",
            calibrationPeriodMonth: cal.calibration_period_month ?? "",
            calibrationDueDate: cal.calibration_due_date || "",
            autoLevelUpload: cal.auto_level_upload_file || "",
            totalStationUpload: cal.total_station_upload_file || "",
            delayMinutes: cal.delay_minutes,
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
    key: "calibration",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber", "quotationNo", "invoiceNo"],
    filters: [
      { key: "enquiryType", label: "Enquiry Type", allLabel: "All Enquiry Types", get: (r) => r.enquiryType },
    ],
    columns: COLUMNS,
  });

  const handleCalibrationClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      quotationNo: ticket.quotationNo || "",
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      companyName: ticket.companyName || "",
      calibrationDate: "",
      calibrationPeriodMonth: "",
    });
    setUploadFiles({});
    setShowCalibrationModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Calibration Due Date is derived (calibration date + period in months) —
  // purely informational (when this calibration itself expires), not a
  // stage-gating column.
  const calibrationDueDate = (() => {
    if (!formData.calibrationDate || !formData.calibrationPeriodMonth) return "";
    const months = parseInt(formData.calibrationPeriodMonth, 10);
    if (isNaN(months) || months <= 0) return "";
    const d = new Date(formData.calibrationDate);
    if (isNaN(d.getTime())) return "";
    const due = new Date(d);
    due.setMonth(due.getMonth() + months);
    if (due.getDate() !== d.getDate()) due.setDate(0);
    return due.toISOString().split("T")[0];
  })();

  const uploadToStorage = async (file) => {
    const path = `calibration/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("inbound_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("inbound_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFileSelect = (field) => (e) => {
    const file = e.target.files?.[0] || null;
    setUploadFiles((prev) => ({ ...prev, [field]: file }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.calibrationDate) {
      toast({ title: "Validation Error", description: "Please select Calibration Date", variant: "destructive" });
      return;
    }
    if (!formData.calibrationPeriodMonth) {
      toast({ title: "Validation Error", description: "Please enter Calibration Period (Month)", variant: "destructive" });
      return;
    }

    const required = uploadsFor(selectedTicket);
    const missing = required.find((u) => !uploadFiles[u.field]);
    if (missing) {
      toast({ title: "Validation Error", description: "Please upload the " + missing.label + " calibration file", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload only now that Submit was actually clicked — nothing was
      // uploaded on file selection.
      const uploadedUrls = {};
      for (const u of required) uploadedUrls[u.field] = await uploadToStorage(uploadFiles[u.field]);


      const { error } = await supabase.from("inbound_calibration").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        calibration_date: formData.calibrationDate || null,
        calibration_period_month: formData.calibrationPeriodMonth || null,
        calibration_due_date: calibrationDueDate || null,
        auto_level_upload_file: uploadedUrls.autoLevelUpload || null,
        total_station_upload_file: uploadedUrls.totalStationUpload || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Calibration details saved successfully",
      });

      setShowCalibrationModal(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting calibration:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save calibration details",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <ListToolbar list={list} searchPlaceholder="Search by ticket ID, client, company or phone..." />
      <ListTable
        list={list}
        ctx={{ onCalibrate: handleCalibrationClick }}
        rowKey={(r) => r.ticketId}
        cardTitle={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending calibrations found.", history: "No calibration history found." }}
        ariaLabel="Calibration tickets"
      />

      {/* Calibration Modal */}
      <Modal
        isOpen={showCalibrationModal}
        onClose={() => setShowCalibrationModal(false)}
        title="Calibration"
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cal-quotationNo">Quotation Number</Label>
            <Input id="cal-quotationNo" value={formData.quotationNo || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label htmlFor="cal-clientName">Client Name</Label>
            <Input id="cal-clientName" value={formData.clientName || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label htmlFor="cal-phone">Phone Number</Label>
            <Input id="cal-phone" value={formData.phoneNumber || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label htmlFor="cal-company">Company Name</Label>
            <Input id="cal-company" value={formData.companyName || ""} disabled className="bg-slate-50" />
          </div>

          <div>
            <Label htmlFor="cal-date">Calibration Date *</Label>
            <Input
              id="cal-date"
              type="date"
              value={formData.calibrationDate || ""}
              onChange={(e) => handleInputChange("calibrationDate", e.target.value)}
              data-testid="input-calibration-date"
            />
          </div>
          <div>
            <Label htmlFor="cal-period">Calibration Period (Month) *</Label>
            <Input
              id="cal-period"
              type="number"
              min="1"
              placeholder="Enter number of months"
              value={formData.calibrationPeriodMonth || ""}
              onChange={(e) => handleInputChange("calibrationPeriodMonth", e.target.value)}
              data-testid="input-calibration-period"
            />
          </div>
          <div>
            <Label htmlFor="cal-due">Calibration Due Date</Label>
            <Input id="cal-due" value={calibrationDueDate ? formatDate(calibrationDueDate) : ""} disabled className="bg-slate-50" />
          </div>
          {uploadsFor(selectedTicket).map((u) => (
            <div key={u.field}>
              <Label htmlFor={"cal-upload-" + u.field}>Calibration Upload ({u.label}) *</Label>
              <Input
                id={"cal-upload-" + u.field}
                type="file"
                onChange={handleFileSelect(u.field)}
                disabled={isSubmitting}
                data-testid={"input-calibration-upload-" + u.field}
              />
              {uploadFiles[u.field] && (
                <p className="text-xs text-muted-foreground mt-1 truncate">Selected: {uploadFiles[u.field].name}</p>
              )}
            </div>
          ))}

          <div className="md:col-span-2 flex space-x-4 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-submit-calibration"
              className="px-6"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <Loader2Icon className="animate-spin mr-2 w-4 h-4" />
                  Uploading & Submitting...
                </span>
              ) : (
                "Submit"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCalibrationModal(false)}
              data-testid="button-cancel-calibration"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
