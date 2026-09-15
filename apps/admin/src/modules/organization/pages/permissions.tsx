import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  HelpCircle,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import RoleAccessManager from "../components/RoleAccessManager";

export type RolePermission = {
  id: string;
  tenant_id?: string;
  role_id: string;
  resource: string;
  level: number;
  only_if_creator: boolean;
  can_select: boolean;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_submit: boolean;
  can_cancel: boolean;
  can_amend: boolean;
  can_print: boolean;
  can_email: boolean;
  can_report: boolean;
  can_import: boolean;
  can_export: boolean;
  can_share: boolean;
  can_mask: boolean;
  allow_menu?: boolean;
  allow_page?: boolean;
  allow_api?: boolean;
  field_name?: string;
  role?: {
    id: string;
    name: string;
    description?: string;
    enabled?: boolean;
  };
};

export type Role = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  is_custom: boolean;
  desk_access: boolean;
  legacy_level?: number | null;
};

export type Profile = {
  id?: string;
  name: string;
  description?: string;
  enabled: boolean;
  roles?: Role[];
  role_ids?: string[];
};

export type User = {
  id: string;
  display_name: string;
  email: string;
  role: number;
};

type Assignment = {
  roles: Array<{ role_id: string }>;
  profiles: Array<{ role_profile_id: string }>;
};

