import { useState, useEffect } from "react";
import { Pencil, Trash2, Send, Plus, Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { ListToolbar, ListTable, StatusBadge } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { formatDate, formatDateTimeShort } from "../../lib/format";
import { exportCsv } from "../../lib/exportCsv";
import { fromDb, isReminderDue } from "./helpers";
import WhatsappFormModal from "./WhatsappFormModal";
import ReminderModal from "./ReminderModal";

const linkCell = (url) =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
      View
    </a>
  ) : null;

// The client's last outcome. Hover for the failure reason.
const statusCell = (row) => {
  const status = row.clientMsgStatus;
  const error = row.clientMsgError;
  if (!status) return null;
  const tone = status === "sent" ? "success" : status === "failed" ? "danger" : "neutral";
  return (
    <span title={error || undefined}>
      <StatusBadge tone={tone}>{status === "sent" ? "Sent" : status === "failed" ? "Failed" : "Skipped"}</StatusBadge>
    </span>
  );
};

// The client's latest button reply on the reminder. Renewed / Not Interested pause the reminders.
const responseCell = (row) => {
  const response = row.clientResponse;
  if (!response) return null;
  const tone = response === "Interested" ? "success" : response === "Renewed" ? "info" : "danger";
  const paused = response !== "Interested";
  return (
    <span title={`Replied ${formatDateTimeShort(row.clientRespondedAt)}${paused ? " - reminders paused until they reply Interested" : ""}`}>
      <StatusBadge tone={tone}>{response}</StatusBadge>
    </span>
  );
};

const dueDaysCell = (r) => {
  if (r.calibDueDays === null || r.calibDueDays === undefined) return null;
  const d = r.calibDueDays;
  return <StatusBadge tone={d < 0 ? "danger" : d <= 7 ? "warning" : "success"}>{d}</StatusBadge>;
};

const COLUMNS = [
  { key: "action", label: "Action", fixed: true, cell: (r, { onEdit, onDelete }) => (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onEdit(r)} aria-label={`Edit ${r.companyName}`} data-testid={`button-edit-whatsapp-${r.id}`}>
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 hover:text-red-700" onClick={() => onDelete(r)} aria-label={`Delete ${r.companyName}`} data-testid={`button-delete-whatsapp-${r.id}`}>
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  ) },
  { key: "invoiceDate", label: "Date of Invoice", defaultVisible: true, text: (r) => formatDate(r.invoiceDate) },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 200, strong: true, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "clientPhone", label: "Client Number (WhatsApp)", defaultVisible: true, text: (r) => r.clientPhone },
  { key: "siteAddress", label: "Site Address", defaultVisible: true, wrap: true, width: 220, text: (r) => r.siteAddress },
  { key: "invoiceNumber", label: "Invoice Number", defaultVisible: true, text: (r) => r.invoiceNumber },
  { key: "quotationNumber", label: "Quotation Number", defaultVisible: true, text: (r) => r.quotationNumber },
  { key: "calibrationDueDate", label: "Calibration Due Date", defaultVisible: true, text: (r) => formatDate(r.calibrationDueDate) },
  { key: "invoiceCopy", label: "Invoice Copy", defaultVisible: true, cell: (r) => linkCell(r.invoiceCopy) },
  { key: "calibDueDays", label: "Due Days", defaultVisible: true, cell: dueDaysCell, text: (r) => r.calibDueDays ?? "" },
  { key: "lastMessageAt", label: "Last Message At", defaultVisible: true, text: (r) => formatDateTimeShort(r.lastMessageAt) },
  { key: "equipmentLabel", label: "Equipment", defaultVisible: true, text: (r) => r.equipmentLabel },
  { key: "clientStatus", label: "Message Status", defaultVisible: true, cell: (r) => statusCell(r), text: (r) => r.clientMsgStatus },
  { key: "clientResponse", label: "Client Response", defaultVisible: true, cell: (r) => responseCell(r), text: (r) => r.clientResponse },
  { key: "engineerName", label: "Engineer Name", defaultVisible: false, text: (r) => r.engineerName },
  { key: "engineerPhone", label: "Engineer Phone", defaultVisible: false, text: (r) => r.engineerPhone },
  { key: "ticketId", label: "Ticket ID", defaultVisible: false, text: (r) => r.ticketId },
];

// WhatsApp stage (admin only): calibration-due reminders to the client. One tab; every ticket processed at
// Calibration lands here (DB trigger), plus rows added by hand with the Form button.
export default function CalibrationWhatsapp() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  // null = closed, {} = add, row = edit
  const [formRow, setFormRow] = useState(null);
  const [showReminder, setShowReminder] = useState(false);

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("inbound_calibration_whatsapp")
        .select("*")
        .order("calibration_due_date", { ascending: true });
      if (error) throw error;
      setRows((data || []).map(fromDb));
    } catch (error) {
      console.error("Error fetching WhatsApp rows:", error);
      setLoadError(error.message || "Failed to load data");
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete the reminder row for ${row.companyName || row.ticketId || "this entry"}?`)) return;
    const { error } = await supabase.from("inbound_calibration_whatsapp").delete().eq("id", row.id);
    if (error) {
      console.error("Error deleting WhatsApp row:", error);
      toast({ title: "Error", description: "Failed to delete the row", variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: "Row removed" });
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  const list = useClientList({
    key: "inbound-calibration-whatsapp",
    data: { all: rows },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    tabLabels: { all: "Whatsapp" },
    searchKeys: ["companyName", "clientName", "clientPhone", "invoiceNumber", "quotationNumber", "ticketId"],
    columns: COLUMNS,
    sort: "none", // soonest due date first
  });

  const dueCount = rows.filter(isReminderDue).length;

  const handleExportCsv = () => {
    const cols = list.activeColumns.filter((c) => !c.fixed && c.text);
    exportCsv(
      `calibration_whatsapp_${new Date().toISOString().slice(0, 10)}`,
      cols.map((c) => c.label),
      list.allFiltered.map((r) => cols.map((c) => c.text(r)))
    );
  };

  return (
    <div className="space-y-3">
      <ListToolbar
        list={list}
        searchPlaceholder="Search by company, client, number, invoice or quotation..."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={handleExportCsv} data-testid="button-export-whatsapp">
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFormRow({})} data-testid="button-form-whatsapp">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Form
            </Button>
            <Button
              size="sm"
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => setShowReminder(true)}
              data-testid="button-send-reminder"
            >
              <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Send Reminder{dueCount > 0 ? ` (${dueCount})` : ""}
            </Button>
          </>
        }
      />
      <ListTable
        list={list}
        ctx={{ onEdit: (r) => setFormRow(r), onDelete: handleDelete }}
        rowKey={(r) => r.id}
        cardTitle={(r) => r.companyName || r.clientName}
        emptyTitle="No calibration reminders found."
        ariaLabel="Calibration WhatsApp reminders"
      />

      {formRow && (
        <WhatsappFormModal
          key={formRow.id || "new"}
          row={formRow.id ? formRow : null}
          onClose={() => setFormRow(null)}
          onSaved={() => {
            setFormRow(null);
            fetchData();
          }}
        />
      )}

      {showReminder && (
        <ReminderModal
          rows={rows.filter(isReminderDue)}
          onClose={() => setShowReminder(false)}
          onSent={fetchData}
        />
      )}
    </div>
  );
}
