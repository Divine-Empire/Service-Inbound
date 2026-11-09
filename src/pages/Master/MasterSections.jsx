import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { DataTable, FilterSearch, ListTable, ListToolbar } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { useToast } from "../../hooks/use-toast";
import { Loader2Icon, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { ltoSupabase } from "../../lib/supabase/ltoClient";
import useAuthStore from "../../store/authStore";

const DASH = <span className="text-muted-foreground">-</span>;

const formatRate = (rate) =>
  rate !== null && rate !== undefined
    ? `₹${Number(rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : DASH;

// Edit / delete icon buttons shared by every row; `name` makes the labels unique per row.
function RowActions({ name, onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-1">
      <Button variant="outline" size="sm" onClick={onEdit} aria-label={`Edit ${name}`} title="Edit" className="h-7 px-2 text-primary hover:bg-accent">
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      <Button variant="outline" size="sm" onClick={onDelete} aria-label={`Delete ${name}`} title="Delete" className="h-7 px-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

// The Master sub-pages that share this file: Item Master, Engineer List.
// (Dropdown, Company Details and TAT Master have their own pages.) Only the section being
// shown loads its data.
export default function MasterSections({ section }) {
  const { toast } = useToast();

  // ── Items tab state ──────────────────────────────────────────────────
  // Full CRUD on `lto_items` — the SAME shared item catalog table
  // Lead-To-Order-Supabase-New itself reads/writes (see ltoClient.js). This
  // used to be a 'item_name' dropdown category here; now it's its own tab
  // with a real table (name/code/rate/description), matching the dedicated
  // Items Master page LTO already has. lto_items now only holds the common
  // details (name, code, unit, updated_at/updated_by); rate, reseller rate and
  // the description (technical_specs) live in the item's 'basic' row of
  // lto_item_specs -- see Lead-To-Order-Supabase-New/Database/17_item_specs.sql.
  const { user: currentUser } = useAuthStore();
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const [itemPage, setItemPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [itemsTotalCount, setItemsTotalCount] = useState(0);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalMode, setItemModalMode] = useState("add"); // "add" | "edit"
  const [editingItem, setEditingItem] = useState(null);
  const [itemFormData, setItemFormData] = useState({ item_name: "", item_code: "", rate: "", description: "" });
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const fetchItems = async () => {
    setItemsLoading(true);
    try {
      const from = (itemPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = ltoSupabase
        .from("lto_items")
        .select("uuid, item_name, item_code, unit, lto_item_specs(rate, reseller_rate, technical_specs)", { count: "exact" })
        .eq("lto_item_specs.type", "basic");

      const term = debouncedItemSearch.trim();
      if (term) {
        const like = `%${term}%`;
        query = query.or(`item_name.ilike.${like},item_code.ilike.${like}`);
      }

      query = query.order("item_name", { ascending: true }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      // Flatten the basic spec row so the table / edit form keep reading
      // item.rate / item.description.
      setItems(
        (data || []).map(({ lto_item_specs: specs, ...item }) => {
          const basic = (specs && specs[0]) || {};
          return { ...item, rate: basic.rate ?? null, reseller_rate: basic.reseller_rate ?? null, description: basic.technical_specs || "" };
        })
      );
      setItemsTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching items:", error);
      toast({ title: "Error", description: "Failed to load items", variant: "destructive" });
    } finally {
      setItemsLoading(false);
    }
  };

  const handleOpenItemModal = (mode, item = null) => {
    setItemModalMode(mode);
    setEditingItem(item);
    setItemFormData(
      item && mode === "edit"
        ? {
            item_name: item.item_name || "",
            item_code: item.item_code || "",
            rate: item.rate !== null && item.rate !== undefined ? String(item.rate) : "",
            description: item.description || "",
          }
        : { item_name: "", item_code: "", rate: "", description: "" }
    );
    setItemModalOpen(true);
  };

  const handleCloseItemModal = () => {
    setItemModalOpen(false);
    setEditingItem(null);
    setItemFormData({ item_name: "", item_code: "", rate: "", description: "" });
  };

  const handleSubmitItem = async (e) => {
    e.preventDefault();
    const name = itemFormData.item_name.trim();
    if (!name) {
      toast({ title: "Missing item name", description: "Item Name is required", variant: "destructive" });
      return;
    }
    const code = itemFormData.item_code.trim();
    if (!code) {
      toast({ title: "Missing item code", description: "Item Code is required", variant: "destructive" });
      return;
    }
    if (itemModalMode === "edit" && !editingItem?.uuid) {
      toast({ title: "Error", description: "Cannot save: this item has no uuid. Please refresh and try again.", variant: "destructive" });
      return;
    }

    setIsSavingItem(true);
    const payload = {
      item_name: name,
      item_code: code,
      rate: itemFormData.rate !== "" ? parseFloat(itemFormData.rate) : null,
      description: itemFormData.description.trim() || null,
    };
    // Who touched this item last -- stamped on every add/edit.
    const updatedBy = currentUser?.username || currentUser?.name || null;

    try {
      if (itemModalMode === "add") {
        // lto_add_item rejects a duplicate item code (DUPLICATE_CODE:<name>).
        const { data: newUuid, error } = await ltoSupabase.rpc("lto_add_item", {
          p_item_name: name,
          p_item_code: code,
          p_unit: "Nos",
          p_updated_by: updatedBy,
        });
        if (error) throw error;
        const { error: specError } = await ltoSupabase.from("lto_item_specs").insert({
          item_uuid: newUuid,
          type: "basic",
          rate: payload.rate,
          technical_specs: payload.description,
          updated_by: updatedBy,
        });
        if (specError) throw specError;
        toast({ title: "Success", description: "Item added successfully" });
      } else {
        // One call updates the item and its 'basic' spec row. The existing
        // reseller rate and unit are passed through unchanged.
        const { error } = await ltoSupabase.rpc("lto_save_item_details", {
          p_item_uuid: editingItem.uuid,
          p_item_name: name,
          p_item_code: code,
          p_unit: editingItem.unit || null,
          p_specs: [
            {
              type: "basic",
              rate: payload.rate,
              reseller_rate: editingItem.reseller_rate ?? null,
              technical_specs: payload.description,
            },
          ],
          p_updated_by: updatedBy,
        });
        if (error) throw error;
        toast({ title: "Success", description: "Item updated successfully" });
      }
      handleCloseItemModal();
      fetchItems();
    } catch (error) {
      console.error("Error saving item:", error);
      const dup = (error?.message || "").match(/DUPLICATE_CODE:(.*)$/);
      const message = dup
        ? `This item code is already used by "${dup[1].trim()}".`
        : error?.code === "23505"
          ? `An item named "${payload.item_name}" already exists. Choose a different name.`
          : (error.message || String(error));
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) return;
    setIsDeletingItem(true);
    try {
      const { error } = await ltoSupabase.from("lto_items").delete().eq("uuid", deleteItemTarget.uuid);
      if (error) throw error;
      toast({ title: "Success", description: "Item deleted successfully" });
      setDeleteItemTarget(null);
      fetchItems();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    } finally {
      setIsDeletingItem(false);
    }
  };

  // ── Engineer Contacts tab state ─────────────────────────────────────
  // WhatsApp numbers for the video-call-scheduled notifications
  // (send-video-call-notifications Edge Function looks this table up by
  // engineer name — see [[whatsapp_meta_integration]]).
  const [engineerContacts, setEngineerContacts] = useState([]);
  const [engineerContactsLoading, setEngineerContactsLoading] = useState(false);
  const [newEngineerName, setNewEngineerName] = useState("");
  const [newEngineerPhone, setNewEngineerPhone] = useState("");
  const [isAddingEngineerContact, setIsAddingEngineerContact] = useState(false);
  const [addEngineerOpen, setAddEngineerOpen] = useState(false);
  const [deleteEngineerTarget, setDeleteEngineerTarget] = useState(null);
  const [isDeletingEngineerContact, setIsDeletingEngineerContact] = useState(false);

  // Single "Edit" modal per engineer — everything except the name (phone,
  // email, bank details) is editable here. Also feeds the
  // engineer's contact and bank details.
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [detailsForm, setDetailsForm] = useState({});
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  const fetchEngineerContacts = async () => {
    setEngineerContactsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sss_engineer_contacts")
        .select("*")
        .order("engineer_name", { ascending: true });
      if (error) throw error;
      setEngineerContacts(data || []);
    } catch (error) {
      console.error("Error fetching engineer contacts:", error);
      toast({ title: "Error", description: "Failed to load engineer contacts", variant: "destructive" });
    } finally {
      setEngineerContactsLoading(false);
    }
  };

  useEffect(() => {
    if (section === "engineers") fetchEngineerContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  // Items tab: debounce the raw search input so we don't fire a query per
  // keystroke, then re-fetch whenever the page OR the debounced term changes.
  // A new search term also resets back to page 1 (a stale later page would
  // otherwise look like "no results" for an unrelated reason).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedItemSearch(itemSearch.trim()), 400);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  useEffect(() => {
    setItemPage(1);
  }, [debouncedItemSearch]);

  useEffect(() => {
    if (section === "items") fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, itemPage, debouncedItemSearch]);

  // ── Engineer Contacts tab handlers ──────────────────────────────────
  // This tab IS the engineer source of truth — engineers are added and removed only here.
  // Every page that assigns an engineer reads the names via fetchEngineerNames() (see engineers.js).
  const handleAddEngineerContact = async (e) => {
    e.preventDefault();
    const name = newEngineerName.trim();
    const phone = newEngineerPhone.trim();
    if (!name) {
      toast({ title: "Missing engineer name", description: "Please enter the engineer's name", variant: "destructive" });
      return;
    }
    if (!phone) {
      toast({ title: "Missing WhatsApp number", description: "Please enter a WhatsApp number", variant: "destructive" });
      return;
    }
    if (engineerContacts.some((c) => c.engineer_name.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Duplicate engineer", description: "An engineer with this name already exists", variant: "destructive" });
      return;
    }

    setIsAddingEngineerContact(true);
    try {
      const { error } = await supabase
        .from("sss_engineer_contacts")
        .insert({ engineer_name: name, phone_number: phone });
      if (error) throw error;
      toast({ title: "Success", description: "Engineer added successfully" });
      setNewEngineerName("");
      setNewEngineerPhone("");
      setAddEngineerOpen(false);
      fetchEngineerContacts();
    } catch (error) {
      console.error("Error adding engineer:", error);
      toast({ title: "Error", description: "Failed to add engineer", variant: "destructive" });
    } finally {
      setIsAddingEngineerContact(false);
    }
  };

  const handleDeleteEngineerContact = async () => {
    if (!deleteEngineerTarget) return;
    setIsDeletingEngineerContact(true);
    try {
      const { error } = await supabase
        .from("sss_engineer_contacts")
        .delete()
        .eq("engineer_name", deleteEngineerTarget.engineer_name);
      if (error) throw error;
      toast({ title: "Success", description: "Engineer contact deleted successfully" });
      setDeleteEngineerTarget(null);
      fetchEngineerContacts();
    } catch (error) {
      console.error("Error deleting engineer contact:", error);
      toast({ title: "Error", description: "Failed to delete engineer contact", variant: "destructive" });
    } finally {
      setIsDeletingEngineerContact(false);
    }
  };

  const openDetailsModal = (contact) => {
    setDetailsTarget(contact);
    setDetailsForm({
      phoneNumber: contact.phone_number || "",
      email: contact.email || "",
      bankName: contact.bank_name || "",
      accountHolderName: contact.account_holder_name || "",
      accountNumber: contact.account_number || "",
      ifscCode: contact.ifsc_code || "",
      branch: contact.branch || "",
    });
  };

  const handleDetailsFormChange = (field, value) => {
    setDetailsForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDetails = async () => {
    if (!detailsTarget) return;
    if (!detailsForm.phoneNumber?.trim()) {
      toast({ title: "Missing WhatsApp number", description: "WhatsApp number cannot be empty", variant: "destructive" });
      return;
    }
    setIsSavingDetails(true);
    try {
      const { error } = await supabase
        .from("sss_engineer_contacts")
        .update({
          phone_number: detailsForm.phoneNumber.trim(),
          email: detailsForm.email || null,
          bank_name: detailsForm.bankName || null,
          account_holder_name: detailsForm.accountHolderName || null,
          account_number: detailsForm.accountNumber || null,
          ifsc_code: detailsForm.ifscCode || null,
          branch: detailsForm.branch || null,
          updated_at: new Date().toISOString(),
        })
        .eq("engineer_name", detailsTarget.engineer_name);
      if (error) throw error;
      toast({ title: "Success", description: "Engineer details saved successfully" });
      setDetailsTarget(null);
      fetchEngineerContacts();
    } catch (error) {
      console.error("Error saving engineer details:", error);
      toast({ title: "Error", description: "Failed to save engineer details", variant: "destructive" });
    } finally {
      setIsSavingDetails(false);
    }
  };

  // ── Lists (kit) ─────────────────────────────────────────────────────
  // Each non-Items tab is its own client-side list with a single "all" tab.
  const engineerList = useClientList({
    key: "master-engineers",
    data: { all: engineerContacts },
    loading: engineerContactsLoading,
    tabLabels: { all: "Engineers" },
    searchKeys: ["engineer_name", "phone_number", "email"],
    sort: "none",
    columns: [
      { key: "actions", label: "Actions", fixed: true, headerClassName: "text-right w-24", cellClassName: "text-right", cell: (c) => (
        <RowActions name={c.engineer_name} onEdit={() => openDetailsModal(c)} onDelete={() => setDeleteEngineerTarget(c)} />
      ) },
      { key: "engineer_name", label: "Engineer Name", strong: true },
      { key: "phone_number", label: "WhatsApp Number" },
      { key: "email", label: "Email" },
      { key: "bank_name", label: "Bank Name" },
      { key: "account_holder_name", label: "Account Holder" },
      { key: "account_number", label: "Account Number" },
      { key: "ifsc_code", label: "IFSC Code" },
      { key: "branch", label: "Branch" },
    ],
  });

  const itemsTotalPages = Math.ceil(itemsTotalCount / itemsPerPage) || 1;

  return (
    <div className="space-y-4">
      {/* ── Items Tab ────────────────────────────────────────── */}
      {/* Full CRUD on `lto_items` — the SAME shared item catalog
          Lead-To-Order-Supabase-New reads/writes (see ltoClient.js).
          Every add/edit stamps user_who_updated + updated_at. */}
      {section === "items" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterSearch value={itemSearch} onChange={setItemSearch} placeholder="Search items by name or code..." className="min-w-[220px]" />
            <Button type="button" onClick={() => handleOpenItemModal("add")} className="shrink-0">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add Item
            </Button>
          </div>
          <DataTable
            headers={[
              { label: "Actions", className: "text-right w-24" },
              "Item Name",
              "Item Code",
              "Rate (₹)",
              "Description",
            ]}
            data={items}
            loading={itemsLoading}
            minWidth="min-w-[800px]"
            ariaLabel="Items"
            emptyTitle="No items found."
            currentPage={itemPage}
            totalPages={itemsTotalPages}
            itemsPerPage={itemsPerPage}
            totalResults={itemsTotalCount}
            onPageChange={(p) => setItemPage(Math.min(Math.max(1, p), itemsTotalPages))}
            onItemsPerPageChange={() => {}}
            itemsPerPageOptions={[itemsPerPage]}
            renderRow={(item) => (
              <tr key={item.uuid} className="transition-colors">
                <td className="px-3.5 py-2.5 text-right align-top">
                  <RowActions name={item.item_name} onEdit={() => handleOpenItemModal("edit", item)} onDelete={() => setDeleteItemTarget(item)} />
                </td>
                <td className="px-3.5 py-2.5 align-top text-sm font-semibold text-foreground">{item.item_name}</td>
                <td className="whitespace-nowrap px-3.5 py-2.5 align-top text-sm text-foreground">{item.item_code || DASH}</td>
                <td className="whitespace-nowrap px-3.5 py-2.5 align-top text-sm text-foreground">{formatRate(item.rate)}</td>
                <td className="max-w-xs truncate px-3.5 py-2.5 align-top text-sm text-foreground" title={item.description || ""}>{item.description || DASH}</td>
              </tr>
            )}
            renderCard={(item) => (
              <div key={item.uuid} className="rounded-lg border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold text-foreground">{item.item_name}</p>
                  <RowActions name={item.item_name} onEdit={() => handleOpenItemModal("edit", item)} onDelete={() => setDeleteItemTarget(item)} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Item Code</dt>
                    <dd className="break-words text-foreground">{item.item_code || DASH}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Rate (₹)</dt>
                    <dd className="text-foreground">{formatRate(item.rate)}</dd>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <dt className="text-muted-foreground">Description</dt>
                    <dd className="break-words text-foreground">{item.description || DASH}</dd>
                  </div>
                </dl>
              </div>
            )}
          />
        </div>
      )}

      {/* ── Engineer Contacts Tab ────────────────────────────── */}
      {/* Single source of truth for engineers app-wide — every page's
          "Engineer Assign" field reads from this table (see
          engineers.js). Add/remove an engineer here, nowhere else. */}
      {section === "engineers" && (
        <div className="space-y-3">
          <ListToolbar
            list={engineerList}
            searchPlaceholder="Search engineers..."
            actions={
              <Button type="button" onClick={() => setAddEngineerOpen(true)} className="h-9 shrink-0 gap-1.5">
                <Plus className="h-4 w-4" aria-hidden="true" /> Add Engineer
              </Button>
            }
          />
          <ListTable
            list={engineerList}
            rowKey={(c) => c.engineer_name}
            emptyTitle="No engineer contacts yet."
            ariaLabel="Engineer contacts"
            minWidth="min-w-[1000px]"
          />
        </div>
      )}

      {/* Add Engineer modal */}
      <Modal isOpen={addEngineerOpen} onClose={() => setAddEngineerOpen(false)} title="Add Engineer" size="md">
        <form onSubmit={handleAddEngineerContact} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="add-engineer-name" className="text-sm font-medium text-foreground">Engineer Name *</label>
            <Input
              id="add-engineer-name"
              placeholder="Engineer name"
              value={newEngineerName}
              onChange={(e) => setNewEngineerName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="add-engineer-phone" className="text-sm font-medium text-foreground">WhatsApp Number *</label>
            <Input
              id="add-engineer-phone"
              placeholder="Enter WhatsApp number"
              value={newEngineerPhone}
              onChange={(e) => setNewEngineerPhone(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setAddEngineerOpen(false)} disabled={isAddingEngineerContact}>Cancel</Button>
            <Button type="submit" disabled={isAddingEngineerContact}>
              {isAddingEngineerContact && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Add Engineer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Item add/edit modal */}
      <Modal
        isOpen={itemModalOpen}
        onClose={handleCloseItemModal}
        title={itemModalMode === "add" ? "Add Item" : "Edit Item"}
        size="md"
      >
        <form onSubmit={handleSubmitItem} className="p-2 space-y-4">
          <div className="space-y-1">
            <label htmlFor="master-f1" className="text-sm font-medium text-foreground">Item Name *</label>
            <Input id="master-f1"
              placeholder="e.g. Solar Panel 400W"
              value={itemFormData.item_name}
              onChange={(e) => setItemFormData((prev) => ({ ...prev, item_name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="master-f2" className="text-sm font-medium text-foreground">Item Code *</label>
              <Input id="master-f2"
                placeholder="e.g. ITM-001"
                value={itemFormData.item_code}
                onChange={(e) => setItemFormData((prev) => ({ ...prev, item_code: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="master-f3" className="text-sm font-medium text-foreground">Rate (₹)</label>
              <Input id="master-f3"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 1500.00"
                value={itemFormData.rate}
                onChange={(e) => setItemFormData((prev) => ({ ...prev, rate: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="master-f4" className="text-sm font-medium text-foreground">Description</label>
            <textarea id="master-f4"
              rows={3}
              placeholder="Enter additional details or specifications..."
              value={itemFormData.description}
              onChange={(e) => setItemFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleCloseItemModal} disabled={isSavingItem}>Cancel</Button>
            <Button type="submit" disabled={isSavingItem} >
              {isSavingItem && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Item delete confirmation */}
      <Modal
        isOpen={!!deleteItemTarget}
        onClose={() => setDeleteItemTarget(null)}
        title="Delete Item"
        size="sm"
      >
        <div className="p-2 space-y-4">
          <p className="text-foreground">
            Delete <span className="font-semibold">{deleteItemTarget?.item_name}</span>? This item also disappears from Lead-To-Order's own Items Master, since both apps share the same catalog.
          </p>
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => setDeleteItemTarget(null)}>Cancel</Button>
            <Button type="button" onClick={handleDeleteItem} disabled={isDeletingItem} variant="destructive">
              {isDeletingItem && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Engineer contact delete confirmation */}
      <Modal
        isOpen={!!deleteEngineerTarget}
        onClose={() => setDeleteEngineerTarget(null)}
        title="Delete Engineer Contact"
        size="sm"
      >
        <div className="p-2 space-y-4">
          <p className="text-foreground">
            Delete the WhatsApp number for{" "}
            <span className="font-semibold">{deleteEngineerTarget?.engineer_name}</span>?
          </p>
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => setDeleteEngineerTarget(null)}>Cancel</Button>
            <Button type="button" onClick={handleDeleteEngineerContact} disabled={isDeletingEngineerContact} variant="destructive">
              {isDeletingEngineerContact && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Email & Bank Details modal — feeds the TADA Senior Approval email */}
      <Modal
        isOpen={!!detailsTarget}
        onClose={() => setDetailsTarget(null)}
        title={`Details — ${detailsTarget?.engineer_name || ""}`}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
          <div className="space-y-1">
            <label htmlFor="master-f5" className="text-sm font-medium text-foreground">WhatsApp Number</label>
            <Input id="master-f5"
              value={detailsForm.phoneNumber || ""}
              onChange={(e) => handleDetailsFormChange("phoneNumber", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="master-f6" className="text-sm font-medium text-foreground">Email</label>
            <Input id="master-f6"
              type="email"
              placeholder="engineer@example.com"
              value={detailsForm.email || ""}
              onChange={(e) => handleDetailsFormChange("email", e.target.value)}
            />
          </div>
          <div className="md:col-span-2 pt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Bank Details for Transfer</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="master-f7" className="text-sm font-medium text-foreground">Bank Name</label>
            <Input id="master-f7"
              value={detailsForm.bankName || ""}
              onChange={(e) => handleDetailsFormChange("bankName", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="master-f8" className="text-sm font-medium text-foreground">Account Holder Name</label>
            <Input id="master-f8"
              value={detailsForm.accountHolderName || ""}
              onChange={(e) => handleDetailsFormChange("accountHolderName", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="master-f9" className="text-sm font-medium text-foreground">Account Number</label>
            <Input id="master-f9"
              value={detailsForm.accountNumber || ""}
              onChange={(e) => handleDetailsFormChange("accountNumber", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="master-f10" className="text-sm font-medium text-foreground">IFSC Code</label>
            <Input id="master-f10"
              value={detailsForm.ifscCode || ""}
              onChange={(e) => handleDetailsFormChange("ifscCode", e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label htmlFor="master-f11" className="text-sm font-medium text-foreground">Branch</label>
            <Input id="master-f11"
              value={detailsForm.branch || ""}
              onChange={(e) => handleDetailsFormChange("branch", e.target.value)}
            />
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setDetailsTarget(null)} disabled={isSavingDetails}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveDetails}
              disabled={isSavingDetails}
              
            >
              {isSavingDetails && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
