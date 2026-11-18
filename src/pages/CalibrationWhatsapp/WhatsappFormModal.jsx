import { useState, useEffect } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Modal } from "../../components/ui/modal";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { fetchEngineerContacts } from "../../lib/supabase/engineers";
import { hasWhatsappNumber } from "./helpers";

const selectClass = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";

// Add (row = null) or edit one reminder row by hand. Rows created here have no ticket link (source = 'manual').
export default function WhatsappFormModal({ row, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    invoiceDate: row?.invoiceDate || "",
    companyName: row?.companyName || "",
    clientName: row?.clientName || "",
    clientPhone: row?.clientPhone || "",
    siteAddress: row?.siteAddress || "",
    equipmentLabel: row?.equipmentLabel || "",
    invoiceNumber: row?.invoiceNumber || "",
    quotationNumber: row?.quotationNumber || "",
    calibrationDueDate: row?.calibrationDueDate || "",
    engineerName: row?.engineerName || "",
  });
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [engineers, setEngineers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEngineerContacts()
      .then(setEngineers)
      .catch((e) => {
        console.error("Error loading engineers:", e);
        toast({ title: "Error", description: "Failed to load engineers", variant: "destructive" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fail = (description) => toast({ title: "Validation Error", description, variant: "destructive" });

    if (!form.companyName.trim()) return fail("Please enter Company Name");
    if (!form.calibrationDueDate) return fail("Please select Calibration Due Date");
    if (!form.clientPhone.trim()) return fail("Please enter the Client Phone (WhatsApp)");
    if (!hasWhatsappNumber(form.clientPhone)) return fail("Client Phone is not a valid mobile number");

    setIsSubmitting(true);
    try {
      let invoiceCopy = row?.invoiceCopy || null;
      if (invoiceFile) {
        const path = `calibration_whatsapp/${Date.now()}_${invoiceFile.name}`;
        const { error: uploadError } = await supabase.storage.from("inbound_enquiry").upload(path, invoiceFile, { contentType: invoiceFile.type });
        if (uploadError) throw uploadError;
        invoiceCopy = supabase.storage.from("inbound_enquiry").getPublicUrl(path).data.publicUrl;
      }

      const engineer = engineers.find((en) => en.engineer_name === form.engineerName);
      const values = {
        invoice_date: form.invoiceDate || null,
        company_name: form.companyName.trim(),
        client_name: form.clientName.trim() || null,
        client_phone: form.clientPhone.trim() || null,
        site_address: form.siteAddress.trim() || null,
        equipment_label: form.equipmentLabel.trim() || null,
        invoice_number: form.invoiceNumber.trim() || null,
        quotation_number: form.quotationNumber.trim() || null,
        calibration_due_date: form.calibrationDueDate,
        invoice_copy: invoiceCopy,
        engineer_name: engineer?.engineer_name || null,
        engineer_phone: engineer?.phone_number || null,
      };

      const { error } = row
        ? await supabase.from("inbound_calibration_whatsapp").update(values).eq("id", row.id)
        : await supabase.from("inbound_calibration_whatsapp").insert({ ...values, source: "manual" });
      if (error) throw error;

      toast({ title: "Success", description: row ? "Row updated" : "Row added" });
      onSaved();
    } catch (error) {
      console.error("Error saving WhatsApp row:", error);
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={row ? "Edit Calibration Reminder" : "Add Calibration Reminder"} size="3xl">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
        <div>
          <Label htmlFor="wa-invoiceDate">Date of Invoice</Label>
          <Input id="wa-invoiceDate" type="date" value={form.invoiceDate} onChange={set("invoiceDate")} />
        </div>
        <div>
          <Label htmlFor="wa-company">Company Name *</Label>
          <Input id="wa-company" value={form.companyName} onChange={set("companyName")} placeholder="Company name" />
        </div>
        <div>
          <Label htmlFor="wa-clientName">Client Name</Label>
          <Input id="wa-clientName" value={form.clientName} onChange={set("clientName")} placeholder="Client name" />
        </div>
        <div>
          <Label htmlFor="wa-clientPhone">Client Phone (WhatsApp) *</Label>
          <Input id="wa-clientPhone" type="tel" value={form.clientPhone} onChange={set("clientPhone")} placeholder="10-digit number" />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="wa-address">Site Address</Label>
          <Input id="wa-address" value={form.siteAddress} onChange={set("siteAddress")} placeholder="Site address" />
        </div>
        <div>
          <Label htmlFor="wa-equipment">Equipment (shown in the message)</Label>
          <Input id="wa-equipment" value={form.equipmentLabel} onChange={set("equipmentLabel")} placeholder="e.g. Auto Level / Total Station" />
        </div>
        <div>
          <Label htmlFor="wa-invoiceNo">Invoice Number</Label>
          <Input id="wa-invoiceNo" value={form.invoiceNumber} onChange={set("invoiceNumber")} />
        </div>
        <div>
          <Label htmlFor="wa-quotationNo">Quotation Number</Label>
          <Input id="wa-quotationNo" value={form.quotationNumber} onChange={set("quotationNumber")} />
        </div>
        <div>
          <Label htmlFor="wa-due">Calibration Due Date *</Label>
          <Input id="wa-due" type="date" value={form.calibrationDueDate} onChange={set("calibrationDueDate")} />
        </div>
        <div>
          <Label htmlFor="wa-copy">Invoice Copy</Label>
          <Input id="wa-copy" type="file" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} disabled={isSubmitting} />
          {invoiceFile ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">Selected: {invoiceFile.name}</p>
          ) : row?.invoiceCopy ? (
            <a href={row.invoiceCopy} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-primary hover:underline">
              View current copy
            </a>
          ) : null}
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="wa-engineer">Engineer</Label>
          <select id="wa-engineer" className={selectClass} value={form.engineerName} onChange={set("engineerName")}>
            <option value="">Select engineer</option>
            {engineers.map((en) => (
              <option key={en.engineer_name} value={en.engineer_name}>
                {en.engineer_name}{en.phone_number ? ` - ${en.phone_number}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Name and number are saved on the row. You can also pick the engineer each time you send a reminder.</p>
        </div>

        <div className="flex space-x-4 pt-2 md:col-span-2">
          <Button type="submit" disabled={isSubmitting} className="px-6" data-testid="button-submit-whatsapp">
            {isSubmitting ? (
              <span className="flex items-center">
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Submit"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
