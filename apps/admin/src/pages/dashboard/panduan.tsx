import { useEffect, useState } from "react";
import { BookOpen, Plus, Trash2, Loader2, Search, Youtube, Tags } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CATEGORY_OPTIONS = [
  { value: "umum", label: "Umum" },
  { value: "teknis", label: "Panduan Teknis" },
  { value: "course", label: "Panduan Course" },
  { value: "affiliate", label: "Panduan Affiliate" },
  { value: "pembayaran", label: "Panduan Pembayaran" },
];

const ROLE_OPTIONS = [
  { value: "student", label: "Partner" },
  { value: "mentor", label: "Mentor" },
  { value: "parent", label: "Merchant" },
  { value: "admin", label: "Admin" },
];

const extractVideoId = (url) => {
  if (!url) return null;
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/
  );
  return m ? m[1] : null;
};

function PanduanPage({ user }) {
  const [guides, setGuides] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "", description: "", youtube_url: "", category: "umum", roles: ["student"], sort_order: 0,
  });

  // Category management state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catList, setCatList] = useState([]);
  const [catEditing, setCatEditing] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", slug: "", sort_order: 0 });
  const [savingCat, setSavingCat] = useState(false);

  const fetchCategories = async () => {
    try {
      const res = await api.get("/subscriptions/admin/resources/guide-categories?limit=50");
      const d = res.data?.data || res.data || [];
      setCatList(Array.isArray(d) ? d : []);
    } catch {}
  };

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) return toast.error("Nama kategori wajib diisi");
    setSavingCat(true);
    try {
      const slug = catForm.slug || catForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const payload = { ...catForm, slug };
      if (catEditing) {
        await api.put(`/subscriptions/admin/resources/guide-categories/${catEditing.id}`, payload);
        toast.success("Kategori diperbarui");
      } else {
        await api.post("/subscriptions/admin/resources/guide-categories", payload);
        toast.success("Kategori ditambahkan");
      }
      setCatForm({ name: "", slug: "", sort_order: 0 });
      setCatEditing(null);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menyimpan kategori");
    } finally { setSavingCat(false); }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm("Hapus kategori ini?")) return;
    try {
      await api.delete(`/subscriptions/admin/resources/guide-categories/${id}`);
      toast.success("Kategori dihapus");
      fetchCategories();
    } catch { toast.error("Gagal menghapus"); }
  };

  const isAdmin = Number(user?.role) >= 99;
  const userRole =
    Number(user?.role) === 99 ? "admin"
    : Number(user?.role) === 30 ? "mentor"
    : Number(user?.role) === 10 ? "parent"
    : "student";

  const fetchGuides = async () => {
    try {
      const params = { limit: 100 };
      if (search) params.search = search;
      if (selectedCat) params.category = selectedCat;
      const res = await api.get("/lms/guides", { params });
      const data = res.data?.data || res.data || [];
      setGuides(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Gagal memuat panduan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGuides(); }, [search, selectedCat]);

  useEffect(() => {
    api.get("/subscriptions/admin/resources/guide-categories?limit=50").then((res) => {
      const d = res.data?.data || res.data || [];
      setCategories(Array.isArray(d) ? d : []);
    }).catch(() => {});
  }, []);

  const CATEGORY_OPTIONS = categories.map((c) => ({ value: c.slug || c.id, label: c.name }));
  const catLabels = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c.label]));

  const resetForm = () => {
    setForm({ title: "", description: "", youtube_url: "", category: "umum", roles: ["student"], sort_order: 0 });
    setEditing(null);
  };

  const handleEdit = (g) => {
    setForm({
      title: g.title || "", description: g.description || "", youtube_url: g.youtube_url || "",
      category: g.category || "umum",
      roles: g.roles ? (Array.isArray(g.roles) ? g.roles : g.roles.split(",")) : ["student"],
      sort_order: g.sort_order || 0,
    });
    setEditing(g);
    setFormOpen(true);
  };

  const toggleRole = (role) => {
    setForm((p) => ({ ...p, roles: p.roles.includes(role) ? p.roles.filter((r) => r !== role) : [...p.roles, role] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Judul wajib diisi");
    // Validate YouTube URL
    if (form.youtube_url && !/^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}(\S*)?$/.test(form.youtube_url)) {
      return toast.error("URL harus dari YouTube (youtube.com/watch atau youtu.be)");
    }
    setSaving(true);
    try {
      const payload = { ...form, roles: form.roles.join(",") };
      if (editing) {
        await api.put(`/subscriptions/admin/resources/guides/${editing.id}`, payload);
        toast.success("Panduan diperbarui");
      } else {
        await api.post("/subscriptions/admin/resources/guides", payload);
        toast.success("Panduan ditambahkan");
      }
      setFormOpen(false);
      resetForm();
      fetchGuides();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Hapus panduan ini?")) return;
    try {
      await api.delete(`/subscriptions/admin/resources/guides/${id}`);
      toast.success("Panduan dihapus");
      fetchGuides();
    } catch { toast.error("Gagal menghapus"); }
  };

  // Group by category — only show guides for the user's role
  const visibleGuides = guides.filter((g) => {
    const roleList = Array.isArray(g.roles) ? g.roles : (g.roles || "").split(",");
    return roleList.includes(userRole) || isAdmin;
  });
  const grouped = visibleGuides.reduce((acc, g) => {
    const cat = g.category || "umum";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(g);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-blue-600" /> Panduan Aplikasi
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Pelajari cara menggunakan semua fitur aplikasi.
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCatForm({ name: "", slug: "", sort_order: 0 });
                      setCatEditing(null);
                      fetchCategories();
                    }}
                  >
                    <Tags className="h-4 w-4 mr-1" /> Kelola Kategori
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Kelola Kategori Panduan</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label>Nama Kategori</Label>
                        <Input
                          value={catForm.name}
                          onChange={(e) =>
                            setCatForm({ ...catForm, name: e.target.value })
                          }
                          placeholder="Nama kategori..."
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={handleSaveCategory}
                        disabled={savingCat}
                      >
                        {savingCat ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : catEditing ? (
                          "Simpan"
                        ) : (
                          "Tambah"
                        )}
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {(Array.isArray(catList) ? catList : []).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                        >
                          <span>{c.name}</span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => {
                                setCatForm({
                                  name: c.name,
                                  slug: c.slug,
                                  sort_order: c.sort_order || 0,
                                });
                                setCatEditing(c);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-red-600"
                              onClick={() => handleDeleteCategory(c.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {catList.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">
                          Belum ada kategori.
                        </p>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      resetForm();
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Tambah Panduan
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      {editing ? "Edit Panduan" : "Tambah Panduan"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSave} className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Judul *</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 200) })}
                      placeholder="Judul panduan..."
                      maxLength={200}
                      required
                    />
                    <p className="text-[10px] text-right text-slate-400">{form.title.length}/200</p>
                  </div>
                    <div className="space-y-2">
                      <Label>Kategori</Label>
                      <Select
                        value={form.category}
                        onValueChange={(val) => setForm({ ...form, category: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.slug || c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Deskripsi (maks 2000)</Label>
                      <Textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 2000) })}
                        placeholder="Deskripsi singkat..."
                        maxLength={2000}
                        rows={3}
                      />
                      <p className="text-[10px] text-right text-slate-400">{form.description.length}/2000</p>
                    </div>
                    <div className="space-y-2">
                      <Label>URL YouTube</Label>
                      <Input
                        value={form.youtube_url}
                        onChange={(e) =>
                          setForm({ ...form, youtube_url: e.target.value })
                        }
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Untuk Role</Label>
                      <div className="flex flex-wrap gap-3">
                        {ROLE_OPTIONS.map((r) => (
                          <label
                            key={r.value}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <Checkbox
                              checked={form.roles.includes(r.value)}
                              onCheckedChange={() => toggleRole(r.value)}
                            />
                            {r.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormOpen(false)}
                      >
                        Batal
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving && (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        )}
                        {editing ? "Simpan" : "Tambah"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Search + Filter */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari panduan..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c.value}
              onClick={() =>
                setSelectedCat(selectedCat === c.value ? "" : c.value)
              }
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                selectedCat === c.value
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-blue-300"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-slate-400">
            <BookOpen className="mx-auto h-8 w-8 mb-2" />
            <p className="text-sm">Belum ada panduan.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <section key={cat} className="mb-8">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {catLabels[cat] || cat}
                </Badge>
                <span className="text-xs text-slate-400 font-normal">
                  {items.length} panduan
                </span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((g) => {
                  const vid = extractVideoId(g.youtube_url);
                  const roles = Array.isArray(g.roles)
                    ? g.roles
                    : (g.roles || "").split(",");
                  return (
                    <div
                      key={g.id}
                      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                    >
                      {vid ? (
                        <div className="aspect-video bg-black">
                          <iframe
                            src={`https://www.youtube.com/embed/${vid}`}
                            title={g.title}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <div className="aspect-video flex items-center justify-center bg-slate-100">
                          <Youtube className="h-10 w-10 text-slate-300" />
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold text-slate-950">
                          {g.title}
                        </h3>
                        {g.description && (
                          <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                            {g.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {roles.map((r) => (
                            <span
                              key={r}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              {ROLE_OPTIONS.find((o) => o.value === r.trim())
                                ?.label || r}
                            </span>
                          ))}
                        </div>
                        {isAdmin && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(g)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600"
                              onClick={() => handleDelete(g.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export default DashboardLayout(PanduanPage);
