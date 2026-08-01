import { useEffect, useState } from "react";
import { BookOpen, Plus, Trash2, Loader2, X, Youtube } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ROLE_OPTIONS = [
  { value: "student", label: "Siswa" },
  { value: "mentor", label: "Mentor" },
  { value: "parent", label: "Orang Tua" },
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
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    youtube_url: "",
    roles: ["student"],
    sort_order: 0,
  });

  const isAdmin = Number(user?.role) >= 99;
  const userRole =
    Number(user?.role) === 99
      ? "admin"
      : Number(user?.role) === 30
        ? "mentor"
        : Number(user?.role) === 10
          ? "parent"
          : "student";

  const fetchGuides = async () => {
    try {
      const res = await api.get("/subscriptions/admin/resources/guides?limit=100");
      const data = res.data?.data || res.data || [];
      setGuides(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Gagal memuat panduan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuides();
  }, []);

  const resetForm = () => {
    setForm({ title: "", description: "", youtube_url: "", roles: ["student"], sort_order: 0 });
    setEditing(null);
  };

  const handleEdit = (g) => {
    setForm({
      title: g.title || "",
      description: g.description || "",
      youtube_url: g.youtube_url || "",
      roles: g.roles ? (Array.isArray(g.roles) ? g.roles : g.roles.split(",")) : ["student"],
      sort_order: g.sort_order || 0,
    });
    setEditing(g);
    setFormOpen(true);
  };

  const toggleRole = (role) => {
    setForm((p) => ({
      ...p,
      roles: p.roles.includes(role)
        ? p.roles.filter((r) => r !== role)
        : [...p.roles, role],
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Judul wajib diisi");
    setSaving(true);
    try {
      const payload = {
        ...form,
        roles: form.roles.join(","),
      };
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
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-blue-600" />
              Panduan Penggunaan
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Video tutorial untuk membantu kamu menggunakan platform ini.
            </p>
          </div>
          {isAdmin && (
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm();
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Tambah Panduan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Panduan" : "Tambah Panduan"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Judul *</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Judul panduan..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deskripsi</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Deskripsi singkat..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL YouTube</Label>
                    <Input
                      value={form.youtube_url}
                      onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
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
                    <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      {editing ? "Simpan" : "Tambah"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : guides.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-slate-400">
            <BookOpen className="mx-auto h-8 w-8 mb-2" />
            <p className="text-sm">Belum ada panduan.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {guides
              .filter((g) => {
                const roles = Array.isArray(g.roles)
                  ? g.roles
                  : (g.roles || "").split(",");
                return roles.includes(userRole) || isAdmin;
              })
              .map((g) => {
                const vid = extractVideoId(g.youtube_url);
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
                      <h3 className="font-semibold text-slate-950">{g.title}</h3>
                      {g.description && (
                        <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                          {g.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(Array.isArray(g.roles)
                          ? g.roles
                          : (g.roles || "").split(",")
                        ).map((r) => (
                          <span
                            key={r}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                          >
                            {ROLE_OPTIONS.find((o) => o.value === r.trim())?.label || r}
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
                            className="text-red-600 hover:text-red-700"
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
        )}
      </div>
    </div>
  );
}

export default DashboardLayout(PanduanPage);
