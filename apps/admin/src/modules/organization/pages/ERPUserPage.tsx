import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Info, KeyRound, Plus, Save, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { beginImpersonation } from "@/lib/impersonation";
import { erpWorkspaces } from "@/lib/erp-workspaces";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  email: string;
  role: number;
  status: number;
};
type Role = { id: string; name: string; enabled: boolean };
type RoleProfile = {
  id: string;
  name: string;
  enabled: boolean;
  roles?: Role[];
};
type ModuleProfile = {
  id: string;
  name: string;
  description?: string;
  blocked_modules?: string[];
};
type Assignment = {
  roles: Array<{ role_id: string }>;
  profiles: Array<{ role_profile_id: string }>;
};
type Form = {
  username: string;
  display_name: string;
  email: string;
  password: string;
  role: number;
  status: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  language: string;
  time_zone: string;
  gender: string;
  birth_date: string;
  interest: string;
  phone: string;
  location: string;
  bio: string;
  mobile_no: string;
  role_profile_id: string;
  module_profile: string;
  blocked_modules: string[];
  desk_theme: string;
  default_workspace: string;
  default_app: string;
  simultaneous_sessions: number;
  restrict_ip: string;
  login_after: number;
  login_before: number;
  user_type: string;
  email_signature: string;
  mute_sounds: boolean;
  search_bar: boolean;
  notifications: boolean;
  list_sidebar: boolean;
  bulk_actions: boolean;
  view_switcher: boolean;
  form_sidebar: boolean;
  form_navigation_buttons: boolean;
  timeline: boolean;
  dashboard: boolean;
  logout_all_sessions: boolean;
  document_follow_notify: boolean;
  thread_notify: boolean;
  send_me_a_copy: boolean;
  allowed_in_mentions: boolean;
};

const blank = (): Form => ({
  username: "",
  display_name: "",
  email: "",
  password: "",
  role: 1,
  status: 1,
  first_name: "",
  middle_name: "",
  last_name: "",
  language: "English",
  time_zone: "Asia/Jakarta",
  gender: "",
  birth_date: "",
  interest: "",
  phone: "",
  location: "",
  bio: "",
  mobile_no: "",
  role_profile_id: "",
  module_profile: "",
  blocked_modules: [],
  desk_theme: "Light",
  default_workspace: "",
  default_app: "",
  simultaneous_sessions: 2,
  restrict_ip: "",
  login_after: 0,
  login_before: 24,
  user_type: "System User",
  email_signature: "",
  mute_sounds: false,
  search_bar: true,
  notifications: true,
  list_sidebar: true,
  bulk_actions: true,
  view_switcher: true,
  form_sidebar: true,
  form_navigation_buttons: true,
  timeline: true,
  dashboard: true,
  logout_all_sessions: true,
  document_follow_notify: true,
  thread_notify: true,
  send_me_a_copy: false,
  allowed_in_mentions: true,
});
const storageKey = (id: string) => `erp.user.settings.${id}`;
const fieldSchema: Record<string, { placeholder: string; help: string }> = {
  Email: { placeholder: "samantha@codeverta.com", help: "Alamat email untuk login dan notifikasi." },
  "Full Name": { placeholder: "Nama lengkap user", help: "Nama yang tampil di aplikasi." },
  Username: { placeholder: "username", help: "Nama pengguna unik untuk login." },
  "Set New Password": { placeholder: "Minimal 8 karakter", help: "Kosongkan saat edit jika password tidak diubah." },
  Phone: { placeholder: "+62 812...", help: "Nomor telepon utama user." },
  "Mobile No": { placeholder: "+62 812...", help: "Nomor seluler yang dapat dihubungi." },
  Location: { placeholder: "Kota atau lokasi", help: "Lokasi kerja atau domisili user." },
  Interests: { placeholder: "Contoh: olahraga, musik", help: "Minat user, pisahkan dengan koma." },
  Bio: { placeholder: "Tuliskan biografi singkat...", help: "Deskripsi singkat tentang user." },
  "Restrict IP": { placeholder: "111.111.111.111, 10.0.", help: "Batasi login ke IP tertentu; pisahkan dengan koma." },
  "Email Signature": { placeholder: "Salam, nama Anda", help: "Tanda tangan otomatis untuk email." },
  "Default Workspace": { placeholder: "Pilih workspace default", help: "Jika kosong, gunakan workspace terakhir." },
  "Default App": { placeholder: "Pilih aplikasi setelah login", help: "Aplikasi tujuan setelah login." },
  "Role Profile": { placeholder: "Pilih role profile", help: "Profile berisi kumpulan role." },
  "Module Profile": { placeholder: "Pilih module profile", help: "Profile untuk membatasi module yang terlihat." },
  "Birth Date": { placeholder: "Pilih tanggal lahir", help: "Tanggal lahir user." },
  "First Name": { placeholder: "Nama depan", help: "Nama depan user." },
  "Middle Name": { placeholder: "Nama tengah (opsional)", help: "Nama tengah user." },
  "Last Name": { placeholder: "Nama belakang (opsional)", help: "Nama belakang user." },
  Language: { placeholder: "Pilih bahasa", help: "Bahasa tampilan aplikasi." },
  "Time Zone": { placeholder: "Pilih zona waktu", help: "Zona waktu untuk tanggal dan notifikasi." },
  Gender: { placeholder: "Pilih gender", help: "Gender user (opsional)." },
};
const Field = ({
  label,
  children,
  help,
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) => {
  const config = fieldSchema[label] || { placeholder: "", help: "Pengaturan user pada kolom ini." };
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<any>, {
        placeholder:
          (children as React.ReactElement<any>).props.placeholder ||
          config.placeholder,
      })
    : children;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-slate-400 hover:text-blue-600"
              aria-label={`Info ${label}`}
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs text-xs">{help || config.help}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      {child}
      {help && <p className="text-xs text-slate-500">{help}</p>}
    </div>
  );
};
const Toggle = ({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) => (
  <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3">
    <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    <span className="text-sm font-medium">
      {label}
      {help && (
        <small className="mt-1 block font-normal text-slate-500">{help}</small>
      )}
    </span>
  </label>
);
const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950">
    <h2 className="font-semibold">{title}</h2>
    {children}
  </section>
);

