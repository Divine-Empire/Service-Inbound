import { supabase } from "./client";

const PAGE_SIZE = 1000;

/**
 * Fetches ALL rows from public.dropdown matching the given categories (every
 * category if omitted), paginating past Supabase's default per-request row
 * cap (1000). A plain unpaginated .select() silently truncates once the
 * table crosses that cap — which item_name alone does on its own (~1400
 * rows, a real spare-parts catalog) — dropping whichever categories/values
 * happen to sort after the cutoff. Never assume a single .select() call
 * returns the full table; always go through this helper instead.
 */
export async function fetchDropdownRows(categories, columns = "category, value") {
  let rows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("sss_dropdown")
      .select(columns)
      .order("category", { ascending: true })
      .order("value", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (categories && categories.length > 0) {
      query = query.in("category", categories);
    }

    const { data, error } = await query;
    if (error) throw error;

    rows = rows.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
