import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Modal } from "../../components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Loader2Icon } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { computeStagePlanned } from "../../lib/supabase/stagePlanning";

// Create-invoice (and cancel-ticket) form for one pending ticket. Render it only while a ticket
// is selected. onClose closes it; onSaved runs after a saved invoice (page reloads its lists);
// onCancelled(ticketId) runs after a cancellation (page drops the ticket from Pending).
export default function InvoiceForm({ ticket, masterData, onClose, onSaved, onCancelled }) {
  const selectedTicket = ticket;
  const { toast } = useToast();
  const [isCancelled, setIsCancelled] = useState(false);
  const [cancelSubmit, setCancelSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Files are only HELD here on selection; the upload happens at submit time (all three in
  // parallel), so closing the form never leaves an orphaned upload behind.
  const [attachmentServiceFile, setAttachmentServiceFile] = useState(null);
  const [attachmentSpareFile, setAttachmentSpareFile] = useState(null);
  const [formData, setFormData] = useState(() => ({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      companyName: ticket.companyName || "",
      siteAddress: ticket.siteAddress || "",
      quotationNo: ticket.quotationNo || "",
      quotationPdfLink: ticket.quotationPdfLink || "",
      invoicePostedBy: "",
      // Left blank on purpose (was defaulted to today) — CREs were clicking
      // straight past it without checking, risking a wrong date going onto
      // the invoice. Now they must pick it deliberately.
      invoiceDate: "",
      invoiceNoSERVICE: "",
      invoiceNoSPARE: "",
      serviceAmountBasic: "",
      serviceAmountGst: "",
      spareAmountBasic: "",
      spareAmountGst: "",
  }));

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadToStorage = async (file, prefix) => {
    const path = `invoice/${prefix}_${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("inbound_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("inbound_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // All three uploads happen here, in parallel, only now that Submit was
      // actually clicked — nothing was uploaded on file selection.
      const [attachmentServiceUrl, attachmentSpareUrl] = await Promise.all([
        attachmentServiceFile ? uploadToStorage(attachmentServiceFile, "service") : Promise.resolve(null),
        attachmentSpareFile ? uploadToStorage(attachmentSpareFile, "spare") : Promise.resolve(null),
      ]);

      const submittedAt = new Date();
      // machine_handover_planned: every ticket. calibration_planned: only tickets whose Enquiry Type
      // includes AUTO-LEVEL-CALIBRATION / TOTAL-STATION-CALIBRATION (see stagePlanning.js).
      const planningCtx = { ticket: { enquiryType: selectedTicket.enquiryTypes }, invoiceSubmittedAt: submittedAt };
      const [machineHandoverPlanned, calibrationPlanned] = await Promise.all([
        computeStagePlanned("machineHandover", planningCtx),
        computeStagePlanned("calibration", planningCtx),
      ]);

      const { error } = await supabase.from("inbound_invoice").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        invoice_posted_by: formData.invoicePostedBy || null,
        invoice_date: formData.invoiceDate || null,
        invoice_no_service: formData.invoiceNoSERVICE || null,
        invoice_no_spare: formData.invoiceNoSPARE || null,
        service_amount_basic: formData.serviceAmountBasic || null,
        service_amount_gst: formData.serviceAmountGst || null,
        spare_amount_basic: formData.spareAmountBasic || null,
        spare_amount_gst: formData.spareAmountGst || null,
        attachment_service: attachmentServiceUrl,
        attachment_spare: attachmentSpareUrl,
        machine_handover_planned: machineHandoverPlanned,
        calibration_planned: calibrationPlanned,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice submitted successfully",
      });
      onClose();
      onSaved();
    } catch (error) {
      console.error("Error submitting invoice:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save invoice details",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCancel = async (e) => {
    e.preventDefault();
    setCancelSubmit(true);

    try {
      const { error } = await supabase.from("inbound_cancelled_tickets").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        cancelled_from_stage: "Invoice",
        remarks: formData.cancelRemarks || null,
      });

      if (error) throw error;

      // Removes it from the page's own pending list only. The inbound_cancel_apply trigger on
      // inbound_cancelled_tickets nulls every downstream "<next_stage>_planned" stamp.
      onCancelled(selectedTicket.ticketId);
      onClose();
      toast({
        title: "Success",
        description: "Ticket cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling ticket:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel ticket",
        variant: "destructive",
      });
    } finally {
      setCancelSubmit(false);
    }
  };

  return (
      <Modal
        isOpen
        onClose={onClose}
        title="Invoice"
        size="2xl"
      >
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-4 pb-4">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="flex items-center space-x-2 md:col-span-2">
              <input
                type="checkbox"
                id="cancelTicketInvoice"
                checked={isCancelled}
                onChange={(e) => setIsCancelled(e.target.checked)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <Label htmlFor="cancelTicketInvoice" className="text-red-600 font-medium">
                Cancel Ticket
              </Label>
            </div>

            {!isCancelled && (
              <>
            <div>
              <Label>Ticket ID</Label>
              <Input value={formData.ticketId || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Client Name</Label>
              <Input value={formData.clientName || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input value={formData.phoneNumber || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Quotation No.</Label>
              <Input value={formData.quotationNo || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Company Name</Label>
              <Input value={formData.companyName || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Site Address</Label>
              <Input value={formData.siteAddress || ""} disabled className="bg-slate-50" />
            </div>

            <div>
              <Label>Invoice Posted By *</Label>
              <Select
                value={formData.invoicePostedBy || undefined}
                onValueChange={(value) => handleInputChange("invoicePostedBy", value)}
              >
                <SelectTrigger data-testid="select-invoice-posted-by">
                  <SelectValue placeholder="Select who posted this invoice" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                  {masterData.length > 0 && masterData[0]["Invoice Posted By"] ? (
                    masterData[0]["Invoice Posted By"].map(
                      (item, ind) =>
                        item && (
                          <SelectItem key={ind} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
                            {item}
                          </SelectItem>
                        )
                    )
                  ) : (
                    <SelectItem value="loading" disabled>
                      Loading options...
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Invoice Date *</Label>
              <Input
                type="date"
                value={formData.invoiceDate || ""}
                onChange={(e) => handleInputChange("invoiceDate", e.target.value)}
                required
                data-testid="input-invoice-date"
              />
            </div>

            <div>
              <Label>Invoice No (SERVICE)</Label>
              <Input
                value={formData.invoiceNoSERVICE || ""}
                onChange={(e) => handleInputChange("invoiceNoSERVICE", e.target.value)}
                placeholder="Enter Invoice No (SERVICE)"
              />
            </div>
            <div>
              <Label>Invoice No (SPARE)</Label>
              <Input
                value={formData.invoiceNoSPARE || ""}
                onChange={(e) => handleInputChange("invoiceNoSPARE", e.target.value)}
                placeholder="Enter Invoice No (SPARE)"
              />
            </div>


            <div>
              <Label>Service Amount (Basic)</Label>
              <Input
                type="number"
                value={formData.serviceAmountBasic || ""}
                onChange={(e) => handleInputChange("serviceAmountBasic", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Service Amount (GST)</Label>
              <Input
                type="number"
                value={formData.serviceAmountGst || ""}
                onChange={(e) => handleInputChange("serviceAmountGst", e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Spare Amount (Basic)</Label>
              <Input
                type="number"
                value={formData.spareAmountBasic || ""}
                onChange={(e) => handleInputChange("spareAmountBasic", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Spare Amount (GST)</Label>
              <Input
                type="number"
                value={formData.spareAmountGst || ""}
                onChange={(e) => handleInputChange("spareAmountGst", e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Attachment (Service)</Label>
              <Input
                type="file"
                onChange={(e) => setAttachmentServiceFile(e.target.files[0] || null)}
                disabled={isSubmitting}
              />
              {attachmentServiceFile && (
                <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {attachmentServiceFile.name}</p>
              )}
            </div>
            <div>
              <Label>Attachment (Spare)</Label>
              <Input
                type="file"
                onChange={(e) => setAttachmentSpareFile(e.target.files[0] || null)}
                disabled={isSubmitting}
              />
              {attachmentSpareFile && (
                <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {attachmentSpareFile.name}</p>
              )}
            </div>

            <div className="md:col-span-2 flex justify-end space-x-4 pt-6 border-t border-gray-200 sticky bottom-0 bg-white py-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel-invoice"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-invoice"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <Loader2Icon className="animate-spin mr-2" />
                    Uploading & Submitting...
                  </span>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
              </>
            )}

            {isCancelled && (
              <>
                <div className="md:col-span-2">
                  <Label>Remarks</Label>
                  <Textarea
                    rows={3}
                    value={formData.cancelRemarks || ""}
                    onChange={(e) => handleInputChange("cancelRemarks", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 flex justify-center py-6">
                  <Button
                    type="button"
                    onClick={handleSubmitCancel}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-3"
                  >
                    {cancelSubmit && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
                    Confirm Cancellation
                  </Button>
                </div>
              </>
            )}
          </form>
        </div>
      </Modal>
  );
}
