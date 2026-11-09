import { supabase } from "./client";

// Single source of truth for engineer names across the app: engineers are added/removed
// exclusively from Master > Engineer Contacts, which also holds their phone number, email and
// bank details. Every page that needs engineer names calls this.
export async function fetchEngineerNames() {
  const { data, error } = await supabase
    .from("sss_engineer_contacts")
    .select("engineer_name")
    .order("engineer_name", { ascending: true });

  if (error) throw error;
  return [...new Set((data || []).map((r) => r.engineer_name))].filter(Boolean);
}
