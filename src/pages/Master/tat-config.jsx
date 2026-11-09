import { useState, useEffect } from "react";
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
import { ListTable, StatusTabs } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { useToast } from "../../hooks/use-toast";
import { Loader2Icon, LoaderIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase/client";

// Every pipeline stage whose `<next_stage>_planned` is TAT-based (i.e. reads
// tat_config via src/lib/supabase/stagePlanning.js's computeStagePlanned),
// in pipeline order. "New Stage" only lets the admin pick from this fixed
// list (no more manual free-text stage names) — keeps stage_name values
// from ever drifting out of sync with what stagePlanning.js actually looks
// up. Add a stage's name here whenever a new TAT-driven rule is added to
// stagePlanning.js.
const ALL_STAGE_NAMES = [
  "Machine-Received",
  "Quotation",
  "Follow-Up",
  "CRM Verification",
  "Invoice",
  "Machine-Handover",
  "Calibration",
  "Calibration Certificate",
];

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

/** {days, hours, minutes} -> total minutes, for writing to duration_minutes. */
function durationToMinutes({ days, hours, minutes }) {
  const d = Number(days) || 0;
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  return d * 24 * 60 + h * 60 + m;
}

/** total minutes -> {days, hours, minutes}, for prefilling the edit form. */
function minutesToDuration(totalMinutes) {
  const total = Number(totalMinutes) || 0;
  const days = Math.floor(total / (24 * 60));
  const hours = Math.floor((total % (24 * 60)) / 60);
  const minutes = total % 60;
  return { days, hours, minutes };
}

function formatDuration(totalMinutes) {
  const { days, hours, minutes } = minutesToDuration(totalMinutes);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

/** "10:00:00" -> "10:00" for a native <input type="time">. */
function toTimeInputValue(timeStr) {
  if (!timeStr) return "";
  return String(timeStr).slice(0, 5);
}

const emptyForm = { uuid: null, stageName: "", days: 0, hours: 1, minutes: 0, responsiblePerson: "" };

export default function TatConfig() {
  const [activeTab, setActiveTab] = useState("stages");
  const { toast } = useToast();

  // ── Stages tab state ────────────────────────────────────────────────
  const [stages, setStages] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Office Hours tab state ──────────────────────────────────────────
  const [officeHoursLoading, setOfficeHoursLoading] = useState(false);
  const [officeHoursForm, setOfficeHoursForm] = useState({ startTime: "10:00", endTime: "18:00", weeklyOffDays: [0] });
  const [isSavingOfficeHours, setIsSavingOfficeHours] = useState(false);

  // ── Holidays tab state ───────────────────────────────────────────────
  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ uuid: null, holidayName: "", holidayDate: "" });
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  const [deleteHolidayTarget, setDeleteHolidayTarget] = useState(null);
  const [isDeletingHoliday, setIsDeletingHoliday] = useState(false);

  const fetchStages = async () => {
    setFetchLoading(true);
    try {
      const { data, error } = await supabase
        .from("inbound_tat_config")
        .select("*")
        .order("stage_name", { ascending: true });
      if (error) throw error;
      setStages(data || []);
    } catch (error) {
      console.error("Error fetching TAT config:", error);
      toast({ title: "Error", description: "Failed to load TAT config", variant: "destructive" });
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchOfficeHours = async () => {
    setOfficeHoursLoading(true);
    try {
      const { data, error } = await supabase.from("sss_office_hours").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      if (data) {
        setOfficeHoursForm({
          startTime: toTimeInputValue(data.start_time),
          endTime: toTimeInputValue(data.end_time),
          weeklyOffDays: data.weekly_off_days || [],
        });
      }
    } catch (error) {
      console.error("Error fetching office hours:", error);
      toast({ title: "Error", description: "Failed to load office hours", variant: "destructive" });
    } finally {
      setOfficeHoursLoading(false);
    }
  };

  const fetchHolidays = async () => {
    setHolidaysLoading(true);
    try {
      const { data, error } = await supabase
        .from("sss_holidays")
        .select("*")
        .order("holiday_date", { ascending: true });
      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      toast({ title: "Error", description: "Failed to load holidays", variant: "destructive" });
    } finally {
      setHolidaysLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
    fetchOfficeHours();
    fetchHolidays();
  }, []);

  // Stages not yet configured — the only ones selectable when creating a
  // new one (prevents duplicate stage_name rows via the dropdown itself).
  const availableStageNames = ALL_STAGE_NAMES.filter(
    (name) => !stages.some((s) => s.stage_name === name)
  );

  const openEditModal = (stage) => {
    setIsEditMode(true);
    const { days, hours, minutes } = minutesToDuration(stage.duration_minutes);
    setFormData({
      uuid: stage.uuid,
      stageName: stage.stage_name,
      days,
      hours,
      minutes,
      responsiblePerson: stage.responsible_person || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.stageName.trim()) {
      toast({ title: "Missing information", description: "Stage name is required", variant: "destructive" });
      return;
    }

    const durationMinutes = durationToMinutes(formData);
    if (durationMinutes <= 0) {
      toast({ title: "Invalid duration", description: "TAT duration must be greater than 0", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        const { error } = await supabase
          .from("inbound_tat_config")
          .update({
            stage_name: formData.stageName.trim(),
            duration_minutes: durationMinutes,
            responsible_person: formData.responsiblePerson.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("uuid", formData.uuid);
        if (error) throw error;
        toast({ title: "Success", description: "TAT updated successfully" });
      } else {
        const { error } = await supabase.from("inbound_tat_config").insert({
          stage_name: formData.stageName.trim(),
          duration_minutes: durationMinutes,
          responsible_person: formData.responsiblePerson.trim() || null,
        });
        if (error) throw error;
        toast({ title: "Success", description: "Stage added successfully" });
      }
      setShowModal(false);
      fetchStages();
    } catch (error) {
      console.error("Error saving TAT config:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate") ? "That stage already exists" : "Failed to save TAT config",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("inbound_tat_config").delete().eq("uuid", deleteTarget.uuid);
      if (error) throw error;
      toast({ title: "Success", description: "Stage deleted successfully" });
      setDeleteTarget(null);
      fetchStages();
    } catch (error) {
      console.error("Error deleting TAT config:", error);
      toast({ title: "Error", description: "Failed to delete stage", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleWeeklyOffDay = (dayValue) => {
    setOfficeHoursForm((prev) => {
      const has = prev.weeklyOffDays.includes(dayValue);
      return {
        ...prev,
        weeklyOffDays: has
          ? prev.weeklyOffDays.filter((d) => d !== dayValue)
          : [...prev.weeklyOffDays, dayValue].sort(),
      };
    });
  };

  const handleSaveOfficeHours = async (e) => {
    e.preventDefault();

    if (!officeHoursForm.startTime || !officeHoursForm.endTime) {
      toast({ title: "Missing information", description: "Please set both start and end time", variant: "destructive" });
      return;
    }
    if (officeHoursForm.endTime <= officeHoursForm.startTime) {
      toast({ title: "Invalid time range", description: "End time must be after start time", variant: "destructive" });
      return;
    }

    setIsSavingOfficeHours(true);
    try {
      const { error } = await supabase
        .from("sss_office_hours")
        .update({
          start_time: `${officeHoursForm.startTime}:00`,
          end_time: `${officeHoursForm.endTime}:00`,
          weekly_off_days: officeHoursForm.weeklyOffDays,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
      toast({ title: "Success", description: "Office hours updated successfully" });
      fetchOfficeHours();
    } catch (error) {
      console.error("Error saving office hours:", error);
      toast({ title: "Error", description: "Failed to save office hours", variant: "destructive" });
    } finally {
      setIsSavingOfficeHours(false);
    }
  };

  const openCreateHolidayModal = () => {
    setHolidayForm({ uuid: null, holidayName: "", holidayDate: "" });
    setShowHolidayModal(true);
  };

  const openEditHolidayModal = (holiday) => {
    setHolidayForm({ uuid: holiday.id, holidayName: holiday.holiday_name, holidayDate: holiday.holiday_date });
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async (e) => {
    e.preventDefault();

    if (!holidayForm.holidayName.trim()) {
      toast({ title: "Missing information", description: "Holiday name is required", variant: "destructive" });
      return;
    }
    if (!holidayForm.holidayDate) {
      toast({ title: "Missing information", description: "Holiday date is required", variant: "destructive" });
      return;
    }

    setIsSavingHoliday(true);
    try {
      if (holidayForm.uuid) {
        const { error } = await supabase
          .from("sss_holidays")
          .update({ holiday_name: holidayForm.holidayName.trim(), holiday_date: holidayForm.holidayDate })
          .eq("id", holidayForm.uuid);
        if (error) throw error;
        toast({ title: "Success", description: "Holiday updated successfully" });
      } else {
        const { error } = await supabase.from("sss_holidays").insert({
          holiday_name: holidayForm.holidayName.trim(),
          holiday_date: holidayForm.holidayDate,
        });
        if (error) throw error;
        toast({ title: "Success", description: "Holiday added successfully" });
      }
      setShowHolidayModal(false);
      fetchHolidays();
    } catch (error) {
      console.error("Error saving holiday:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate") ? "A holiday is already set for that date" : "Failed to save holiday",
        variant: "destructive",
      });
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!deleteHolidayTarget) return;
    setIsDeletingHoliday(true);
    try {
      const { error } = await supabase.from("sss_holidays").delete().eq("id", deleteHolidayTarget.id);
      if (error) throw error;
      toast({ title: "Success", description: "Holiday deleted successfully" });
      setDeleteHolidayTarget(null);
      fetchHolidays();
    } catch (error) {
      console.error("Error deleting holiday:", error);
      toast({ title: "Error", description: "Failed to delete holiday", variant: "destructive" });
    } finally {
      setIsDeletingHoliday(false);
    }
  };

  const formatHolidayDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const rowActions = (name, onEdit, onDelete) => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0" aria-label={`Edit ${name}`}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${name}`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const stageList = useClientList({
    key: "tat-stages",
    data: { all: stages },
    loading: fetchLoading,
    tabLabels: { all: "Stages" },
    sort: "none",
    defaultPageSize: 50,
    columns: [
      { key: "actions", label: "Actions", fixed: true, cell: (st) => rowActions(st.stage_name, () => openEditModal(st), () => setDeleteTarget(st)) },
      { key: "stage_name", label: "Stage", fixed: true, strong: true },
      { key: "tat", label: "TAT", defaultVisible: true, text: (st) => formatDuration(st.duration_minutes) },
      { key: "responsible_person", label: "Responsible Person", defaultVisible: true, text: (st) => st.responsible_person },
    ],
  });

  const holidayList = useClientList({
    key: "tat-holidays",
    data: { all: holidays },
    loading: holidaysLoading,
    tabLabels: { all: "Holidays" },
    sort: "none",
    defaultPageSize: 50,
    columns: [
      { key: "actions", label: "Actions", fixed: true, cell: (h) => rowActions(h.holiday_name, () => openEditHolidayModal(h), () => setDeleteHolidayTarget(h)) },
      { key: "holiday_date", label: "Date", fixed: true, strong: true, text: (h) => formatHolidayDate(h.holiday_date) },
      { key: "holiday_name", label: "Holiday Name", defaultVisible: true, text: (h) => h.holiday_name },
    ],
  });

  const sectionTabs = [
    { id: "stages", label: "Stages", count: stages.length },
    { id: "officeHours", label: "Office Hours" },
    { id: "holidays", label: "Holidays", count: holidays.length },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusTabs tabs={sectionTabs} activeTab={activeTab} onChange={setActiveTab} label="TAT sections" />
        {activeTab === "holidays" && (
          <Button onClick={openCreateHolidayModal} className="h-9 shrink-0 gap-1.5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Holiday
          </Button>
        )}
      </div>

      {activeTab === "stages" && (
        <ListTable list={stageList} rowKey={(st) => st.uuid} emptyTitle="No stages configured." ariaLabel="TAT stages" minWidth="min-w-0" />
      )}

      {activeTab === "officeHours" && (
        <div className="rounded-lg border bg-card">
          {officeHoursLoading ? (
            <div className="flex items-center justify-center py-10">
              <LoaderIcon className="h-6 w-6 animate-spin text-primary" aria-label="Loading" />
            </div>
          ) : (
            <form onSubmit={handleSaveOfficeHours} className="max-w-lg space-y-4 p-4">
              <p className="text-sm text-muted-foreground">
                Every <code>&lt;next_stage&gt;_planned</code> timestamp across the app is confined to this
                window — a stage submitted after closing time (or whose TAT runs past it) rolls over to the
                next working day's opening time instead of landing outside office hours.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="office-start">Start Time *</Label>
                  <Input
                    id="office-start"
                    type="time"
                    value={officeHoursForm.startTime}
                    onChange={(e) => setOfficeHoursForm((prev) => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="office-end">End Time *</Label>
                  <Input
                    id="office-end"
                    type="time"
                    value={officeHoursForm.endTime}
                    onChange={(e) => setOfficeHoursForm((prev) => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
  
              <div className="space-y-1.5">
                <Label id="weekly-off-label">Weekly Off Days</Label>
                <div role="group" aria-labelledby="weekly-off-label" className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const isOff = officeHoursForm.weeklyOffDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={isOff}
                        onClick={() => toggleWeeklyOffDay(day.value)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isOff
                            ? "border-destructive/25 bg-destructive/10 text-destructive"
                            : "border-input bg-card text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  These recur every week automatically. For one-off dates (national/company holidays), use
                  the Holidays tab instead.
                </p>
              </div>
  
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isSavingOfficeHours}>
                  {isSavingOfficeHours && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                  Save Office Hours
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {activeTab === "holidays" && (
        <ListTable list={holidayList} rowKey={(h) => h.id} emptyTitle="No holidays added." ariaLabel="Holidays" minWidth="min-w-0" />
      )}

      {/* Create / Edit Stage Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={isEditMode ? "Edit Stage TAT" : "New Stage"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tat-stage-name">Stage Name *</Label>
            {isEditMode ? (
              <Input id="tat-stage-name" value={formData.stageName} disabled />
            ) : (
              <Select
                value={formData.stageName || undefined}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, stageName: value }))}
              >
                <SelectTrigger id="tat-stage-name">
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent className="rounded-md border border-input bg-popover shadow-lg">
                  {availableStageNames.length === 0 ? (
                    <SelectItem value="none" disabled>
                      All stages already configured
                    </SelectItem>
                  ) : (
                    availableStageNames.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none">TAT Duration *</legend>
            <div className="grid grid-cols-3 gap-2 pt-1.5">
              {[
                { key: "days", label: "Days" },
                { key: "hours", label: "Hours" },
                { key: "minutes", label: "Minutes" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Input
                    id={`tat-${key}`}
                    type="number"
                    min="0"
                    value={formData[key]}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="0"
                  />
                  <Label htmlFor={`tat-${key}`} className="mt-1 block text-center text-xs font-normal text-muted-foreground">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              = {durationToMinutes(formData)} minutes total
            </p>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="tat-responsible">Responsible Person</Label>
            <Input
              id="tat-responsible"
              value={formData.responsiblePerson}
              onChange={(e) => setFormData((prev) => ({ ...prev, responsiblePerson: e.target.value }))}
              placeholder="e.g. Piyush Tiwari"
            />
            <p className="text-xs text-muted-foreground">
              Shown on Dashboard's "Generate Report" PDF as the person accountable for this stage's delay.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={isSubmitting || (!isEditMode && availableStageNames.length === 0)}
            >
              {isSubmitting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Save Changes" : "Create Stage"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Stage confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Stage"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            Delete TAT config for <span className="font-semibold">{deleteTarget?.stage_name}</span>?
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add / Edit Holiday Modal */}
      <Modal
        isOpen={showHolidayModal}
        onClose={() => setShowHolidayModal(false)}
        title={holidayForm.uuid ? "Edit Holiday" : "Add Holiday"}
        size="sm"
      >
        <form onSubmit={handleSaveHoliday} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="holiday-name">Holiday Name *</Label>
            <Input
              id="holiday-name"
              value={holidayForm.holidayName}
              onChange={(e) => setHolidayForm((prev) => ({ ...prev, holidayName: e.target.value }))}
              placeholder="e.g. Diwali, Republic Day, Company Anniversary"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="holiday-date">Date *</Label>
            <Input
              id="holiday-date"
              type="date"
              value={holidayForm.holidayDate}
              onChange={(e) => setHolidayForm((prev) => ({ ...prev, holidayDate: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowHolidayModal(false)}>Cancel</Button>
            <Button type="submit" disabled={isSavingHoliday}>
              {isSavingHoliday && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              {holidayForm.uuid ? "Save Changes" : "Add Holiday"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Holiday confirmation */}
      <Modal
        isOpen={!!deleteHolidayTarget}
        onClose={() => setDeleteHolidayTarget(null)}
        title="Delete Holiday"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            Delete holiday <span className="font-semibold">{deleteHolidayTarget?.holiday_name}</span> (
            {formatHolidayDate(deleteHolidayTarget?.holiday_date)})?
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteHolidayTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleDeleteHoliday} disabled={isDeletingHoliday}>
              {isDeletingHoliday && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
