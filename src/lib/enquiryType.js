// inbound_tickets.enquiry_type is a text[] (multi-select). These helpers keep the rest of the app
// working with plain strings / arrays regardless of what the column hands back.

/** Array of selected enquiry types (accepts an array, a "A, B" string, or nothing). */
export const enquiryTypeList = (v) => {
  if (Array.isArray(v)) return v.filter(Boolean);
  return v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : [];
};

/** "A, B" text for tables, filters and CSV. */
export const enquiryTypeText = (v) => enquiryTypeList(v).join(", ");
