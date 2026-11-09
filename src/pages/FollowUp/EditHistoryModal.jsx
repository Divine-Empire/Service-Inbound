import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Modal } from "../../components/ui/modal";
import { useToast } from "../../hooks/use-toast";
import { LoaderIcon, Loader2Icon } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { needsAdvanceAttachment } from "./followUpHelpers";

// History tab Edit: re-upload Client Approval and, for Order Received rows, Acceptance Via /
// Advance Payment / Senior Approval on one inbound_follow_up row. Render it only while a row is selected.
export default function EditHistoryModal({ row, masterData, updatedByName, onClose, onSaved }) {
  const editingHistoryRow = row;
  const { toast } = useToast();
  const [editAttachmentUrl, setEditAttachmentUrl] = useState(row["client-attachment"] || "");
  const [isUploadingEditAttachment, setIsUploadingEditAttachment] = useState(false);
  const [isSavingEditAttachment, setIsSavingEditAttachment] = useState(false);
  // Order Received rows: Acceptance Via / Advance Payment / Senior Approval are editable from
  // History too (moved here from the Order Received page).
  const [editOrderFields, setEditOrderFields] = useState({
    acceptanceVia: row.acceptance_via || "",
    advancePaymentAttachmentUrl: row.advance_payment_attachment || "",
    seniorApprovalUrl: row.senior_approval || "",
  });
  const [isUploadingEditOrderFile, setIsUploadingEditOrderFile] = useState(false);

  const handleEditOrderFileChange = (field) => async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingEditOrderFile(true);
    try {
      const path = `follow_up/${editingHistoryRow?.ticketId || editingHistoryRow?.ticket_id}_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("inbound_enquiry")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("inbound_enquiry").getPublicUrl(path);
      setEditOrderFields((prev) => ({ ...prev, [field]: data.publicUrl }));
      toast({ title: "Success", description: "File uploaded successfully" });
    } catch (error) {
      console.error("Error uploading file:", error);
      e.target.value = null;
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploadingEditOrderFile(false);
    }
  };

  const handleEditAttachmentFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingEditAttachment(true);
    try {
      // Reuses the same Supabase storage bucket/path pattern as
      // uploadImageToDrive (the Pending tab's Follow-Up form upload), but
      // keyed off the History row's own ticket_id rather than selectedTicket.
      const path = `follow_up/${editingHistoryRow?.ticketId || editingHistoryRow?.ticket_id}_${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("inbound_enquiry")
        .upload(path, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("inbound_enquiry").getPublicUrl(path);

      setEditAttachmentUrl(data.publicUrl);
      toast({
        title: "Success",
        description: "Client Approval uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading edit attachment:", error);
      e.target.value = null;
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploadingEditAttachment(false);
    }
  };

  const handleSaveEditHistoryAttachment = async () => {
    if (!editingHistoryRow?.id) {
      toast({
        title: "Error",
        description: "Missing follow-up row id, cannot save",
        variant: "destructive",
      });
      return;
    }

    setIsSavingEditAttachment(true);
    try {
      const isOrderRow = editingHistoryRow.stage === "Order Received" && !!editingHistoryRow.payment_mode;
      const isFOCRow = editingHistoryRow.payment_mode === "FOC";
      const { error } = await supabase
        .from("inbound_follow_up")
        .update({
          client_attachment_url: editAttachmentUrl || null,
          last_updated_by: updatedByName,
          ...(isOrderRow
            ? {
                acceptance_via: editOrderFields.acceptanceVia || null,
                ...(isFOCRow
                  ? {}
                  : {
                      ...(needsAdvanceAttachment(editingHistoryRow.payment_mode)
                        ? { advance_payment_attachment: editOrderFields.advancePaymentAttachmentUrl || null }
                        : {}),
                      senior_approval: editOrderFields.seniorApprovalUrl || null,
                    }),
              }
            : {}),
        })
        .eq("id", editingHistoryRow.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Follow-up updated successfully",
      });

      onClose();
      onSaved();
    } catch (error) {
      console.error("Error updating Client Approval:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update Client Approval",
        variant: "destructive",
      });
    } finally {
      setIsSavingEditAttachment(false);
    }
  };

  return (
      <Modal
        isOpen
        onClose={onClose}
        title="Edit Follow-Up"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <Label className="flex items-center gap-2">
              Client Approval
              {isUploadingEditAttachment && (
                <LoaderIcon className="animate-spin w-4 h-4 text-blue-600" />
              )}
            </Label>
            <Input
              type="file"
              disabled={isUploadingEditAttachment || isSavingEditAttachment}
              onChange={handleEditAttachmentFileChange}
              data-testid="edit-history-approval-attachment"
            />
            {isUploadingEditAttachment && (
              <p className="text-xs text-blue-600 mt-1">Uploading file, please wait...</p>
            )}
            {editAttachmentUrl && (
              <p className="mt-1 text-sm text-green-600">
                Currently uploaded:{" "}
                <a
                  href={editAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-green-800 font-medium"
                >
                  View File
                </a>
              </p>
            )}
          </div>

          {editingHistoryRow?.stage === "Order Received" && editingHistoryRow?.payment_mode && (
            <>
              <div>
                <Label>Acceptance Via</Label>
                <Select
                  value={editOrderFields.acceptanceVia || undefined}
                  onValueChange={(value) =>
                    setEditOrderFields((prev) => ({ ...prev, acceptanceVia: value }))
                  }
                >
                  <SelectTrigger data-testid="edit-select-acceptance-via">
                    <SelectValue placeholder="Acceptance Via" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    {(masterData["Acceptance Via"] || []).map((item) => (
                      <SelectItem key={item} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editingHistoryRow.payment_mode !== "FOC" &&
                [
                  ["advancePaymentAttachmentUrl", "Advance Payment Attachment"],
                  ["seniorApprovalUrl", "Senior Approval"],
                ]
                  .filter(([field]) => field !== "advancePaymentAttachmentUrl" || needsAdvanceAttachment(editingHistoryRow.payment_mode))
                  .map(([field, label]) => (
                  <div key={field}>
                    <Label className="flex items-center gap-2">{label}</Label>
                    <Input
                      type="file"
                      disabled={isUploadingEditOrderFile || isSavingEditAttachment}
                      onChange={handleEditOrderFileChange(field)}
                    />
                    {editOrderFields[field] && (
                      <p className="mt-1 text-sm text-green-600">
                        Currently uploaded:{" "}
                        <a
                          href={editOrderFields[field]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-green-800 font-medium"
                        >
                          View File
                        </a>
                      </p>
                    )}
                  </div>
                ))}
              {isUploadingEditOrderFile && (
                <p className="text-xs text-blue-600">Uploading file, please wait...</p>
              )}
            </>
          )}

          <div className="flex space-x-4 pt-2">
            <Button
              type="button"
              onClick={handleSaveEditHistoryAttachment}
              disabled={isUploadingEditAttachment || isSavingEditAttachment || isUploadingEditOrderFile}
              data-testid="button-save-edit-history-attachment"
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-70"
            >
              {isSavingEditAttachment && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSavingEditAttachment}
              data-testid="button-cancel-edit-history-attachment"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
  );
}
