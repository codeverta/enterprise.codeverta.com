import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Globe,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Target,
  FilePlus2,
  CheckCircle2,
  List,
  Network,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  territoryApi,
  type Territory,
  type TerritoryTarget,
  type TerritoryOptions,
  type TerritoryTreeNode,
} from "../territoryApi";

const formatRp = (value?: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const emptyTarget = (): TerritoryTarget => ({
  item_group: "All Item Groups",
  fiscal_year: new Date().getFullYear().toString(),
  target_qty: 0,
  target_amount: 0,
  target_distribution: "Even",
});

const emptyTerritory = (): Territory => ({
  territory_name: "",
  parent_territory: "All Territories",
  is_group: false,
  territory_manager: "",
  disabled: false,
  targets: [],
});

/* =========================================================================
   TREE COMPONENT
   ========================================================================= */
function TreeItem({
  node,
  navigate,
}: {
  node: TerritoryTreeNode;
  navigate: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <div className="w-6" />
        )}

        {node.is_group ? (
          <FolderTree className="size-4 text-blue-600 shrink-0" />
        ) : (
          <MapPin className="size-4 text-slate-400 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => navigate(`/desk/territory/${node.id}`)}
          className="font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400 text-left truncate"
        >
          {node.territory_name}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {node.is_group ? (
            <Badge variant="secondary" className="text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Group
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-slate-500">
              Leaf Node
            </Badge>
          )}

          {node.territory_manager && (
            <span className="hidden sm:inline-block text-xs text-slate-400">
              Manager: {node.territory_manager}
            </span>
          )}

          {node.target_count > 0 && (
            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
              {node.target_count} targets
            </Badge>
          )}

          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => navigate(`/desk/territory/${node.id}`)}
          >
            <Pencil className="size-3.5 text-slate-500" />
          </Button>
        </div>
      </div>

      {hasChildren && isOpen && (
        <div className="ml-6 border-l pl-3 space-y-1 dark:border-slate-800">
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   LIST PAGE
   ========================================================================= */
export function TerritoryListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Territory[]>([]);
  const [treeData, setTreeData] = useState<TerritoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [typeFilter, setTypeFilter] = useState<"all" | "group" | "leaf">("all");

  const load = async () => {
    setLoading(true);
    try {
      const isGroupParam = typeFilter === "group" ? true : typeFilter === "leaf" ? false : undefined;
      const [listResult, treeResult] = await Promise.all([
        territoryApi.list({ q, is_group: isGroupParam }),
        territoryApi.tree(),
      ]);
      setRows(listResult);
      setTreeData(treeResult);
    } catch {
      toast.error("Gagal memuat data Territory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [typeFilter]);

  const handleDelete = async (row: Territory) => {
    if (!row.id) return;
    if (!confirm(`Hapus territory "${row.territory_name}"?`)) return;
    try {
      await territoryApi.remove(row.id);
      toast.success(`Territory "${row.territory_name}" berhasil dihapus`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menghapus territory");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-5">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">
              Selling
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">Territory</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Territory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola wilayah geografis atau segmentasi penjualan pelanggan serta target tahunannya.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-slate-50 p-1 dark:bg-slate-900">
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className={`h-8 px-2.5 text-xs ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <List className="mr-1.5 size-3.5" /> List
            </Button>
            <Button
              size="sm"
              variant={viewMode === "tree" ? "default" : "ghost"}
              className={`h-8 px-2.5 text-xs ${viewMode === "tree" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100" : ""}`}
              onClick={() => setViewMode("tree")}
            >
              <Network className="mr-1.5 size-3.5" /> Tree
            </Button>
          </div>

          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link to="/desk/territory/new">
              <Plus className="mr-2 size-4" /> New Territory
            </Link>
          </Button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Cari nama territory, parent, atau manager..."
            className="h-9 text-xs"
          />
          <Button variant="secondary" size="sm" onClick={load} className="h-9">
            <Search className="mr-1.5 size-3.5" /> Cari
          </Button>
        </div>

        {viewMode === "list" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Filter Tipe:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="h-9 rounded-md border bg-white px-3 text-xs dark:bg-slate-900"
            >
              <option value="all">Semua Tipe</option>
              <option value="group">Hanya Group</option>
              <option value="leaf">Hanya Leaf Node</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {viewMode === "tree" ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
                Struktur Hierarki Wilayah (Territory Tree)
              </h3>
              <p className="text-xs text-slate-500">
                Hubungan parent dan child territory. Transaksi penjualan hanya dapat menggunakan Leaf Node.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={load}>
              Refresh Tree
            </Button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Memuat hierarki territory...</div>
          ) : treeData.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Belum ada struktur territory</div>
          ) : (
            <div className="space-y-2">
              {treeData.map((node) => (
                <TreeItem key={node.id} node={node} navigate={navigate} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
                <tr>
                  <th className="py-3 px-4 min-w-[200px]">Territory Name</th>
                  <th className="py-3 px-4 min-w-[160px]">Parent Territory</th>
                  <th className="py-3 px-4 w-32">Type</th>
                  <th className="py-3 px-4 min-w-[150px]">Territory Manager</th>
                  <th className="py-3 px-4 w-28 text-center">Targets</th>
                  <th className="py-3 px-4 w-24 text-center">Status</th>
                  <th className="py-3 px-4 w-20 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Memuat data territory...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Tidak ada territory yang cocok.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-900/50"
                    >
                      <td className="py-3 px-4 font-semibold">
                        <Link
                          to={`/desk/territory/${row.id}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {row.territory_name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {row.parent_territory || "-"}
                      </td>
                      <td className="py-3 px-4">
                        {row.is_group ? (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            Group
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">
                            Leaf Node
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {row.territory_manager || "-"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.targets && row.targets.length > 0 ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                            {row.targets.length} Target
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={row.disabled ? "secondary" : "default"}>
                          {row.disabled ? "Nonaktif" : "Aktif"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" asChild className="size-7">
                            <Link to={`/desk/territory/${row.id}`}>
                              <Pencil className="size-3.5" />
                            </Link>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-rose-500 hover:bg-rose-50"
                            onClick={() => handleDelete(row)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   FORM PAGE
   ========================================================================= */
export default function TerritoryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-territory");

  const [row, setRow] = useState<Territory>(emptyTerritory());
  const [options, setOptions] = useState<TerritoryOptions>({
    parent_territories: ["All Territories"],
    territories: [],
    item_groups: ["All Item Groups", "Products", "Raw Material", "Services"],
    fiscal_years: ["2024", "2025", "2026", "2027", "2028"],
    distributions: ["Even", "Quarterly", "Seasonality"],
    managers: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const opts = await territoryApi.options();
        if (opts) setOptions(opts);

        if (!isNew && id) {
          const loaded = await territoryApi.get(id);
          setRow(loaded);
        }
      } catch {
        toast.error("Gagal memuat data Territory");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isNew]);

  const update = <K extends keyof Territory>(key: K, value: Territory[K]) =>
    setRow((prev) => ({ ...prev, [key]: value }));

  const updateTarget = (idx: number, patch: Partial<TerritoryTarget>) => {
    const current = row.targets || [];
    const updated = current.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    update("targets", updated);
  };

  const addTarget = () => {
    const current = row.targets || [];
    update("targets", [...current, emptyTarget()]);
  };

  const removeTarget = (idx: number) => {
    const current = row.targets || [];
    update("targets", current.filter((_, i) => i !== idx));
  };

  const totalQty = useMemo(() => {
    return (row.targets || []).reduce((sum, t) => sum + (Number(t.target_qty) || 0), 0);
  }, [row.targets]);

  const totalAmount = useMemo(() => {
    return (row.targets || []).reduce((sum, t) => sum + (Number(t.target_amount) || 0), 0);
  }, [row.targets]);

  const save = async () => {
    if (!row.territory_name.trim()) {
      return toast.error("Territory Name wajib diisi");
    }
    if (row.territory_name.trim() === (row.parent_territory || "").trim()) {
      return toast.error("Parent Territory tidak boleh sama dengan Territory Name");
    }

    setSaving(true);
    try {
      if (!isNew && id) {
        await territoryApi.update(id, row);
        toast.success(`Territory "${row.territory_name}" berhasil diperbarui`);
      } else {
        await territoryApi.create(row);
        toast.success(`Territory "${row.territory_name}" berhasil dibuat`);
      }
      navigate("/desk/territory");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menyimpan Territory");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !id) return;
    if (!confirm(`Hapus territory "${row.territory_name}"?`)) return;
    try {
      await territoryApi.remove(id);
      toast.success("Territory berhasil dihapus");
      navigate("/desk/territory");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menghapus territory");
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-7 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">
              Selling
            </Link>
            <span>/</span>
            <Link to="/desk/territory" className="hover:text-blue-600">
              Territory
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? "New Territory" : row.territory_name || "Edit Territory"}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "New Territory" : row.territory_name}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {isNew ? "Not Saved" : row.disabled ? "Status: Nonaktif" : "Status: Aktif"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/desk/territory")}>
            <ArrowLeft className="mr-1.5 size-4" /> Kembali
          </Button>

          {!isNew && (
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 hover:bg-rose-50"
              onClick={handleDelete}
            >
              <Trash2 className="mr-1.5 size-4" /> Hapus
            </Button>
          )}

          <Button
            size="sm"
            disabled={saving || loading}
            onClick={save}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? "Menyimpan..." : "Save"}
          </Button>
        </div>
      </header>

      {/* Main Details Card */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
          Territory Details
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Territory Name */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Territory Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={row.territory_name}
              onChange={(e) => update("territory_name", e.target.value)}
              placeholder="Contoh: Jakarta, Jawa Barat, North America..."
              className="mt-1 text-xs"
            />
            <p className="mt-1 text-[11px] text-slate-400">Nama identifikasi territory.</p>
          </div>

          {/* Parent Territory */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Parent Territory
            </label>
            <select
              value={row.parent_territory || ""}
              onChange={(e) => update("parent_territory", e.target.value)}
              className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
            >
              <option value="">-- Tanpa Parent (Root Node) --</option>
              {options.parent_territories
                .filter((p) => p !== row.territory_name)
                .map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">Territory induk dalam struktur pohon.</p>
          </div>

          {/* Territory Manager */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Territory Manager
            </label>
            <div className="relative mt-1">
              <Input
                value={row.territory_manager || ""}
                onChange={(e) => update("territory_manager", e.target.value)}
                placeholder="Begin typing for results..."
                className="text-xs"
                list="manager-suggestions"
              />
              <datalist id="manager-suggestions">
                {options.managers.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">For reference</p>
          </div>

          {/* Is Group Checkbox */}
          <div className="flex flex-col justify-center space-y-3 pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox
                checked={row.is_group}
                onCheckedChange={(c) => update("is_group", !!c)}
                className="mt-0.5"
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Is Group
                </span>
                <p className="text-[11px] text-slate-500">
                  Only leaf nodes are allowed in transaction
                </p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={row.disabled}
                onCheckedChange={(c) => update("disabled", !!c)}
              />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                Nonaktifkan Territory (Disabled)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Territory Targets Section */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Target className="size-4 text-blue-600" /> Territory Targets
            </h3>
            <p className="text-xs text-slate-500">
              Set Item Group-wise budgets on this Territory. You can also include seasonality by
              setting the Distribution.
            </p>
          </div>

          <Button size="sm" onClick={addTarget} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-1.5 size-3.5" /> Add Row
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">No.</th>
                <th className="py-2.5 px-3 min-w-[180px]">Item Group</th>
                <th className="py-2.5 px-3 w-32">Fiscal Year</th>
                <th className="py-2.5 px-3 w-32 text-right">Target Qty</th>
                <th className="py-2.5 px-3 min-w-[160px] text-right">Target Amount (IDR)</th>
                <th className="py-2.5 px-3 min-w-[160px]">Target Distribution</th>
                <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!row.targets || row.targets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No rows. Klik <b>"+ Add Row"</b> untuk menetapkan target budget item group pada territory ini.
                  </td>
                </tr>
              ) : (
                row.targets.map((t, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <select
                        value={t.item_group}
                        onChange={(e) => updateTarget(idx, { item_group: e.target.value })}
                        className="w-full rounded border bg-white p-1.5 text-xs dark:bg-slate-900"
                      >
                        {options.item_groups.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={t.fiscal_year}
                        onChange={(e) => updateTarget(idx, { fiscal_year: e.target.value })}
                        className="w-full rounded border bg-white p-1.5 text-xs dark:bg-slate-900"
                      >
                        {options.fiscal_years.map((fy) => (
                          <option key={fy} value={fy}>
                            {fy}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <Input
                        type="number"
                        step="any"
                        value={t.target_qty}
                        onChange={(e) =>
                          updateTarget(idx, { target_qty: parseFloat(e.target.value) || 0 })
                        }
                        className="h-8 text-xs text-right"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="space-y-0.5">
                        <Input
                          type="number"
                          step="any"
                          value={t.target_amount}
                          onChange={(e) =>
                            updateTarget(idx, { target_amount: parseFloat(e.target.value) || 0 })
                          }
                          className="h-8 text-xs text-right font-medium"
                        />
                        <div className="text-[10px] text-slate-400 text-right">
                          {formatRp(t.target_amount)}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={t.target_distribution || "Even"}
                        onChange={(e) =>
                          updateTarget(idx, { target_distribution: e.target.value })
                        }
                        className="w-full rounded border bg-white p-1.5 text-xs dark:bg-slate-900"
                      >
                        {options.distributions.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-rose-500 hover:bg-rose-50"
                        onClick={() => removeTarget(idx)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {row.targets && row.targets.length > 0 && (
              <tfoot>
                <tr className="border-t bg-slate-50 font-semibold dark:bg-slate-900/50">
                  <td colSpan={3} className="py-2.5 px-3 text-right">
                    Total:
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-blue-600">
                    {totalQty.toLocaleString("id-ID")}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-blue-600">
                    {formatRp(totalAmount)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
