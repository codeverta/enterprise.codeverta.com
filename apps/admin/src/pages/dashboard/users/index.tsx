import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import UserFormDialog from "@/components/crud/users/UserFormDialog";
import {
  Ban,
  Building2,
  Edit,
  ExternalLink,
  Eye,
  Loader2,
  Mail,
  MoreHorizontal,
  Power,
  PlusCircle,
  Search,
  ShieldAlert,
  Trash2,
  UserX,
  UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, Copy, CheckCircle } from "lucide-react"; // Pastikan lucide-react terinstall
import UserDetailDialog from "../../../components/crud/users/UserDetailDialog";
import { beginImpersonation } from "@/lib/impersonation";

const ROLE_OPTIONS = [
  { label: "Semua Role", value: "" },
  { label: "Merchant", value: "10" },
  { label: "Partner", value: "20" },
  { label: "Mentor", value: "30" },
  { label: "Admin", value: "99" },
];

const roleLabel = (roleNumber) => {
  if (roleNumber === 10) return "Merchant";
  if (roleNumber === 20) return "Partner";
  if (roleNumber === 30) return "Mentor Internal";
  if (roleNumber === 40) return "Mentor Eksternal";
  if (roleNumber === 99) return "Admin";
  return "User";
};

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(amount || 0));

const statusBadge = (status) => {
  const s = Number(status);
  if (s === 2) {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Inactive</Badge>;
  }
  if (s === 3) {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
  }
  if (s === 4) {
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Pending Approval</Badge>;
  }
  return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>;
};


  const CopyableText = ({ id }: { id: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset icon setelah 2 detik
      } catch (err) {
        console.error("Gagal menyalin text: ", err);
      }
    };

    return (
      <div
        onClick={handleCopy}
        className="group flex max-w-[140px] cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 font-mono text-xs hover:bg-muted"
        title="Klik untuk menyalin"
      >
        <span className="truncate">{id}</span>
        <span className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </span>
      </div>
    );
  };

const paymentStatusBadge = (status) => {
  const value = String(status || "").toLowerCase();
  if (value === "paid") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">paid</Badge>;
  if (value === "pending") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">pending</Badge>;
  if (["failed", "expired", "cancelled"].includes(value)) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{value}</Badge>;
  return <Badge variant="outline">{value || "-"}</Badge>;
};

function InfoRow({ label, value }) {
  return (
    <div className="grid gap-1 rounded-md border bg-muted/20 p-3 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="break-words font-medium text-foreground">{value || "-"}</span>
    </div>
  );
}

