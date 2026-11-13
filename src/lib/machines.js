// inbound_tickets.machine_name is a jsonb array of { name, qty }. These helpers keep the rest of the
// app working with plain arrays / strings (and tolerate a legacy "A, B" text value).

/** Normalised [{ name, qty }] list (accepts the jsonb array, a JSON string, a legacy "A, B" string, or nothing). */
export const machineList = (v) => {
  let value = v;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];
    try {
      value = JSON.parse(s);
    } catch {
      return s.split(",").map((n) => n.trim()).filter(Boolean).map((name) => ({ name, qty: 1 }));
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((m) => (typeof m === "string" ? { name: m.trim(), qty: 1 } : { name: String(m?.name || "").trim(), qty: Number(m?.qty) || 1 }))
    .filter((m) => m.name);
};

/** "Machine A (Qty: 2), Machine B (Qty: 1)" text for tables, filters and CSV. */
export const machineText = (v) => machineList(v).map((m) => `${m.name} (Qty: ${m.qty})`).join(", ");
