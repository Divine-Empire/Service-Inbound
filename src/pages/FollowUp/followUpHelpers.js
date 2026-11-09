import { supabase } from "../../lib/supabase/client";
import { computeStagePlanned } from "../../lib/supabase/stagePlanning";

// No advance payment is collected for these payment modes, so the Advance Payment Attachment
// field is not rendered (and not required / saved) for them.
export const NO_ADVANCE_MODES = ["FOC", "Full On Credit"];
export const needsAdvanceAttachment = (mode) => !!mode && !NO_ADVANCE_MODES.includes(mode);

// Uploads one Follow-Up attachment to the inbound_enquiry bucket and returns its public URL.
// Throws on failure (callers toast).
export async function uploadFollowUpFile(ticketId, file) {
  const path = `follow_up/${ticketId}_${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from("inbound_enquiry").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("inbound_enquiry").getPublicUrl(path).data.publicUrl;
}

// Next stage once an order is confirmed: every Order Received submit goes to CRM Verification
// (crm_verification_planned = submit time + the "CRM Verification" TAT), whatever the payment mode.
export const computeOrderPlanned = async ({ baseTime }) => ({
  crm_verification_planned: await computeStagePlanned("crmFromOrderReceived", { orderReceivedSubmittedAt: baseTime }),
});
