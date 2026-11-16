// Small helpers shared by the certificate layouts.
export const FONT = "times"

// A form field left blank is left off the certificate.
export const filled = (v) => String(v ?? "").trim() !== ""

// "2026-11-14" -> "14-11-2026"
export function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "")
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ""
}
