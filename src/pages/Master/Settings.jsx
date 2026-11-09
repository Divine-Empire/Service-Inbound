import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "../../components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { Badge } from "../../components/ui/badge";
import StatusBadge from "../../components/shared/StatusBadge";
import { Checkbox } from "../../components/ui/checkbox";
import { ListToolbar, ListTable } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { useToast } from "../../hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { navigation, navLabel } from "../../config/navigation";

const ROLES = ["admin", "user", "engineer"];
const ROLE_TONE = { admin: "info", engineer: "success", user: "neutral" };

// Pages that are always visible regardless of the page-access list, so
// offering them as toggles here wouldn't do anything — leave them out.
const ASSIGNABLE_PAGES = navigation
  .map((item) => item.name)
  .filter((name) => !["Settings", "Master"].includes(name));

const navLabelFor = (name) => {
  const item = navigation.find((i) => i.name === name);
  return item ? navLabel(item) : name;
};

const emptyForm = {
  uuid: null,
  fullName: "",
  username: "",
  password: "",
  role: "user",
  page: [],
};

const COLUMNS = [
  { key: "actions", label: "Actions", fixed: true, cell: (user, { onEdit, onDelete }) => (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(user)} aria-label={`Edit ${user.username}`}>
        <Edit className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => onDelete(user)}
        aria-label={`Delete ${user.username}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  ) },
  { key: "full_name", label: "Full Name", defaultVisible: true, strong: true, text: (u) => u.full_name },
  { key: "username", label: "Username", defaultVisible: true, text: (u) => u.username },
  { key: "password", label: "Password", defaultVisible: true, cell: (user, { visiblePasswords, onTogglePassword }) => (
    <div className="flex items-center gap-1.5 font-mono text-sm">
      <span>{visiblePasswords.has(user.uuid) ? user.password || "—" : "••••••••"}</span>
      <button
        type="button"
        onClick={() => onTogglePassword(user.uuid)}
        className="text-muted-foreground hover:text-foreground"
        aria-label={visiblePasswords.has(user.uuid) ? "Hide password" : "Show password"}
      >
        {visiblePasswords.has(user.uuid) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  ) },
  { key: "role", label: "Role", defaultVisible: true, cell: (user) => (
    <StatusBadge tone={ROLE_TONE[user.role] || "neutral"} className="capitalize">{user.role}</StatusBadge>
  ) },
  // Only pages that exist in this system are shown; the stored list is shared with Service-Support,
  // so other pages in it are left alone (neither shown nor removed).
  { key: "page", label: "Page Access", defaultVisible: true, cell: (user) => {
    const own = Array.isArray(user.page) ? user.page.map((p) => p.trim()).filter((p) => ASSIGNABLE_PAGES.includes(p)) : [];
    return (
      <div className="flex flex-wrap gap-1">
        {user.role === "admin" || own.length >= ASSIGNABLE_PAGES.length ? (
          <StatusBadge tone="success">All Steps (Full Access)</StatusBadge>
        ) : own.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">No pages assigned</span>
        ) : (
          own.map((p) => (
            <Badge key={p} variant="outline" className="bg-secondary text-xs font-normal text-foreground">{navLabelFor(p)}</Badge>
          ))
        )}
      </div>
    );
  } },
];

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState(new Set());
  // User-management RPCs verify the caller server-side, so the admin re-enters their
  // login here. Kept in memory only (never persisted) and dropped when the page unmounts.
  const [adminCreds, setAdminCreds] = useState(null);
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const { toast } = useToast();

  const isAuthError = (error) =>
    error?.code === "42501" || /not authorized/i.test(error?.message || "");

  const adminArgs = (creds = adminCreds) => ({
    p_admin_username: creds?.username ?? "",
    p_admin_password: creds?.password ?? "",
  });

  // Credentials rejected mid-session (changed password, demoted, deleted) -> back to the gate.
  const lockOnAuthError = (error) => {
    if (!isAuthError(error)) return false;
    setAdminCreds(null);
    setUsers([]);
    setAuthError("Session expired. Please confirm your admin login again.");
    return true;
  };

  const fetchUsers = async (creds = adminCreds) => {
    setFetchLoading(true);
    try {
      const { data, error } = await supabase.rpc("sss_admin_list_users", adminArgs(creds));
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      if (lockOnAuthError(error)) return;
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    const creds = { username: authForm.username.trim(), password: authForm.password };
    if (!creds.username || !creds.password) {
      setAuthError("Enter your admin username and password.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const { data, error } = await supabase.rpc("sss_admin_list_users", adminArgs(creds));
      if (error) throw error;
      setUsers(data || []);
      setAdminCreds(creds);
      setAuthForm({ username: "", password: "" });
    } catch (error) {
      setAuthError(isAuthError(error) ? "Invalid admin credentials." : "Could not verify. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const ownPageCount = formData.page.filter((p) => ASSIGNABLE_PAGES.includes(p)).length;

  const togglePage = (pageName) => {
    setFormData((prev) => ({
      ...prev,
      page: prev.page.includes(pageName)
        ? prev.page.filter((p) => p !== pageName)
        : [...prev.page, pageName],
    }));
  };

  const handleRoleChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      role: value,
      page: value === "admin" ? [...new Set([...prev.page, ...ASSIGNABLE_PAGES])] : prev.page,
    }));
  };

  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData(emptyForm);
    setShowPassword(false);
    setIsUserDialogOpen(true);
  };

  const openEditModal = (user) => {
    setIsEditMode(true);
    setFormData({
      uuid: user.uuid,
      fullName: user.full_name || "",
      username: user.username || "",
      password: user.password || "",
      role: user.role || "user",
      page: Array.isArray(user.page) ? user.page.map((p) => p.trim()) : [],
    });
    setShowPassword(true);
    setIsUserDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.fullName.trim()) {
      toast({ title: "Missing information", description: "Full name is required.", variant: "destructive" });
      return;
    }
    if (!formData.username.trim()) {
      toast({ title: "Missing information", description: "Username is required.", variant: "destructive" });
      return;
    }
    if (!isEditMode && !formData.password.trim()) {
      toast({ title: "Missing information", description: "Password is required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        const { error } = await supabase.rpc("sss_admin_update_user", {
          ...adminArgs(),
          p_uuid: formData.uuid,
          p_full_name: formData.fullName.trim(),
          p_username: formData.username.trim(),
          p_role: formData.role,
          p_page: formData.page,
          p_password: formData.password.trim() || null,
        });
        if (error) throw error;
        toast({ title: "User updated", description: `${formData.username} has been updated successfully.` });
      } else {
        const { error } = await supabase.rpc("sss_admin_create_user", {
          ...adminArgs(),
          p_full_name: formData.fullName.trim(),
          p_username: formData.username.trim(),
          p_password: formData.password.trim(),
          p_role: formData.role,
          p_page: formData.page,
        });
        if (error) throw error;
        toast({ title: "User created", description: `${formData.username} has been created successfully.` });
      }
      setIsUserDialogOpen(false);
      fetchUsers();
    } catch (error) {
      if (lockOnAuthError(error)) {
        setIsUserDialogOpen(false);
        return;
      }
      console.error("Error saving user:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate")
          ? "That username is already taken"
          : "Failed to save user",
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
      const { error } = await supabase.rpc("sss_admin_delete_user", {
        ...adminArgs(),
        p_uuid: deleteTarget.uuid,
      });
      if (error) throw error;
      toast({ title: "User deleted", description: `${deleteTarget.full_name} has been removed successfully.` });
      setDeleteTarget(null);
      fetchUsers();
    } catch (error) {
      if (lockOnAuthError(error)) {
        setDeleteTarget(null);
        return;
      }
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const list = useClientList({
    key: "settings-users",
    data: { all: users },
    loading: fetchLoading,
    tabLabels: { all: "Users" },
    searchKeys: ["full_name", "username", "role"],
    sort: "none",
    columns: COLUMNS,
  });

  if (!adminCreds) {
    return (
      <div className="mx-auto max-w-md pt-10">
        <Card>
          <CardHeader className="border-b py-3">
            <div className="flex items-center gap-2 font-medium">
              <Lock className="h-4 w-4" />
              Confirm admin login
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleUnlock} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                User management is protected. Re-enter your admin username and password to continue.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="admin-auth-username">Admin username</Label>
                <Input
                  id="admin-auth-username"
                  autoComplete="username"
                  value={authForm.username}
                  onChange={(e) => setAuthForm((p) => ({ ...p, username: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-auth-password">Admin password</Label>
                <Input
                  id="admin-auth-password"
                  type="password"
                  autoComplete="current-password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
              {authError && (
                <p role="alert" className="text-sm text-destructive">
                  {authError}
                </p>
              )}
              <Button type="submit" disabled={authLoading} className="w-full">
                {authLoading ? "Verifying..." : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ListToolbar
        list={list}
        searchPlaceholder="Search by name, username or role..."
        showColumns={false}
        actions={
          <>
            <Button onClick={() => fetchUsers()} variant="outline" className="h-9 gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button onClick={openCreateModal} className="h-9 gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add User
            </Button>
          </>
        }
      />
      <ListTable
        list={list}
        ctx={{ onEdit: openEditModal, onDelete: setDeleteTarget, visiblePasswords, onTogglePassword: togglePasswordVisibility }}
        rowKey={(u) => u.uuid}
        cardTitle={(u) => u.full_name}
        emptyTitle="No users found in database"
        ariaLabel="Users"
        minWidth="min-w-[900px]"
      />

      {/* DIALOG: User Create / Edit */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit User Account" : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update credentials, role, and assigned page access"
                : "Create a new user profile with specific page permissions"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Row 1: Username + Full Name */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  placeholder="e.g. jdoe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>
            </div>

            {/* Row 2: Password + Role */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Password {isEditMode ? "" : "*"}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    placeholder={isEditMode ? "Leave blank to keep unchanged" : "Enter password"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={handleRoleChange}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border border-input bg-popover shadow-lg">
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role} className="capitalize">
                        {role === "admin"
                          ? "Admin (Full Access & Settings)"
                          : role === "user"
                          ? "User (Assigned Pages Only)"
                          : "Engineer"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Page Access */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label id="page-access-label">Page Access</Label>
                {formData.role === "admin" ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    <Lock className="h-3 w-3" />
                    Auto-granted (Admin)
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-xs text-primary"
                    onClick={() => {
                      // Pages of other systems sharing this list (Service-Support) are kept as-is.
                      if (ownPageCount === ASSIGNABLE_PAGES.length) {
                        setFormData((prev) => ({ ...prev, page: prev.page.filter((p) => !ASSIGNABLE_PAGES.includes(p)) }));
                      } else {
                        setFormData((prev) => ({ ...prev, page: [...new Set([...prev.page, ...ASSIGNABLE_PAGES])] }));
                      }
                    }}
                  >
                    {ownPageCount === ASSIGNABLE_PAGES.length
                      ? "Deselect All"
                      : "Select All Pages"}
                  </Button>
                )}
              </div>
              {formData.role === "admin" && (
                <p className="text-xs text-muted-foreground">
                  Admins automatically get access to every page — the list below is locked and informational only.
                </p>
              )}
              <div role="group" aria-labelledby="page-access-label" className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-md border bg-secondary/40 p-3 sm:grid-cols-2">
                {ASSIGNABLE_PAGES.map((pageName) => (
                  <div key={pageName} className="flex items-center space-x-2">
                    <Checkbox
                      id={`page-${pageName}`}
                      checked={
                        formData.role === "admin" ? true : formData.page.includes(pageName)
                      }
                      disabled={formData.role === "admin"}
                      onCheckedChange={() => togglePage(pageName)}
                    />
                    <Label
                      htmlFor={`page-${pageName}`}
                      className={`text-sm font-normal ${
                        formData.role === "admin" ? "text-muted-foreground" : "cursor-pointer"
                      }`}
                    >
                      {navLabelFor(pageName)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  !formData.username ||
                  !formData.fullName ||
                  (!isEditMode && !formData.password)
                }
              >
                {isSubmitting && <RefreshCw className="animate-spin w-4 h-4 mr-2" />}
                {isEditMode ? "Update User" : "Create User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.full_name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting && <RefreshCw className="animate-spin w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
