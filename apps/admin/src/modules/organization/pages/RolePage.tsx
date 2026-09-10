import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { roleApi, type RoleItem } from "../roleApi";

const emptyRole = (): Partial<RoleItem> => ({
  name: "",
  role_name: "",
  home_page: "",
  restrict_to_domain: "",
  disabled: false,
  enabled: true,
  is_custom: true,
  desk_access: true,
  two_factor_auth: false,
});

/* =========================================================================
   ROLE LIST VIEW
   ========================================================================= */
export function RoleListPage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");

  const loadRoles = async () => {
    setLoading(true);
    try {
      const data = await roleApi.list();
      setRoles(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal memuat daftar role");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const q = search.toLowerCase().trim();
      const nameMatch =
        !q ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.role_name && r.role_name.toLowerCase().includes(q)) ||
        (r.id && r.id.toLowerCase().includes(q));

      if (!nameMatch) return false;

      const isRoleDisabled = Boolean(r.disabled || !r.enabled);
      if (statusFilter === "enabled" && isRoleDisabled) return false;
      if (statusFilter === "disabled" && !isRoleDisabled) return false;

      return true;
    });
  }, [roles, search, statusFilter]);

  const handleDelete = async (role: RoleItem) => {
    if (!role.is_custom) {
      toast.error("Standard role tidak dapat dihapus, silakan disable role tersebut.");
      return;
    }
    if (!confirm(`Hapus role "${role.name || role.role_name}"?`)) return;

    try {
      await roleApi.delete(role.id || role.name);
      toast.success("Role berhasil dihapus");
      loadRoles();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus role");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Link to="/desk" className="hover:text-slate-800 dark:hover:text-slate-200">
              Administration
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">Role</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
            Role
            <Badge variant="outline" className="text-xs font-normal">
              {filteredRoles.length} of {roles.length}
            </Badge>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadRoles}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => navigate("/desk/role/new")}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Plus className="size-4" />
            Add Role
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-xl border bg-white p-3 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            placeholder="Search role name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="inline-flex rounded-lg border bg-slate-50 p-0.5 text-xs dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-md px-3 py-1 font-medium transition ${
                statusFilter === "all"
                  ? "bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("enabled")}
              className={`rounded-md px-3 py-1 font-medium transition ${
                statusFilter === "enabled"
                  ? "bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              Enabled
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("disabled")}
              className={`rounded-md px-3 py-1 font-medium transition ${
                statusFilter === "disabled"
                  ? "bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              Disabled
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="border-b bg-slate-50/80 text-xs font-semibold uppercase text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              <tr>
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Is Custom</th>
                <th className="py-3.5 px-4 text-center">Desk Access</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto size-6 animate-spin text-blue-600 mb-2" />
                    Memuat data roles...
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Tidak ada role yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredRoles.map((r) => {
                  const isRoleDisabled = Boolean(r.disabled || !r.enabled);
                  const roleName = r.name || r.role_name;
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-800/40"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        <Link
                          to={`/desk/role/${encodeURIComponent(roleName)}`}
                          className="hover:underline text-blue-600 dark:text-blue-400 font-semibold"
                        >
                          {roleName}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 max-w-[200px] truncate" title={r.id}>
                        {r.id}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={
                            !isRoleDisabled
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                          }
                        >
                          {!isRoleDisabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {r.is_custom ? (
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400">
                            Custom
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">Standard</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {r.desk_access ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400">
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                            onClick={() => navigate(`/desk/role/${encodeURIComponent(roleName)}`)}
                            title="Edit Role"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          {r.is_custom && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                              onClick={() => handleDelete(r)}
                              title="Delete Role"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   ROLE FORM VIEW
   ========================================================================= */
export function RoleFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const isNew = !id || id === "new" || id.startsWith("new-role-");
  const [form, setForm] = useState<Partial<RoleItem>>(emptyRole());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(isNew);

  useEffect(() => {
    if (!isNew && id) {
      setLoading(true);
      roleApi
        .get(decodeURIComponent(id))
        .then((data) => {
          setForm({
            ...data,
            role_name: data.role_name || data.name,
            disabled: Boolean(data.disabled || !data.enabled),
          });
          setIsDirty(false);
        })
        .catch((err: any) => {
          toast.error(err?.response?.data?.error || "Gagal memuat detail role");
          navigate("/desk/role");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const handleChange = (key: keyof RoleItem, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "role_name") {
        next.name = value;
      }
      if (key === "disabled") {
        next.enabled = !value;
      }
      return next;
    });
    setIsDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const roleName = form.role_name?.trim() || form.name?.trim();
    if (!roleName) {
      toast.error("Role Name wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<RoleItem> = {
        name: roleName,
        role_name: roleName,
        home_page: form.home_page?.trim() || "",
        restrict_to_domain: form.restrict_to_domain?.trim() || "",
        disabled: Boolean(form.disabled),
        enabled: !form.disabled,
        is_custom: Boolean(form.is_custom),
        desk_access: Boolean(form.desk_access),
        two_factor_auth: Boolean(form.two_factor_auth),
      };

      if (isNew) {
        await roleApi.create(payload);
        toast.success("Role berhasil dibuat");
      } else {
        await roleApi.update(id!, payload);
        toast.success("Role berhasil diperbarui");
      }

      setIsDirty(false);
      navigate("/desk/role");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan role");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.is_custom) {
      toast.error("Standard role tidak dapat dihapus, silakan centang Disabled.");
      return;
    }
    if (!confirm(`Hapus role "${form.role_name || form.name}"?`)) return;

    try {
      await roleApi.delete(id!);
      toast.success("Role berhasil dihapus");
      navigate("/desk/role");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus role");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="size-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const displayName = form.role_name || form.name || (isNew ? "New Role" : id);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Link to="/desk" className="hover:text-slate-800 dark:hover:text-slate-200">
              Administration
            </Link>
            <span>/</span>
            <Link to="/desk/role" className="hover:text-slate-800 dark:hover:text-slate-200">
              Role
            </Link>
            <span>/</span>
            <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
              {displayName}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {displayName}
            </h1>
            <Badge
              variant="outline"
              className={
                isDirty
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
              }
            >
              {isDirty ? "Not Saved" : "Saved"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/desk/role")}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {!isNew && form.is_custom && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[80px]"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Details Card */}
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b pb-3 dark:border-slate-800">
            Role Details
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="role_name" className="text-sm font-medium">
                Role Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="role_name"
                value={form.role_name || ""}
                onChange={(e) => handleChange("role_name", e.target.value)}
                placeholder="e.g. Analytics"
                disabled={Boolean(!isNew && !form.is_custom)}
                required
              />
              {!isNew && !form.is_custom && (
                <p className="text-xs text-slate-500">
                  Standard role names cannot be modified.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="home_page" className="text-sm font-medium">
                Home Page
              </Label>
              <Input
                id="home_page"
                value={form.home_page || ""}
                onChange={(e) => handleChange("home_page", e.target.value)}
                placeholder='Route : Example "/desk"'
              />
              <p className="text-xs text-slate-500">
                Route : Example &quot;/desk&quot;
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="restrict_to_domain" className="text-sm font-medium">
                Restrict To Domain
              </Label>
              <Input
                id="restrict_to_domain"
                value={form.restrict_to_domain || ""}
                onChange={(e) => handleChange("restrict_to_domain", e.target.value)}
                placeholder="Restrict To Domain"
              />
            </div>
          </div>
        </div>

        {/* Security & Access Settings Card */}
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b pb-3 dark:border-slate-800">
            Access & Security
          </h2>

          <div className="space-y-5">
            {/* Disabled */}
            <div className="flex items-start space-x-3 rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
              <Checkbox
                id="disabled"
                checked={Boolean(form.disabled)}
                onCheckedChange={(v) => handleChange("disabled", Boolean(v))}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="disabled" className="text-sm font-semibold cursor-pointer">
                  Disabled
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  If disabled, this role will be removed from all users.
                </p>
              </div>
            </div>

            {/* Is Custom */}
            <div className="flex items-start space-x-3 rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
              <Checkbox
                id="is_custom"
                checked={Boolean(form.is_custom)}
                onCheckedChange={(v) => handleChange("is_custom", Boolean(v))}
                disabled={Boolean(!isNew && !form.is_custom)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="is_custom" className="text-sm font-semibold cursor-pointer">
                  Is Custom
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Custom roles can be modified and deleted freely.
                </p>
              </div>
            </div>

            {/* Desk Access */}
            <div className="flex items-start space-x-3 rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
              <Checkbox
                id="desk_access"
                checked={Boolean(form.desk_access)}
                onCheckedChange={(v) => handleChange("desk_access", Boolean(v))}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="desk_access" className="text-sm font-semibold cursor-pointer">
                  Desk Access
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enable access to the desk administrative console for users assigned to this role.
                </p>
              </div>
            </div>

            {/* Two Factor Authentication */}
            <div className="flex items-start space-x-3 rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
              <Checkbox
                id="two_factor_auth"
                checked={Boolean(form.two_factor_auth)}
                onCheckedChange={(v) => handleChange("two_factor_auth", Boolean(v))}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="two_factor_auth" className="text-sm font-semibold cursor-pointer">
                  Two Factor Authentication
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enforce two-factor authentication for users with this role.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function RolePage() {
  const { id } = useParams();
  const location = useLocation();

  // If path is /desk/role or /desk/role/ (without specific item or 'new')
  const isList =
    location.pathname === "/desk/role" ||
    location.pathname === "/desk/role/" ||
    location.pathname === "/desk/role/view/List";

  if (isList) {
    return <RoleListPage />;
  }

  return <RoleFormPage />;
}
