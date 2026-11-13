import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Modal } from "../../components/ui/modal";
import { Textarea } from "../../components/ui/textarea";
import { ClipboardList, Loader2Icon } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { computeStagePlanned } from "../../lib/supabase/stagePlanning";
import { fetchItemNameSample, searchItemNames } from "../../lib/supabase/items";
import { MultiSelect } from "../../components/ui/multi-select";
import { enquiryTypeList } from "../../lib/enquiryType";
import { machineList } from "../../lib/machines";

const EMPTY_FORM = {
  clientType: "New",
  sourceOfEnquiry: "",
  callType: "",
  enquiryReceiverName: "",
  companyName: "",
  clientName: "",
  phoneNumber: "",
  siteAddress: "",
  gstNo: "",
  gstAddress: "",
  enquiryType: [],
  mentionIssue: "",
  remarks: "",
};

// New / edit enquiry form. `ticket` = the row being edited, or null for a new enquiry. Render it
// only while open; onClose closes it, onSaved runs after a successful save (page reloads).
export default function EnquiryFormModal({ ticket, masterData, companyDetails, onClose, onSaved }) {
  const { toast } = useToast();
  const isEditMode = !!ticket;
  const editingTicket = ticket;
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Unique company names for the suggestion list (the client master repeats names).
  const companyNames = useMemo(
    () => [...new Set(companyDetails.map((c) => c.company_name).filter(Boolean))],
    [companyDetails]
  );
  const [newEnquiryData, setNewEnquiryData] = useState(() =>
    ticket
      ? {
        clientType: ticket.clientType || "New",
        sourceOfEnquiry: ticket.sourceOfEnquiry || "",
        callType: ticket.callType || "",
        enquiryReceiverName: ticket.enquiryReceiverName || "",
        companyName: ticket.companyName || "",
        clientName: ticket.clientName || "",
        phoneNumber: ticket.phoneNumber || "",
        siteAddress: ticket.siteAddress || "",
        gstNo: ticket.gstNo || "",
        gstAddress: ticket.gstAddress || "",
        enquiryType: enquiryTypeList(ticket.enquiryTypes ?? ticket.enquiryType),
        mentionIssue: ticket.mentionIssue || "",
        remarks: ticket.remarks || "",
        }
      : EMPTY_FORM
  );
  const [newFormSelectedMachines, setNewFormSelectedMachines] = useState(() => machineList(ticket?.machines));
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);
  const [machineSearchQuery, setMachineSearchQuery] = useState("");
  // Machine Name options come from the item catalog (lto_items): a spread sample first, then a
  // debounced server-side search while typing. Only the latest search may update the list.
  const [machineOptions, setMachineOptions] = useState([]);
  const [machineSample, setMachineSample] = useState([]);
  const [machineLoading, setMachineLoading] = useState(false);
  const [machineError, setMachineError] = useState(false);
  // GST fields are read-only only while they hold a value auto-filled from the client master;
  // if the master has no GST No./Address for the company, they stay editable (GST Address is required).
  const [gstLocked, setGstLocked] = useState({ gstNo: false, gstAddress: false });

  useEffect(() => {
    let cancelled = false;
    setMachineLoading(true);
    fetchItemNameSample()
      .then((names) => { if (!cancelled) { setMachineSample(names); setMachineOptions(names); } })
      .catch(() => { if (!cancelled) setMachineError(true); })
      .finally(() => { if (!cancelled) setMachineLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const term = machineSearchQuery.trim();
    if (!term) { setMachineOptions(machineSample); setMachineError(false); return undefined; }
    let cancelled = false;
    const timer = setTimeout(() => {
      setMachineLoading(true);
      searchItemNames(term)
        .then((names) => { if (!cancelled) { setMachineOptions(names); setMachineError(false); } })
        .catch(() => { if (!cancelled) setMachineError(true); })
        .finally(() => { if (!cancelled) setMachineLoading(false); });
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [machineSearchQuery, machineSample]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowMachineDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNewEnquiryCompanyChange = (value) => {
    let locked = { gstNo: false, gstAddress: false };
    setNewEnquiryData((prev) => {
      const updated = { ...prev, companyName: value };

      if (prev.clientType === "Existing") {
        // The master can repeat a company; take the first non-empty GST No./Address across its rows.
        const name = value.trim().toLowerCase();
        const rows = name ? companyDetails.filter((c) => c.company_name && c.company_name.trim().toLowerCase() === name) : [];
        const gstNo = rows.map((c) => (c.gst_number || "").trim()).find(Boolean) || "";
        const gstAddress = rows.map((c) => (c.billing_address || "").trim()).find(Boolean) || "";
        updated.gstNo = gstNo;
        updated.gstAddress = gstAddress;
        locked = { gstNo: !!gstNo, gstAddress: !!gstAddress };
      }
      return updated;
    });
    setGstLocked(locked);
  };

  // Free-typed machine (not in the item catalog). Only ever goes into this ticket's machine_name
  // payload — nothing here writes to lto_items.
  const addCustomMachine = () => {
    const name = machineSearchQuery.trim();
    if (!name) return;
    const existing = machineOptions.find((o) => o.toLowerCase() === name.toLowerCase());
    const finalName = existing || name;
    setNewFormSelectedMachines((prev) =>
      prev.some((m) => m.name.toLowerCase() === finalName.toLowerCase()) ? prev : [...prev, { name: finalName, qty: 1 }]
    );
    setMachineSearchQuery("");
    setShowMachineDropdown(false);
  };

  const userName = localStorage.getItem("currentUsername");


  const handleNewEnquirySubmit = async (e) => {
    e.preventDefault();

    if (!newEnquiryData.clientName) {
      toast({ title: "Validation Error", description: "Client Name is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.phoneNumber) {
      toast({ title: "Validation Error", description: "Phone Number is required", variant: "destructive" });
      return;
    }
    if (newEnquiryData.enquiryType.length === 0) {
      toast({ title: "Validation Error", description: "Select at least one Enquiry Type", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.callType) {
      toast({ title: "Validation Error", description: "Call Type is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.sourceOfEnquiry) {
      toast({ title: "Validation Error", description: "Source of Enquiry is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.enquiryReceiverName) {
      toast({ title: "Validation Error", description: "Enquiry Receiver Name is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.companyName || !newEnquiryData.companyName.trim()) {
      toast({ title: "Validation Error", description: "Company Name is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.gstAddress || !newEnquiryData.gstAddress.trim()) {
      toast({ title: "Validation Error", description: "GST Address is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.siteAddress || !newEnquiryData.siteAddress.trim()) {
      toast({ title: "Validation Error", description: "Site Address is required", variant: "destructive" });
      return;
    }
    if (newFormSelectedMachines.length === 0) {
      toast({ title: "Validation Error", description: "Machine Name is required", variant: "destructive" });
      return;
    }
    const badQty = newFormSelectedMachines.find((m) => !Number.isInteger(Number(m.qty)) || Number(m.qty) < 1);
    if (badQty) {
      toast({ title: "Validation Error", description: "Enter a quantity (1 or more) for " + badQty.name, variant: "destructive" });
      return;
    }
    if (!newEnquiryData.mentionIssue || !newEnquiryData.mentionIssue.trim()) {
      toast({ title: "Validation Error", description: "Mention Issue is required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && editingTicket) {
        const updatePayload = {
          source_of_enquiry: newEnquiryData.sourceOfEnquiry || "",
          call_type: newEnquiryData.callType || "",
          enquiry_receiver_name: newEnquiryData.enquiryReceiverName || "",
          client_type: newEnquiryData.clientType || "",
          company_name: newEnquiryData.companyName || "",
          client_name: newEnquiryData.clientName || "",
          phone_number: newEnquiryData.phoneNumber || "",
          site_address: newEnquiryData.siteAddress || "",
          gst_no: newEnquiryData.gstNo || "",
          gst_address: newEnquiryData.gstAddress || "",
          machine_name: newFormSelectedMachines.map((m) => ({ name: m.name, qty: Number(m.qty) })),
          enquiry_type: newEnquiryData.enquiryType,
          mention_issue: newEnquiryData.mentionIssue || "",
          remarks: newEnquiryData.remarks || "",
          updated_at: new Date().toISOString(),
          updated_by: userName || null,
        };

        const { error } = await supabase
          .from("inbound_tickets")
          .update(updatePayload)
          .eq("ticket_id", editingTicket.ticketId);

        const result = error ? { success: false, error: error.message } : { success: true };

        if (result.success) {
          toast({
            title: "Success",
            description: `Enquiry updated successfully for Ticket ID: ${editingTicket.ticketId}`,
          });
          onClose();
          onSaved();
        } else {
          throw new Error(result.error || "Failed to update enquiry");
        }
      } else {
        // Stamps this ticket ready for the next stage (Machine Received): submit time + TAT.
        const machineReceivedPlanned = await computeStagePlanned("machineReceived", {
          ticketSubmittedAt: new Date(),
        });
        const insertPayload = {
          source_of_enquiry: newEnquiryData.sourceOfEnquiry || "",
          call_type: newEnquiryData.callType || "",
          enquiry_receiver_name: newEnquiryData.enquiryReceiverName || "",
          client_type: newEnquiryData.clientType || "",
          company_name: newEnquiryData.companyName || "",
          client_name: newEnquiryData.clientName || "",
          phone_number: newEnquiryData.phoneNumber || "",
          site_address: newEnquiryData.siteAddress || "",
          gst_no: newEnquiryData.gstNo || "",
          gst_address: newEnquiryData.gstAddress || "",
          machine_name: newFormSelectedMachines.map((m) => ({ name: m.name, qty: Number(m.qty) })),
          enquiry_type: newEnquiryData.enquiryType,
          mention_issue: newEnquiryData.mentionIssue || "",
          remarks: newEnquiryData.remarks || "",
          updated_by: userName || null,
          machine_received_planned: machineReceivedPlanned,
        };

        const { data: inserted, error } = await supabase
          .from("inbound_tickets")
          .insert(insertPayload)
          .select("ticket_id")
          .single();

        const result = error
          ? { success: false, error: error.message }
          : { success: true, ticketId: inserted.ticket_id };

        if (result.success) {
          toast({
            title: "Success",
            description: `Enquiry created successfully with Ticket ID: ${result.ticketId}`,
          });

          onClose();
          onSaved();
        } else {
          throw new Error(result.error || "Failed to create enquiry");
        }
      }
    } catch (error) {
      console.error("Error saving enquiry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save enquiry",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
      <Modal
        isOpen
        onClose={onClose}
        title={
          <div className="flex items-center space-x-2">
            <ClipboardList className="w-5 h-5 text-brand-600" />
            <span>{isEditMode ? `Edit Enquiry: ${editingTicket?.ticketId}` : "New Enquiry"}</span>
          </div>
        }
        size="4xl"
        className="rounded-lg max-h-[90vh] overflow-y-auto"
      >
        <form
          onSubmit={handleNewEnquirySubmit}
          className="space-y-6 max-h-[70vh] overflow-y-auto p-2"
        >
          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-gray-50 px-4 py-3">
              <CardTitle className="text-sm font-medium flex items-center bg-transparent border-0 shadow-none text-gray-800">
                Client Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="tk-clientType" className="text-sm">Client Type *</Label>
                <Select
                  onValueChange={(value) => {
                    setGstLocked({ gstNo: false, gstAddress: false });
                    setNewEnquiryData(prev => ({
                      ...prev,
                      clientType: value,
                      companyName: value === "New" ? "" : prev.companyName,
                      gstNo: value === "New" ? "" : prev.gstNo,
                      gstAddress: value === "New" ? "" : prev.gstAddress
                    }));
                  }}
                  value={newEnquiryData.clientType}
                >
                  <SelectTrigger id="tk-clientType">
                    <SelectValue placeholder="Select Client Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Existing">Existing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-company" className="text-sm">Company Name *</Label>
                {newEnquiryData.clientType === "Existing" ? (
                  <div className="relative">
                    <Input id="tk-company"
                      value={newEnquiryData.companyName || ""}
                      onChange={(e) => handleNewEnquiryCompanyChange(e.target.value)}
                      placeholder="Type to search or select company name"
                      list="new-company-suggestions"
                      required
                    />
                    <datalist id="new-company-suggestions">
                      {companyNames.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </div>
                ) : (
                  <Input id="tk-company"
                    value={newEnquiryData.companyName || ""}
                    onChange={(e) => setNewEnquiryData(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="Enter company name"
                    required
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-clientName" className="text-sm">Client Name *</Label>
                <Input id="tk-clientName"
                  value={newEnquiryData.clientName || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Enter client name"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-phone" className="text-sm">Phone Number *</Label>
                <Input id="tk-phone"
                  value={newEnquiryData.phoneNumber || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="Enter phone number"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-gray-50 px-4 py-3">
              <CardTitle className="text-sm font-medium flex items-center bg-transparent border-0 shadow-none text-gray-800">
                Enquiry Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Row 1: Call Type, Source of Enquiry, Enquiry Receiver Name */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="tk-callType" className="text-sm">Call Type *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, callType: value }))}
                    value={newEnquiryData.callType}
                  >
                    <SelectTrigger id="tk-callType">
                      <SelectValue placeholder="Select Call Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      {(masterData[0]?.["Call type"] || [])
                        .filter(Boolean)
                        .map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tk-source" className="text-sm">Source of Enquiry *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, sourceOfEnquiry: value }))}
                    value={newEnquiryData.sourceOfEnquiry || undefined}
                  >
                    <SelectTrigger id="tk-source">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      {[...new Set(masterData[0]?.["Source of enquiry"] || [])]
                        .filter(Boolean)
                        .map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tk-receiver" className="text-sm">Enquiry Receiver Name *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, enquiryReceiverName: value }))}
                    value={newEnquiryData.enquiryReceiverName || undefined}
                  >
                    <SelectTrigger id="tk-receiver">
                      <SelectValue placeholder="Select receiver name" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      {[...new Set(masterData[0]?.["Enquiry Receiver Name"] || [])]
                        .filter(Boolean)
                        .map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Enquiry Type (new), Category (renamed from Enquiry-Type), Sub-Category (renamed from Category) */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="tk-enquiryType" className="text-sm">Enquiry Type *</Label>
                  <MultiSelect
                    options={[...new Set(masterData[0]?.["Enquiry Type"] || [])].filter(Boolean)}
                    value={newEnquiryData.enquiryType}
                    onChange={(value) => setNewEnquiryData((prev) => ({ ...prev, enquiryType: value }))}
                    placeholder="Select Enquiry Type(s)"
                  />
                </div>

              </div>
              <div className="space-y-1">
                <Label htmlFor="tk-gstNo" className="text-sm">GST No.</Label>
                <Input id="tk-gstNo"
                  value={newEnquiryData.gstNo || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, gstNo: e.target.value }))}
                  placeholder="Enter GST No."
                  disabled={gstLocked.gstNo}
                  className={gstLocked.gstNo ? "bg-gray-100" : ""}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-gstAddress" className="text-sm">GST Address *</Label>
                <Input id="tk-gstAddress"
                  value={newEnquiryData.gstAddress || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, gstAddress: e.target.value }))}
                  placeholder="Enter GST Address"
                  disabled={gstLocked.gstAddress}
                  className={gstLocked.gstAddress ? "bg-gray-100" : ""}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-site" className="text-sm">Site Address *</Label>
                <Input id="tk-site"
                  value={newEnquiryData.siteAddress || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, siteAddress: e.target.value }))}
                  placeholder="Enter Site Address"
                  required
                />
              </div>


              <div className="space-y-1 md:col-span-2 relative">
                <Label htmlFor="tk-machine" className="text-sm">Machine Name *</Label>
                <div className="relative dropdown-container">
                  <button id="tk-machine"
                    type="button"
                    onClick={() => {
                      setShowMachineDropdown(!showMachineDropdown);
                    }}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-gray-500">Select machine(s)</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 opacity-50"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {showMachineDropdown && (
                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                      <div className="px-2 py-1 sticky top-0 bg-white z-10">
                        <Input
                          placeholder="Search machine..."
                          value={machineSearchQuery}
                          onChange={(e) => setMachineSearchQuery(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomMachine(); } }}
                          className="h-8 text-xs border-gray-200"
                        />
                      </div>
                      <div className="mt-1">
                        {machineOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            disabled={newFormSelectedMachines.some((m) => m.name === option)}
                            onClick={() => {
                              if (!newFormSelectedMachines.some((m) => m.name === option)) {
                                setNewFormSelectedMachines(prev => [...prev, { name: option, qty: 1 }]);
                              }
                              setMachineSearchQuery("");
                              setShowMachineDropdown(false);
                            }}
                            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                          >
                            {option}
                          </button>
                        ))}
                        {machineSearchQuery.trim() &&
                          !machineOptions.some((o) => o.toLowerCase() === machineSearchQuery.trim().toLowerCase()) &&
                          !newFormSelectedMachines.some((m) => m.name.toLowerCase() === machineSearchQuery.trim().toLowerCase()) && (
                            <button
                              type="button"
                              onClick={addCustomMachine}
                              className="flex w-full items-center rounded-sm border-t border-gray-100 px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-slate-100 text-left"
                            >
                              + Add "{machineSearchQuery.trim()}" (custom machine)
                            </button>
                          )}
                        {machineLoading && <p className="text-xs text-gray-500 text-center py-2">Searching...</p>}
                        {!machineLoading && machineError && <p className="text-xs text-red-600 text-center py-2">Could not load machines</p>}
                        {!machineLoading && !machineError && machineOptions.length === 0 && (
                          <p className="text-xs text-gray-500 text-center py-2">No machine found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {newFormSelectedMachines.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {newFormSelectedMachines.map((machine) => (
                      <div
                        key={machine.name}
                        className="flex items-center gap-3 rounded-md border border-gray-200 bg-brand-50 px-3 py-2"
                      >
                        <span className="flex-1 text-sm text-brand-800 break-words">{machine.name}</span>
                        <Label htmlFor={`tk-qty-${machine.name}`} className="text-xs text-gray-600">Qty *</Label>
                        <Input
                          id={`tk-qty-${machine.name}`}
                          type="number"
                          min={1}
                          step={1}
                          value={machine.qty}
                          onChange={(e) => {
                            const qty = e.target.value;
                            setNewFormSelectedMachines(prev => prev.map(m => m.name === machine.name ? { ...m, qty } : m));
                          }}
                          className="h-8 w-20 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setNewFormSelectedMachines(prev => prev.filter(m => m.name !== machine.name));
                          }}
                          className="text-brand-600 hover:text-brand-800 font-bold"
                          aria-label={`Remove ${machine.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="tk-issue" className="text-sm">Mention Issue *</Label>
                <Textarea id="tk-issue"
                  value={newEnquiryData.mentionIssue || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, mentionIssue: e.target.value }))}
                  placeholder="Describe the issue"
                  rows={3}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-remarks" className="text-sm">Remarks</Label>
                <Input id="tk-remarks"
                  value={newEnquiryData.remarks || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Enter remarks"
                />
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2Icon className="animate-spin w-4 h-4 mr-2" />
              )}
              {isEditMode ? "Save Changes" : "Create Enquiry"}
            </Button>
          </div>
        </form>
      </Modal>
  );
}