// Searchable Combobox Component for DocType and Role
function SearchableDropdown({
  placeholder,
  value,
  options,
  onChange,
}: {
  placeholder: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative min-w-[220px] max-w-xs flex-1">
      <div
        className="flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-slate-100/70 px-3 text-sm transition-colors hover:bg-slate-100 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-slate-800 dark:bg-slate-900/80 cursor-pointer"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={value ? "font-medium text-slate-800 dark:text-slate-200" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1.5 text-slate-400">
          {value && (
            <span
              role="button"
              className="rounded p-0.5 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setQuery("");
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown className="size-4" />
        </div>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
          <div className="p-2 border-b border-slate-100 dark:border-slate-900">
            <div className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 dark:border-slate-800">
              <Search className="size-3.5 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Begin typing for results..."
                className="w-full bg-transparent text-xs outline-none"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto p-1 text-xs">
            {filtered.length === 0 ? (
              <div className="py-2 text-center text-slate-400">Tidak ada hasil</div>
            ) : (
              filtered.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => {
                    onChange(item);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-900 ${
                    value === item ? "bg-blue-50 font-semibold text-blue-600 dark:bg-blue-950/50" : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span>{item}</span>
                  {value === item && <Check className="size-3.5 text-blue-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PermissionManagementPage() {
  const [tab, setTab] = useState<"access" | "permissions" | "profiles" | "assignments">("access");

  // Filter criteria for Role Permissions Manager
  const [selectedDocType, setSelectedDocType] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  // Data lists
  const [docTypes, setDocTypes] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // States for secondary tabs
  const [profile, setProfile] = useState<Profile>({ name: "", description: "", enabled: true, role_ids: [] });
  const [selectedUser, setSelectedUser] = useState("");
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [assignedProfiles, setAssignedProfiles] = useState<string[]>([]);

  // Modals
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [newRuleDocType, setNewRuleDocType] = useState("");
  const [newRuleRole, setNewRuleRole] = useState("");
  const [newRuleLevel, setNewRuleLevel] = useState(0);
  const [newRuleOnlyIfCreator, setNewRuleOnlyIfCreator] = useState(false);
  const [newRulePermissions, setNewRulePermissions] = useState<{
    can_select: boolean;
    can_read: boolean;
    can_create: boolean;
    can_update: boolean;
    can_delete: boolean;
    can_submit: boolean;
    can_cancel: boolean;
    can_amend: boolean;
    can_print: boolean;
    can_email: boolean;
    can_report: boolean;
    can_import: boolean;
    can_export: boolean;
    can_share: boolean;
    can_mask: boolean;
  }>({
    can_select: false,
    can_read: true,
    can_create: true,
    can_update: true,
    can_delete: false,
    can_submit: false,
    can_cancel: false,
    can_amend: false,
    can_print: true,
    can_email: true,
    can_report: true,
    can_import: false,
    can_export: true,
    can_share: true,
    can_mask: false,
  });

  const [loading, setLoading] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(true);

  // Load base options (doctypes, roles, profiles, users)
  const loadBase = async () => {
    setLoading(true);
    try {
      const [dtRes, rRes, pRes, uRes] = await Promise.all([
        api.get("/authorization/doctypes").catch(() => ({ data: { data: [] } })),
        api.get("/authorization/roles"),
        api.get("/authorization/profiles"),
        api.get("/users", { params: { page: 1, limit: 200 } }),
      ]);
      setDocTypes(dtRes.data.data || []);
      setRoles(rRes.data.data || []);
      setProfiles(pRes.data.data || []);
      setUsers(uRes.data.data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal memuat data permission manager");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  // Fetch permissions when selectedDocType or selectedRole changes
  const fetchPermissions = async () => {
    if (!selectedDocType && !selectedRole) {
      setPermissions([]);
      return;
    }
    setLoadingPermissions(true);
    try {
      const params: Record<string, string> = {};
      if (selectedDocType) params.doctype = selectedDocType;
      if (selectedRole) params.role = selectedRole;
      const res = await api.get("/authorization/permissions", { params });
      setPermissions(res.data.data || []);
    } catch (e: any) {
      toast.error("Gagal memuat aturan permission");
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [selectedDocType, selectedRole]);

  // Load user assignments when user changes
  useEffect(() => {
    if (!selectedUser) {
      setAssignedRoles([]);
      setAssignedProfiles([]);
      return;
    }
    api
      .get<Assignment>(`/authorization/users/${selectedUser}/assignments`)
      .then(({ data }) => {
        setAssignedRoles((data.roles || []).map((v) => v.role_id));
        setAssignedProfiles((data.profiles || []).map((v) => v.role_profile_id));
      })
      .catch(() => toast.error("Gagal memuat assignment user"));
  }, [selectedUser]);

  // Toggle permission right
  const togglePermission = async (
    permissionId: string,
    key: keyof RolePermission,
    value: boolean
  ) => {
    // Optimistic update
    setPermissions((prev) =>
      prev.map((item) => (item.id === permissionId ? { ...item, [key]: value } : item))
    );

    try {
      const payload: Record<string, any> = { [key]: value };
      if (key === "can_update") {
        payload.can_write = value;
      }
      await api.put(`/authorization/permissions/${permissionId}`, payload);
    } catch (e: any) {
      toast.error("Gagal memperbarui hak akses");
      // Rollback on failure
      fetchPermissions();
    }
  };

  // Delete permission rule
  const deletePermissionRule = async (rule: RolePermission) => {
    const roleName = rule.role?.name || "Role";
    if (!confirm(`Hapus aturan permission untuk ${roleName} pada ${rule.resource}?`)) {
      return;
    }
    try {
      await api.delete(`/authorization/permissions/${rule.id}`);
      toast.success("Aturan permission dihapus");
      setPermissions((prev) => prev.filter((p) => p.id !== rule.id));
    } catch (e: any) {
      toast.error("Gagal menghapus aturan permission");
    }
  };

  // Restore original permissions
  const handleRestorePermissions = async () => {
    if (!selectedDocType) {
      toast.error("Pilih Document Type terlebih dahulu");
      return;
    }
    if (
      !confirm(
        `Kembalikan aturan permission standar untuk Document Type '${selectedDocType}'? Aturan custom yang ada saat ini akan diganti dengan default Administrator & System Manager.`
      )
    ) {
      return;
    }
    try {
      await api.post("/authorization/permissions/restore", { doctype: selectedDocType });
      toast.success(`Permission untuk ${selectedDocType} berhasil dikembalikan ke standar`);
      fetchPermissions();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal mengembalikan permission standar");
    }
  };

  // Open add rule dialog
  const openAddRuleModal = () => {
    setNewRuleDocType(selectedDocType || docTypes[0] || "");
    setNewRuleRole(selectedRole || (roles.length > 0 ? roles[0].name : ""));
    setNewRuleLevel(0);
    setNewRuleOnlyIfCreator(false);
    setIsAddRuleOpen(true);
  };

  // Add rule submit
  const handleAddRule = async () => {
    if (!newRuleDocType.trim()) {
      toast.error("Pilih Document Type");
      return;
    }
    if (!newRuleRole.trim()) {
      toast.error("Pilih Role");
      return;
    }

    try {
      await api.post("/authorization/permissions", {
        resource: newRuleDocType,
        role_name: newRuleRole,
        level: newRuleLevel,
        only_if_creator: newRuleOnlyIfCreator,
        ...newRulePermissions,
        can_write: newRulePermissions.can_update,
      });
      toast.success("Aturan permission baru berhasil ditambahkan");
      setIsAddRuleOpen(false);
      if (!selectedDocType && !selectedRole) {
        setSelectedDocType(newRuleDocType);
      } else {
        fetchPermissions();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menambahkan aturan permission");
    }
  };

  // Secondary tab actions
  const saveProfile = async () => {
    if (!profile.name.trim()) return toast.error("Profile Name wajib diisi");
    const payload = {
      ...profile,
      role_ids: profile.role_ids || profile.roles?.map((r) => r.id) || [],
    };
    try {
      profile.id
        ? await api.put(`/authorization/profiles/${profile.id}`, payload)
        : await api.post("/authorization/profiles", payload);
      toast.success("Role Profile disimpan");
      setProfile({ name: "", description: "", enabled: true, role_ids: [] });
      loadBase();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menyimpan profile");
    }
  };

  const saveAssignments = async () => {
    if (!selectedUser) return toast.error("Pilih pengguna");
    try {
      await api.put(`/authorization/users/${selectedUser}/assignments`, {
        role_ids: assignedRoles,
        profile_ids: assignedProfiles,
      });
      toast.success("Role user berhasil diperbarui");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menyimpan assignment");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <div className="size-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm text-slate-500">Memuat Role & Permission Manager...</p>
      </div>
    );
  }

  const roleNames = roles.map((r) => r.name);
  const isFiltered = Boolean(selectedDocType || selectedRole);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Role Permissions Manager
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Atur module Apps, menu sidebar, halaman, dan hak akses dokumen untuk setiap role.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="bg-slate-100 dark:bg-slate-900">
            <TabsTrigger value="access" className="text-xs">
              <Shield className="mr-1.5 size-3.5" />
              Apps & Menu
            </TabsTrigger>
            <TabsTrigger value="permissions" className="text-xs">
              <Shield className="mr-1.5 size-3.5" />
              Role Permissions Manager
            </TabsTrigger>
            <TabsTrigger value="profiles" className="text-xs">
              Role Profiles
            </TabsTrigger>
            <TabsTrigger value="assignments" className="text-xs">
              <Users className="mr-1.5 size-3.5" />
              User Permissions
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "access" && <RoleAccessManager roles={roles} />}

      {tab === "permissions" && (
        <div className="space-y-6">
          {/* Action & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <SearchableDropdown
                placeholder="Document Type"
                value={selectedDocType}
                options={docTypes}
                onChange={setSelectedDocType}
              />
              <SearchableDropdown
                placeholder="Roles"
                value={selectedRole}
                options={roleNames}
                onChange={setSelectedRole}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={() => setTab("assignments")}
              >
                Set User Permissions
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={handleRestorePermissions}
                disabled={!selectedDocType}
                title={!selectedDocType ? "Pilih Document Type terlebih dahulu" : "Kembalikan permission standar"}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Restore Original Permissions
              </Button>

              <Button
                size="sm"
                className="h-9 bg-slate-900 text-xs text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200 font-medium"
                onClick={openAddRuleModal}
              >
                <Plus className="mr-1.5 size-3.5" />
                Add A New Rule
              </Button>
            </div>
          </div>

          {/* Main Permission Table / Empty States */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
              <div className="col-span-12 sm:col-span-3">Document Type</div>
              <div className="col-span-12 sm:col-span-2">Role</div>
              <div className="col-span-12 sm:col-span-1 text-center">Level</div>
              <div className="col-span-12 sm:col-span-5">Permissions</div>
              <div className="col-span-12 sm:col-span-1 text-right">Aksi</div>
            </div>

            {/* Content Display */}
            {loadingPermissions ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                <div className="size-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2" />
                Memuat aturan permission...
              </div>
            ) : !isFiltered ? (
              /* Case 1: Neither Document Type nor Role is selected */
              <div className="flex flex-col items-center justify-center p-16 text-center">
                <div className="rounded-full bg-blue-50 p-4 text-blue-600 dark:bg-blue-950/50">
                  <Shield className="size-8" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-200">
                  Select Document Type or Role to start.
                </h3>
                <p className="mt-1.5 max-w-md text-xs text-slate-500">
                  Pilih Document Type atau Role pada dropdown filter di atas untuk melihat, mengubah, dan menambahkan aturan permission.
                </p>
              </div>
            ) : permissions.length === 0 ? (
              /* Case 2: Filter is set, but no permission rules found */
              <div className="flex flex-col items-center justify-center p-16 text-center">
                <div className="rounded-full bg-slate-100 p-4 text-slate-400 dark:bg-slate-900">
                  <AlertCircle className="size-8" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-200">
                  No Permissions set for this criteria.
                </h3>
                <p className="mt-1.5 max-w-md text-xs text-slate-500">
                  Belum ada hak akses yang diatur untuk kombinasi filter ini. Klik tombol di bawah untuk membuat aturan baru.
                </p>
                <Button
                  size="sm"
                  onClick={openAddRuleModal}
                  className="mt-5 bg-slate-900 text-xs text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900"
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Add A New Rule
                </Button>
              </div>
            ) : (
              /* Case 3: Display Permission Rules */
              <div className="divide-y divide-slate-100 dark:divide-slate-900">
                {permissions.map((rule) => (
                  <div
                    key={rule.id}
                    className="grid grid-cols-12 gap-4 px-6 py-4.5 items-start text-xs transition hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                  >
                    {/* Document Type */}
                    <div className="col-span-12 sm:col-span-3 pt-1">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                        {rule.resource}
                      </span>
                    </div>

                    {/* Role & Only If Creator */}
                    <div className="col-span-12 sm:col-span-2 space-y-2 pt-1">
                      <span className="font-medium text-slate-800 dark:text-slate-200 text-sm block">
                        {rule.role?.name || "Role"}
                      </span>
                      <label className="inline-flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 select-none">
                        <Checkbox
                          checked={rule.only_if_creator}
                          onCheckedChange={(checked) =>
                            togglePermission(rule.id, "only_if_creator", Boolean(checked))
                          }
                        />
                        <span>Only If Creator</span>
                      </label>
                    </div>

                    {/* Level */}
                    <div className="col-span-12 sm:col-span-1 pt-1 text-center font-bold text-slate-800 dark:text-slate-200 text-sm">
                      {rule.level}
                    </div>

                    {/* Permissions: 3 Columns Grid Matching Frappe ERPNext */}
                    <div className="col-span-12 sm:col-span-5 grid grid-cols-3 gap-x-4 gap-y-2.5 pt-0.5">
                      {/* Column 1: Select, Create, Cancel, Email, Export */}
                      <div className="space-y-2.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_select}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_select", Boolean(v))}
                          />
                          <span>Select</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_create}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_create", Boolean(v))}
                          />
                          <span>Create</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_cancel}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_cancel", Boolean(v))}
                          />
                          <span>Cancel</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_email}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_email", Boolean(v))}
                          />
                          <span>Email</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_export}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_export", Boolean(v))}
                          />
                          <span>Export</span>
                        </label>
                      </div>

                      {/* Column 2: Read, Delete, Amend, Report, Share */}
                      <div className="space-y-2.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_read}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_read", Boolean(v))}
                          />
                          <span>Read</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_delete}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_delete", Boolean(v))}
                          />
                          <span>Delete</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_amend}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_amend", Boolean(v))}
                          />
                          <span>Amend</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_report}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_report", Boolean(v))}
                          />
                          <span>Report</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_share}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_share", Boolean(v))}
                          />
                          <span>Share</span>
                        </label>
                      </div>

                      {/* Column 3: Write, Submit, Print, Import, Mask */}
                      <div className="space-y-2.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_update}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_update", Boolean(v))}
                          />
                          <span>Write</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_submit}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_submit", Boolean(v))}
                          />
                          <span>Submit</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_print}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_print", Boolean(v))}
                          />
                          <span>Print</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_import}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_import", Boolean(v))}
                          />
                          <span>Import</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <Checkbox
                            checked={rule.can_mask}
                            onCheckedChange={(v) => togglePermission(rule.id, "can_mask", Boolean(v))}
                          />
                          <span>Mask</span>
                        </label>
                      </div>
                    </div>

                    {/* Delete Action: Circular Red Button with X */}
                    <div className="col-span-12 sm:col-span-1 pt-0.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => deletePermissionRule(rule)}
                        className="flex size-7 items-center justify-center rounded-md bg-red-500 text-white transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
                        title="Delete Rule"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Help for Setting Permissions (Frappe ERPNext Guide) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div
              className="flex cursor-pointer items-center justify-between"
              onClick={() => setIsHelpOpen((prev) => !prev)}
            >
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="size-4 text-blue-600" />
                Quick Help for Setting Permissions:
              </h2>
              <ChevronDown
                className={`size-4 text-slate-400 transition-transform ${
                  isHelpOpen ? "rotate-180" : ""
                }`}
              />
            </div>

            {isHelpOpen && (
              <div className="mt-4 space-y-5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 pt-4 dark:border-slate-900">
                <p>
                  Permissions are set on Roles and Document Types (called DocTypes) by setting rights like Read, Write, Create, Delete, Submit, Cancel, Amend, Report, Import, Export, Print, Email and Set User Permissions.
                </p>
                <p>
                  Permissions get applied on Users based on what Roles they are assigned. Roles can be set for users from their User page.
                  The system provides many pre-defined roles. You can add new roles to set finer permissions.
                </p>
                <p>
                  Permissions are automatically applied to Standard Reports and searches. As a best practice, do not assign the same set of permission rule to different Roles. Instead, set multiple Roles to the same User.
                </p>

                {/* Table of Permission Meanings */}
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="bg-slate-50 px-4 py-2 font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    Meaning of Different Permission Types:
                  </div>
                  <table className="w-full text-left">
                    <thead className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                      <tr>
                        <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">Permission</th>
                        <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">Description</th>
                        <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">Example</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Select</td>
                        <td className="px-4 py-2">Allows the user to search and see records.</td>
                        <td className="px-4 py-2">The user can select a Customer in Sales Order but cannot open the Customer master.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Read</td>
                        <td className="px-4 py-2">Allows the user to view the document.</td>
                        <td className="px-4 py-2">The user can view Sales Invoices but cannot modify any field values in them.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Write</td>
                        <td className="px-4 py-2">Allows the user to edit existing records they have access to.</td>
                        <td className="px-4 py-2">The user can update a customer or any other fields in an existing Sales Order but cannot create a new Sales Order.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Create</td>
                        <td className="px-4 py-2">Allows the user to create new documents.</td>
                        <td className="px-4 py-2">The user can create a new Item but cannot edit existing items.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Delete</td>
                        <td className="px-4 py-2">Allows the user to delete documents.</td>
                        <td className="px-4 py-2">The user can delete Draft / Cancelled documents.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Submit</td>
                        <td className="px-4 py-2">Allows the user to submit finalized documents to ledger.</td>
                        <td className="px-4 py-2">The user can submit Sales Orders or Purchase Orders.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Cancel</td>
                        <td className="px-4 py-2">Allows the user to cancel submitted documents.</td>
                        <td className="px-4 py-2">The user can cancel an incorrect Sales Invoice.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Amend</td>
                        <td className="px-4 py-2">Allows amending cancelled documents to generate new revisions.</td>
                        <td className="px-4 py-2">The user can amend a cancelled Purchase Order.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Print</td>
                        <td className="px-4 py-2">Allows printing or PDF download of documents.</td>
                        <td className="px-4 py-2">The print button is enabled for the user in the document.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Email</td>
                        <td className="px-4 py-2">Allows the user to email from the document.</td>
                        <td className="px-4 py-2">The email button is enabled for the user in the document.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Report</td>
                        <td className="px-4 py-2">Allows the user to access reports related to the document.</td>
                        <td className="px-4 py-2">If the user has access to Employee and Report is enabled, they can view Employee-based reports.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Export</td>
                        <td className="px-4 py-2">Allows the user to export data from the Report view.</td>
                        <td className="px-4 py-2">The user can export report data to Excel/CSV.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Import</td>
                        <td className="px-4 py-2">Allows the user to use Data Import tool to create / update records.</td>
                        <td className="px-4 py-2">The user can import new records or update existing data for the document.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Share</td>
                        <td className="px-4 py-2">Allows sharing document access with other users.</td>
                        <td className="px-4 py-2">The user can share document access with another user.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Mask</td>
                        <td className="px-4 py-2">Allows users to enable the mask property for any field of the respective doctype.</td>
                        <td className="px-4 py-2">If the user enables the mask property for the phone number field, the value will be displayed in a masked format (e.g., 811XXXXXXX).</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Permission Levels */}
                <div className="space-y-1.5 pt-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">Permission Levels:</h4>
                  <p>
                    Permissions at level 0 are Document Level permissions, i.e. they are primary for access to the document. If a Role does not have access at Level 0, then higher levels are meaningless.
                  </p>
                  <p>
                    Permissions at higher levels are Field Level permissions. All Fields have a Permission Level set against them and the rules defined at that permissions apply to the field. This is useful in case you want to hide or make certain field read-only for certain Roles.
                  </p>
                </div>

                {/* User Permissions */}
                <div className="space-y-1.5 pt-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">User Permissions:</h4>
                  <p>
                    User Permissions are used to limit users to specific records. Select Document Types to set which User Permissions are used to limit access. Once you have set this, the users will only be able to access documents where the link exists. Apart from System Manager, roles with Set User Permissions right can set permissions for other users for that Document Type.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Role Profiles */}
      {tab === "profiles" && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                Role Profiles <Badge variant="secondary">{profiles.length}</Badge>
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setProfile({ name: "", description: "", enabled: true, role_ids: [] })}
              >
                <Plus className="size-4 mr-1" /> New
              </Button>
            </div>
            <div className="space-y-1">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-900 ${
                    profile.id === p.id ? "bg-blue-50 font-medium dark:bg-blue-950" : ""
                  }`}
                  onClick={() =>
                    setProfile({
                      ...p,
                      role_ids: p.roles?.map((r) => r.id).filter(Boolean) || [],
                    })
                  }
                >
                  <span>{p.name}</span>
                  <Badge variant="secondary">{p.roles?.length || 0} roles</Badge>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {profile.id ? profile.name : "New Role Profile"}
              </h2>
              <Button onClick={saveProfile} className="bg-blue-600 text-white hover:bg-blue-700">
                Save Profile
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Profile Name</Label>
                <Input
                  className="mt-1"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="e.g. Sales Staff Profile"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  className="mt-1"
                  value={profile.description}
                  onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                  placeholder="Keterangan singkat..."
                />
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <Checkbox
                  checked={profile.enabled}
                  onCheckedChange={(v) => setProfile({ ...profile, enabled: Boolean(v) })}
                />
                <span>Enabled</span>
              </label>

              <div>
                <Label>Included Roles</Label>
                <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-3">
                  {roles
                    .filter((r) => r.enabled)
                    .map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-2 text-xs cursor-pointer select-none"
                      >
                        <Checkbox
                          checked={(profile.role_ids || []).includes(r.id)}
                          onCheckedChange={(v) =>
                            setProfile({
                              ...profile,
                              role_ids: v
                                ? [...(profile.role_ids || []), r.id]
                                : (profile.role_ids || []).filter((id) => id !== r.id),
                            })
                          }
                        />
                        <span>{r.name}</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab: User Permissions / Assignments */}
      {tab === "assignments" && (
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/50">
              <Users className="size-6" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                User Role Assignment & Permissions
              </h2>
              <p className="text-xs text-slate-500">
                Assign role langsung dan/atau role profile kepada pengguna sistem.
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <Label>User</Label>
            <ERPSelect
              className="mt-1 h-10 w-full rounded-md border bg-transparent px-3 text-sm"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <ERPSelectOption value="">Pilih pengguna...</ERPSelectOption>
              {users.map((u) => (
                <ERPSelectOption key={u.id} value={u.id}>
                  {u.display_name || u.email} — {u.email}
                </ERPSelectOption>
              ))}
            </ERPSelect>
          </div>

          {selectedUser && (
            <div className="grid gap-6 lg:grid-cols-2 pt-2">
              <div>
                <Label>Direct Roles</Label>
                <div className="mt-2 grid max-h-96 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-2">
                  {roles
                    .filter((r) => r.enabled)
                    .map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-2 text-xs cursor-pointer select-none"
                      >
                        <Checkbox
                          checked={assignedRoles.includes(r.id)}
                          onCheckedChange={(v) =>
                            setAssignedRoles(
                              v ? [...assignedRoles, r.id] : assignedRoles.filter((id) => id !== r.id)
                            )
                          }
                        />
                        <span>{r.name}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div>
                <Label>Role Profiles</Label>
                <div className="mt-2 space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  {profiles
                    .filter((p) => p.enabled)
                    .map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 text-xs cursor-pointer select-none"
                      >
                        <Checkbox
                          checked={assignedProfiles.includes(p.id!)}
                          onCheckedChange={(v) =>
                            setAssignedProfiles(
                              v
                                ? [...assignedProfiles, p.id!]
                                : assignedProfiles.filter((id) => id !== p.id)
                            )
                          }
                        />
                        <span>
                          {p.name} ({p.roles?.length || 0} roles)
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="lg:col-span-2 pt-2">
                <Button onClick={saveAssignments} className="bg-blue-600 text-white hover:bg-blue-700">
                  <Shield className="mr-2 size-4" />
                  Save User Permissions
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Modal: Add A New Rule */}
      <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle>Add A New Rule</DialogTitle>
            <DialogDescription>
              Tambahkan aturan permission untuk kombinasi Document Type, Role, dan Level.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Document Type</Label>
                <ERPSelect
                  className="mt-1 h-9 w-full text-xs"
                  value={newRuleDocType}
                  onChange={(e) => setNewRuleDocType(e.target.value)}
                >
                  <ERPSelectOption value="">Pilih Document Type...</ERPSelectOption>
                  {docTypes.map((dt) => (
                    <ERPSelectOption key={dt} value={dt}>
                      {dt}
                    </ERPSelectOption>
                  ))}
                </ERPSelect>
              </div>

              <div>
                <Label className="text-xs font-semibold">Role</Label>
                <ERPSelect
                  className="mt-1 h-9 w-full text-xs"
                  value={newRuleRole}
                  onChange={(e) => setNewRuleRole(e.target.value)}
                >
                  <ERPSelectOption value="">Pilih Role...</ERPSelectOption>
                  {roles.map((r) => (
                    <ERPSelectOption key={r.id} value={r.name}>
                      {r.name}
                    </ERPSelectOption>
                  ))}
                </ERPSelect>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 items-center pt-1">
              <div>
                <Label className="text-xs font-semibold">Permission Level</Label>
                <Input
                  type="number"
                  className="mt-1 h-9 text-xs"
                  value={newRuleLevel}
                  min={0}
                  max={9}
                  onChange={(e) => setNewRuleLevel(parseInt(e.target.value) || 0)}
                />
                <p className="mt-1 text-[11px] text-slate-400">0 = Document level, &gt;0 = Field level</p>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <Checkbox
                    checked={newRuleOnlyIfCreator}
                    onCheckedChange={(v) => setNewRuleOnlyIfCreator(Boolean(v))}
                  />
                  <span>Only If Creator</span>
                </label>
              </div>
            </div>

            <div className="pt-2">
              <Label className="text-xs font-semibold mb-2 block">Default Permissions</Label>
              <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800 text-xs">
                {(
                  [
                    ["can_select", "Select"],
                    ["can_read", "Read"],
                    ["can_update", "Write"],
                    ["can_create", "Create"],
                    ["can_delete", "Delete"],
                    ["can_submit", "Submit"],
                    ["can_cancel", "Cancel"],
                    ["can_amend", "Amend"],
                    ["can_print", "Print"],
                    ["can_email", "Email"],
                    ["can_report", "Report"],
                    ["can_import", "Import"],
                    ["can_export", "Export"],
                    ["can_share", "Share"],
                    ["can_mask", "Mask"],
                  ] as Array<[keyof typeof newRulePermissions, string]>
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={newRulePermissions[key]}
                      onCheckedChange={(v) =>
                        setNewRulePermissions((prev) => ({ ...prev, [key]: Boolean(v) }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddRuleOpen(false)}>
              Batal
            </Button>
            <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleAddRule}>
              Tambahkan Aturan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
