import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { StatusBadge } from "../../components/shared";

export const DRAFT_COPY_SHARED = "Draft Copy Shared";
export const CONFIRMATION_PENDING = "Confirmation Pending";
const OTHER = "Other";
const KNOWN = [DRAFT_COPY_SHARED, CONFIRMATION_PENDING];

// Colour coding: Draft Copy Shared = blue, Confirmation Pending = amber, anything typed
// under "Other" = purple. Empty = nothing shown.
export const statusTone = (status) => {
  if (!status) return "neutral";
  if (status === DRAFT_COPY_SHARED) return "info";
  if (status === CONFIRMATION_PENDING) return "warning";
  return "purple";
};

export const CalibrationStatusBadge = ({ status }) =>
  status ? <StatusBadge tone={statusTone(status)}>{status}</StatusBadge> : null;

const selectClass =
  "h-8 w-full min-w-[170px] rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";

// Inline editor for the Pending tab. Picking a listed status saves straight away; "Other"
// reveals a text field that saves on Enter / blur. `onSave(row, value|null)` returns a promise.
export function CalibrationStatusCell({ row, onSave }) {
  const current = row.calibrationStatus || "";
  const currentMode = !current ? "" : KNOWN.includes(current) ? current : OTHER;
  const [mode, setMode] = useState(currentMode);
  const [text, setText] = useState(currentMode === OTHER ? current : "");
  const [saving, setSaving] = useState(false);

  // Follow the saved value (e.g. after the 72 h auto-update or a reload).
  useEffect(() => {
    setMode(currentMode);
    setText(currentMode === OTHER ? current : "");
  }, [current, currentMode]);

  const save = async (value) => {
    setSaving(true);
    try {
      await onSave(row, value);
    } finally {
      setSaving(false);
    }
  };

  const onSelect = (e) => {
    const v = e.target.value;
    setMode(v);
    if (v === OTHER) return; // wait for the text
    save(v || null);
  };

  const commitText = () => {
    const t = text.trim();
    if (!t || t === current) return;
    save(t);
  };

  return (
    <div className="flex min-w-[170px] flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <select
          aria-label={`Calibration status for ${row.ticketId}`}
          className={selectClass}
          value={mode}
          onChange={onSelect}
          disabled={saving}
          data-testid={`select-calibration-status-${row.ticketId}`}
        >
          <option value="">— Select —</option>
          <option value={DRAFT_COPY_SHARED}>{DRAFT_COPY_SHARED}</option>
          <option value={CONFIRMATION_PENDING}>{CONFIRMATION_PENDING}</option>
          <option value={OTHER}>{OTHER}</option>
        </select>
        {saving && <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {mode === OTHER && (
        <input
          aria-label="Other status"
          className={selectClass}
          placeholder="Type status and press Enter"
          value={text}
          maxLength={80}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          disabled={saving}
          data-testid={`input-calibration-status-other-${row.ticketId}`}
        />
      )}
      {current && <CalibrationStatusBadge status={current} />}
    </div>
  );
}
