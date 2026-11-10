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
import { Loader2Icon } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { needsAdvanceAttachment, uploadFollowUpFile } from "./followUpHelpers";

// History tab Edit: re-upload Client Approval and, for Order Received rows, Acceptance Via /
// Advance Payment / Senior Approval on one inbound_follow_up row. Render it only while a row is selected.
export default function EditHistoryModal({ row, masterData, updatedByName, onClose, onSaved }) {
  const editingHistoryRow = row;
  const { toast } = useToast();
  const [editAttachmentUrl] = useState(row["client-attachment"] || "");
  // Files are only picked here and uploaded on Save, so closing the modal never leaves files in storage.
  const [pickedFiles, setPickedFiles] = useState({});
  const [isSavingEditAttachment, setIsSavingEditAttachment] = useState(false);
  // Order Received rows: Acceptance Via / Advance Payment / Senior Approval are editable from
  // History too (moved here from the Order Received page).
  const [editOrderFields, setEditOrderFields] = useState({
    acceptanceVia: row.acceptance_via || "",
    advancePaymentAttachmentUrl: row.advance_payment_attachment || "",
    seniorApprovalUrl: row.senior_approval || "",
  });
  const handleFilePick = (field) => (e) => {
    const file = e.target.files?.[0] || null;
    setPickedFiles((prev) => ({ ...prev, [field]: file }));
  };

  const pickedName = (field) =>
    pickedFiles[field] ? (
      <p className="mt-1 text-sm text-slate-600 truncate">Selected: {pickedFiles[field].name} (uploads on Save)</p>
    ) : null;

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
      const ticketKey = editingHistoryRow?.ticketId || editingHistoryRow?.ticket_id;
      const urlFor = async (field, current) =>
        pickedFiles[field] ? uploadFollowUpFile(ticketKey, pickedFiles[field]) : current;
      const clientUrl = await urlFor("client", editAttachmentUrl);
      const advanceUrl = await urlFor("advancePaymentAttachmentUrl", editOrderFields.advancePaymentAttachmentUrl);
      const seniorUrl = await urlFor("seniorApprovalUrl", editOrderFields.seniorApprovalUrl);
      const { error } = await supabase
        .from("inbound_follow_up")
        .update({
          client_attachment_url: clientUrl || null,
          last_updated_by: updatedByName,
          ...(isOrderRow
            ? {
                acceptance_via: editOrderFields.acceptanceVia || null,
                ...(isFOCRow
                  ? {}
                  : {
                      ...(needsAdvanceAttachment(editingHistoryRow.payment_mode)
                        ? { advance_payment_attachment: advanceUrl || null }
                        : {}),
                      senior_approval: seniorUrl || null,
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
            </Label>
            <Input
              type="file"
              disabled={isSavingEditAttachment}
              onChange={handleFilePick("client")}
              data-testid="edit-history-approval-attachment"
            />
            {pickedName("client")}
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
                      disabled={isSavingEditAttachment}
                      onChange={handleFilePick(field)}
                    />
                    {pickedName(field)}
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
            </>
          )}

          <div className="flex space-x-4 pt-2">
            <Button
              type="button"
              onClick={handleSaveEditHistoryAttachment}
              disabled={isSavingEditAttachment}
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
