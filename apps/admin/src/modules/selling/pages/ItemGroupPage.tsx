import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FolderTree,
  List,
  Network,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  FolderPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  itemGroupApi,
  type ItemGroup,
  type ItemGroupTreeNode,
} from "../itemGroupApi";

const emptyItemGroup = (parent = "All Item Groups"): ItemGroup => ({
  item_group_name: "",
  parent_item_group: parent,
  is_group: false,
});

/* =========================================================================
   TREE COMPONENT
   ========================================================================= */
function ItemGroupTreeItem({
  node,
  navigate,
  onDelete,
}: {
  node: ItemGroupTreeNode;
  navigate: (path: string) => void;
  onDelete: (node: ItemGroupTreeNode) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group">
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
          <FolderTree className="size-4 text-amber-500 shrink-0" />
        ) : (
          <Tag className="size-3.5 text-slate-400 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => navigate(`/desk/item-group/${node.id}`)}
          className="font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400 text-left truncate"
        >
          {node.item_group_name}
        </button>

        <div className="ml-auto flex items-center gap-1.5 opacity-90 group-hover:opacity-100">
          {node.is_group ? (
            <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Group
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-slate-500">
              Leaf
            </Badge>
          )}

          {node.is_group && (
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-blue-600 hover:bg-blue-50"
              title={`Tambah sub-group di bawah ${node.item_group_name}`}
              onClick={() => navigate(`/desk/item-group/new?parent=${encodeURIComponent(node.item_group_name)}`)}
            >
              <FolderPlus className="size-3.5" />
            </Button>
          )}

          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-slate-500"
            onClick={() => navigate(`/desk/item-group/${node.id}`)}
          >
            <Pencil className="size-3.5" />
          </Button>

          {node.item_group_name !== "All Item Groups" && (
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-rose-500 hover:bg-rose-50"
              onClick={() => onDelete(node)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {hasChildren && isOpen && (
        <div className="ml-6 border-l pl-3 space-y-1 dark:border-slate-800">
          {node.children.map((child) => (
            <ItemGroupTreeItem
              key={child.id}
              node={child}
              navigate={navigate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   LIST PAGE (DEFAULT TREE VIEW)
   ========================================================================= */
export function ItemGroupListPage() {
  const navigate = useNavigate();
  const [treeData, setTreeData] = useState<ItemGroupTreeNode[]>([]);
  const [flatRows, setFlatRows] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");

  const load = async () => {
    setLoading(true);
    try {
      const [treeResult, flatResult] = await Promise.all([
        itemGroupApi.tree(),
        itemGroupApi.list({ q: q || undefined }),
      ]);
      setTreeData(treeResult);
      setFlatRows(flatResult);
    } catch {
      toast.error("Gagal memuat data Item Group");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (item: { id: string; item_group_name: string }) => {
    if (!confirm(`Hapus Item Group "${item.item_group_name}"?`)) return;
    try {
      await itemGroupApi.remove(item.id);
      toast.success(`Item Group "${item.item_group_name}" berhasil dihapus`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menghapus Item Group");
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
            <span className="font-semibold text-slate-900 dark:text-slate-100">Item Group</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Item Group</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hierarki klasifikasi dan pengelompokan item barang atau jasa dalam inventaris.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-slate-50 p-1 dark:bg-slate-900">
            <Button
              size="sm"
              variant={viewMode === "tree" ? "default" : "ghost"}
              className={`h-8 px-2.5 text-xs ${viewMode === "tree" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100" : ""}`}
              onClick={() => setViewMode("tree")}
            >
              <Network className="mr-1.5 size-3.5" /> Tree View
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className={`h-8 px-2.5 text-xs ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <List className="mr-1.5 size-3.5" /> List View
            </Button>
          </div>

          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link to="/desk/item-group/new">
              <Plus className="mr-2 size-4" /> New Item Group
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      {viewMode === "tree" ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
                Item Group Tree
              </h3>
              <p className="text-xs text-slate-500">
                Struktur pohon kelompok item. Sub-group baru dapat dibuat di bawah record yang ditandai sebagai 'Group'.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={load}>
              Refresh Tree
            </Button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Memuat hierarki Item Group...</div>
          ) : treeData.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Belum ada struktur Item Group</div>
          ) : (
            <div className="space-y-2">
              {treeData.map((node) => (
                <ItemGroupTreeItem
                  key={node.id}
                  node={node}
                  navigate={navigate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950 max-w-md">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Cari nama item group..."
              className="h-9 text-xs"
            />
            <Button variant="secondary" size="sm" onClick={load} className="h-9">
              <Search className="mr-1.5 size-3.5" /> Cari
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
                  <tr>
                    <th className="py-3 px-4 min-w-[200px]">Item Group Name</th>
                    <th className="py-3 px-4 min-w-[180px]">Parent Item Group</th>
                    <th className="py-3 px-4 w-32">Type</th>
                    <th className="py-3 px-4 w-24 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        Memuat data...
                      </td>
                    </tr>
                  ) : flatRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        Tidak ada Item Group ditemukan.
                      </td>
                    </tr>
                  ) : (
                    flatRows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-900/50"
                      >
                        <td className="py-3 px-4 font-semibold">
                          <Link
                            to={`/desk/item-group/${row.id}`}
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {row.item_group_name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {row.parent_item_group || "-"}
                        </td>
                        <td className="py-3 px-4">
                          {row.is_group ? (
                            <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              Group
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500">
                              Leaf
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" asChild className="size-7">
                              <Link to={`/desk/item-group/${row.id}`}>
                                <Pencil className="size-3.5" />
                              </Link>
                            </Button>
                            {row.item_group_name !== "All Item Groups" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-rose-500 hover:bg-rose-50"
                                onClick={() => handleDelete({ id: row.id!, item_group_name: row.item_group_name })}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   FORM PAGE
   ========================================================================= */
export default function ItemGroupFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-item-group");
  const parentFromQuery = searchParams.get("parent") || "All Item Groups";

  const [row, setRow] = useState<ItemGroup>(emptyItemGroup(parentFromQuery));
  const [availableGroups, setAvailableGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const groups = await itemGroupApi.list({ is_group: true });
        setAvailableGroups(groups);

        if (!isNew && id) {
          const loaded = await itemGroupApi.get(id);
          setRow(loaded);
        } else {
          setRow(emptyItemGroup(parentFromQuery));
        }
      } catch {
        toast.error("Gagal memuat data Item Group");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isNew, parentFromQuery]);

  const update = <K extends keyof ItemGroup>(key: K, value: ItemGroup[K]) =>
    setRow((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!row.item_group_name.trim()) {
      return toast.error("Item Group Name wajib diisi");
    }
    if (row.item_group_name.trim() === (row.parent_item_group || "").trim()) {
      return toast.error("Parent Item Group tidak boleh sama dengan Item Group Name");
    }

    setSaving(true);
    try {
      if (!isNew && id) {
        await itemGroupApi.update(id, row);
        toast.success(`Item Group "${row.item_group_name}" berhasil diperbarui`);
      } else {
        await itemGroupApi.create(row);
        toast.success(`Item Group "${row.item_group_name}" berhasil dibuat`);
      }
      navigate("/desk/item-group");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menyimpan Item Group");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !id) return;
    if (!confirm(`Hapus Item Group "${row.item_group_name}"?`)) return;
    try {
      await itemGroupApi.remove(id);
      toast.success("Item Group berhasil dihapus");
      navigate("/desk/item-group");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menghapus Item Group");
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-7 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">
              Selling
            </Link>
            <span>/</span>
            <Link to="/desk/item-group" className="hover:text-blue-600">
              Item Group
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? "New Item Group" : row.item_group_name}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "New Item Group" : row.item_group_name}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {isNew ? "Not Saved" : row.is_group ? "Tipe: Group Node" : "Tipe: Leaf Node"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/desk/item-group")}>
            <ArrowLeft className="mr-1.5 size-4" /> Kembali
          </Button>

          {!isNew && row.item_group_name !== "All Item Groups" && (
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

      {/* Form Details Card */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
          Item Group Details
        </h3>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Item Group Name */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Item Group Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={row.item_group_name}
              onChange={(e) => update("item_group_name", e.target.value)}
              placeholder="item_group_name"
              className="mt-1 text-xs"
            />
            <p className="mt-1 text-[11px] text-slate-400">Nama unik untuk kelompok item.</p>
          </div>

          {/* Parent Item Group */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Parent Item Group
            </label>
            <select
              value={row.parent_item_group || ""}
              onChange={(e) => update("parent_item_group", e.target.value)}
              className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
            >
              <option value="">-- Root (Tanpa Parent) --</option>
              {availableGroups
                .filter((g) => g.item_group_name !== row.item_group_name)
                .map((g) => (
                  <option key={g.id || g.item_group_name} value={g.item_group_name}>
                    {g.item_group_name}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Hanya record bertipe 'Group' yang dapat menjadi parent.
            </p>
          </div>

          {/* Is Group */}
          <div className="sm:col-span-2 pt-2 border-t">
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
                  Further sub-groups can only be created under records marked as 'Group'
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
