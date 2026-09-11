import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Edit2,
  ExternalLink,
  Folder,
  FolderPlus,
  FolderTree,
  ListFilter,
  MapPin,
  MoreVertical,
  Network,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Warehouse as WarehouseIcon,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanySelect } from "@/components/CompanySelect";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  warehouseApi,
  type CompanyOption,
  type Warehouse,
  type WarehouseTreeNode,
} from "../warehouseApi";

const defaultWarehouseTypes = [
  "Stores",
  "Finished Goods",
  "Transit",
  "Work In Progress",
  "Manufacturing",
  "Sample",
  "Rejected",
  "Group",
];

const emptyWarehouse: Warehouse = {
  warehouse_name: "",
  is_group: false,
  parent_warehouse: "",
  company: "",
  warehouse_type: "Stores",
  address_line_1: "",
  city: "",
  phone_no: "",
  disabled: false,
};

export default function WarehousePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [treeData, setTreeData] = useState<WarehouseTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState<Warehouse>(emptyWarehouse);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (searchParams.get("action") === "new" || searchParams.get("new") === "true") {
      setIsDialogOpen(true);
    }
  }, [searchParams]);

  // Expanded nodes in Tree View
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Load Companies
  useEffect(() => {
    warehouseApi.listCompanies().then((res) => {
      if (res && res.length > 0) {
        setCompanies(res);
        // keep default or pick first
        setSelectedCompany((prev) => prev || res[0]?.name || "");
      }
    });
  }, []);

  // Load Warehouses & Tree
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, treeRes] = await Promise.all([
        warehouseApi.list({ company: selectedCompany }),
        warehouseApi.tree({ company: selectedCompany }),
      ]);
      setWarehouses(listRes || []);
      setTreeData(treeRes || []);

      // Auto-expand all root and group nodes
      const initExpanded: Record<string, boolean> = {};
      const markExpanded = (nodes: WarehouseTreeNode[]) => {
        for (const n of nodes) {
          if (n.is_group) {
            initExpanded[n.warehouse_name] = true;
            if (n.children && n.children.length > 0) {
              markExpanded(n.children);
            }
          }
        }
      };
      markExpanded(treeRes || []);
      setExpandedNodes((prev) => ({ ...initExpanded, ...prev }));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal memuat data gudang");
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group Warehouses (options for Parent Warehouse)
  const groupWarehouses = useMemo(() => {
    return warehouses.filter((w) => w.is_group);
  }, [warehouses]);

  // Toggle tree node expansion
  const toggleExpand = (name: string) => {
    setExpandedNodes((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // Open Dialog for New Node
  const handleOpenAdd = (parentGroup?: string) => {
    setEditingWarehouse(null);
    setFormData({
      ...emptyWarehouse,
      company: selectedCompany || "",
      parent_warehouse: parentGroup || (groupWarehouses[0]?.warehouse_name ?? ""),
      is_group: false,
      warehouse_type: "Stores",
    });
    setIsDialogOpen(true);
  };

  // Open Dialog for Edit Node
  const handleOpenEdit = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setFormData({ ...wh });
    setIsDialogOpen(true);
  };

  // Save Warehouse (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.warehouse_name.trim()) {
      return toast.error("Nama Gudang wajib diisi");
    }

    setSaving(true);
    try {
      if (editingWarehouse?.id) {
        await warehouseApi.update(editingWarehouse.id, formData);
        toast.success("Gudang berhasil diperbarui");
      } else {
        await warehouseApi.create(formData);
        toast.success("Gudang baru berhasil dibuat");
      }
      setIsDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan data gudang");
    } finally {
      setSaving(false);
    }
  };

  // Delete Warehouse
  const handleDelete = async (wh: Warehouse) => {
    if (!confirm(`Hapus gudang "${wh.warehouse_name}"?`)) return;
    try {
      await warehouseApi.remove(wh.id!);
      toast.success("Gudang berhasil dihapus");
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus gudang");
    }
  };

  // Seed default warehouses
  const handleSeed = async () => {
    setSeeding(true);
    try {
      await warehouseApi.seed();
      toast.success("Struktur gudang default berhasil di-seed!");
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal seeding gudang");
    } finally {
      setSeeding(false);
    }
  };

  // Filtered list for Table View
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return warehouses;
    const q = searchQuery.toLowerCase();
    return warehouses.filter(
      (w) =>
        w.warehouse_name.toLowerCase().includes(q) ||
        (w.parent_warehouse && w.parent_warehouse.toLowerCase().includes(q)) ||
        (w.warehouse_type && w.warehouse_type.toLowerCase().includes(q)) ||
        (w.city && w.city.toLowerCase().includes(q))
    );
  }, [warehouses, searchQuery]);

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: WarehouseTreeNode, level = 0) => {
    const isExpanded = expandedNodes[node.warehouse_name] ?? true;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id || node.warehouse_name} className="relative select-none">
        {/* Row Card */}
        <div
          style={{ paddingLeft: `${level * 28 + 16}px` }}
          className={`group flex items-center justify-between border-b border-slate-100 py-3 pr-4 transition hover:bg-slate-50/90 dark:border-slate-800/80 dark:hover:bg-slate-800/50 ${
            node.disabled ? "opacity-60" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Expand / Collapse Icon */}
            {node.is_group ? (
              <button
                type="button"
                onClick={() => toggleExpand(node.warehouse_name)}
                className="flex size-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 cursor-pointer dark:hover:bg-slate-700"
              >
                {isExpanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
            ) : (
              <div className="size-6 flex items-center justify-center">
                <span className="size-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
            )}

            {/* Node Icon */}
            {node.is_group ? (
              <Folder className="size-5 text-amber-500 fill-amber-500/20" />
            ) : (
              <WarehouseIcon className="size-4 text-blue-600 dark:text-blue-400" />
            )}

            {/* Title & Metadata */}
            <div className="flex items-baseline gap-2.5">
              <span
                onClick={() => (node.is_group ? toggleExpand(node.warehouse_name) : handleOpenEdit(node))}
                className={`cursor-pointer font-semibold transition ${
                  node.is_group
                    ? "text-slate-900 hover:text-blue-600 dark:text-white"
                    : "text-slate-800 hover:text-blue-600 dark:text-slate-200"
                }`}
              >
                {node.warehouse_name}
              </span>

              {/* Group / Leaf Badge */}
              {node.is_group ? (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300">
                  Group ({node.children?.length || 0})
                </span>
              ) : (
                node.warehouse_type && (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {node.warehouse_type}
                  </span>
                )
              )}

              {node.city && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <MapPin className="size-3" /> {node.city}
                </span>
              )}
            </div>
          </div>

          {/* Actions on Hover */}
          <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition">
            {node.is_group && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenAdd(node.warehouse_name)}
                className="h-7 gap-1 px-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-blue-200/70 cursor-pointer dark:border-blue-800 dark:hover:bg-blue-950"
              >
                <Plus className="size-3" />
                <span>Add Child</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleOpenEdit(node)}
              className="h-7 px-2 text-xs font-medium text-slate-600 hover:text-blue-600 cursor-pointer dark:text-slate-400"
            >
              <Edit2 className="size-3.5" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(node)}
              className="h-7 px-2 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-600 cursor-pointer dark:hover:bg-red-950"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Children Render */}
        {node.is_group && isExpanded && node.children && node.children.length > 0 && (
          <div className="relative">
            {/* Vertical connector line */}
            <div
              style={{ left: `${level * 28 + 27}px` }}
              className="absolute top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-800"
            />
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-10">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Link
              to="/desk/stock"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Stock
            </Link>
            <ChevronRight className="size-3 text-slate-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Warehouse
            </span>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Warehouse Tree
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Struktur hirarki pohon gudang (Group & Child Warehouses) untuk lokasi penyimpanan barang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seed Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seeding}
            className="gap-1.5 cursor-pointer"
          >
            <Database className={`size-3.5 ${seeding ? "animate-spin" : ""}`} />
            <span>{seeding ? "Seeding..." : "Seed Warehouses"}</span>
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {/* New Warehouse Button */}
          <Button
            onClick={() => handleOpenAdd()}
            size="sm"
            className="gap-1.5 bg-blue-600 font-semibold text-white hover:bg-blue-700 shadow-sm cursor-pointer"
          >
            <Plus className="size-4" />
            <span>New Warehouse</span>
          </Button>
        </div>
      </div>

      {/* Filter & View Switcher Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        {/* Company Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Building2 className="size-4 text-blue-600 dark:text-blue-400" />
            <span>Company:</span>
          </div>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-bold text-slate-800 outline-none hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
          >
            <option value="ALL">Semua Perusahaan</option>
            {companies.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} {c.abbreviation ? `(${c.abbreviation})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle & Search */}
        <div className="flex items-center gap-3">
          {viewMode === "list" && (
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Cari gudang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 rounded-xl pl-8 text-xs"
              />
            </div>
          )}

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50/70 p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                viewMode === "tree"
                  ? "bg-white text-blue-600 shadow-xs dark:bg-slate-800 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <FolderTree className="size-3.5" />
              <span>Tree View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                viewMode === "list"
                  ? "bg-white text-blue-600 shadow-xs dark:bg-slate-800 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <ListFilter className="size-3.5" />
              <span>List View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "tree" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
            <span>Struktur Hirarki Gudang ({selectedCompany})</span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500">
              <RefreshCw className="mx-auto mb-2 size-6 animate-spin text-blue-600" />
              <p className="text-sm">Memuat pohon gudang...</p>
            </div>
          ) : treeData.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <WarehouseIcon className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Belum ada struktur gudang untuk perusahaan ini
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Klik tombol di bawah untuk membuat struktur gudang standar (Stores, Finished Goods, Transit, WIP).
              </p>
              <Button
                onClick={handleSeed}
                size="sm"
                className="mt-4 bg-blue-600 text-white cursor-pointer"
              >
                <Database className="mr-1.5 size-4" />
                Seed Standard Warehouses
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {treeData.map((rootNode) => renderTreeNode(rootNode, 0))}
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                <tr>
                  <th className="px-6 py-4">Warehouse Name</th>
                  <th className="px-6 py-4">Is Group</th>
                  <th className="px-6 py-4">Parent Warehouse</th>
                  <th className="px-6 py-4">Warehouse Type</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-500">
                      <RefreshCw className="mx-auto mb-2 size-6 animate-spin text-blue-600" />
                      <p>Memuat data gudang...</p>
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-500">
                      Tidak ada gudang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((wh) => (
                    <tr
                      key={wh.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          {wh.is_group ? (
                            <Folder className="size-4 text-amber-500" />
                          ) : (
                            <WarehouseIcon className="size-4 text-blue-600" />
                          )}
                          <span>{wh.warehouse_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {wh.is_group ? (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300">
                            Group Node
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Leaf
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                        {wh.parent_warehouse || "-"}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium">
                        {wh.warehouse_type || "-"}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                        {wh.company}
                      </td>
                      <td className="px-6 py-4">
                        {!wh.disabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(wh)}
                            className="h-8 px-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer dark:hover:bg-blue-950"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(wh)}
                            className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-600 cursor-pointer dark:hover:bg-red-950"
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

      {/* Modal Dialog: New Warehouse / Edit Warehouse */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
              {editingWarehouse ? "Edit Warehouse" : "New Warehouse"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
              Konfigurasikan node gudang baru pada struktur pohon inventaris.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* Warehouse Name */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                New Warehouse Name <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                placeholder="contoh: Stores - PZTS, Finished Goods - PZTS..."
                value={formData.warehouse_name}
                onChange={(e) =>
                  setFormData({ ...formData, warehouse_name: e.target.value })
                }
                className="rounded-xl font-semibold"
              />
              <p className="text-[11px] font-mono text-slate-400">
                warehouse_name
              </p>
            </div>

            {/* Is Group Checkbox */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
              <label className="flex cursor-pointer items-start gap-3 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Checkbox
                  checked={formData.is_group}
                  onCheckedChange={(c) =>
                    setFormData({ ...formData, is_group: Boolean(c) })
                  }
                  className="mt-0.5"
                />
                <div>
                  <span>Is Group</span>
                  <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    Child nodes can be only created under 'Group' type nodes
                  </p>
                  <p className="text-[10px] font-mono text-slate-400">
                    is_group
                  </p>
                </div>
              </label>
            </div>

            {/* Parent Warehouse (only group nodes) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Parent Warehouse
              </Label>
              <select
                value={formData.parent_warehouse || ""}
                onChange={(e) =>
                  setFormData({ ...formData, parent_warehouse: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              >
                <option value="">None (Root Node)</option>
                {groupWarehouses
                  .filter((gw) => !editingWarehouse || gw.warehouse_name !== editingWarehouse.warehouse_name)
                  .map((gw) => (
                    <option key={gw.id || gw.warehouse_name} value={gw.warehouse_name}>
                      📁 {gw.warehouse_name} ({gw.company})
                    </option>
                  ))}
              </select>
              <p className="text-[11px] font-mono text-slate-400">
                parent_warehouse
              </p>
            </div>

            {/* Company */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Company <span className="text-red-500">*</span>
                </Label>
                <Link
                  to={`/desk/company/${encodeURIComponent(formData.company)}`}
                  target="_blank"
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  <span>Lihat Company</span>
                  <ExternalLink className="size-2.5" />
                </Link>
              </div>
              <CompanySelect
                value={formData.company}
                onChange={(company) => setFormData((current) => ({ ...current, company }))}
                className="[&_button]:h-10 [&_button]:rounded-xl [&_button]:text-sm"
              />
              <p className="text-[11px] font-mono text-slate-400">company</p>
            </div>

            {/* Warehouse Type */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Warehouse Type
              </Label>
              <Input
                list="wh-type-options"
                placeholder="Pilih atau ketik tipe gudang..."
                value={formData.warehouse_type || ""}
                onChange={(e) =>
                  setFormData({ ...formData, warehouse_type: e.target.value })
                }
                className="rounded-xl"
              />
              <datalist id="wh-type-options">
                {defaultWarehouseTypes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            {/* Disabled Checkbox */}
            <div className="pt-1">
              <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={formData.disabled}
                  onCheckedChange={(c) =>
                    setFormData({ ...formData, disabled: Boolean(c) })
                  }
                />
                <span>Disabled / Nonaktif</span>
              </label>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              >
                {saving && <RefreshCw className="mr-1.5 size-3.5 animate-spin" />}
                <span>{saving ? "Menyimpan..." : "Simpan Gudang"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
