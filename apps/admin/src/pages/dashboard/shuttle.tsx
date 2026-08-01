import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/lib/api";
import { Loader2, Plus, Pencil, Trash2, Car, Download } from "lucide-react";
import { useSearchParams } from "react-router"; 
import DashboardLayout from "@/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CreateShuttleDialog from "../../components/shuttles/CreateShuttleDialog";
import ShuttleOrders from "../../components/shuttles/ShuttleOrders";
import { formatCurrency } from "@/lib/utils";
import PrivateCarOrders from "../../components/shuttles/PrivateCarOrders";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Tipe Data
interface Shuttle {
  id?: number;
  event_id: number;
  route_name: string;
  departure_date: string;
  departure_time: string;
  terminal: string;
  price: number;
  quota: number;
}

interface ShuttleOrder {
  id: string;
  pic_name: string;
  pic_email: string;
  Shuttle: Shuttle;
  qty: number;
  total_amount: number;
  status: string;
  payment_method: string;
  created_at: string;
}

interface BalanceLog {
  id: number;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

const initialShuttleForm: Shuttle = {
  event_id: import.meta.env.VITE_EVENT_ID,
  route_name: "",
  departure_date: dayjs().format("YYYY-MM-DD"),
  departure_time: "09:00",
  terminal: "",
  price: 0,
  quota: 0,
};

interface PrivateCarOrder {
  id: string;
  pic_name: string;
  pic_email: string;
  pic_phone: string;
  pick_up_point: string;
  pick_up_date: string;
  duration_days: number;
  total_amount: number;
  status: string;
  created_at: string;
}

function ShuttlePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "orders"; // Default tab adalah 'orders'
  const [orders, setOrders] = useState<ShuttleOrder[]>([]);
  const [balances, setBalances] = useState<BalanceLog[]>([]);
  const [shuttles, setShuttles] = useState<Shuttle[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total_pages: 1, total_data: 0 });
  const [summary, setSummary] = useState({ total_paid_orders: 0, total_nominal: 0 });
const [carOrders, setCarOrders] = useState<PrivateCarOrder[]>([]);
  const [carSearch, setCarSearch] = useState("");
  const [carPage, setCarPage] = useState(1);
  const [carMeta, setCarMeta] = useState({ total_pages: 1, total_data: 0 });
  const [carSummary, setCarSummary] = useState({ total_paid_orders: 0, total_nominal: 0 });
  const [loadingCars, setLoadingCars] = useState(false);
  // State CRUD
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<Shuttle>(initialShuttleForm);
const [isExporting, setIsExporting] = useState(false); 

// Tambahkan ini di bagian deklarasi state
const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
const [selectedShuttleIdToDelete, setSelectedShuttleIdToDelete] = useState<string | null>(null);
const [isDeleting, setIsDeleting] = useState(false);

const [statusFilter, setStatusFilter] = useState("");
const [carStatusFilter, setCarStatusFilter] = useState("");