export default function ERPUserPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const id = pathname.split("/").filter(Boolean)[2];
  const isList = !id;
  const isNew = id === "new" || id?.startsWith("new-");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profiles, setProfiles] = useState<RoleProfile[]>([]);
  const [moduleProfiles, setModuleProfiles] = useState<ModuleProfile[]>([]);
  const [directRoles, setDirectRoles] = useState<string[]>([]);
  const [form, setForm] = useState<Form>(blank());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const modules = useMemo(
    () =>
      Array.from(
        new Set(Object.values(erpWorkspaces).map((w) => w.title).filter(Boolean)),
      ).sort(),
    [],
  );
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((v) => ({ ...v, [key]: value }));
  const loadUsers = () =>
    api
      .get("/users", { params: { page: 1, limit: 100 } })
      .then(({ data }) => setUsers(data.data || []));
  const loadModuleProfiles = () =>
    api
      .get("/module-profiles")
      .then(({ data }) => setModuleProfiles(data.data || []))
      .catch(() => setModuleProfiles([]));
  useEffect(() => {
    void loadModuleProfiles();
  }, []);
  useEffect(() => {
    Promise.all([
      api.get("/authorization/roles"),
      api.get("/authorization/profiles"),
    ])
      .then(([r, p]) => {
        setRoles(r.data.data || []);
        setProfiles(p.data.data || []);
      })
      .catch(() => toast.error("Gagal memuat role dan profile"));
    if (isList)
      loadUsers()
        .catch(() => toast.error("Gagal memuat user"))
        .finally(() => setLoading(false));
    else if (!isNew && id)
      Promise.all([
        api.get(`/users/${id}/detail`),
        api.get<Assignment>(`/authorization/users/${id}/assignments`),
      ])
        .then(([detail, assignment]) => {
          const a = detail.data.data?.account || detail.data.account || {};
          const p = detail.data.data?.profile || detail.data.profile || {};
          let saved = {};
          try {
            saved = JSON.parse(localStorage.getItem(storageKey(id)) || "{}");
          } catch {
            saved = {};
          }
          setForm({
            ...blank(),
            ...saved,
            username: a.username || "",
            display_name: a.display_name || a.full_name || "",
            email: a.email || "",
            role: a.role || 1,
            status: a.status || 1,
            first_name: p.full_name || a.display_name || "",
            gender: p.gender || "",
            birth_date: String(p.date_of_birth || "").slice(0, 10),
            phone: a.phone_number || p.whatsapp || "",
            mobile_no: a.phone_number || p.whatsapp || "",
            location: p.city || "",
          });
          setDirectRoles((assignment.data.roles || []).map((v) => v.role_id));
          const profileID =
            assignment.data.profiles?.[0]?.role_profile_id || "";
          if (profileID) set("role_profile_id", profileID);
        })
        .catch(() => toast.error("Gagal memuat detail user"))
        .finally(() => setLoading(false));
    else setLoading(false);
  }, [id, isList, isNew]);
  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "display_name",
      header: "Full Name",
      cell: ({ row }) => (
        <Link
          className="font-semibold text-blue-600"
          to={`/desk/user/${row.original.id}`}
        >
          {row.original.display_name || row.original.username}
        </Link>
      ),
    },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "username", header: "Username" },
    { accessorKey: "role", header: "Legacy Role" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === 1 ? "default" : "secondary"}>
          {row.original.status === 1 ? "Active" : "Disabled"}
        </Badge>
      ),
    },
  ];
  const save = async () => {
    if (!form.email || !form.username || !form.display_name)
      return toast.error("Email, username, dan full name wajib diisi");
    if (isNew && !form.password)
      return toast.error("Password wajib diisi untuk user baru");
    setSaving(true);
    try {
      const payload = {
        username: form.username,
        display_name: form.display_name,
        email: form.email,
        password: form.password,
        role: form.role,
        status: form.status,
        city: form.location,
      };
      if (isNew) {
        await api.post("/users", payload);
        toast.success("User dibuat");
        navigate("/desk/user");
      } else {
        await api.put(`/users/${id}`, payload);
        await api.put(`/authorization/users/${id}/assignments`, {
          role_ids: directRoles,
          profile_ids: form.role_profile_id ? [form.role_profile_id] : [],
        });
        await api.put(`/users/${id}/erp-settings`, {
          module_profile_id: form.module_profile || null,
          settings: form,
        });
        localStorage.setItem(storageKey(id!), JSON.stringify(form));
        toast.success("User disimpan");
      }
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Gagal menyimpan user",
      );
    } finally {
      setSaving(false);
    }
  };
  const createModuleProfile = async () => {
    const name = window.prompt("Nama Module Profile baru?");
    if (!name?.trim()) return;
    try {
      const { data } = await api.post("/module-profiles", {
        name: name.trim(),
        blocked_modules: form.blocked_modules,
      });
      await loadModuleProfiles();
      set("module_profile", data.id);
      toast.success("Module Profile dibuat");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal membuat Module Profile");
    }
  };
  const impersonate = async () => {
    const reason = window.prompt("Alasan impersonate user ini?");
    if (!reason?.trim()) return;
    try {
      const { data } = await api.post(`/users/${id}/impersonate`, {
        reason: reason.trim(),
      });
      beginImpersonation(data.data || data);
      window.location.assign("/desk");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Gagal impersonate user");
    }
  };
  if (loading)
    return (
      <ERPPage>
        <div className="p-12 text-center text-slate-500">Memuat user...</div>
      </ERPPage>
    );
  if (isList)
    return (
      <ERPPage>
        <ERPPageHeader
          title="User"
          description="Kelola akun, akses, role, module, dan pengaturan pengguna."
          breadcrumbs={[
            { label: "Organization", href: "/desk/organization" },
            { label: "User" },
          ]}
          actions={
            <Button asChild>
              <Link to="/desk/user/new">
                <Plus />
                New User
              </Link>
            </Button>
          }
        />
        <DataTable
          columns={columns}
          data={users}
          getRowId={(u) => u.id}
          onRowClick={(u) => navigate(`/desk/user/${u.id}`)}
          searchPlaceholder="Cari nama, email, atau username..."
          emptyMessage="Belum ada user."
        />
      </ERPPage>
    );
  return (
    <ERPPage>
      <ERPPageHeader
        title={isNew ? "New User" : form.display_name || "User"}
        description="Detail user, permission, module, dan preferensi."
        breadcrumbs={[
          { label: "User", href: "/desk/user" },
          { label: isNew ? "New User" : form.display_name },
        ]}
        actions={
          <>
            {!isNew && (
              <Button variant="outline" onClick={impersonate}>
                <UserRoundCog />
                Impersonate
              </Button>
            )}
            <Button onClick={save} disabled={saving}>
              <Save />
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        }
      />
      <Tabs defaultValue="details">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="details">User Details</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="more">More Information</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="space-y-6">
          <Section title="Basic Info">
            <Toggle
              label="Enabled"
              checked={form.status === 1}
              onChange={(v) => set("status", v ? 1 : 2)}
            />
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Full Name">
                <Input
                  value={form.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                />
              </Field>
              <Field label="Language">
                <SearchableSelect
                  value={form.language}
                  onChange={(v) => set("language", v)}
                  options={["English", "Bahasa Indonesia"]}
                />
              </Field>
              <Field label="First Name">
                <Input
                  value={form.first_name}
                  onChange={(e) => set("first_name", e.target.value)}
                />
              </Field>
              <Field label="Username">
                <Input
                  value={form.username}
                  onChange={(e) => set("username", e.target.value)}
                />
              </Field>
              <Field label="Time Zone">
                <SearchableSelect
                  value={form.time_zone}
                  onChange={(v) => set("time_zone", v)}
                  options={[
                    "Asia/Jakarta",
                    "Asia/Makassar",
                    "Asia/Jayapura",
                    "UTC",
                  ]}
                />
              </Field>
              <Field label="Middle Name">
                <Input
                  value={form.middle_name}
                  onChange={(e) => set("middle_name", e.target.value)}
                />
              </Field>
              <Field label="Last Name">
                <Input
                  value={form.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                />
              </Field>
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="roles" className="space-y-6">
          <Section title="Roles">
            <div className="flex items-end gap-3">
              <Field label="Role Profile">
                <SearchableSelect
                  value={form.role_profile_id}
                  onChange={(v) => set("role_profile_id", v)}
                  options={profiles
                    .filter((p) => p.enabled)
                    .map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="Begin typing for results."
                />
              </Field>
              <Button asChild variant="outline">
                <Link to="/desk/organization/permissions">
                  New Role Profile
                </Link>
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {roles
                .filter((r) => r.enabled)
                .map((role) => (
                  <Toggle
                    key={role.id}
                    label={role.name}
                    checked={directRoles.includes(role.id)}
                    onChange={(v) =>
                      setDirectRoles(
                        v
                          ? [...directRoles, role.id]
                          : directRoles.filter((x) => x !== role.id),
                      )
                    }
                  />
                ))}
            </div>
          </Section>
          <Section title="Allow Modules">
            <div className="flex items-end gap-3">
              <Field label="Module Profile">
                <SearchableSelect
                  value={form.module_profile}
                  onChange={(v) => {
                    set("module_profile", v);
                    const selected = moduleProfiles.find((p) => p.id === v);
                    if (selected?.blocked_modules)
                      set("blocked_modules", selected.blocked_modules);
                  }}
                  options={moduleProfiles.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  placeholder="Begin typing for results."
                />
              </Field>
              <Button variant="outline" onClick={createModuleProfile}>
                New Module Profile
              </Button>
            </div>
            <p className="text-sm text-slate-500">
              Centang module yang ingin diblokir untuk user.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((name) => (
                <Toggle
                  key={name}
                  label={name}
                  checked={form.blocked_modules.includes(name)}
                  onChange={(v) =>
                    set(
                      "blocked_modules",
                      v
                        ? [...form.blocked_modules, name]
                        : form.blocked_modules.filter((x) => x !== name),
                    )
                  }
                />
              ))}
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="more">
          <Section title="More Information">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Gender">
                <SearchableSelect
                  value={form.gender}
                  onChange={(v) => set("gender", v)}
                  options={["Male", "Female", "Other"]}
                />
              </Field>
              <Field label="Birth Date">
                <Input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => set("birth_date", e.target.value)}
                />
              </Field>
              <Field label="Interests">
                <Input
                  value={form.interest}
                  onChange={(e) => set("interest", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field label="Location">
                <Input
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                />
              </Field>
              <Field label="Mobile No">
                <Input
                  value={form.mobile_no}
                  onChange={(e) => set("mobile_no", e.target.value)}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Bio">
                  <Textarea
                    rows={5}
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="settings" className="space-y-6">
          <Section title="Desk Settings">
            <div className="grid gap-3 md:grid-cols-2">
              <Toggle
                label="Mute Sounds"
                checked={form.mute_sounds}
                onChange={(v) => set("mute_sounds", v)}
              />
              <Field label="Desk Theme">
                <SearchableSelect
                  value={form.desk_theme}
                  onChange={(v) => set("desk_theme", v)}
                  options={["Light", "Dark", "Automatic"]}
                />
              </Field>
            </div>
          </Section>
          <Section title="Navigation & Form Settings">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["search_bar", "Search Bar"],
                  ["notifications", "Notifications"],
                  ["list_sidebar", "List Sidebar"],
                  ["bulk_actions", "Bulk Actions"],
                  ["view_switcher", "View Switcher"],
                  ["form_sidebar", "Form Sidebar"],
                  ["form_navigation_buttons", "Navigation Buttons"],
                  ["timeline", "Timeline"],
                  ["dashboard", "Dashboard"],
                ] as const
              ).map(([key, label]) => (
                <Toggle
                  key={key}
                  label={label}
                  checked={form[key]}
                  onChange={(v) => set(key, v)}
                />
              ))}
            </div>
          </Section>
          <Section title="Change Password">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Set New Password">
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                />
              </Field>
              <Toggle
                label="Logout From All Devices After Changing Password"
                checked={form.logout_all_sessions}
                onChange={(v) => set("logout_all_sessions", v)}
              />
            </div>
          </Section>
          <Section title="Email">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Email Signature">
                <Textarea
                  value={form.email_signature}
                  onChange={(e) => set("email_signature", e.target.value)}
                />
              </Field>
              <div className="grid gap-2">
                <Toggle
                  label="Send Notifications For Email Threads"
                  checked={form.thread_notify}
                  onChange={(v) => set("thread_notify", v)}
                />
                <Toggle
                  label="Send Me A Copy of Outgoing Emails"
                  checked={form.send_me_a_copy}
                  onChange={(v) => set("send_me_a_copy", v)}
                />
                <Toggle
                  label="Allowed In Mentions"
                  checked={form.allowed_in_mentions}
                  onChange={(v) => set("allowed_in_mentions", v)}
                />
              </div>
            </div>
          </Section>
          <Section title="Workspace & App">
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Default Workspace"
                help="Jika kosong, workspace terakhir yang dikunjungi akan digunakan."
              >
                <SearchableSelect
                  value={form.default_workspace}
                  onChange={(v) => set("default_workspace", v)}
                  options={modules}
                />
              </Field>
              <Field label="Default App">
                <SearchableSelect
                  value={form.default_app}
                  onChange={(v) => set("default_app", v)}
                  options={["ERP", "LMS", "Website"]}
                />
              </Field>
            </div>
          </Section>
          <Section title="Security Settings">
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Simultaneous Sessions">
                <Input
                  type="number"
                  min={1}
                  value={form.simultaneous_sessions}
                  onChange={(e) =>
                    set("simultaneous_sessions", Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Restrict IP">
                <Input
                  value={form.restrict_ip}
                  onChange={(e) => set("restrict_ip", e.target.value)}
                />
              </Field>
              <Field label="User Type">
                <SearchableSelect
                  value={form.user_type}
                  onChange={(v) => set("user_type", v)}
                  options={["System User", "Website User"]}
                />
              </Field>
              <Field label="Login After">
                <Input
                  type="number"
                  min={0}
                  max={24}
                  value={form.login_after}
                  onChange={(e) => set("login_after", Number(e.target.value))}
                />
              </Field>
              <Field label="Login Before">
                <Input
                  type="number"
                  min={0}
                  max={24}
                  value={form.login_before}
                  onChange={(e) => set("login_before", Number(e.target.value))}
                />
              </Field>
            </div>
          </Section>
          <Section title="API Access">
            <Button variant="outline">
              <KeyRound />
              Generate Keys
            </Button>
          </Section>
        </TabsContent>
        <TabsContent value="connections" className="space-y-6">
          <Section title="User Emails">
            <DataTable
              columns={[
                { accessorKey: "email", header: "Email Account" },
                { accessorKey: "awaiting", header: "Awaiting Password" },
                { accessorKey: "oauth", header: "Used OAuth" },
              ]}
              data={[]}
              toolbar={false}
              pagination={false}
              emptyMessage="No Data"
            />
          </Section>
          <Section title="Social Logins">
            <DataTable
              columns={[
                { accessorKey: "provider", header: "Provider" },
                { accessorKey: "username", header: "Username" },
                { accessorKey: "user_id", header: "User ID" },
              ]}
              data={[]}
              toolbar={false}
              pagination={false}
              emptyMessage="No Data"
            />
          </Section>
        </TabsContent>
      </Tabs>
    </ERPPage>
  );
}
