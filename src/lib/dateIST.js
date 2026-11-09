// Calendar-day helpers pinned to India time, so a visit stored as an ISO instant lands on
// the same day for every viewer (used by the Site Visit calendar and availability views).

const IST_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export const getISTComponents = (date) => {
  const parts = {};
  IST_FORMATTER.formatToParts(date).forEach((p) => {
    if (p.type !== "literal") parts[p.type] = parseInt(p.value, 10);
  });
  return { year: parts.year, month: parts.month - 1, day: parts.day };
};

// Accepts ISO timestamps, dd/mm/yyyy[ hh:mm], yyyy-mm-dd and dd-mm-yyyy.
// Returns { day, month (0-based), year } or null.
export const parseIST = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;

  if (dateStr.includes("T") || dateStr.endsWith("Z")) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : getISTComponents(d);
  }

  const fromParts = (day, month, year) =>
    [day, month, year].some(Number.isNaN) ? null : { day, month, year };

  if (dateStr.includes("/")) {
    const parts = dateStr.split(" ")[0].split("/");
    if (parts.length === 3) {
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      const r = fromParts(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, year);
      if (r) return r;
    }
  }

  if (dateStr.includes("-")) {
    const parts = dateStr.split(" ")[0].split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      const r = fromParts(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      if (r) return r;
    }
    if (parts.length === 3) {
      const r = fromParts(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (r) return r;
    }
  }

  return null;
};
