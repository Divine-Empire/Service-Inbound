// Shared helpers for the WhatsApp (calibration reminder) stage. Client is the only receiver.

// Reminders go out only when the due date is exactly this many days away (negative = overdue). 0 never sends.
export const REMINDER_DAYS = [30, 15, 7, 3, 1, -3, -7, -15];

// India's calendar date (YYYY-MM-DD) for an instant.
export const istDate = (value) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(value)
  );

// A usable mobile number once cleaned the same way the Edge Function cleans it.
export const hasWhatsappNumber = (raw) => {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return /^91[6-9]\d{9}$/.test(digits);
};

// The client's latest button reply is Renewed / Not Interested: no reminders until they answer Interested again.
export const isPaused = (row) => ["Renewed", "Not Interested"].includes(row.clientResponse);

// Does the client still need today's reminder? True when there is a number and no successful message today.
export const clientPending = (row) => {
  if (!hasWhatsappNumber(row.clientPhone)) return false;
  if (isPaused(row)) return false;
  const sentToday = row.clientMsgStatus === "sent" && row.clientMsgSentAt && istDate(row.clientMsgSentAt) === istDate(new Date());
  return !sentToday;
};

// Row is part of today's reminder run: due-days is one of the reminder days and the client still needs the message.
export const isReminderDue = (row) => REMINDER_DAYS.includes(row.calibDueDays) && clientPending(row);

// DB row -> UI row.
export const fromDb = (r) => ({
  id: r.id,
  ticketUuid: r.ticket_uuid,
  ticketId: r.ticket_id || "",
  source: r.source,
  invoiceDate: r.invoice_date || "",
  companyName: r.company_name || "",
  clientName: r.client_name || "",
  clientPhone: r.client_phone || "",
  siteAddress: r.site_address || "",
  invoiceNumber: r.invoice_number || "",
  quotationNumber: r.quotation_number || "",
  equipmentLabel: r.equipment_label || "",
  calibrationDueDate: r.calibration_due_date || "",
  invoiceCopy: r.invoice_copy || "",
  engineerName: r.engineer_name || "",
  engineerPhone: r.engineer_phone || "",
  calibDueDays: r.calib_due_days,
  lastMessageAt: r.last_message_at || "",
  clientMsgStatus: r.client_msg_status || "",
  clientMsgError: r.client_msg_error || "",
  clientMsgSentAt: r.client_msg_sent_at || "",
  clientResponse: r.client_response || "",
  clientRespondedAt: r.client_responded_at || "",
});
