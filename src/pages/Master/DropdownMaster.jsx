import { useEffect, useState } from "react";
import { Loader2Icon, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { EmptyState, ErrorState } from "../../components/shared";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { fetchDropdownRows } from "../../lib/supabase/dropdown";

// Categories whose key reads badly as a heading (see migration 0043 for the renames).
const CATEGORY_LABELS = {
  category: "Category (Requirement Service Type)",
  sub_category: "Sub-Category (Machine Group)",
};
const categoryLabel = (cat) =>
  CATEGORY_LABELS[cat] || String(cat).replace(/_/g, " ");

// Same layout as Lead-To-Order's Dropdown Master: one column per category with its values
// listed underneath, edit / delete on row hover, and "Add Value" for an existing category.
export default function DropdownMaster() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(null); // { mode: "add" | "edit", row? }
  const [form, setForm] = useState({ category: "", value: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows((await fetchDropdownRows(null, "uuid, category, value, created_at")) || []);
    } catch (e) {
      console.error("Error fetching dropdowns:", e);
      setError("Failed to load dropdown values.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categories = [...new Set(rows.map((r) => r.category))];
  const grouped = Object.fromEntries(categories.map((c) => [c, rows.filter((r) => r.category === c)]));
  const maxRows = Math.max(0, ...categories.map((c) => grouped[c].length));

  const openModal = (mode, row = null) => {
    setForm(row ? { category: row.category, value: row.value } : { category: categories[0] || "", value: "" });
    setModal({ mode, row });
  };
  const closeModal = () => {
    setModal(null);
    setForm({ category: "", value: "" });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const value = form.value.trim();
    if (!form.category || !value) {
      toast({ title: "Missing details", description: "Please provide both Category and Value.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (modal.mode === "edit") {
        const { error: err } = await supabase.from("sss_dropdown").update({ value }).eq("uuid", modal.row.uuid);
        if (err) throw err;
        toast({ title: "Success", description: "Value updated successfully" });
      } else {
        const { error: err } = await supabase.from("sss_dropdown").insert({ category: form.category, value });
        if (err) throw err;
        toast({ title: "Success", description: "Value added successfully" });
      }
      closeModal();
      load();
    } catch (err) {
      console.error("Error saving value:", err);
      toast({ title: "Error", description: "Failed to save value", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from("sss_dropdown").delete().eq("uuid", deleteTarget.uuid);
      if (err) throw err;
      toast({ title: "Success", description: "Value deleted successfully" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      console.error("Error deleting value:", err);
      toast({ title: "Error", description: "Failed to delete value", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Dropdown Master</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Manage values for the dropdown categories used across the app</p>
        </div>
        <Button type="button" onClick={() => openModal("add")} disabled={loading || categories.length === 0} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Value
        </Button>
      </div>

      <div className="max-h-[calc(100vh-11rem)] overflow-auto rounded-lg border bg-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground" role="status">Loading dropdowns...</div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : categories.length === 0 ? (
          <EmptyState title="No dropdown values found" />
        ) : (
          <table className="min-w-full border-separate border-spacing-0" aria-label="Dropdown values by category">
            <thead className="sticky top-0 z-10 bg-secondary">
              <tr>
                {categories.map((cat) => (
                  <th
                    key={cat}
                    scope="col"
                    className="min-w-[220px] border-b border-r bg-secondary px-4 py-2.5 text-left text-xs font-semibold capitalize text-brand-800 last:border-r-0"
                  >
                    {categoryLabel(cat)}
                    <span className="ml-1.5 font-normal text-muted-foreground">({grouped[cat].length})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-card">
              {Array.from({ length: maxRows }).map((_, i) => (
                <tr key={i} className="transition-colors hover:bg-secondary/60">
                  {categories.map((cat) => {
                    const item = grouped[cat][i];
                    return (
                      <td key={cat} className="border-b border-r px-4 py-2 align-top text-sm text-foreground last:border-r-0">
                        {item ? (
                          <div className="group flex items-center justify-between gap-2">
                            <span className="min-w-0 break-words">{item.value}</span>
                            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => openModal("edit", item)}
                                aria-label={`Edit ${item.value}`}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-accent"
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                aria-label={`Delete ${item.value}`}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground" aria-label="empty">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={!!modal} onClose={closeModal} title={modal?.mode === "edit" ? "Edit Value" : "Add New Value"} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="dropdown-category" className="block text-sm font-medium text-foreground">Category</label>
            <select
              id="dropdown-category"
              required
              disabled={modal?.mode === "edit"}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus:border-primary focus:outline-none disabled:bg-secondary disabled:text-muted-foreground"
            >
              <option value="" disabled>Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{categoryLabel(cat)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dropdown-value" className="block text-sm font-medium text-foreground">Value</label>
            <Input
              id="dropdown-value"
              required
              autoFocus
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder="Enter dropdown value"
            />
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Value" size="sm">
        <div className="space-y-4">
          <p className="text-foreground">
            Delete <span className="font-semibold">{deleteTarget?.value}</span> from{" "}
            <span className="font-semibold">{deleteTarget && categoryLabel(deleteTarget.category)}</span>?
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
