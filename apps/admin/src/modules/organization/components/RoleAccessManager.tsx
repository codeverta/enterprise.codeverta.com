import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Save, Search, Store } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { deskModules } from "@/lib/erp-desk";
import { erpWorkspaces, type WorkspaceNavigationItem } from "@/lib/erp-workspaces";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import type { Role, RolePermission } from "../pages/permissions";

type AccessValue = { menu: boolean; page: boolean };
type AccessMap = Record<string, AccessValue>;

const pathResource = (href: string) => `${href.split("?")[0].replace(/\*+$/, "")}*`;
const moduleResource = (slug: string) => `module:${slug}`;

const leafItems = (items: WorkspaceNavigationItem[]) =>
  items.flatMap((item) => item.items ? leafItems(item.items) : [item]);

const uniquePages = (items: WorkspaceNavigationItem[]) => {
  const pages = new Map<string, WorkspaceNavigationItem>();
  leafItems(items).forEach((item) => pages.set(pathResource(item.href), item));
  return [...pages.entries()].map(([resource, item]) => ({ resource, item }));
};

const managedResources = new Set(
  deskModules.flatMap((module) => [
    moduleResource(module.slug),
    ...uniquePages(erpWorkspaces[module.slug]?.navigation || []).map((page) => page.resource),
  ]),
);

