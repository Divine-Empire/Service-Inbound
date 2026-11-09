import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
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
import { MultiSelect } from "../../components/ui/multi-select";
import { enquiryTypeList } from "../../lib/enquiryType";

// Edit form for one History row (a posted invoice, plus the ticket's editable Enquiry Type).
// Render it only while a row is selected. Deliberately separate from InvoiceForm's state.
export default function EditInvoiceModal({ row: editingHistoryRow, masterData, onClose, onSaved }) {
  const { toast } = useToast();
  const ticket = editingHistoryRow;
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editAttachmentServiceFile, setEditAttachmentServiceFile] = useState(null);
  const [editAttachmentSpareFile, setEditAttachmentSpareFile] = useState(null);
  const [editFormData, setEditFormData] = useState(() => ({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      companyName: ticket.companyName || "",
      siteAddress: ticket.siteAddress || "",
      quotationNo: ticket.quotationNo || "",
      quotationPdfLink: ticket.quotationPdfLink || "",
      enquiryType: enquiryTypeList(ticket.enquiryTypes),
      invoicePostedBy: ticket.invoicePostedBy || "",
      invoiceDate: ticket.invoiceDate || "",
      invoiceNoSERVICE: ticket.invoiceNoSERVICE || "",
      invoiceNoSPARE: ticket.invoiceNoSPARE || "",
      serviceAmountBasic: ticket.serviceAmountBasic ?? "",
      serviceAmountGst: ticket.serviceAmountGst ?? "",
      spareAmountBasic: ticket.spareAmountBasic ?? "",
      spareAmountGst: ticket.spareAmountGst ?? "",
      attachmentService: ticket.attachmentService || "",
      attachmentSpare: ticket.attachmentSpare || "",
  }));

  const handleEditInputChange = (field, value) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadEditAttachment = async (file, prefix) => {
    const path = `invoice/${prefix}_${editingHistoryRow?.ticketId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("inbound_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("inbound_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsEditSubmitting(true);

    try {
      // Only newly-picked files get (re-)uploaded — otherwise keep whatever
      // URL was already on the row.
      const [attachmentServiceUrl, attachmentSpareUrl] = await Promise.all([
        editAttachmentServiceFile
          ? uploadEditAttachment(editAttachmentServiceFile, "service")
          : Promise.resolve(editFormData.attachmentService || null),
        editAttachmentSpareFile
          ? uploadEditAttachment(editAttachmentSpareFile, "spare")
          : Promise.resolve(editFormData.attachmentSpare || null),
      ]);

      const invoiceUpdatePayload = {
        invoice_posted_by: editFormData.invoicePostedBy || null,
        invoice_date: editFormData.invoiceDate || null,
        invoice_no_service: editFormData.invoiceNoSERVICE || null,
        invoice_no_spare: editFormData.invoiceNoSPARE || null,
        service_amount_basic: editFormData.serviceAmountBasic || null,
        service_amount_gst: editFormData.serviceAmountGst || null,
        spare_amount_basic: editFormData.spareAmountBasic || null,
        spare_amount_gst: editFormData.spareAmountGst || null,
        attachment_service: attachmentServiceUrl,
        attachment_spare: attachmentSpareUrl,
      };

      // Enquiry Type decides whether the ticket has a calibration_planned (only the two calibration
      // types do). It was computed once at invoice creation, so a later edit recomputes it from the
      // SAME base time (this invoice's created_at), not "now" - an edit must not shift the TAT deadline.
      const originalTypes = enquiryTypeList(editingHistoryRow.enquiryTypes);
      const newTypes = enquiryTypeList(editFormData.enquiryType);
      const enquiryTypeChanged = [...originalTypes].sort().join("|") !== [...newTypes].sort().join("|");
      let enquiryTypeBlocked = false;

      if (enquiryTypeChanged) {
        if (newTypes.length === 0) throw new Error("Select at least one Enquiry Type");

        // Once Calibration has been processed (an inbound_calibration row exists) the Enquiry Type is
        // locked: changing it could desync the ticket from calibration work that is already done.
        const { data: calibrationRows, error: calibrationCheckError } = await supabase
          .from("inbound_calibration")
          .select("id")
          .eq("ticket_uuid", editingHistoryRow.ticketUuid)
          .limit(1);
        if (calibrationCheckError) throw calibrationCheckError;

        if (calibrationRows && calibrationRows.length > 0) {
          enquiryTypeBlocked = true;
        } else {
          invoiceUpdatePayload.calibration_planned = await computeStagePlanned("calibration", {
            ticket: { enquiryType: newTypes },
            invoiceSubmittedAt: editingHistoryRow.invoiceCreatedAt ? new Date(editingHistoryRow.invoiceCreatedAt) : new Date(),
          });
        }
      }

      const { error: invoiceError } = await supabase
        .from("inbound_invoice")
        .update(invoiceUpdatePayload)
        .eq("ticket_uuid", editingHistoryRow.ticketUuid);

      if (invoiceError) throw invoiceError;

      if (enquiryTypeChanged && !enquiryTypeBlocked) {
        const { error: ticketError } = await supabase
          .from("inbound_tickets")
          .update({ enquiry_type: newTypes })
          .eq("uuid", editingHistoryRow.ticketUuid);

        if (ticketError) throw ticketError;
      }

      if (enquiryTypeBlocked) {
        toast({
          title: "Enquiry Type not changed",
          description:
            "This ticket has already been processed through the Calibration stage, so its Enquiry Type can no longer be changed. The rest of the invoice details were saved.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Invoice details updated successfully",
        });
      }
      onClose();
      onSaved();
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update invoice details",
        variant: "destructive",
      });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  return (
      <Modal
        isOpen
        onClose={onClose}
        title="Edit Invoice"
        size="2xl"
      >
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-4 pb-4">
          <form
            onSubmit={handleEditSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div>
              <Label>Ticket ID</Label>
              <Input value={editFormData.ticketId || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Client Name</Label>
              <Input value={editFormData.clientName || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input value={editFormData.phoneNumber || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Quotation No.</Label>
              <Input value={editFormData.quotationNo || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Company Name</Label>
              <Input value={editFormData.companyName || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Site Address</Label>
              <Input value={editFormData.siteAddress || ""} disabled className="bg-slate-50" />
            </div>

            <div>
              <Label>Enquiry Type</Label>
              <MultiSelect
                options={(masterData.length > 0 && masterData[0]["Enquiry Type"]) || []}
                value={editFormData.enquiryType}
                onChange={(value) => handleEditInputChange("enquiryType", value)}
                placeholder="Select enquiry type(s)"
              />
            </div>

            <div>
              <Label>Invoice Posted By *</Label>
              <Select
                value={editFormData.invoicePostedBy || undefined}
                onValueChange={(value) => handleEditInputChange("invoicePostedBy", value)}
              >
                <SelectTrigger data-testid="select-edit-invoice-posted-by">
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
                value={editFormData.invoiceDate || ""}
                onChange={(e) => handleEditInputChange("invoiceDate", e.target.value)}
                required
                data-testid="input-edit-invoice-date"
              />
            </div>

            <div>
              <Label>Invoice No (SERVICE)</Label>
              <Input
                value={editFormData.invoiceNoSERVICE || ""}
                onChange={(e) => handleEditInputChange("invoiceNoSERVICE", e.target.value)}
                placeholder="Enter Invoice No (SERVICE)"
              />
            </div>
            <div>
              <Label>Invoice No (SPARE)</Label>
              <Input
                value={editFormData.invoiceNoSPARE || ""}
                onChange={(e) => handleEditInputChange("invoiceNoSPARE", e.target.value)}
                placeholder="Enter Invoice No (SPARE)"
              />
            </div>


            <div>
              <Label>Service Amount (Basic)</Label>
              <Input
                type="number"
                value={editFormData.serviceAmountBasic || ""}
                onChange={(e) => handleEditInputChange("serviceAmountBasic", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Service Amount (GST)</Label>
              <Input
                type="number"
                value={editFormData.serviceAmountGst || ""}
                onChange={(e) => handleEditInputChange("serviceAmountGst", e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Spare Amount (Basic)</Label>
              <Input
                type="number"
                value={editFormData.spareAmountBasic || ""}
                onChange={(e) => handleEditInputChange("spareAmountBasic", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Spare Amount (GST)</Label>
              <Input
                type="number"
                value={editFormData.spareAmountGst || ""}
                onChange={(e) => handleEditInputChange("spareAmountGst", e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Attachment (Service)</Label>
              <Input
                type="file"
                onChange={(e) => setEditAttachmentServiceFile(e.target.files[0] || null)}
                disabled={isEditSubmitting}
              />
              {editAttachmentServiceFile ? (
                <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {editAttachmentServiceFile.name}</p>
              ) : editFormData.attachmentService ? (
                <a
                  href={editFormData.attachmentService}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
                >
                  View current file
                </a>
              ) : null}
            </div>
            <div>
              <Label>Attachment (Spare)</Label>
              <Input
                type="file"
                onChange={(e) => setEditAttachmentSpareFile(e.target.files[0] || null)}
                disabled={isEditSubmitting}
              />
              {editAttachmentSpareFile ? (
                <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {editAttachmentSpareFile.name}</p>
              ) : editFormData.attachmentSpare ? (
                <a
                  href={editFormData.attachmentSpare}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
                >
                  View current file
                </a>
              ) : null}
            </div>

            <div className="md:col-span-2 flex justify-end space-x-4 pt-6 border-t border-gray-200 sticky bottom-0 bg-white py-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel-edit-invoice"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isEditSubmitting}
                data-testid="button-submit-edit-invoice"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
              >
                {isEditSubmitting ? (
                  <span className="flex items-center">
                    <Loader2Icon className="animate-spin mr-2" />
                    Uploading & Saving...
                  </span>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
  );
}
