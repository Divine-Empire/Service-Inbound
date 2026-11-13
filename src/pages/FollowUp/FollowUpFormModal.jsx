import { useState } from "react";
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
import { useToast } from "../../hooks/use-toast";
import { LoaderIcon, Loader2Icon } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { needsAdvanceAttachment, computeOrderPlanned, uploadFollowUpFile } from "./followUpHelpers";

// Follow-Up / Order Received / Cancel Ticket form for one pending ticket. Render it only while a
// ticket is selected; onClose closes it, onSaved reloads the page's lists, onCancelled(ticketId)
// drops the ticket from Pending.
export default function FollowUpFormModal({ ticket, masterData, updatedByName, onClose, onSaved, onCancelled }) {
  const selectedTicket = ticket;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [cancelSubmit, setCancelSubmit] = useState(false);
  // Files are only picked here; they are uploaded when the form is submitted (never on selection),
  // so cancelling the form leaves nothing behind in storage.
  const [pickedFiles, setPickedFiles] = useState({});
  // Machine Received is still pending ("Quotation Shared"): Order Received cannot be filled yet.
  const orderBlocked = !!ticket.orderBlocked;
  const [formData, setFormData] = useState(() => ({

    ticketId: ticket.ticketId,
    ticketUuid: ticket.ticketUuid,
    clientName: ticket.clientName,
    phoneNumber: ticket.phoneNumber,
    quotationNo: ticket.quotationNo || "",
    enquiryReceiverName: ticket.enquiryReceiverName || "",
    machineName: ticket.machineName || "",
    engineerAssign: ticket.engineerAssign || "",
    basicAmount: ticket.basicAmount || "",
    totalAmountWithTax: ticket.totalAmoutWithTex || "",
    quotationPdfLink: ticket.quotationPdfLink || "",
    quotationShareBy: ticket.quotationShareByPersonName || "",
    shareThrough: ticket.ShareThrough || "",
    remarks: ticket.quotationremarks || "",
    // Legacy 'Order Received' row without order details: only the Order
    // Received form applies, and its Client Approval is already uploaded.
    // Proforma Inv. tab rows (PI already made) and legacy order rows only ever process Order Received.
    stage: ticket.legacyOrderRow || ticket.fromProforma ? "Order Received" : "",
    piNumber: "",
    piAmount: "",
    piRemarks: "",
    whatDidCustomerSay: "",
    nextAction: "",
    nextDateOfCall: "",
    clientAttachmentUrl: ticket.legacyOrderRow?.client_attachment_url || "",
    paymentTerm: "",
    acceptanceVia: "",
    paymentMode: "",
    advancePaymentAttachmentUrl: "",
    seniorApprovalUrl: "",
    seniorApprovedBy: "",
  }));

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFilePick = (field) => (e) => {
    const file = e.target.files?.[0] || null;
    setPickedFiles((prev) => ({ ...prev, [field]: file }));
  };

  const pickedName = (field) =>
    pickedFiles[field] ? (
      <p className="mt-1 text-sm text-slate-600 truncate">Selected: {pickedFiles[field].name} (uploads on Submit)</p>
    ) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // if (!formData.clientName || !formData.phoneNumber || !formData.title) {
    //  toast({
    //    title: "Error",
    //    description: "Please fill in all required fields",
    //    variant: "destructive",
    //  });
    //  return;
    // }

    if (!formData.stage) {
      alert("Please select a Stage");
      return;
    }

    if (formData.stage === "Order Received" && orderBlocked) return;

    if (formData.stage === "Make PI") {
      if (!formData.piNumber.trim()) {
        alert("Please enter the PI Number");
        return;
      }
      const amount = Number(formData.piAmount);
      if (formData.piAmount === "" || !Number.isFinite(amount) || amount < 0) {
        alert("Please enter a valid PI Amount");
        return;
      }
      if (!pickedFiles.piUpload) {
        alert("Please attach the PI Upload file");
        return;
      }
    } else if (formData.stage === "Follow-Up") {
      if (!formData.whatDidCustomerSay) {
        alert("Please Write Something in What did Customer Say");
        return;
      }

      if (!formData.nextAction) {
        alert("Please Write Something in Next Action");
        return;
      }
      if (!formData.nextDateOfCall) {
        alert("Please Select Next Date of Call");
        return;
      }
    } else if (formData.stage === "Order Received") {
      if (!formData.clientAttachmentUrl && !pickedFiles.clientAttachmentUrl) {
        alert("Please attach the Client Approval file");
        return;
      }
      if (!formData.paymentTerm) {
        alert("Please select Payment Term");
        return;
      }
      if (!formData.acceptanceVia) {
        alert("Please select Acceptance Via");
        return;
      }
      if (!formData.paymentMode) {
        alert("Please select Payment Mode");
        return;
      }
      // Advance Payment / Senior Approval are skipped for FOC (no payment).
      if (formData.paymentMode !== "FOC") {
        if (needsAdvanceAttachment(formData.paymentMode) && !formData.advancePaymentAttachmentUrl && !pickedFiles.advancePaymentAttachmentUrl) {
          alert("Please attach the Advance Payment Attachment");
          return;
        }
        if (!formData.seniorApprovalUrl && !pickedFiles.seniorApprovalUrl) {
          alert("Please attach the Senior Approval file");
          return;
        }
        if (!formData.seniorApprovedBy) {
          alert("Please select Senior Approved By");
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      let error;
      if (formData.stage === "Make PI") {
        // Proforma Invoice: a log row only. The ticket moves to the Proforma Inv. tab and waits there
        // for its Order Received; no stage / planned time is touched.
        const piUrl = await uploadFollowUpFile(selectedTicket?.ticketId, pickedFiles.piUpload);
        ({ error } = await supabase.from("inbound_follow_up").insert({
          ticket_id: formData.ticketId,
          ticket_uuid: formData.ticketUuid,
          stage: "Make PI",
          engineer_assign: formData.engineerAssign || null,
          pi_number: formData.piNumber.trim(),
          pi_amount: Number(formData.piAmount),
          pi_upload: piUrl,
          pi_remarks: formData.piRemarks.trim() || null,
          last_updated_by: updatedByName,
        }));
      } else if (formData.stage === "Order Received") {
        const isFOC = formData.paymentMode === "FOC";
        const legacyRow = selectedTicket?.legacyOrderRow;
        const planned = await computeOrderPlanned({ baseTime: new Date() });

        // Upload the picked files now (the form is being submitted).
        const urlFor = async (field) =>
          pickedFiles[field] ? uploadFollowUpFile(selectedTicket?.ticketId, pickedFiles[field]) : formData[field];
        const clientUrl = await urlFor("clientAttachmentUrl");
        const advanceUrl = needsAdvanceAttachment(formData.paymentMode) ? await urlFor("advancePaymentAttachmentUrl") : null;
        const seniorUrl = isFOC ? null : await urlFor("seniorApprovalUrl");

        const orderFields = {
          client_attachment_url: clientUrl || null,
          payment_term: formData.paymentTerm || null,
          acceptance_via: formData.acceptanceVia || null,
          payment_mode: formData.paymentMode || null,
          advance_payment_attachment: advanceUrl || null,
          senior_approval: seniorUrl || null,
          senior_approved_by: isFOC ? null : formData.seniorApprovedBy || null,
          last_updated_by: updatedByName,
          // The separate Order Received stage is gone — never feed it again.
          order_received_planned: null,
          ...planned,
        };

        ({ error } = legacyRow
          ? await supabase.from("inbound_follow_up").update(orderFields).eq("id", legacyRow.id)
          : await supabase.from("inbound_follow_up").insert({
              ticket_id: formData.ticketId,
              ticket_uuid: formData.ticketUuid,
              stage: formData.stage,
              engineer_assign: formData.engineerAssign || null,
              ...orderFields,
            }));
      } else {
        ({ error } = await supabase.from("inbound_follow_up").insert({
          ticket_id: formData.ticketId,
          ticket_uuid: formData.ticketUuid,
          stage: formData.stage,
          engineer_assign: formData.engineerAssign || null,
          what_did_customer_say: formData.whatDidCustomerSay || null,
          next_action: formData.nextAction || null,
          next_date_of_call: formData.nextDateOfCall || null,
          last_updated_by: updatedByName,
        }));
      }

      if (error) throw error;

      onClose();

      toast({
        title: "Success",
        description: "follow-up added successfully",
      });

      onSaved();
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save ticket",
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
        cancelled_from_stage: "Follow-Up",
        remarks: formData.cancelRemarks || null,
      });

      if (error) throw error;

      // Removes it from the page's own pending list only (see migration 0046's comment).
      onCancelled(selectedTicket.ticketId);
      toast({
        title: "Success",
        description: "Ticket cancelled successfully",
      });
      onClose();
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

  const renderConditionalFields = () => {
    const stage = formData.stage;

    if (
      // stage === "call-not-picked" ||
      stage === "Follow-Up"
      // stage === "introductory-call"
    ) {
      return (
        <>
          <div>
            <Label>What Did The Customer Say *</Label>
            <Textarea
              rows={3}
              value={formData.whatDidCustomerSay || ""}
              onChange={(e) =>
                handleInputChange("whatDidCustomerSay", e.target.value)
              }
              data-testid="textarea-customer-say"
            />
          </div>
          <div>
            <Label>Next Action *</Label>
            <Select
              value={formData.nextAction || undefined}
              onValueChange={(value) => handleInputChange("nextAction", value)}
            >
              <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500" data-testid="select-next-action">
                <SelectValue placeholder="Select Next Action" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {[
                  "Quotation Sent",
                  "Follow-up Required",
                  "Customer Contacted",
                  "Under Discussion",
                  "Price Negotiation",
                  "Waiting for Customer Response",
                  "Purchase Decision Pending",
                  "Quotation Revised",
                  "Order Confirmed",
                  "Order Lost",
                  "On Hold",
                  "Not Interested",
                ].map((option) => (
                  <SelectItem key={option} value={option} className="hover:bg-blue-50 focus:bg-blue-50">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Next Date Of Call *</Label>
            <Input
              type="date"
              value={formData.nextDateOfCall || ""}
              onChange={(e) =>
                handleInputChange("nextDateOfCall", e.target.value)
              }
              data-testid="input-next-date"
            />
          </div>
        </>
      );
    } else if (stage === "Make PI") {
      return (
        <>
          <div>
            <Label>PI Number *</Label>
            <Input
              placeholder="Enter PI number"
              value={formData.piNumber}
              onChange={(e) => handleInputChange("piNumber", e.target.value)}
              data-testid="input-pi-number"
            />
          </div>
          <div>
            <Label>PI Amount *</Label>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="Enter PI amount"
              value={formData.piAmount}
              onChange={(e) => handleInputChange("piAmount", e.target.value)}
              data-testid="input-pi-amount"
            />
          </div>
          <div>
            <Label>PI Upload *</Label>
            <Input type="file" onChange={handleFilePick("piUpload")} data-testid="input-pi-upload" />
            {pickedName("piUpload")}
          </div>
          <div>
            <Label>Remarks</Label>
            <Input
              placeholder="Enter any remarks..."
              value={formData.piRemarks}
              onChange={(e) => handleInputChange("piRemarks", e.target.value)}
              data-testid="input-pi-remarks"
            />
          </div>
        </>
      );
    } else if (stage === "Order Received") {
      return (
        <fieldset disabled={orderBlocked} className={"contents" + (orderBlocked ? " opacity-60" : "")}>
          <div>
            <Label className="flex items-center gap-2">
              Client Approval *
            </Label>
            <Input
              type="file"
              onChange={handleFilePick("clientAttachmentUrl")}
              data-testid="approval-attachments"
            />
            {pickedName("clientAttachmentUrl")}
            {formData.clientAttachmentUrl && (
              <p className="mt-1 text-sm text-green-600">
                Current attachment:{" "}
                <a
                  href={formData.clientAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-green-800 font-medium"
                >
                  View File
                </a>
              </p>
            )}
          </div>
          <div>
            <Label>Payment Term *</Label>
            <Select
              value={formData.paymentTerm || undefined}
              onValueChange={(value) => handleInputChange("paymentTerm", value)}
            >
              <SelectTrigger data-testid="select-payment-term">
                <SelectValue placeholder="Select payment term" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {(masterData["Payment Terms"] || []).length > 0 ? (
                  masterData["Payment Terms"].map((item) => (
                    <SelectItem key={item} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
                      {item}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="loading" disabled>
                    Loading options...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Acceptance Via *</Label>
            <Select
              value={formData.acceptanceVia || undefined}
              onValueChange={(value) => handleInputChange("acceptanceVia", value)}
            >
              <SelectTrigger data-testid="select-acceptance-via">
                <SelectValue placeholder="Acceptance Via" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {(masterData["Acceptance Via"] || []).length > 0 ? (
                  masterData["Acceptance Via"].map((item) => (
                    <SelectItem key={item} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
                      {item}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="loading" disabled>
                    Loading options...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment Mode *</Label>
            <Select
              value={formData.paymentMode || undefined}
              onValueChange={(value) => handleInputChange("paymentMode", value)}
            >
              <SelectTrigger data-testid="select-payment-mode">
                <SelectValue placeholder="Select payment mode" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {(masterData["Payment Mode"] || []).length > 0 ? (
                  masterData["Payment Mode"].map((item) => (
                    <SelectItem key={item} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
                      {item}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="loading" disabled>
                    Loading options...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {needsAdvanceAttachment(formData.paymentMode) && (
            <div>
              <Label className="flex items-center gap-2">
                Advance Payment Attachment *
              </Label>
              <Input
                type="file"
                onChange={handleFilePick("advancePaymentAttachmentUrl")}
                data-testid="input-advance-payment-attachment"
              />
              {pickedName("advancePaymentAttachmentUrl")}
              {formData.advancePaymentAttachmentUrl && (
                <p className="mt-1 text-sm text-green-600">
                  Uploaded:{" "}
                  <a
                    href={formData.advancePaymentAttachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-green-800 font-medium"
                  >
                    View File
                  </a>
                </p>
              )}
            </div>
          )}
          {formData.paymentMode && formData.paymentMode !== "FOC" && (
            <>
            <div>
              <Label className="flex items-center gap-2">
                Senior Approval *
              </Label>
              <Input
                type="file"
                onChange={handleFilePick("seniorApprovalUrl")}
                data-testid="input-senior-approval"
              />
              {pickedName("seniorApprovalUrl")}
              {formData.seniorApprovalUrl && (
                <p className="mt-1 text-sm text-green-600">
                  Uploaded:{" "}
                  <a
                    href={formData.seniorApprovalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-green-800 font-medium"
                  >
                    View File
                  </a>
                </p>
              )}
            </div>
            <div>
              <Label>Senior Approved By *</Label>
              <Select
                value={formData.seniorApprovedBy || undefined}
                onValueChange={(value) => handleInputChange("seniorApprovedBy", value)}
              >
                <SelectTrigger data-testid="select-senior-approved-by">
                  <SelectValue placeholder="Select senior" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {(masterData["Senior Approved By"] || []).length > 0 ? (
                    masterData["Senior Approved By"].map((item) => (
                      <SelectItem key={item} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
                        {item}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="loading" disabled>
                      Loading options...
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            </>
          )}
        </fieldset>
      );
    }
    return null;
  };

  return (
      <Modal
        isOpen
        onClose={onClose}
        title="Follow-Up"
        size="4xl"
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="flex items-center space-x-2 mb-10">
            <input
              type="checkbox"
              id="cancelTicket"
              checked={isCancelled}
              onChange={(e) => setIsCancelled(e.target.checked)}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <Label htmlFor="cancelTicket" className="text-red-600 font-medium">
              Cancel Ticket
            </Label>
          </div>

          {/* Shown beside Cancel Ticket while the machine is still on hold in Machine Received. */}
          {orderBlocked && formData.stage === "Order Received" && !isCancelled ? (
            <div
              role="alert"
              className="self-start rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
              data-testid="order-blocked-message"
            >
              Please receive the machine from the Quotation Shared tab in Machine Received first. You can proceed with this order only after that.
            </div>
          ) : (
            <div></div>
          )}

          {/* Pre-filled fields */}
          <div>
            <Label>Ticket ID</Label>
            <Input
              value={formData.ticketId || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          <div>
            <Label>Client Name</Label>
            <Input
              value={formData.clientName || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input
              value={formData.phoneNumber || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          {/* NEW: Quotation No Field in Modal */}
          <div>
            <Label>Quotation No.</Label>
            <Input
              value={formData.quotationNo || ""}
              disabled
              className="bg-slate-50"
            />
          </div>

          {!isCancelled && (
            <>
              <div>
                <Label>Stage</Label>
                <Select
                  value={formData.stage || undefined} // Use undefined instead of empty string
                  onValueChange={(value) => handleInputChange("stage", value)}
                  disabled={!!selectedTicket?.legacyOrderRow || !!selectedTicket?.fromProforma}
                >
                  <SelectTrigger data-testid="select-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    <SelectItem value="Follow-Up" className="hover:bg-blue-50 focus:bg-blue-50">
                      Follow-Up
                    </SelectItem>
                    <SelectItem value="Make PI" className="hover:bg-blue-50 focus:bg-blue-50">
                      Make PI
                    </SelectItem>
                    <SelectItem value="Order Received" className="hover:bg-blue-50 focus:bg-blue-50">
                      Order Received
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional fields based on stage */}
              {renderConditionalFields()}

              <div className="md:col-span-2 flex space-x-4 pt-4">
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (formData.stage === "Order Received" && orderBlocked)
                  }
                  data-testid="button-submit-followup"
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-70 disabled:transform-none"
                >
                  {isSubmitting && <Loader2Icon className="animate-spin" />}
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  data-testid="button-cancel-followup"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}

          {isCancelled && (
            <>
              <div>
                <Label>Remarks</Label>
                <Textarea
                  rows={3}
                  value={formData.cancelRemarks || ""}
                  onChange={(e) =>
                    handleInputChange("cancelRemarks", e.target.value)
                  }
                  data-testid="textarea-remark"
                />
              </div>

              <div className="flex justify-center py-6">
                <Button
                  type="button"
                  onClick={handleSubmitCancel}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3"
                >
                  {cancelSubmit && (
                    <Loader2Icon className="animate-spin w-4 h-4 mr-2" />
                  )}
                  Confirm Cancellation
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>
  );
}
