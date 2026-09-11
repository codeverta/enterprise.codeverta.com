import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Fingerprint,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import {
  attendanceApi,
  type Attendance,
  type AttendanceOptions,
  type AttendanceStats,
  type AttendanceStatus,
} from "../api";

const todayStr = () => new Date().toISOString().split("T")[0];

export function AttendanceListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Attendance[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [options, setOptions] = useState<AttendanceOptions | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [query, setQuery] = useState("");

  // Mark Attendance Modal (Employee Attendance Tool)
  const [markModalOpen, setMarkModalOpen] = useState(false);
  const [markEmployeeId, setMarkEmployeeId] = useState("");
  const [markMonth, setMarkMonth] = useState(todayStr().slice(0, 7)); // YYYY-MM
  const [markStatus, setMarkStatus] = useState<AttendanceStatus>("Present");
  const [excludeHolidays, setExcludeHolidays] = useState(true);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [submittingBulk, setSubmittingBulk] = useState(false);

  // Check-in Terminal Modal (QR, Fingerprint, RFID)
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTab, setTerminalTab] = useState<"qr" | "fingerprint" | "rfid" | "manual">("qr");
  const [terminalIdentifier, setTerminalIdentifier] = useState("");
  const [terminalLogType, setTerminalLogType] = useState<"" | "IN" | "OUT">("");
  const [scanning, setScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{
    message: string;
    log_type: "IN" | "OUT";
    employee_name: string;
    timestamp: string;
    source: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, statsRes, optRes] = await Promise.all([
        attendanceApi.list({
          date: selectedDate || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          department: departmentFilter === "all" ? undefined : departmentFilter,
          q: query || undefined,
        }),
        attendanceApi.stats(),
        attendanceApi.options(),
      ]);
      setRows(listRes);
      setStats(statsRes);
      setOptions(optRes);
    } catch {
      toast.error("Gagal memuat data absensi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [selectedDate, statusFilter, departmentFilter]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Hapus data absensi ini?")) return;
    try {
      await attendanceApi.delete(id);
      toast.success("Data absensi berhasil dihapus");
      void loadData();
    } catch {
      toast.error("Gagal menghapus data absensi");
    }
  };

  // Helper for generating dates in selected month for Employee Attendance Tool
  useEffect(() => {
    if (!markMonth) return;
    const [year, month] = markMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dates: string[] = [];
    const today = new Date();

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      if (d <= today) {
        // Only past and today per Frappe HR rules (cannot mark future dates)
        const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (excludeHolidays) {
          const weekday = d.getDay();
          if (weekday !== 0 && weekday !== 6) {
            dates.push(dateString);
          }
        } else {
          dates.push(dateString);
        }
      }
    }
    setSelectedDates(dates);
  }, [markMonth, excludeHolidays]);

  const handleBulkSubmit = async () => {
    if (!markEmployeeId) {
      toast.error("Pilih karyawan terlebih dahulu");
      return;
    }
    if (selectedDates.length === 0) {
      toast.error("Pilih minimal satu tanggal absensi");
      return;
    }
    setSubmittingBulk(true);
    try {
      const res = await attendanceApi.markBulk({
        user_ids: [markEmployeeId],
        dates: selectedDates,
        status: markStatus,
        exclude_holidays: excludeHolidays,
      });
      toast.success(res.message);
      setMarkModalOpen(false);
      void loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal memproses absensi massal");
    } finally {
      setSubmittingBulk(false);
    }
  };

  const handleProcessScan = async (identifier: string, source: string) => {
    if (!identifier.trim()) {
      toast.error("Identifier scan tidak boleh kosong");
      return;
    }
    setScanning(true);
    try {
      const res = await attendanceApi.processScan({
        identifier,
        source,
        device_id: `${source} Scanner Terminal 01`,
        log_type: terminalLogType || undefined,
      });
      setLastScanResult({
        message: res.message,
        log_type: res.log_type,
        employee_name: res.employee.name,
        timestamp: new Date(res.checkin.timestamp).toLocaleTimeString("id-ID"),
        source,
      });
      toast.success(res.message);
      setTerminalIdentifier("");
      void loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Scan absensi gagal");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Attendance</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              Shift & Attendance
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Catatan kehadiran harian karyawan, absensi massal, dan check-in/out otomatis via QR, Fingerprint & RFID.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setTerminalOpen(true)}
            className="h-10 rounded-xl border-purple-200 bg-purple-50/60 text-purple-700 hover:bg-purple-100"
          >
            <QrCode className="size-4 mr-1.5" /> Terminal Check-in (QR / Biometric)
          </Button>

          <Button
            variant="outline"
            onClick={() => setMarkModalOpen(true)}
            className="h-10 rounded-xl border-blue-200 bg-blue-50/60 text-blue-700 hover:bg-blue-100"
          >
            <UserCheck className="size-4 mr-1.5" /> Mark Attendance (Tool)
          </Button>

          <Button
            onClick={() => navigate("/desk/attendance/new")}
            className="h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
          >
            <Plus className="size-4 mr-1.5" /> New Attendance
          </Button>
        </div>
      </header>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:p-5 shadow-xs flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Present Today</p>
            <p className="text-xl lg:text-2xl font-bold text-emerald-600 mt-0.5">
              {stats?.present_today || 0}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:p-5 shadow-xs flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Half Day</p>
            <p className="text-xl lg:text-2xl font-bold text-amber-600 mt-0.5">
              {stats?.half_day_today || 0}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:p-5 shadow-xs flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Users className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">On Leave</p>
            <p className="text-xl lg:text-2xl font-bold text-blue-600 mt-0.5">
              {stats?.on_leave_today || 0}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:p-5 shadow-xs flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <XCircle className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Absent</p>
            <p className="text-xl lg:text-2xl font-bold text-rose-600 mt-0.5">
              {stats?.absent_today || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void loadData()}
            placeholder="Cari karyawan, email..."
            className="h-10 pl-9 rounded-xl border-slate-200 bg-slate-50 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-slate-400 shrink-0" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs"
          />
          {selectedDate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate("")}
              className="h-8 text-xs text-slate-400 hover:text-slate-700"
            >
              Semua
            </Button>
          )}
        </div>

        <div>
          <ERPSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
          >
            <ERPSelectOption value="all">Semua Status</ERPSelectOption>
            <ERPSelectOption value="Present">Present (Hadir)</ERPSelectOption>
            <ERPSelectOption value="Half Day">Half Day (Setengah Hari)</ERPSelectOption>
            <ERPSelectOption value="On Leave">On Leave (Cuti/Izin)</ERPSelectOption>
            <ERPSelectOption value="Absent">Absent (Mangkir)</ERPSelectOption>
          </ERPSelect>
        </div>

        <div>
          <ERPSelect
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
          >
            <ERPSelectOption value="all">Semua Departemen</ERPSelectOption>
            {(options?.departments || []).map((dept) => (
              <ERPSelectOption key={dept} value={dept}>
                {dept}
              </ERPSelectOption>
            ))}
          </ERPSelect>
        </div>
      </div>

      {/* Attendance Data Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Karyawan (Employee)</th>
                <th className="p-4">Shift & Departemen</th>
                <th className="p-4 text-center">In / Out</th>
                <th className="p-4 text-center">Working Hours</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Source</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2" />
                    Memuat data Attendance...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    Tidak ada catatan kehadiran pada kriteria ini.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => navigate(`/desk/attendance/${row.id}`)}
                  >
                    <td className="p-4 font-semibold text-slate-900">
                      {new Date(row.attendance_date).toLocaleDateString("id-ID", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{row.employee_name}</div>
                      {row.employee_email && (
                        <p className="text-xs text-slate-400 mt-0.5">{row.employee_email}</p>
                      )}
                    </td>
                    <td className="p-4 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">{row.shift || "General Shift"}</div>
                      <p className="text-slate-400 mt-0.5">{row.department || "All Departments"}</p>
                    </td>
                    <td className="p-4 text-center text-xs">
                      <div className="inline-flex items-center gap-2">
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {row.in_time ? new Date(row.in_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                        </span>
                        <span className="text-slate-400">-</span>
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {row.out_time ? new Date(row.out_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center font-bold text-slate-800 text-xs">
                      {row.working_hours ? `${row.working_hours} hrs` : "-"}
                    </td>
                    <td className="p-4 text-center">
                      {row.status === "Present" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="size-3" /> Present
                        </span>
                      ) : row.status === "Half Day" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                          <Clock className="size-3" /> Half Day
                        </span>
                      ) : row.status === "On Leave" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                          On Leave
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                          <XCircle className="size-3" /> Absent
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <Badge variant="outline" className="text-[10px] bg-slate-50 font-medium">
                        {row.source || "Manual"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/desk/attendance/${row.id}`)}
                          className="h-8 text-xs text-blue-600 hover:text-blue-700"
                        >
                          Detail
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(row.id)}
                          className="h-8 text-xs text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Mark Attendance (Employee Attendance Tool) */}
      <Dialog open={markModalOpen} onOpenChange={setMarkModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="size-5 text-blue-600" />
              Employee Attendance Tool
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tandai kehadiran (Present, Absent, Half Day) untuk karyawan pada bulan tertentu per tanggal yang dipilih.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="text-xs font-semibold text-slate-700">Pilih Karyawan (Employee)</label>
              <select
                aria-label="Pilih Karyawan"
                value={markEmployeeId}
                onChange={(e) => setMarkEmployeeId(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Pilih Karyawan --</option>
                {(options?.employees || []).map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email || emp.username})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Pilih Bulan (Month)</label>
                <Input
                  type="month"
                  value={markMonth}
                  onChange={(e) => setMarkMonth(e.target.value)}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Status Kehadiran</label>
                <select
                  aria-label="Status Kehadiran"
                  value={markStatus}
                  onChange={(e) => setMarkStatus(e.target.value as AttendanceStatus)}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Present">Present (Hadir)</option>
                  <option value="Absent">Absent (Mangkir)</option>
                  <option value="Half Day">Half Day (Setengah Hari)</option>
                  <option value="On Leave">On Leave (Cuti)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="excludeHolidays"
                checked={excludeHolidays}
                onChange={(e) => setExcludeHolidays(e.target.checked)}
                className="rounded border-slate-300 size-4 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="excludeHolidays" className="text-xs text-slate-700 font-medium cursor-pointer">
                Exclude Holidays (Kecualikan hari Sabtu & Minggu)
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Tanggal yang Dipilih ({selectedDates.length} Hari)
                </label>
                <span className="text-[11px] text-slate-400">Maksimal sampai hari ini</span>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2.5 flex flex-wrap gap-1.5">
                {selectedDates.map((date) => (
                  <span
                    key={date}
                    className="inline-flex items-center rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200 shadow-2xs"
                  >
                    {date}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkModalOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={submittingBulk}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submittingBulk ? "Memproses..." : "Mark Attendance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Check-in Terminal (QR, Fingerprint, RFID) */}
      <Dialog open={terminalOpen} onOpenChange={setTerminalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="size-5 text-purple-600" />
              Attendance Scan Terminal (Kiosk)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Simulasi terminal absensi pintar menggunakan scanner QR Code, Biometrik Sidik Jari (Fingerprint), atau kartu RFID.
            </DialogDescription>
          </DialogHeader>

          {/* Terminal Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
            <button
              type="button"
              onClick={() => setTerminalTab("qr")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                terminalTab === "qr" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <QrCode className="size-3.5" /> QR Code
            </button>
            <button
              type="button"
              onClick={() => setTerminalTab("fingerprint")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                terminalTab === "fingerprint" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Fingerprint className="size-3.5" /> Fingerprint
            </button>
            <button
              type="button"
              onClick={() => setTerminalTab("rfid")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                terminalTab === "rfid" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Radio className="size-3.5" /> RFID Card
            </button>
            <button
              type="button"
              onClick={() => setTerminalTab("manual")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                terminalTab === "manual" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <SlidersHorizontal className="size-3.5" /> Manual ID
            </button>
          </div>

          <div className="space-y-4 py-2 text-center">
            {/* Mode selection IN / OUT */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Mode:</span>
              <button
                type="button"
                onClick={() => setTerminalLogType("")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  terminalLogType === "" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                Auto (Toggl IN/OUT)
              </button>
              <button
                type="button"
                onClick={() => setTerminalLogType("IN")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  terminalLogType === "IN" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                Force Check-IN
              </button>
              <button
                type="button"
                onClick={() => setTerminalLogType("OUT")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  terminalLogType === "OUT" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                Force Check-OUT
              </button>
            </div>

            {/* Visual simulation scanner container */}
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 flex flex-col items-center justify-center min-h-[220px]">
              {terminalTab === "qr" && (
                <div className="space-y-3">
                  <div className="size-28 border-2 border-purple-500 rounded-2xl p-2 bg-white mx-auto flex items-center justify-center shadow-xs animate-pulse">
                    <QrCode className="size-20 text-purple-600" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">
                    Arahkan kamera ke QR Code Badge Karyawan atau pilih karyawan di bawah:
                  </p>
                </div>
              )}

              {terminalTab === "fingerprint" && (
                <div className="space-y-3">
                  <div className="size-28 border-2 border-emerald-500 rounded-full p-2 bg-emerald-50/50 mx-auto flex items-center justify-center shadow-xs animate-pulse">
                    <Fingerprint className="size-16 text-emerald-600" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">
                    Sensor Biometrik aktif. Sentuhkan jari karyawan pada pemindai.
                  </p>
                </div>
              )}

              {terminalTab === "rfid" && (
                <div className="space-y-3">
                  <div className="size-28 border-2 border-blue-500 rounded-2xl p-2 bg-blue-50/50 mx-auto flex items-center justify-center shadow-xs animate-pulse">
                    <Radio className="size-16 text-blue-600" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">
                    Tempelkan kartu RFID / Smartcard karyawan pada terminal reader.
                  </p>
                </div>
              )}

              {terminalTab === "manual" && (
                <div className="w-full max-w-sm space-y-2 text-left">
                  <label className="text-xs font-semibold text-slate-700">ID Karyawan / Email / Username</label>
                  <div className="flex gap-2">
                    <Input
                      value={terminalIdentifier}
                      onChange={(e) => setTerminalIdentifier(e.target.value)}
                      placeholder="Masukkan ID / Email..."
                      className="h-10 rounded-xl bg-white"
                    />
                    <Button
                      onClick={() => void handleProcessScan(terminalIdentifier, "Manual")}
                      disabled={scanning || !terminalIdentifier.trim()}
                      className="h-10 rounded-xl"
                    >
                      Scan
                    </Button>
                  </div>
                </div>
              )}

              {/* Quick employee test buttons */}
              {terminalTab !== "manual" && (
                <div className="mt-4 w-full">
                  <p className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                    Simulasi Karyawan (Klik untuk Scan):
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 max-h-32 overflow-y-auto">
                    {(options?.employees || []).slice(0, 8).map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => void handleProcessScan(emp.email || emp.username || emp.id, terminalTab === "qr" ? "QR Code" : terminalTab === "fingerprint" ? "Fingerprint" : "RFID")}
                        disabled={scanning}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs hover:border-purple-300 hover:bg-purple-50 transition"
                      >
                        {emp.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Result alert */}
            {lastScanResult && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-left text-xs flex items-start gap-3">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-900">{lastScanResult.message}</p>
                  <p className="text-emerald-700 mt-0.5">
                    Karyawan: <strong>{lastScanResult.employee_name}</strong> · Waktu: <strong>{lastScanResult.timestamp}</strong> · Device: {lastScanResult.source}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminalOpen(false)}>
              Tutup Terminal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AttendanceListPage;