// 1. Tab Orders (Shuttle)
  useEffect(() => {
    if (activeTab !== "orders") return;
    const timeoutId = setTimeout(() => { fetchOrders(); }, 500);
    return () => clearTimeout(timeoutId);
  }, [activeTab, page, search, statusFilter]); 

  // 2. Tab Cars (Sewa Mobil)
  useEffect(() => {
    if (activeTab !== "cars") return;
    const timeoutId = setTimeout(() => { fetchCarOrders(); }, 500);
    return () => clearTimeout(timeoutId);
  }, [activeTab, carPage, carSearch, carStatusFilter]);

  // 3. Tab Balances
  useEffect(() => {
    if (activeTab !== "balances") return;
    fetchBalances();
  }, [activeTab]);

  // 4. Tab Schedules
  useEffect(() => {
    if (activeTab !== "schedules") return;
    fetchShuttles();
  }, [activeTab]);
  
  const fetchCarOrders = async () => {
    setLoadingCars(true);
    try {
      const response = await api.get("/private-car", { params: { page: carPage, limit: 10, search: carSearch, status: carStatusFilter } });
      setCarOrders(response.data.data || []);
      setCarSummary(response.data.summary || { total_paid_orders: 0, total_nominal: 0 });
      setCarMeta(response.data.meta || { total_pages: 1, total_data: 0 });
    } catch (error) { toast.error("Gagal memuat data penyewaan mobil"); } finally { setLoadingCars(false); }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get("/hello/shuttles/orders", { params: { page: page, limit: 10, search: search, status: statusFilter } });
      setOrders(response.data.data || []);
      setSummary(response.data.summary || { total_paid_orders: 0, total_nominal: 0 });
      setMeta(response.data.meta || { total_pages: 1, total_data: 0 });
    } catch (error) { toast.error("Gagal memuat data pesanan"); } finally { setLoading(false); }
  };

  const fetchBalances = async () => {
    setLoading(true);
    try {
      const response = await api.get("/hello/shuttles/balances");
      setBalances(response.data || []);
    } catch (error) { toast.error("Gagal memuat data mutasi saldo"); } finally { setLoading(false); }
  };

  const fetchShuttles = async () => {
    setLoading(true);
    try {
      const response = await api.get("/hello/shuttles/list");
      setShuttles(response.data || []);
    } catch (error) { toast.error("Gagal memuat jadwal shuttle"); } finally { setLoading(false); }
  };

const handleSaveShuttle = async (data: Shuttle) => {
  try {
    // Gunakan 'data' yang dikirim, BUKAN state 'form'
    if (data.id) {
      await api.put(`/hello/shuttles/${data.id}`, data);
      toast.success("Jadwal diperbarui");
    } else {
      await api.post("/hello/shuttles", data);
      toast.success("Jadwal ditambahkan");
    }
    setIsModalOpen(false);
    fetchShuttles();
  } catch (error) {
    toast.error("Gagal menyimpan jadwal");
  }
};

// Ganti fungsi handleDeleteShuttle yang lama dengan ini:

// Fungsi untuk membuka modal konfirmasi
const confirmDeleteShuttle = (id: string) => {
  setSelectedShuttleIdToDelete(id);
  setIsDeleteModalOpen(true);
};

// Fungsi untuk mengeksekusi penghapusan (dipanggil dari tombol di dalam modal)
const executeDeleteShuttle = async () => {
  if (!selectedShuttleIdToDelete) return;
  
  setIsDeleting(true);
  try {
    await api.delete(`/hello/shuttles/${selectedShuttleIdToDelete}`);
    toast.success("Jadwal dihapus");
    fetchShuttles();
    setIsDeleteModalOpen(false); // Tutup modal setelah berhasil
  } catch (error) {
    toast.error("Gagal menghapus jadwal");
  } finally {
    setIsDeleting(false);
    setSelectedShuttleIdToDelete(null); // Reset ID
  }
};

  const openEditModal = (s: Shuttle) => {
    setForm(s);
    setIsModalOpen(true);
  };

