import { useState, useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Modal } from "../../components/ui/modal";
import { Loader2Icon, LoaderIcon } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";

// Create / Revise Quotation (and Cancel Ticket) form for one ticket. Render it only while a ticket
// is selected. historyEdit = opened from History's admin-only Edit (hides "Cancel Ticket").
// onClose closes it; onSaved reloads the page's lists; onCancelled(ticketId) drops the ticket from Pending.
export default function QuotationFormModal({ ticket, historyEdit, masterData, onClose, onSaved, onCancelled }) {
  const selectedTicket = ticket;
  const isHistoryEditMode = historyEdit;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingQuotation, setIsUploadingQuotation] = useState(false);
  const [quotationPdfFile, setQuotationPdfFile] = useState(null);
  // Latest Quotation No. the user picked: lets the async items lookup in handleQuotationNoChange
  // drop a stale response after a quick A -> B switch.
  const latestQuotationNoRef = useRef("");
  const [isCancelled, setIsCancelled] = useState(false);
  const [cancelSubmit, setCancelSubmit] = useState(false);
  // Quotations previously built (via "Make Quotation") for this ticket: powers the Quotation No.
  // dropdown and its Basic/Total/PDF autofill.
  const [generatedQuotations, setGeneratedQuotations] = useState([]);
  const [formData, setFormData] = useState(() => ({
    ticketId: ticket.ticketId,
    clientName: ticket.clientName,
    phoneNumber: ticket.phoneNumber,
    enquiryReceiverName: ticket.enquiryReceiverName || "",
    machineName: ticket.machineName || "",
    siteAddress: ticket.siteAddress || "",
    // Prefill from the existing quotation when revising; blank for a first-time quote.
    quotationNo: ticket.quotationNo || "",
    basicAmount: ticket.basicAmount || "",
    totalAmountWithTax: ticket.totalQutation || "",
    quotationPdfLink: ticket.quotationPdfLink || "",
    quotationShareBy: ticket.quotationShareBy || "",
    shareThrough: ticket.shareThrough || "",
    remarks: ticket.remarks || "",
  }));

  useEffect(() => {
    if (ticket.ticketUuid) fetchGeneratedQuotations(ticket.ticketUuid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every quotation (and revision) built via "Make Quotation" for this
  // ticket — mirrors Lead-To-Order-Supabase-New's MakeQuotationFrom.jsx
  // fetchGeneratedQuotations, sourced from make_quotation.ticket_uuid.
  const fetchGeneratedQuotations = async (ticketUuid) => {
    try {
      const { data, error } = await supabase
        .from("inbound_make_quotations")
        .select("quotation_no, grand_total, pdf_url, created_at")
        .eq("ticket_uuid", ticketUuid)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setGeneratedQuotations(data || []);
    } catch (error) {
      console.error("Error fetching generated quotations for ticket:", error);
      setGeneratedQuotations([]);
    }
  };

  // Selecting a Quotation No. pre-fills Total Amount / PDF link from the
  // matched make_quotation row, and Basic Amount from the sum of that
  // quotation's non-freight quotation_items.amount. Fields stay editable
  // afterward (pre-fill, not lock) — same as MakeQuotationFrom.jsx.
  //
  // Everything is replaced (or cleared) on every switch so nothing from the
  // previously selected quotation can linger: a manually picked PDF file
  // (which would otherwise hide the new link and be uploaded on submit), the
  // old link when the new row has none, or the old amounts.
  const handleQuotationNoChange = (value) => {
    latestQuotationNoRef.current = value;
    const matched = generatedQuotations.find((q) => q.quotation_no === value);

    setQuotationPdfFile(null);
    setFormData((prev) => ({
      ...prev,
      quotationNo: value,
      totalAmountWithTax:
        matched && matched.grand_total !== undefined && matched.grand_total !== null
          ? String(matched.grand_total)
          : "",
      quotationPdfLink: matched?.pdf_url || "",
      basicAmount: "",
    }));

    if (value) {
      supabase
        .from("inbound_quotation_items")
        .select("amount, is_freight")
        .eq("quotation_no", value)
        .then(({ data: items, error }) => {
          // User already moved on to another quotation — ignore this response.
          if (latestQuotationNoRef.current !== value) return;
          if (!error && items && items.length > 0) {
            const subtotal = items.reduce((sum, item) => {
              if (item.is_freight) return sum;
              return sum + (Number(item.amount) || 0);
            }, 0);
            handleInputChange("basicAmount", String(Math.round(subtotal * 100) / 100));
          }
        });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadImageToDrive = async (file) => {
    try {
      const path = `quotation/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("inbound_enquiry")
        .upload(path, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("inbound_enquiry").getPublicUrl(path);

      return { success: true, fileUrl: data.publicUrl };
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
      return { success: false, error: error.message || "Failed to upload image" };
    }
  };

  // Just holds the picked file — actual upload happens at submit time in
  // handleSubmit, so cancelling the form never leaves an orphaned upload behind.
  const handleQuotationChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setQuotationPdfFile(file);
    handleInputChange("quotationPdfLink", "");
  };

  const removeQuotationPdfFile = () => {
    setQuotationPdfFile(null);
    handleInputChange("quotationPdfLink", "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!quotationPdfFile && !formData.quotationPdfLink) {
      toast({ title: "Validation Error", description: "Please Upload quotation PDF", variant: "destructive" });
      return;
    }

    if (!formData.quotationShare) {
      toast({ title: "Validation Error", description: "Please select quotation Share", variant: "destructive" });
      return;
    }

    if (!formData.quotationShareBy) {
      toast({ title: "Validation Error", description: "Please select quotation Shareby", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      let fileUrl = formData.quotationPdfLink || "";

      if (quotationPdfFile) {
        setIsUploadingQuotation(true);
        const uploadResult = await uploadImageToDrive(quotationPdfFile);
        setIsUploadingQuotation(false);
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "Failed to upload quotation PDF");
        }
        fileUrl = uploadResult.fileUrl;
      }

      const payload = {
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        quotation_no: formData.quotationNo || null,
        basic_amount: formData.basicAmount ? Number(formData.basicAmount) : null,
        total_amount: formData.totalAmountWithTax ? Number(formData.totalAmountWithTax) : null,
        quotation_pdf_link: fileUrl || null,
        quotation_share_by: formData.quotationShareBy || null,
        share_through: "Mail",
        remarks: formData.remarks || null,
      };

      // Locked in on the FIRST quotation only — omitted on every later
      // revision so it's never overwritten (revising a quotation shouldn't
      // restart FollowUp's readiness clock).
      if (!selectedTicket.hasQuotation) {
        payload.follow_up_planned = new Date().toISOString();
      }

      const { error } = await supabase
        .from("inbound_quotations")
        .upsert(payload, { onConflict: "ticket_uuid" });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Ticket details saved successfully",
      });

      onClose();
      onSaved();
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save ticket details",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploadingQuotation(false);
    }
  };

  const handleSubmitCancel = async (e) => {
    e.preventDefault();

    setCancelSubmit(true);

    try {
      const { error } = await supabase.from("inbound_cancelled_tickets").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        cancelled_from_stage: "Quotation",
        remarks: formData.cancelRemarks || null,
      });

      if (error) throw error;

      // Removes it from the page's own pending list only (see migration 0046's comment).
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
        title={selectedTicket?.hasQuotation ? "Revise Quotation" : "Create Quotation"}
        size="2xl"
      >
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-4 pb-4">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {!isHistoryEditMode && (
              <div className="flex items-center space-x-2 mb-10">
                <input
                  type="checkbox"
                  id="cancelTicket"
                  checked={isCancelled}
                  onChange={(e) => setIsCancelled(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-destructive"
                />
                <Label
                  htmlFor="cancelTicket"
                  className="text-destructive font-medium"
                >
                  Cancel Ticket
                </Label>
              </div>
            )}

            <div></div>

            {/* Pre-filled fields */}
            <div>
              <Label htmlFor="quo-ticketId">Ticket ID</Label>
              <Input
                id="quo-ticketId"
                value={formData.ticketId || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="quo-clientName">Client Name</Label>
              <Input
                id="quo-clientName"
                value={formData.clientName || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="quo-phoneNumber">Phone Number</Label>
              <Input
                id="quo-phoneNumber"
                value={formData.phoneNumber || ""}
                disabled
                className="bg-muted"
              />
            </div>

            {!isCancelled && (
              <>
                <div>
                  <Label htmlFor="quo-siteAddress">Site Address</Label>
                  <Input
                    id="quo-siteAddress"
                    value={formData.siteAddress || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div>
                  <Label htmlFor="quo-quotationNo">Quotation No. *</Label>
                  <select
                    id="quo-quotationNo"
                    value={formData.quotationNo || ""}
                    onChange={(e) => handleQuotationNoChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="select-quotation-no"
                    required
                  >
                    <option value="">Select quotation number</option>
                    {generatedQuotations.map((q) => (
                      <option key={q.quotation_no} value={q.quotation_no}>
                        {q.quotation_no}
                        {q.grand_total ? ` — ₹${q.grand_total}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Editable fields */}
                <div>
                  <Label htmlFor="quo-basicAmount">Basic Amount *</Label>
                  <Input
                    id="quo-basicAmount"
                    type="number"
                    placeholder="Enter basic amount"
                    value={formData.basicAmount || ""}
                    onChange={(e) =>
                      handleInputChange("basicAmount", e.target.value)
                    }
                    data-testid="input-basic-amount"
                  />
                </div>
                <div>
                  <Label htmlFor="quo-totalAmount">Total Amount with Tax *</Label>
                  <Input
                    id="quo-totalAmount"
                    type="number"
                    placeholder="Enter total amount"
                    value={formData.totalAmountWithTax || ""}
                    onChange={(e) =>
                      handleInputChange("totalAmountWithTax", e.target.value)
                    }
                    data-testid="input-total-amount"
                  />
                </div>
                <div>
                  <Label htmlFor="quo-pdfFile" className="flex items-center gap-2">
                    Quotation PDF Link *
                    {isUploadingQuotation && (
                      <LoaderIcon className="animate-spin w-4 h-4 text-primary" />
                    )}
                  </Label>
                  {quotationPdfFile ? (
                    <div className="flex items-center justify-between border border-input rounded-md p-2 bg-muted text-foreground text-sm">
                      <span className="truncate max-w-[250px]" title={quotationPdfFile.name}>
                        {quotationPdfFile.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={removeQuotationPdfFile}
                        className="text-destructive hover:text-destructive h-8 px-2 py-1 text-xs font-semibold"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : formData.quotationPdfLink ? (
                    <div className="flex items-center justify-between border border-success/25 rounded-md p-2 bg-success/10 text-success text-sm">
                      <a href={formData.quotationPdfLink} target="_blank" rel="noopener noreferrer" className="font-semibold underline truncate max-w-[250px]">
                        View File
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={removeQuotationPdfFile}
                        className="text-destructive hover:text-destructive h-8 px-2 py-1 text-xs font-semibold"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Input
                      id="quo-pdfFile"
                      type="file"
                      onChange={handleQuotationChange}
                      data-testid="input-pdf-link"
                    />
                  )}
                  {isUploadingQuotation && (
                    <p className="text-xs text-primary mt-1">Uploading file, please wait...</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="quo-shareBy">Quotation Share By *</Label>
                  <select
                    id="quo-shareBy"
                    value={formData.quotationShareBy || ""}
                    onChange={(e) =>
                      handleInputChange("quotationShareBy", e.target.value)
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select Share By</option>
                    {masterData[0]?.["Quotation Share by"]?.map((person) => (
                      <option key={person} value={person}>
                        {person}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="quo-share">Quotation Share *</Label>
                  <select
                    id="quo-share"
                    value={formData.quotationShare || ""}
                    onChange={(e) =>
                      handleInputChange("quotationShare", e.target.value)
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="select-quotation-share"
                  >
                    <option value="">Select Quotation Share</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex space-x-4 pt-4 sticky bottom-0 bg-background py-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting || isUploadingQuotation}
                    data-testid="button-submit-quotation"
                    className="px-6"
                  >
                    {isSubmitting && <Loader2Icon className="animate-spin" />}
                    Submit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    data-testid="button-cancel-quotation"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {isCancelled && (
              <>
                <div>
                  <Label htmlFor="quo-cancelRemarks">Remarks</Label>
                  <Textarea
                    id="quo-cancelRemarks"
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
                    disabled={cancelSubmit}
                    variant="destructive"
                    className="px-8 py-3"
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
        </div>
      </Modal>
  );
}
