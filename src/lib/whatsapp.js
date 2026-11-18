import { supabase } from "./supabase/client";

// Sends the calibration-due reminder (WhatsApp template) to the client of each selected
// inbound_calibration_whatsapp row via the inbound-send-calibration-reminder Edge Function. Never throws:
// always resolves with { success, error?, sent, failed, results }. Meta credentials stay server-side.
export async function sendCalibrationReminders({ rowIds, engineerName, dryRun = false }) {
  try {
    const { data, error } = await supabase.functions.invoke("inbound-send-calibration-reminder", {
      body: { rowIds, engineerName, dryRun },
    });
    if (error) {
      console.error("Calibration reminder failed:", error);
      return { success: false, error: error.message || "Failed to send calibration reminders", results: [] };
    }
    if (!data?.success) {
      console.error("Calibration reminder failed:", data?.error);
      return { success: false, error: data?.error || "Failed to send calibration reminders", results: [] };
    }
    return data;
  } catch (error) {
    console.error("Calibration reminder failed:", error);
    return { success: false, error: error.message || "Failed to send calibration reminders", results: [] };
  }
}