const handleDownloadExcel = async () => {
    setIsExporting(true);
    toast.info("Sedang menyiapkan file Excel...");
    
    try {
      // Pastikan path endpoint disesuaikan dengan routing Go Anda
      // Gunakan responseType: 'blob' sangat penting untuk file biner!
      const response = await api.get("/shuttles/export?status=PAID", {
        responseType: "blob", 
      });

      // Membuat URL Blob dari response data
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Mencoba mengambil nama file dari header Content-Disposition (jika dikirim oleh backend)
      const contentDisposition = response.headers["content-disposition"];
      let fileName = "Shuttle_Orders.xlsx"; // Default fallback
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (fileNameMatch && fileNameMatch.length === 2) {
          fileName = fileNameMatch[1];
        }
      }

      // Memicu klik untuk download
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();

      // Membersihkan DOM
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("Berhasil mengunduh Excel");
    } catch (error) {
      toast.error("Gagal mengunduh file Excel");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };
  return (
    <div className="p-6 space-y-6 bg-white rounded-lg shadow-sm border">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Shuttle</h2>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={(val) => setSearchParams({ tab: val })} 
        className="w-full"
      >
                <TabsList className="grid w-full grid-cols-1 md:grid-cols-4 max-w-xl">
          <TabsTrigger value="orders">Shuttle</TabsTrigger>
          <TabsTrigger value="cars">Sewa Mobil</TabsTrigger>
          <TabsTrigger value="balances">Mutasi Saldo</TabsTrigger>
          <TabsTrigger value="schedules">Kelola Jadwal</TabsTrigger>
        </TabsList>

        {/* Tab Pesanan & Mutasi Saldo tetap sama seperti sebelumnya... */}
<TabsContent value="orders" className="mt-6 space-y-4">
  {/* Summary Cards */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <div className="bg-white border p-4 rounded-xl shadow-sm">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Nominal (PAID)</p>
      <p className="text-2xl font-bold text-green-600 mt-1">
        {formatCurrency(summary.total_nominal)}
      </p>
    </div>
    <div className="bg-white border p-4 rounded-xl shadow-sm">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Order PAID</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">
        {summary.total_paid_orders} Tiket
      </p>
    </div>
  </div>

  {/* Search Bar */}
  <div className="flex justify-between items-center mb-4">
<div className="flex w-full max-w-md gap-2">
    <Input 
      placeholder="Cari nama pemesan..." 
      value={search}
      onChange={(e) => {
        setSearch(e.target.value);
        setPage(1); 
      }}
      className="bg-white flex-1"
    />
    
    {/* Shadcn UI Select */}
    <Select
      value={statusFilter || "ALL"} // Fallback ke "ALL" jika state kosong
      onValueChange={(value) => {
        setStatusFilter(value === "ALL" ? "" : value);
        setPage(1);
      }}
    >
      <SelectTrigger className="w-[150px] bg-white">
        <SelectValue placeholder="Semua Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">Semua Status</SelectItem>
        <SelectItem value="PAID">PAID</SelectItem>
        <SelectItem value="PENDING">PENDING</SelectItem>
        <SelectItem value="EXPIRED">EXPIRED</SelectItem>
        <SelectItem value="FAILED">FAILED</SelectItem>
      </SelectContent>
    </Select>
  </div>
<Button 
    variant="outline" 
    className="border-green-600 text-green-700 hover:bg-green-50"
    onClick={handleDownloadExcel}
    disabled={isExporting}
  >
    {isExporting ? (
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
    ) : (
      <Download className="w-4 h-4 mr-2" />
    )}
    Export Excel
  </Button>
  </div>

  {/* Komponen List Order Kamu Sebelumnya */}
  <ShuttleOrders orders={orders} loading={loading} />

  {/* Pagination Control */}
  <div className="flex justify-between items-center mt-4">
    <p className="text-sm text-gray-500">
      Total {meta.total_data} data
    </p>
    <div className="flex gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        disabled={page === 1 || loading}
      >
        Prev
      </Button>
      <span className="flex items-center text-sm font-medium px-2">
        Page {page} of {meta.total_pages}
      </span>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
        disabled={page >= meta.total_pages || loading}
      >
        Next
      </Button>
    </div>
  </div>
</TabsContent>

        <TabsContent value="balances" className="mt-6">
            <div className="border rounded-md overflow-hidden text-sm">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead>Waktu</TableHead>
                            <TableHead>Deskripsi</TableHead>
                            <TableHead className="text-right">Nominal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {
                          balances.length === 0 && !loading && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                                Belum ada mutasi saldo.
                              </TableCell>
                            </TableRow>
                          )
                        }
                        {balances.map((b) => (
                        <TableRow key={b.id}>
                            <TableCell className="text-xs">{dayjs(b.created_at).format("DD/MM/YY HH:mm")}</TableCell>
                            <TableCell>{b.description}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                            + { formatCurrency(b.system_amount)}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </TabsContent>

        {/* TAB BARU: KELOLA JADWAL (CRUD) */}
        <TabsContent value="schedules" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setForm(initialShuttleForm); setIsModalOpen(true); }} className="bg-blue-600">
              <Plus className="w-4 h-4 mr-2" /> Tambah Jadwal
            </Button>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Rute & Terminal</TableHead>
                  <TableHead>Keberangkatan</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Kuota</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shuttles.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-semibold">{s.route_name}</div>
                      <div className="text-xs text-muted-foreground">{s.terminal || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{dayjs(s.departure_date).format("DD MMM YYYY")}</div>
                      <div className="text-xs font-mono text-blue-600">{s.departure_time} WIB</div>
                    </TableCell>
                    <TableCell>Rp {s.price?.toLocaleString("id-ID")}</TableCell>
                    <TableCell>{s.quota}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(s)}>
                        <Pencil className="w-4 h-4 text-amber-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => confirmDeleteShuttle(s.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

{/* --- TAB BARU UNTUK PRIVATE CAR --- */}
<TabsContent value="cars" className="mt-6 space-y-4">
          
          {/* Summary Cards untuk Private Car */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border p-4 rounded-xl shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Nominal (PAID)</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(carSummary.total_nominal)}
              </p>
            </div>
            <div className="bg-white border p-4 rounded-xl shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Sewa PAID</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {carSummary.total_paid_orders} Transaksi
              </p>
            </div>
          </div>

          {/* Search Bar Private Car */}
          <div className="flex justify-between items-center mb-4">
<div className="flex w-full max-w-md gap-2">
    <Input 
      placeholder="Cari email penyewa..." 
      value={carSearch}
      onChange={(e) => {
        setCarSearch(e.target.value);
        setCarPage(1);
      }}
      className="bg-white flex-1"
    />
    
    {/* Shadcn UI Select */}
    <Select
      value={carStatusFilter || "ALL"}
      onValueChange={(value) => {
        setCarStatusFilter(value === "ALL" ? "" : value);
        setCarPage(1);
      }}
    >
      <SelectTrigger className="w-[150px] bg-white">
        <SelectValue placeholder="Semua Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">Semua Status</SelectItem>
        <SelectItem value="PAID">PAID</SelectItem>
        <SelectItem value="PENDING">PENDING</SelectItem>
        <SelectItem value="EXPIRED">EXPIRED</SelectItem>
        <SelectItem value="FAILED">FAILED</SelectItem>
      </SelectContent>
    </Select>
  </div>
          </div>

          {/* PANGGIL KOMPONEN PRIVATE CAR DI SINI */}
          <PrivateCarOrders orders={carOrders} loading={loadingCars} />

          {/* Pagination Control Private Car */}
          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-gray-500">
              Total {carMeta.total_data} transaksi
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" size="sm" 
                onClick={() => setCarPage((p) => Math.max(1, p - 1))}
                disabled={carPage === 1 || loadingCars}
              >Prev</Button>
              <span className="flex items-center text-sm font-medium px-2">
                Page {carPage} of {carMeta.total_pages}
              </span>
              <Button 
                variant="outline" size="sm" 
                onClick={() => setCarPage((p) => Math.min(carMeta.total_pages, p + 1))}
                disabled={carPage >= carMeta.total_pages || loadingCars}
              >Next</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <CreateShuttleDialog
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        form={form}
        setForm={setForm}
        handleSaveShuttle={handleSaveShuttle}
      />

{/* Letakkan ini sebelum tag penutup </div> terakhir */}
<Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle className="text-red-600 flex items-center gap-2">
        <Trash2 className="w-5 h-5" />
        Hapus Jadwal
      </DialogTitle>
    </DialogHeader>
    <div className="py-4">
      <p className="text-gray-600 text-sm">
        Apakah kamu yakin ingin menghapus jadwal ini? Tindakan ini tidak dapat dibatalkan.
      </p>
    </div>
    <DialogFooter>
      <Button 
        variant="outline" 
        onClick={() => setIsDeleteModalOpen(false)}
        disabled={isDeleting}
      >
        Batal
      </Button>
      <Button 
        variant="destructive" 
        onClick={executeDeleteShuttle}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Menghapus...
          </>
        ) : (
          "Ya, Hapus"
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
    </div>
  );
}

export default DashboardLayout(ShuttlePage);