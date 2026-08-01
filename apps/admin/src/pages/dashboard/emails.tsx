import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import EmailTemplateFormDialog from "@/components/email/EmailTemplateFormDialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus, Eye, Search, Loader2 } from "lucide-react";
import DashboardLayout from "../../layout/DashboardLayout";
import api from "@/lib/api";


// --- Main Component ---
const DEFAULT_BODY = `<!DOCTYPE html>
<html>
<head><style>body{font-family:sans-serif;}</style></head>
<body>
    <h2>Halo {{.Name}},</h2>
    <p>Ini adalah template default.</p>
</body>
</html>`;

export function EmailTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pagination, setPagination] = useState({ last_page: 1, total: 0 });

  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State Form (Ditambahkan field 'type')
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    from_email: "",
    type: "", // Default empty
    body: DEFAULT_BODY,
    tencent_template_id: "",
    logo_path: "",
  });

  useEffect(() => {
    fetchTemplates(page, search, statusFilter);
  }, [page]);

  const fetchTemplates = async (p, s, st) => {
    setLoading(true);
    try {
      const res = await api.get("/templates", {
        params: { page: p, limit: 10, search: s, status: st },
      });
      setTemplates(res.data.data || []);
      setPagination(res.data.meta);
    } catch (error) {
      toast.error("Gagal memuat data template");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validasi input
    if (!formData.name || !formData.subject || !formData.body || !formData.type) {
      toast.warning("Mohon lengkapi Nama, Subject, Tipe, dan Body");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        tencent_template_id: formData.tencent_template_id ? String(formData.tencent_template_id) : ""
      };

      if (formData.id) {
        await api.put(`/templates/${formData.id}`, payload);
        toast.success("Template berhasil diperbarui");
      } else {
        await api.post("/templates", payload);
        toast.success("Template berhasil dibuat");
      }
      setIsOpen(false);
      fetchTemplates(page, search, statusFilter);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || "Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Apakah Anda yakin ingin menghapus template ini?")) {
      try {
        await api.delete(`/templates/${id}`);
        toast.success("Template dihapus");
        fetchTemplates(page, search, statusFilter);
      } catch (error) {
        toast.error("Gagal menghapus data");
      }
    }
  };

  const openEdit = (t) => {
    setFormData({
      id: t.id,
      name: t.name,
      subject: t.subject,
      type: t.type, // Load type dari existing data
      body: t.body,
      tencent_template_id: t.tencent_template_id,
      template_status: t.template_status,
      from_email: t.from_address || "",
      logo_path: t.logo_path,
    });
    setIsOpen(true);
  };

  const resetForm = () =>
    setFormData({
      name: "",
      subject: "",
      type: "",
      body: DEFAULT_BODY,
      tencent_template_id: "",
      from_email: "",
      logo_path: ""
    });

  const handleOpenChange = (val) => {
    setIsOpen(val);
    if (!val) resetForm(); // Reset saat dialog ditutup
  };

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
        <p className="text-muted-foreground">
          Kelola layout dan konten email sistem.
        </p>
      </header>

      {/* Control Bar */}
      <div className="bg-card p-4 rounded-lg shadow-sm mb-6 border">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau subject..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Button
            onClick={() => {
              resetForm();
              setIsOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Template Baru
          </Button>
        </div>
      </div>

      {/* Component Dialog (Terpisah) */}
      <EmailTemplateFormDialog
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      {/* Table Content */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="w-[200px]">Nama</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tencent ID</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[100px] text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  Tidak ada template ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-slate-600 truncate max-w-xs">
                    {t.subject}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {t.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {t.tencent_template_id}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.template_status === "APPROVED"
                          ? "default"
                          : "secondary"
                      }
                      className={
                        t.template_status === "APPROVED"
                          ? "bg-green-600 hover:bg-green-700"
                          : t.template_status === "REJECTED"
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : ""
                      }
                    >
                      {t.template_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-blue-600"
                        onClick={() => openEdit(t)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:bg-red-50"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination?.last_page > 1 && (
        <div className="flex justify-end">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={
                    page === 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>

              {getPaginationRange(page, pagination.last_page).map((p, idx) =>
                p === "..." ? (
                  <PaginationItem key={`ell-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={page === p}
                      onClick={() => setPage(p)}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setPage((p) => Math.min(pagination.last_page, p + 1))
                  }
                  className={
                    page === pagination.last_page
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

export default DashboardLayout(EmailTemplateManager);
