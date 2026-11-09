import { useState, useEffect, useRef } from "react";
import { useToast } from "../../hooks/use-toast";
import { ltoSupabase } from "../../lib/supabase/ltoClient";
import { fetchAllRows } from "../../lib/fetchAllRows";
import { fetchDropdownRows } from "../../lib/supabase/dropdown";
import { fetchEngineerNames } from "../../lib/supabase/engineers";

// Master data for the enquiry form: dropdown values + engineer names (masterData) and the
// Lead-To-Order client master (companyDetails). The dropdowns load when the page mounts; the client
// master (thousands of rows, fetched in chunks) loads the first time ensureCompanies() is called,
// i.e. when the enquiry form is opened.
export function useEnquiryMasters() {
  const { toast } = useToast();
  const [masterData, setMasterData] = useState({});
  const [companyDetails, setCompanyDetails] = useState([]);

  // Maps public.dropdown's `category` keys to the display keys the rest of
  // this component's JSX already expects (masterData[0]["Call type"], etc.)
  // Maps public.dropdown's `category` keys to the display keys the rest of
  // this component's JSX expects. Renamed in migration 0043 to match the
  // renamed tickets columns: dropdown category='category' now holds the
  // NABL/Service/Spare-style values (source for the "Category" field,
  // formerly "Enquiry-Type"), 'sub_category' holds the machine-group values
  // (source for "Sub-Category", formerly "Category"), and 'enquiry_type' is
  // a brand new, initially-empty category sourcing the brand new "Enquiry
  // Type" field.
  const DROPDOWN_CATEGORY_TO_KEY = {
    call_type: "Call type",
    source_of_enquiry: "Source of enquiry",
    enquiry_receiver_name: "Enquiry Receiver Name",
    category: "Category",
    sub_category: "Sub-Category",
    inbound_enquiry_type: "Enquiry Type",
    service_location: "Service Location",
    machine_name: "Machine Name",
  };

  const fetchDropdown = async () => {
    try {
      const [data, engineerNames] = await Promise.all([
        fetchDropdownRows(Object.keys(DROPDOWN_CATEGORY_TO_KEY)),
        fetchEngineerNames(),
      ]);

      const structuredData = {};
      (data || []).forEach(({ category, value }) => {
        const key = DROPDOWN_CATEGORY_TO_KEY[category];
        if (!key) return;
        if (!structuredData[key]) structuredData[key] = [];
        structuredData[key].push(value);
      });

      if (!structuredData["Call type"] || structuredData["Call type"].filter(Boolean).length === 0) {
        structuredData["Call type"] = ["Incoming", "Outgoing"];
      }

      // Engineer names now come from Master > Engineer Contacts, not the
      // old 'engineer_assign_name' dropdown category — see engineers.js.
      structuredData["Engineer Assign Name"] = engineerNames;

      setMasterData([structuredData]);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
      toast({
        title: "Error",
        description: "Failed to load dropdown data",
        variant: "destructive",
      });
    }
  };

  // Sourced live from the production Lead-To-Order-Supabase-New project's
  // client master, not this project's own (now-retired) company_details
  // table — see [[servicesupport_migration_project]] memory.
  const fetchCompanyDetails = async () => {
    try {
      // fetchAllRows pages past PostgREST's silent 1000-row cap (the client master is larger).
      const { data, error } = await fetchAllRows(() =>
        ltoSupabase
          .from("lto_client_master")
          .select("company_name, billing_address, gst_number")
          .order("company_name", { ascending: true })
          .order("gst_number", { ascending: true })
      );

      if (error) throw error;
      setCompanyDetails(data || []);
    } catch (error) {
      console.error("Error fetching company details:", error);
      toast({
        title: "Error",
        description: "Failed to load company details",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchDropdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companiesRequested = useRef(false);
  const ensureCompanies = () => {
    if (companiesRequested.current) return;
    companiesRequested.current = true;
    fetchCompanyDetails();
  };

  return { masterData, companyDetails, ensureCompanies };
}
