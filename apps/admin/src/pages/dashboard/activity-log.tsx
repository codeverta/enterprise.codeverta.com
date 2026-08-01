import { useState, useEffect } from "react";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import DashboardLayout from "../../layout/DashboardLayout";
import { Search, Eye } from "lucide-react";

const formatJSON = (val: any) => {
  if (!val) return "{}";
  let parsed = val;
  if (typeof val === "string") {
    try {
      parsed = JSON.parse(val);
    } catch (e) {
      return val;
    }
  }
  return JSON.stringify(parsed, null, 2);
};

const getPaginationRange = (currentPage: number, lastPage: number, delta = 2) => {
  const range = [];
  const start = Math.max(2, currentPage - delta);
  const end = Math.min(lastPage - 1, currentPage + delta);
  range.push(1);
  if (start > 2) range.push("...");
  for (let i = start; i <= end; i++) range.push(i);
  if (end < lastPage - 1) range.push("...");
  if (lastPage > 1 && !range.includes(lastPage)) range.push(lastPage);
  return range;
};

function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [logType, setLogType] = useState("audit");
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
  });

  // State untuk Filter
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // State untuk Detail Dialog
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, actionFilter, logType]);

  // Debounced log fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs(currentPage);
    }, 300);
    return () => clearTimeout(timer);
  }, [currentPage, search, actionFilter, logType]);

  const fetchLogs = async (page: number) => {
    setLoading(true);
    try {
      const endpoint = logType === "audit" ? "/system/audit-logs" : "/system/login-attempts";
      const response = await api.get(endpoint, {
        params: {
          page: page,
          limit: 10,
          search: search,
          ...(logType === "audit"
            ? { action: actionFilter }
            : { outcome: actionFilter === "ALL" ? "" : actionFilter.toLowerCase() }),
        },
      });

      const { data, meta } = response.data;
      setLogs(data);
      setPagination(meta);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.last_page) {
      setCurrentPage(page);
    }
  };

  const renderPagination = () => {
    const lastPage = pagination.last_page || 1;
    const range = getPaginationRange(currentPage, lastPage);

    return (
      <>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handlePageChange(currentPage - 1);
            }}
            className={
              currentPage === 1 ? "pointer-events-none opacity-50" : ""
            }
          />
        </PaginationItem>
        {range.map((page, index) =>
          page === "..." ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink
                href="#"
                isActive={page === currentPage}
                onClick={(e) => {
                  e.preventDefault();
                  handlePageChange(Number(page));
                }}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handlePageChange(currentPage + 1);
            }}
            className={
              currentPage === lastPage ? "pointer-events-none opacity-50" : ""
            }
          />
        </PaginationItem>
      </>
    );
  };

  return (
    <div className="container mx-auto py-8 p-4 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Daftar Aktivitas
          </h1>
          <p className="text-slate-500 mt-1">Pantau log aktivitas sistem.</p>
        </div>

        {/* Filter Section */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={logType} onValueChange={(value) => { setLogType(value); setActionFilter("ALL"); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="audit">Database Changes</SelectItem>
              <SelectItem value="login">Login Attempts</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari user, IP, atau tabel..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              {logType === "audit" ? (
                <>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[450px]">User & Action</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead className="w-[120px] text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center h-48 text-slate-500"
                  >
                    Tidak ada data ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="align-middle">
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-2 items-center">
                          <Badge
                            variant={
                              logType === "login"
                                ? log.success ? "default" : "destructive"
                                : log.action === "DELETE"
                                ? "destructive"
                                : "default"
                            }
                          >
                            {logType === "login" ? (log.success ? "SUCCESS" : "FAILED") : log.action}
                          </Badge>
                          <span className="text-xs font-mono text-slate-500">
                            {logType === "login" ? log.auth_method : log.table_name}
                          </span>
                        </div>
                        <div className="font-medium text-sm mt-1">
                          {log.user
                            ? log.user.email
                            : log.attempted_identifier || log.ip_address || "System"}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[350px]">
                          {logType === "login"
                            ? `IP: ${log.ip_address || "-"} · HTTP ${log.http_status}`
                            : `Record: ${log.record_id || "-"}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-middle text-slate-600 text-sm">
                      {logType === "login" ? new Date(log.created_at).toLocaleString("id-ID") : log.created_at}
                    </TableCell>
                    <TableCell className="align-middle text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-slate-100 rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                      >
                        <Eye className="h-4 w-4 text-slate-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Outside Card or Footer */}
      {!loading && pagination.last_page > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination>
            <PaginationContent>{renderPagination()}</PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="md:min-w-3xl rounded-2xl shadow-xl border border-gray-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Detail Aktivitas</DialogTitle>
            <DialogDescription>
              Informasi lengkap aktivitas sistem yang terpilih.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="mt-4 space-y-5">
              {logType === "login" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-400 block text-xs uppercase tracking-wider mb-1">User Identifier</span>
                      <span className="font-medium text-slate-800 break-all">{selectedLog.attempted_identifier || "-"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block text-xs uppercase tracking-wider mb-1">Status</span>
                      <Badge variant={selectedLog.success ? "default" : "destructive"}>
                        {selectedLog.success ? "SUCCESS" : "FAILED"}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block text-xs uppercase tracking-wider mb-1">IP Address</span>
                      <span className="font-mono text-slate-800">{selectedLog.ip_address || "-"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block text-xs uppercase tracking-wider mb-1">HTTP Status</span>
                      <span className="font-medium text-slate-800">{selectedLog.http_status || "-"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block text-xs uppercase tracking-wider mb-1">Metode Auth</span>
                      <span className="font-medium text-slate-800 uppercase">{selectedLog.auth_method || "-"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block text-xs uppercase tracking-wider mb-1">Waktu</span>
                      <span className="font-medium text-slate-800">{new Date(selectedLog.created_at).toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 text-sm block mb-1.5">User Agent</span>
                    <span className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 block break-all font-mono">
                      {selectedLog.user_agent || "-"}
                    </span>
                  </div>
                  {selectedLog.failure_reason && (
                    <div>
                      <span className="font-semibold text-slate-500 text-sm block mb-1.5">Failure Reason</span>
                      <span className="text-sm text-red-600 bg-red-50/50 p-3 rounded-xl border border-red-100 block">
                        {selectedLog.failure_reason}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-400 block text-xs uppercase tracking-wider mb-1">User Email</span>
                      <span className="font-medium text-slate-800">{selectedLog.user?.email || "System"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block text-xs uppercase tracking-wider mb-1">Action</span>
                      <Badge variant={selectedLog.action === "DELETE" ? "destructive" : "default"}>
                        {selectedLog.action}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block text-xs uppercase tracking-wider mb-1">Nama Tabel</span>
                      <span className="font-mono text-slate-800">{selectedLog.table_name || "-"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block text-xs uppercase tracking-wider mb-1">Record ID</span>
                      <span className="font-mono text-slate-800 break-all">{selectedLog.record_id || "-"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold text-slate-400 block text-xs uppercase tracking-wider mb-1">Waktu</span>
                      <span className="font-medium text-slate-800">{selectedLog.created_at}</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 text-sm block mb-1.5">Perubahan (Changes)</span>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800 max-h-[300px] shadow-inner">
                      {formatJSON(selectedLog.changes)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DashboardLayout(LogsPage);
