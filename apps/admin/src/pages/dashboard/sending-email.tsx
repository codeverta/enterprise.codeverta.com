import { useState, useEffect } from "react";
import DOMPurify from "dompurify"; // SECURITY: Mencegah XSS pada preview
import { toast } from "sonner"; // Rekomendasi library toast
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus, Eye, Search, Loader2 } from "lucide-react";
import DashboardLayout from "../../layout/DashboardLayout";
import api from "@/lib/api";
import BulkEmailDialog from "../../components/BulkEmailParticipant";
import dayjs from 'dayjs';

// --- Utility Functions ---
const getPaginationRange = (currentPage, lastPage) => {
  const delta = 2;
  const range = [];
  const start = Math.max(2, currentPage - delta);
  const end = Math.min(lastPage - 1, currentPage + delta);

  range.push(1);
  if (start > 2) range.push("...");
  for (let i = start; i <= end; i++) range.push(i);
  if (end < lastPage - 1) range.push("...");
  if (lastPage > 1) range.push(lastPage);
  return range;
};

// --- Default Template ---
const DEFAULT_BODY = `<!DOCTYPE html>
<html>
<head><style>body{font-family:sans-serif;}</style></head>
<body>
    <h2>Halo {{.Name}},</h2>
    <p>Ini adalah template default.</p>
</body>
</html>`;

export function EmailTemplateManager() {
  // State Data
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  // State Filters & Pagination
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(""); // State untuk delay search
  const [eventFilter, setEventFilter] = useState("ALL"); // Ubah statusFilter jadi eventFilter
  const [pagination, setPagination] = useState({ last_page: 1, total: 0 });
  const [queueStatus, setQueueStatus] = useState({ pending: 0, isProcessing: false });

  // 1. Debounce Effect: Delay search 500ms agar server tidak berat
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset ke halaman 1 saat search berubah
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // 2. Fetch Trigger: Jalan saat page, debouncedSearch, atau filter berubah
  useEffect(() => {
    fetchTemplates(page, debouncedSearch, eventFilter);
  }, [page, debouncedSearch, eventFilter]);

  const fetchTemplates = async (p, s, e) => {
    setLoading(true);
    try {
      const res = await api.get("/ses-logs", {
        params: { 
            page: p, 
            limit: 10, 
            search: s, // Kirim param search
            event: e === "ALL" ? "" : e // Kirim param event
        },
      });
      setTemplates(res.data.data || []);
      setPagination(res.data.meta);

      setQueueStatus({
        pending: res.data.meta.queue_pending || 0,
        isProcessing: res.data.meta.is_processing || false
      });
    } catch (error) {
      toast.error("Gagal memuat data log");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Log Email SES</h1>
        <p className="text-muted-foreground">
          Monitor status pengiriman email.
        </p>
      </header>

      {/* --- BAGIAN FILTER & SEARCH --- */}
      <div className="bg-card p-4 rounded-lg shadow-sm mb-6 border">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Group Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Input Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Dropdown Filter Event */}
            <Select
              value={eventFilter}
              onValueChange={(val) => {
                setEventFilter(val);
                setPage(1); // Reset page saat filter ganti
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Event</SelectItem>
                <SelectItem value="Send">Send</SelectItem>
                <SelectItem value="delivered">Delivery</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Click">Click</SelectItem>
                <SelectItem value="Bounce">Bounce</SelectItem>
                <SelectItem value="Complaint">Complaint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <BulkEmailDialog isProcessing={queueStatus.isProcessing} />
        </div>
      </div>

      {queueStatus.isProcessing && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded relative mb-4 flex items-center gap-3 animate-pulse">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div>
            <p className="font-bold">Sedang Mengirim Email Massal</p>
            <p className="text-sm">
              Tersisa {queueStatus.pending} email dalam antrian. Data di tabel
              akan bertambah secara otomatis.
            </p>
          </div>
        </div>
      )}
      {/* --- TABEL CONTENT --- */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead>Event</TableHead>
              <TableHead>Email Tujuan</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Tanggal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-32 text-center text-muted-foreground"
                >
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-32 text-center text-muted-foreground"
                >
                  Tidak ada data ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    {/* Badge warna-warni sesuai status */}
                    <Badge
                      variant={
                        t.event === "Bounce" || t.event === "Complaint"
                          ? "destructive"
                          : t.event === "Delivery"
                          ? "default"
                          : t.event === "Open"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {t.event}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{t.email}</TableCell>
                  <TableCell className="text-slate-600 truncate max-w-xs">
                    {t.subject || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {dayjs.unix(t.timestamp).format("YYYY-MM-DD HH:mm")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- PAGINATION (Sama seperti sebelumnya) --- */}
      {pagination?.last_page > 1 && (
        <div className="flex justify-end mt-4">
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
