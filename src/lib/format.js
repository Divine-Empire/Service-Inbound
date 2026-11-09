const pad2 = (n) => String(n).padStart(2, "0");

// dd/mm/yyyy (local). Empty string for a missing/invalid value.
export const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// dd/mm/yyyy hh:mm:ss (local, 24h). Empty string for a missing/invalid value.
export const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${formatDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

// dd-mm-yyyy hh:mm (local, 24h). Empty string for a missing/invalid value.
export const formatDateTimeShort = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// A Date / ISO string, or an "HH:MM" (24h, as TimePicker12 stores it) -> "hh:mm AM/PM".
// Anything that is not a time is returned unchanged ("" for empty).
export const formatTime12hr = (value) => {
  if (!value) return "";
  let h;
  let m;
  if (typeof value === "string" && /^\d{1,2}:\d{2}/.test(value) && !value.includes("T")) {
    [h, m] = value.split(":").map((p) => parseInt(p, 10));
  } else {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    h = d.getHours();
    m = d.getMinutes();
  }
  if (isNaN(h) || isNaN(m)) return String(value);
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${pad2(h)}:${pad2(m)} ${period}`;
};

// Local YYYY-MM-DD for a Date / ISO string. Empty string for missing/invalid.
export const toLocalYmd = (value) => {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// What an <input type="date"> expects. Same value as toLocalYmd.
export const formatInputDate = toLocalYmd;

// Delay in minutes. Most stages: positive = early, negative = late (planned - actual).
// TADA / OTP stages never go negative ("x min late" only), which callers choose with
// `lateOnly`. Returns "-" when there is no value.
export const formatDelay = (minutes, { lateOnly = false } = {}) => {
  if (minutes === null || minutes === undefined || minutes === "" || isNaN(Number(minutes))) return "-";
  const n = Number(minutes);
  return lateOnly ? `${Math.max(0, n)} min` : `${n} min`;
};

// "12 min late" / "12 min early" for the early(+)/late(-) convention. "-" when empty.
export const formatDelayLabel = (minutes) => {
  if (minutes === null || minutes === undefined || minutes === "" || isNaN(Number(minutes))) return "-";
  const n = Number(minutes);
  return n < 0 ? `${Math.abs(n)} min late` : `${n} min early`;
};

// Tone for a delay badge: StatusBadge tone names.
export const delayTone = (minutes, { lateOnly = false } = {}) => {
  if (minutes === null || minutes === undefined || minutes === "" || isNaN(Number(minutes))) return "neutral";
  const n = Number(minutes);
  if (lateOnly) return n > 0 ? "danger" : "success";
  return n < 0 ? "danger" : "success";
};
