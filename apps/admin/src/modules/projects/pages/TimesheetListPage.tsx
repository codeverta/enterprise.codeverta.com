import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  timesheetApi,
  type Timesheet,
  type TimesheetOptions,
  type TimesheetStatus,
} from "../api";

export function TimesheetListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [options, setOptions] = useState<TimesheetOptions | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters from URL search params if present
  const initialStatus = searchParams.get("status") || "all";
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTimesheets = async () => {
    setLoading(true);
    try {
      const res = await timesheetApi.listTimesheets({
        status: statusFilter !== "all" ? statusFilter : undefined,
        employee_id: employeeFilter !== "all" ? employeeFilter : undefined,
        q: searchQuery || undefined,
      });
      setTimesheets(res.data.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Gagal memuat daftar timesheet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    timesheetApi.getTimesheetOptions().then((res) => setOptions(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchTimesheets();
  }, [statusFilter, employeeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTimesheets();
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    if (val === "all") searchParams.delete("status");
    else searchParams.set("status", val);
    setSearchParams(searchParams, { replace: true });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Yakin ingin menghapus timesheet "${id}"?`)) return;
    try {
      await timesheetApi.deleteTimesheet(id);
      toast.success("Timesheet berhasil dihapus");
      fetchTimesheets();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menghapus timesheet");
    }
  };

  const stats = useMemo(() => {
    const total = timesheets.length;
    const draftCount = timesheets.filter((t) => t.status === "Draft").length;
    const submittedCount = timesheets.filter((t) => t.status === "Submitted").length;
    const totalHours = Math.round(
      timesheets.reduce((sum, t) => sum + (t.total_working_hours || 0), 0) * 10
    ) / 10;
    return { total, draftCount, submittedCount, totalHours };
  }, [timesheets]);

  const getStatusBadge = (status: TimesheetStatus) => {
    switch (status) {
      case "Draft":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Draft</Badge>;
      case "Submitted":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Submitted</Badge>;
      case "Billed":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Billed</Badge>;
      case "Cancelled":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Timesheet</h1>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              Time Tracking
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Catatan jam kerja karyawan, log aktivitas proyek, dan rincian jam billable untuk penagihan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => navigate("/desk/timesheet/new")}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Plus className="size-4 mr-1.5" />
            New Timesheet
          </Button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Timesheets
            </span>
            <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
              <FileSpreadsheet className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-400 mt-0.5">Semua catatan waktu</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Draft
            </span>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900">{stats.draftCount}</p>
          <p className="text-xs text-amber-600/80 mt-0.5">Menunggu konfirmasi submit</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Submitted
            </span>
            <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-900">{stats.submittedCount}</p>
          <p className="text-xs text-blue-600/80 mt-0.5">Terkonfirmasi & siap dibill</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Total Hours
            </span>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{stats.totalHours} hrs</p>
          <p className="text-xs text-emerald-600/80 mt-0.5">Akumulasi jam kerja</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Cari ID timesheet, nama karyawan, project, atau customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                aria-label="Filter Status"
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Billed">Billed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Karyawan:</span>
              <select
                aria-label="Filter Karyawan"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="h-10 max-w-[200px] truncate rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Karyawan</option>
                {(options?.employees || []).map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={fetchTimesheets}
              className="h-10 rounded-xl border-slate-200 px-3"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </form>
      </div>

      {/* Timesheets Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Timesheet ID & Employee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Total Working Hrs</th>
                <th className="px-4 py-3">Billable Hrs</th>
                <th className="px-4 py-3">Billable Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto size-6 animate-spin text-blue-600 mb-2" />
                    Memuat daftar timesheet...
                  </td>
                </tr>
              ) : timesheets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Clock className="mx-auto size-8 text-slate-300 mb-2" />
                    Belum ada timesheet tercatat.
                  </td>
                </tr>
              ) : (
                timesheets.map((ts) => (
                  <tr key={ts.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/desk/timesheet/${encodeURIComponent(ts.id)}`)}
                        className="font-semibold text-slate-900 hover:text-blue-600 text-left block"
                      >
                        {ts.employee_name || "Timesheet"}
                      </button>
                      <span className="text-xs text-slate-400 font-mono">{ts.id}</span>
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(ts.status)}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{ts.company}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {ts.start_date ? ts.start_date.slice(0, 10) : "-"}
                      {ts.end_date && ts.end_date !== ts.start_date ? ` s/d ${ts.end_date.slice(0, 10)}` : ""}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {ts.total_working_hours} hrs
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {ts.total_billable_hours} hrs
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-700">
                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: ts.currency || "IDR", maximumFractionDigits: 0 }).format(ts.total_billable_amount || 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/desk/timesheet/${encodeURIComponent(ts.id)}`)}
                          className="h-8 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </Button>
                        {ts.status !== "Submitted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(ts.id)}
                            className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
  );
}

export default TimesheetListPage;