export default function RoleAccessManager({ roles }: { roles: Role[] }) {
  const [roleId, setRoleId] = useState("");
  const [rules, setRules] = useState<RolePermission[]>([]);
  const [draft, setDraft] = useState<AccessMap>({});
  const [openModules, setOpenModules] = useState<string[]>(["selling"]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedRole = roles.find((role) => role.id === roleId);

  useEffect(() => {
    if (!roleId) { setRules([]); setDraft({}); return; }
    setLoading(true);
    api.get("/authorization/permissions", { params: { role_id: roleId } })
      .then(({ data }) => {
        const nextRules: RolePermission[] = data.data || [];
        const nextDraft: AccessMap = {};
        nextRules.forEach((rule) => {
          if (managedResources.has(rule.resource)) {
            nextDraft[rule.resource] = { menu: Boolean(rule.allow_menu), page: Boolean(rule.allow_page) };
          }
        });
        setRules(nextRules);
        setDraft(nextDraft);
      })
      .catch(() => toast.error("Gagal memuat akses menu role"))
      .finally(() => setLoading(false));
  }, [roleId]);

  const modules = useMemo(() => {
    const term = query.trim().toLowerCase();
    return deskModules.filter((module) => {
      const workspace = erpWorkspaces[module.slug];
      if (!workspace) return false;
      if (!term) return true;
      return module.name.toLowerCase().includes(term) || uniquePages(workspace.navigation).some(({ item }) => item.name.toLowerCase().includes(term));
    });
  }, [query]);

  const setValue = (resource: string, patch: Partial<AccessValue>) => {
    setDraft((current) => ({
      ...current,
      [resource]: { menu: false, page: false, ...current[resource], ...patch },
    }));
  };

  const setModulePages = (slug: string, enabled: boolean) => {
    const workspace = erpWorkspaces[slug];
    if (!workspace) return;
    setDraft((current) => {
      const next = { ...current, [moduleResource(slug)]: { menu: enabled, page: false } };
      uniquePages(workspace.navigation).forEach(({ resource }) => {
        next[resource] = { menu: enabled, page: enabled };
      });
      return next;
    });
  };

  const applyCashierPreset = () => {
    if (!roleId) return toast.error("Pilih role terlebih dahulu");
    if (!confirm(`Terapkan preset Kasir POS ke role ${selectedRole?.name}? Akses menu ERP yang saat ini dipilih akan diganti.`)) return;
    const next: AccessMap = {};
    managedResources.forEach((resource) => { next[resource] = { menu: false, page: false }; });
    next[moduleResource("selling")] = { menu: true, page: false };
    ["/desk/point-of-sale*", "/desk/pos-opening-entry*", "/desk/pos-closing-entry*"].forEach((resource) => {
      next[resource] = { menu: true, page: true };
    });
    setDraft(next);
    setOpenModules(["selling"]);
    toast.info("Preset siap. Klik Simpan Akses untuk menerapkan.");
  };

  const save = async () => {
    if (!roleId) return toast.error("Pilih role terlebih dahulu");
    setSaving(true);
    try {
      const existing = new Map(rules.filter((rule) => managedResources.has(rule.resource)).map((rule) => [rule.resource, rule]));
      const requests: Promise<unknown>[] = [];
      managedResources.forEach((resource) => {
        const value = draft[resource] || { menu: false, page: false };
        const rule = existing.get(resource);
        if (!value.menu && !value.page) {
          if (rule) requests.push(api.delete(`/authorization/permissions/${rule.id}`));
        } else if (rule) {
          requests.push(api.put(`/authorization/permissions/${rule.id}`, { allow_menu: value.menu, allow_page: value.page }));
        } else {
          requests.push(api.post("/authorization/permissions", {
            role_id: roleId,
            resource,
            level: 0,
            allow_menu: value.menu,
            allow_page: value.page,
          }));
        }
      });
      await Promise.all(requests);
      toast.success("Akses Apps, menu, dan halaman berhasil disimpan");
      const { data } = await api.get("/authorization/permissions", { params: { role_id: roleId } });
      setRules(data.data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal menyimpan akses role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Role yang diatur</Label>
              <ERPSelect className="mt-1 h-10 w-full" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
                <ERPSelectOption value="">Pilih role...</ERPSelectOption>
                {roles.filter((role) => role.enabled).map((role) => <ERPSelectOption key={role.id} value={role.id}>{role.name}</ERPSelectOption>)}
              </ERPSelect>
            </div>
            <div>
              <Label>Cari module atau halaman</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-3 size-4 text-slate-400" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Contoh: POS, Sales Order..." className="pl-9" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={applyCashierPreset} disabled={!roleId || loading}><Store className="mr-2 size-4" />Preset Kasir POS</Button>
            <Button onClick={save} disabled={!roleId || loading || saving} className="bg-blue-600 text-white hover:bg-blue-700"><Save className="mr-2 size-4" />{saving ? "Menyimpan..." : "Simpan Akses"}</Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">“Tampil di menu” mengatur sidebar/pencarian. “Dapat diakses” melindungi halaman meskipun URL dibuka langsung.</p>
      </section>

      {!roleId ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">Pilih role untuk mengatur module, menu, dan halaman yang tersedia.</div>
      ) : loading ? (
        <div className="p-12 text-center text-sm text-slate-500">Memuat konfigurasi akses...</div>
      ) : (
        <div className="space-y-3">
          {modules.map((module) => {
            const workspace = erpWorkspaces[module.slug];
            const pages = uniquePages(workspace.navigation);
            const moduleKey = moduleResource(module.slug);
            const expanded = openModules.includes(module.slug) || Boolean(query);
            const Icon = module.icon;
            return (
              <section key={module.slug} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button type="button" onClick={() => setOpenModules((current) => current.includes(module.slug) ? current.filter((slug) => slug !== module.slug) : [...current, module.slug])} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    {expanded ? <ChevronDown className="size-4 text-slate-400" /> : <ChevronRight className="size-4 text-slate-400" />}
                    <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon className="size-4.5" /></span>
                    <span><span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{module.name}</span><span className="block text-xs text-slate-400">{pages.length} halaman</span></span>
                  </button>
                  <label className="flex items-center gap-2 text-xs font-medium"><Checkbox checked={Boolean(draft[moduleKey]?.menu)} onCheckedChange={(value) => setValue(moduleKey, { menu: Boolean(value) })} />Tampil di Apps</label>
                  <Button size="sm" variant="outline" onClick={() => setModulePages(module.slug, !pages.every(({ resource }) => draft[resource]?.menu && draft[resource]?.page))}>Pilih semua</Button>
                </div>
                {expanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] gap-3 bg-slate-50 px-5 py-2 text-[11px] font-semibold uppercase text-slate-500 dark:bg-slate-900"><span>Sidebar menu / halaman</span><span className="text-center">Tampil di menu</span><span className="text-center">Dapat diakses</span></div>
                    {pages.map(({ resource, item }) => (
                      <div key={resource} className="grid grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-3 border-t border-slate-100 px-5 py-2.5 text-sm dark:border-slate-900">
                        <span className="truncate" title={item.href}>{item.name}<span className="ml-2 hidden text-xs text-slate-400 lg:inline">{item.href.split("?")[0]}</span></span>
                        <span className="text-center"><Checkbox checked={Boolean(draft[resource]?.menu)} onCheckedChange={(value) => setValue(resource, { menu: Boolean(value) })} /></span>
                        <span className="text-center"><Checkbox checked={Boolean(draft[resource]?.page)} onCheckedChange={(value) => setValue(resource, { page: Boolean(value) })} /></span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
