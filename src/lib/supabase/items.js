import { ltoSupabase } from "./ltoClient";

const PAGE_SIZE = 1000;

// Single source of truth for the item catalog across the app: items are added/removed
// exclusively from Master > Items, which writes straight to `lto_items`, the same shared catalog
// table Lead-To-Order-Supabase-New itself uses (see ltoClient.js). Every page that needs item
// names calls this.
//
// Paginated past Supabase's default 1000-row cap -- the catalog is ~3,500
// rows, so a single unpaginated .select() would silently truncate it.
export async function fetchItemNames() {
  let names = [];
  let from = 0;

  while (true) {
    const { data, error } = await ltoSupabase
      .from("lto_items")
      .select("item_name")
      .order("item_name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    names = names.concat((data || []).map((r) => r.item_name).filter(Boolean));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return [...new Set(names)];
}

// Initial Machine Name options in the New Enquiry form: a spread sample of the catalog (every 31st item
// alphabetically, up to 200) so the full list never has to be loaded. See migration 0077.
export async function fetchItemNameSample() {
  const { data, error } = await ltoSupabase.rpc("inbound_item_name_sample", { p_step: 31, p_limit: 200 });
  if (error) throw error;
  return (data || []).map((r) => r.item_name).filter(Boolean);
}

// Server-side item search (case-insensitive contains), alphabetical, capped at `limit` rows.
export async function searchItemNames(query, limit = 50) {
  const term = String(query || "").trim().replace(/[\\%_]/g, (c) => "\\" + c);
  const { data, error } = await ltoSupabase
    .from("lto_items")
    .select("item_name")
    .ilike("item_name", "%" + term + "%")
    .order("item_name", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return [...new Set((data || []).map((r) => r.item_name).filter(Boolean))];
}
