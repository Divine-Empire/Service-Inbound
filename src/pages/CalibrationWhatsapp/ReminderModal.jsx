import { useState, useEffect } from "react";
import { Loader2Icon, Send } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { Modal } from "../../components/ui/modal";
import { StatusBadge } from "../../components/shared";
import { useToast } from "../../hooks/use-toast";
import { fetchEngineerContacts } from "../../lib/supabase/engineers";
import { sendCalibrationReminders } from "../../lib/whatsapp";
import { formatDate } from "../../lib/format";
import { clientPending } from "./helpers";

const selectClass = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";

const daysLabel = (d) => (d > 0 ? `due in ${d} ${d === 1 ? "day" : "days"}` : `overdue by ${-d} ${-d === 1 ? "day" : "days"}`);

const outcomeBadge = (o) =>
  o ? (
    <span title={o.error || undefined}>
      <StatusBadge tone={o.status === "sent" ? "success" : o.status === "failed" ? "danger" : "neutral"}>
        {o.status === "sent" ? "Sent" : o.status === "failed" ? "Failed" : "Skipped"}
      </StatusBadge>
    </span>
  ) : (
    <span className="text-muted-foreground">-</span>
  );

// Rows due a reminder today (due days in 30/15/7/3/1/-3/-7/-15 and the client not yet messaged today). The user reviews
// them, picks an engineer, and sends; the result of each row is shown afterwards.
export default function ReminderModal({ rows, onClose, onSent }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState(() => new Set(rows.map((r) => r.id))); // all selected by default
  const [engineers, setEngineers] = useState([]);
  const [engineerName, setEngineerName] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState(null); // result of the send, replaces the review table
  // The page reloads after a send and the rows just messaged drop out of "due", so the result table reads
  // company names from a copy taken when Send was pressed.
  const [sentRows, setSentRows] = useState(() => new Map());

  useEffect(() => {
    fetchEngineerContacts()
      .then(setEngineers)
      .catch((e) => {
        console.error("Error loading engineers:", e);
        toast({ title: "Error", description: "Failed to load engineers", variant: "destructive" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  const handleSend = async () => {
    if (selected.size === 0) return toast({ title: "Nothing selected", description: "Select at least one row", variant: "destructive" });
    if (!engineerName) return toast({ title: "Select engineer", description: "Choose the engineer to show in the message", variant: "destructive" });

    setSentRows(new Map(rows.map((r) => [r.id, r])));
    setIsSending(true);
    const res = await sendCalibrationReminders({ rowIds: [...selected], engineerName });
    setIsSending(false);

    if (!res.success) {
      toast({ title: "Error", description: res.error || "Failed to send reminders", variant: "destructive" });
      return;
    }
    setResponse(res);
    toast({
      title: res.failed ? "Sent with some failures" : "Reminders sent",
      description: `${res.sent} message(s) sent${res.failed ? `, ${res.failed} failed` : ""}`,
      variant: res.failed ? "destructive" : undefined,
    });
    onSent();
  };

  const rowById = sentRows;

  return (
    <Modal isOpen onClose={onClose} title="Send Calibration Reminder" size="4xl">
      <div className="space-y-4 p-6">
        {response ? (
          <>
            <p className="text-sm text-slate-600">
              {response.sent} message(s) sent{response.failed ? `, ${response.failed} failed` : ""}. A row that failed can be retried: it stays in this list.
            </p>
            <div className="max-h-[50vh] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Client</th>
                  </tr>
                </thead>
                <tbody>
                  {response.results.map((r) => {
                    const row = rowById.get(r.id);
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">{row?.companyName || row?.clientName || r.ticketId || r.id}</td>
                        {r.skipped ? (
                          <td className="px-3 py-2 text-muted-foreground">Not sent ({r.skipped.replace(/_/g, " ")})</td>
                        ) : (
                          <td className="px-3 py-2">{outcomeBadge(r.client)}{r.client?.error ? <span className="ml-2 text-xs text-red-600">{r.client.error}</span> : null}</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <Button onClick={onClose}>Close</Button>
            </div>
          </>
        ) : (
          <>
            <div className="max-w-sm">
              <Label htmlFor="rem-engineer">Engineer (shown in the message) *</Label>
              <select id="rem-engineer" className={selectClass} value={engineerName} onChange={(e) => setEngineerName(e.target.value)}>
                <option value="">Select engineer</option>
                {engineers.map((en) => (
                  <option key={en.engineer_name} value={en.engineer_name}>
                    {en.engineer_name}{en.phone_number ? ` - ${en.phone_number}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {rows.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No reminders are due today. Reminders go out when the due date is 30, 15, 7, 3 or 1 days away, or 3, 7 or 15 days overdue.
              </p>
            ) : (
              <div className="max-h-[50vh] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all rows" />
                      </th>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Invoice No.</th>
                      <th className="px-3 py-2">Due date</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Client</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">
                          <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`Select ${r.companyName}`} />
                        </td>
                        <td className="px-3 py-2 font-medium">{r.companyName || r.clientName}</td>
                        <td className="px-3 py-2">{r.invoiceNumber}</td>
                        <td className="px-3 py-2">{formatDate(r.calibrationDueDate)}</td>
                        <td className="px-3 py-2">
                          <StatusBadge tone={r.calibDueDays < 0 ? "danger" : "warning"}>{daysLabel(r.calibDueDays)}</StatusBadge>
                        </td>
                        <td className="px-3 py-2">
                          {r.clientName || "-"}
                          <div className="text-xs text-muted-foreground">
                            {r.clientPhone || "No number"}{r.clientPhone && !clientPending(r) ? " · already sent today" : ""}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{selected.size} of {rows.length} selected</span>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} disabled={isSending}>Cancel</Button>
                <Button
                  className="bg-green-600 text-white hover:bg-green-700"
                  onClick={handleSend}
                  disabled={isSending || rows.length === 0}
                  data-testid="button-confirm-send-reminder"
                >
                  {isSending ? (
                    <span className="flex items-center"><Loader2Icon className="mr-2 h-4 w-4 animate-spin" />Sending...</span>
                  ) : (
                    <span className="flex items-center"><Send className="mr-2 h-4 w-4" />Send ({selected.size})</span>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
