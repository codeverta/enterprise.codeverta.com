import { useEffect, useState } from "react";
import { BookOpen, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type RAGDocument = {
  id: string;
  title: string;
  source_url?: string;
  content: string;
  audience_roles?: string | string[];
  is_active: boolean;
  chunk_count: number;
  updated_at: string;
};

const RAG_AUDIENCE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
  { value: "mentor", label: "Mentor/Teacher" },
  { value: "admin", label: "Admin" },
];

const emptyForm = { title: "", source_url: "", content: "", audience_roles: [] as string[], is_active: true };

const parseAudienceRoles = (roles?: string | string[]) => {
  if (Array.isArray(roles)) return roles;
  return (roles || "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
};

const audienceLabel = (role: string) => RAG_AUDIENCE_OPTIONS.find((item) => item.value === role)?.label || role;

function RAGDocumentsPage() {
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingID, setEditingID] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await api.get("/lms/superadmin/rag-documents");
      setDocuments(response.data?.data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal memuat dokumentasi AI");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const resetForm = () => {
    setEditingID(null);
    setForm(emptyForm);
  };

  const saveDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Judul dan isi dokumentasi wajib diisi");
      return;
    }
    if (form.audience_roles.length === 0) {
      toast.error("Pilih minimal satu role yang boleh membaca dokumentasi ini");
      return;
    }
    setSaving(true);
    try {
      if (editingID) {
        await api.put(`/lms/superadmin/rag-documents/${editingID}`, form);
      } else {
        await api.post("/lms/superadmin/rag-documents", form);
      }
      toast.success(editingID ? "Dokumentasi diperbarui" : "Dokumentasi ditambahkan");
      resetForm();
      await loadDocuments();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal menyimpan dokumentasi");
    } finally {
      setSaving(false);
    }
  };

  const editDocument = (document: RAGDocument) => {
    setEditingID(document.id);
    setForm({
      title: document.title,
      source_url: document.source_url || "",
      content: document.content,
      audience_roles: parseAudienceRoles(document.audience_roles),
      is_active: document.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteDocument = async (document: RAGDocument) => {
    if (!window.confirm(`Hapus dokumentasi “${document.title}”?`)) return;
    try {
      await api.delete(`/lms/superadmin/rag-documents/${document.id}`);
      toast.success("Dokumentasi dihapus");
      if (editingID === document.id) resetForm();
      await loadDocuments();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal menghapus dokumentasi");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><BookOpen className="h-6 w-6" /> Knowledge Base AI</h1>
        <p className="text-muted-foreground">Dokumentasi ini otomatis dipotong menjadi chunk dan dipakai oleh chat AI melalui MariaDB.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingID ? "Edit dokumentasi" : "Tambah dokumentasi"}</CardTitle>
          <CardDescription>Tempel dokumentasi aplikasi dalam bentuk teks. Maksimal 200.000 karakter per dokumen.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveDocument}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rag-title">Judul</Label>
                <Input id="rag-title" placeholder="Contoh: Kebijakan Ujian Tengah Semester & KKM" maxLength={220} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rag-source">URL sumber (opsional)</Label>
                <Input id="rag-source" placeholder="Contoh: https://docs.google.com/document/d/... atau kosongkan" maxLength={1000} value={form.source_url} onChange={(event) => setForm({ ...form, source_url: event.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rag-content">Isi dokumentasi</Label>
              <Textarea id="rag-content" placeholder="Tempelkan atau tulis detail instruksi, kebijakan, materi pendukung, atau dokumentasi aplikasi di sini..." className="min-h-72 font-mono text-sm" maxLength={200000} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
              <p className="text-right text-xs text-muted-foreground">{form.content.length.toLocaleString("id-ID")} / 200.000 karakter</p>
            </div>
            <div className="space-y-2">
              <Label>Boleh dipakai untuk role</Label>
              <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
                {RAG_AUDIENCE_OPTIONS.map((option) => {
                  const checked = form.audience_roles.includes(option.value);
                  return (
                    <div key={option.value} className="flex items-center gap-2">
                      <Checkbox
                        id={option.value} // Tambahkan ID unik
                        checked={form.audience_roles.includes(option.value)}
                        onCheckedChange={(checked) => {
                          setForm({
                            ...form,
                            audience_roles: checked
                              ? [...form.audience_roles, option.value]
                              : form.audience_roles.filter(
                                  (role) => role !== option.value
                                ),
                          });
                        }}
                      />
                      <label
                        htmlFor={option.value} // Hubungkan ke ID Checkbox
                        className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">AI hanya akan mengambil chunk dokumentasi yang sesuai role user. Dokumen admin/superadmin tidak akan masuk konteks untuk student, parent, atau mentor.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
              Aktifkan untuk retrieval AI
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{saving ? "Menyimpan..." : editingID ? "Simpan perubahan" : "Tambah dokumentasi"}</Button>
              {editingID && <Button type="button" variant="outline" onClick={resetForm}>Batal</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div><CardTitle>Dokumentasi tersimpan</CardTitle><CardDescription>{documents.length} dokumen di knowledge base.</CardDescription></div>
          <Button variant="outline" size="icon" onClick={loadDocuments} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && documents.length === 0 && <p className="py-8 text-center text-muted-foreground">Belum ada dokumentasi.</p>}
          {documents.map((document) => (
            <div key={document.id} className="flex flex-col justify-between gap-3 rounded-lg border p-4 md:flex-row md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{document.title}</h3>
                  <Badge variant={document.is_active ? "default" : "secondary"}>{document.is_active ? "Aktif" : "Nonaktif"}</Badge>
                  <Badge variant="outline">{document.chunk_count} chunk</Badge>
                  {parseAudienceRoles(document.audience_roles).map((role) => (
                    <Badge key={role} variant="secondary">{audienceLabel(role)}</Badge>
                  ))}
                  {parseAudienceRoles(document.audience_roles).length === 0 && <Badge variant="destructive">Belum ada role akses</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{document.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">Diperbarui {new Date(document.updated_at).toLocaleString("id-ID")}</p>
              </div>
              <div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => editDocument(document)}><Pencil className="mr-2 h-4 w-4" />Edit</Button><Button variant="destructive" size="sm" onClick={() => deleteDocument(document)}><Trash2 className="mr-2 h-4 w-4" />Hapus</Button></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardLayout(RAGDocumentsPage);