function UserManagementPage({ user, onlineUsers = [] }) {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Debounce search: wait 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [roleFilter, setRoleFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [impersonationTarget, setImpersonationTarget] = useState(null);
  const [impersonationReason, setImpersonationReason] = useState("");
  const [impersonationLoading, setImpersonationLoading] = useState(false);

  // Org assignment state
  const [auditLogs, setAuditLogs] = useState([]);
  const [onlineFilter, setOnlineFilter] = useState(false);
  const [sortOrder, setSortOrder] = useState("newest");

  const isAdmin = Number(user?.role || 0) >= 99;

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const response = await api.get("/users", {
        params: {
          page: currentPage,
          limit: pagination.limit,
          search: searchTerm || undefined,
          role: roleFilter || undefined,
          online: onlineFilter ? "true" : undefined,
          sort: sortOrder,
        },
      });
      setUsers(response.data.data || []);
      setPagination((prev) => ({
        ...prev,
        ...(response.data.pagination || {}),
      }));
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error(error.response?.data?.message || "Gagal memuat data pengguna.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, roleFilter, searchTerm, onlineFilter, sortOrder, isAdmin]);

  const totalPages = useMemo(
    () => Math.max(1, Number(pagination.total_pages || 1)),
    [pagination.total_pages]
  );

  const handleSaveUser = async (formData) => {
    const isEditing = !!editingUser;
    const toastId = toast.loading(isEditing ? "Memperbarui pengguna..." : "Menambahkan pengguna...");

    try {
      const response = isEditing
        ? await api.put(`/users/${editingUser.id}`, formData)
        : await api.post("/users", formData);

      toast.success(
        response.data.message || `Pengguna berhasil ${isEditing ? "diperbarui" : "ditambahkan"}.`,
        { id: toastId }
      );

      setIsFormOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        `Gagal ${isEditing ? "memperbarui" : "menambahkan"} pengguna.`;
      toast.error(errorMessage, { id: toastId });
    }
  };

  const handleDeleteUser = async (userId) => {
    const toastId = toast.loading("Menghapus pengguna...");
    try {
      await api.delete(`/users/${userId}`);
      toast.success("Pengguna berhasil dihapus.", { id: toastId });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Gagal menghapus pengguna.", { id: toastId });
    }
  };

  const handleApproveUser = async (userId) => {
    const toastId = toast.loading("Menyetujui pengguna...");
    try {
      await api.put(`/users/${userId}/approve`);
      toast.success("Pengguna berhasil disetujui, email aktivasi telah dikirim.", { id: toastId });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menyetujui pengguna.", { id: toastId });
    }
  };

  const handleResendActivation = async (userId) => {
    const toastId = toast.loading("Mengirim ulang email aktivasi...");
    try {
      await api.put(`/users/${userId}/resend-activation`);
      toast.success("Email aktivasi berhasil dikirim ulang.", { id: toastId });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal mengirim ulang aktivasi.", { id: toastId });
    }
  };

  const openUserDetail = async (userId) => {
    setSelectedUserId(userId);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const response = await api.get(`/users/${userId}/detail`);
      setUserDetail(response.data.data || null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Gagal memuat detail user.");
      setUserDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openUserEdit = async (item) => {
    const toastId = toast.loading("Memuat profil pengguna...");
    try {
      const response = await api.get(`/users/${item.id}/detail`);
      const detail = response.data?.data || {};
      setEditingUser({
        ...item,
        ...(detail.account || {}),
        profile: detail.profile || {},
      });
      setIsFormOpen(true);
      toast.dismiss(toastId);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Gagal memuat profil pengguna.",
        { id: toastId }
      );
    }
  };

  const refreshUserDetail = async () => {
    if (!selectedUserId) return;
    await openUserDetail(selectedUserId);
    fetchUsers();
  };

  const changeUserStatus = async () => {
    if (!statusTarget || !userDetail?.account) return;
    setStatusLoading(true);
    try {
      await api.put(`/users/${userDetail.account.id}/status`, {
        status: statusTarget.status,
      });
      toast.success(statusTarget.status === 2 ? "Akun dinonaktifkan." : "Akun diaktifkan kembali.");
      setStatusTarget(null);
      await refreshUserDetail();
    } catch (error) {
      toast.error(error.response?.data?.message || "Gagal memperbarui status user.");
    } finally {
      setStatusLoading(false);
    }
  };

  const startImpersonation = async () => {
    if (!impersonationTarget || !impersonationReason.trim()) return;
    setImpersonationLoading(true);
    try {
      const response = await api.post(`/users/${impersonationTarget.id}/impersonate`, {
        reason: impersonationReason.trim(),
      });
      const data = response.data?.data || response.data;
      beginImpersonation(data);
      toast.success(`Masuk sebagai ${data.user?.display_name || data.user?.username}.`);
      window.location.assign("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Gagal memulai impersonasi.");
      setImpersonationLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border bg-background text-center">
          <ShieldAlert className="mb-3 h-10 w-10 text-red-500" />
          <h1 className="text-xl font-semibold">Khusus Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Halaman daftar users hanya bisa diakses oleh admin.
          </p>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="container mx-auto min-h-screen p-4 text-foreground md:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Daftar Users</h1>
              {onlineUsers.length > 0 && (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 flex items-center gap-1.5 py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  {onlineUsers.length} Online
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Lihat semua user: mentor, partner, merchant, dan admin.
            </p>
          </div>

          <Button
            onClick={() => {
              setEditingUser(null);
              setIsFormOpen(true);
            }}
            className="w-full md:w-auto"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Tambah User
          </Button>
        </header>

        <div className="mb-6 flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau email..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(value) => {
              setRoleFilter(value === "all" ? "" : value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px] h-10">
              <SelectValue placeholder="Pilih Role" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value || "all"}
                  value={option.value || "all"}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={onlineFilter ? "online" : "all"}
            onValueChange={(value) => {
              setOnlineFilter(value === "online");
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[160px] h-10">
              <SelectValue placeholder="Status Koneksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="online">Sedang Online</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortOrder}
            onValueChange={(value) => {
              setSortOrder(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px] h-10">
              <SelectValue placeholder="Urutkan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">User Baru</SelectItem>
              <SelectItem value="active">Terakhir Aktif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Subscription Aktif</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login / Active</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Tanggal Bergabung
                </TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Memuat data...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length > 0 ? (
                users.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openUserDetail(item.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="truncate max-w-[200px]">{item.display_name || item.username || "-"}</div>
                        {onlineUsers.some((ou) => ou.id === item.id) && (
                          <span className="relative flex h-2 w-2" title="Online">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                      </div>
                      {(item.display_name && item.username && item.display_name !== item.username) && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">@{item.username}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.email || "-"}
                    </TableCell>
                    <TableCell className="flex flex-wrap gap-1">
                      <Badge variant="secondary">{roleLabel(item.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.active_subscription && item.active_subscription !== "-" ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-250 w-fit">
                            {item.active_subscription}
                          </Badge>
                          {item.subscription_expiry && item.subscription_expiry !== "-" && (
                            <span className="text-[10px] text-amber-600 font-medium">
                              Habis: {formatDate(item.subscription_expiry)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(item.last_login)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {formatDate(item.created_at)}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {item.email?.includes("root") ? null : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Buka menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => openUserDetail(item.id)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Detail
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openUserEdit(item)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Ubah
                            </DropdownMenuItem>
                            {Number(item.status) === 1 && Number(item.role) < Number(user?.role || 0) && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setImpersonationTarget(item);
                                  setImpersonationReason("");
                                }}
                                className="text-amber-700 focus:bg-amber-50 focus:text-amber-800"
                              >
                                <UserRoundCog className="mr-2 h-4 w-4" />
                                Masuk sebagai user
                              </DropdownMenuItem>
                            )}
                            {item.status === 4 && (
                              <DropdownMenuItem
                                onClick={() => handleApproveUser(item.id)}
                                className="bg-emerald-50 text-emerald-700 focus:bg-emerald-100 focus:text-emerald-700 font-semibold"
                              >
                                <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" />
                                Setujui User
                              </DropdownMenuItem>
                            )}
                            {[3, 4].includes(Number(item.status)) && (
                              <DropdownMenuItem
                                onClick={() => handleResendActivation(item.id)}
                                className="text-blue-700 focus:bg-blue-50 focus:text-blue-700"
                              >
                                <Mail className="mr-2 h-4 w-4" />
                                Kirim Ulang Aktivasi
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(event) => event.preventDefault()}
                                  className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Hapus
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Hapus user ini?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tindakan ini akan menghapus user secara
                                    permanen dari server.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(item.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Ya, Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <UserX className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <span>Tidak ada user ditemukan.</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>
            Total {pagination.total || 0} user, halaman {currentPage} dari{" "}
            {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || loading}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </div>

      <UserFormDialog
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        editingUser={editingUser}
        onSave={handleSaveUser}
      />

      <UserDetailDialog
        formatDateTime={formatDateTime}
        statusBadge={statusBadge}
        detailOpen={detailOpen}
        setIsOpen={setDetailOpen}
        userId={selectedUserId}
        userDetail={userDetail}
        loading={detailLoading}
        CopyableText={CopyableText}
        auditLogs={auditLogs}
        setDetailOpen={setDetailOpen}
        formatDate={formatDate}
        onRefresh={refreshUserDetail}
        formatCurrency={formatCurrency}
        paymentStatusBadge={paymentStatusBadge}
        onChangeStatus={(targetStatus) => {
          setStatusTarget({
            status: targetStatus,
            label:
              targetStatus === 2
                ? "Nonaktifkan akun ini?"
                : "Aktifkan kembali akun ini?",
          });
        }}
      />

      <AlertDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusTarget?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.status === 2
                ? "This will prevent the user from logging in and accessing the dashboard. Existing data remains visible to admins."
                : "This will allow the user to log in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={changeUserStatus}
              disabled={statusLoading}
            >
              {statusLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!impersonationTarget}
        onOpenChange={(open) => {
          if (!open && !impersonationLoading) {
            setImpersonationTarget(null);
            setImpersonationReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700">
              <UserRoundCog className="h-5 w-5" />
            </div>
            <DialogTitle>Masuk sebagai user ini?</DialogTitle>
            <DialogDescription>
              Anda akan melihat aplikasi menggunakan izin dan data milik {impersonationTarget?.display_name || impersonationTarget?.username}. Sesi ini dicatat untuk audit dan maksimal aktif selama 8 jam.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="impersonation-reason">Alasan debug</Label>
            <Textarea
              id="impersonation-reason"
              value={impersonationReason}
              onChange={(event) => setImpersonationReason(event.target.value)}
              placeholder="Contoh: Memeriksa course yang tidak muncul di dashboard partner"
              maxLength={500}
              rows={3}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Jangan mengubah data user kecuali memang diperlukan untuk proses debugging.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={impersonationLoading}
              onClick={() => setImpersonationTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={impersonationLoading || !impersonationReason.trim()}
              onClick={startImpersonation}
              className="bg-amber-700 text-white hover:bg-amber-800"
            >
              {impersonationLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserRoundCog className="mr-2 h-4 w-4" />
              )}
              Mulai impersonasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DashboardLayout(UserManagementPage);
