import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Save,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import {
  attendanceApi,
  type Attendance,
  type AttendanceOptions,
  type AttendanceStatus,
} from "../api";

const todayStr = () => new Date().toISOString().split("T")[0];

const defaultAttendance = (): Partial<Attendance> => ({
  attendance_date: todayStr(),
  status: "Present",
  shift: "General Shift (08:00 - 17:00)",
  department: "Operational",
  source: "Manual",
  docstatus: 1,
  working_hours: 8,
  remarks: "",
});

export function AttendanceFormPage() {
  const params = useParams();
  const id = params.id || params["*"]?.split("/").filter(Boolean)[0];
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [record, setRecord] = useState<Partial<Attendance>>(defaultAttendance());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<AttendanceOptions | null>(null);

  const loadData = async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const data = await attendanceApi.get(id);
      setRecord(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal memuat detail Attendance");
      navigate("/desk/attendance");
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const opt = await attendanceApi.options();
      setOptions(opt);
    } catch {
      /* fallback */
    }
  };

  useEffect(() => {
    void loadOptions();
    if (!isNew && id) {
      void loadData();
    }
  }, [id, isNew]);

  const updateField = <K extends keyof Attendance>(key: K, value: Attendance[K]) => {
    setRecord((prev) => {
      const updated = { ...prev, [key]: value };
      // Recalculate working hours if in_time & out_time modified
      if (key === "in_time" || key === "out_time") {
        if (updated.in_time && updated.out_time) {
          const inT = new Date(updated.in_time).getTime();
          const outT = new Date(updated.out_time).getTime();
          if (outT > inT) {
            const diffHours = Math.round(((outT - inT) / (1000 * 60 * 60)) * 100) / 100;
            updated.working_hours = diffHours;
            if (diffHours < 4 && updated.status === "Present") {
              updated.status = "Half Day";
            }
          }
        }
      }
      return updated;
    });
  };

  const employeeSelectOptions: SearchableSelectOption[] = (options?.employees || []).map((emp) => ({
    value: emp.id,
    label: emp.name,
    sublabel: emp.email || emp.username,
  }));

  const handleEmployeeChange = (userId: string) => {
    const matched = options?.employees.find((e) => e.id === userId);
    setRecord((prev) => ({
      ...prev,
      user_id: userId,
      employee_name: matched?.name || "",
      employee_email: matched?.email || "",
    }));
  };

  const handleSave = async () => {
    if (!record.user_id && !record.employee_name) {
      toast.error("Employee wajib dipilih");
      return;
    }

    // Validation: future dates are prohibited
    if (record.attendance_date && record.attendance_date > todayStr()) {
      toast.error("Attendance cannot be marked for future dates (Absensi tidak dapat dibuat untuk tanggal masa depan)");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await attendanceApi.create(record);
        toast.success("Attendance berhasil dicatat!");
        navigate(`/desk/attendance/${created.id}`, { replace: true });
      } else {
        const updated = await attendanceApi.update(record.id!, record);
        toast.success("Attendance berhasil diperbarui!");
        setRecord(updated);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Attendance");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!record.id || isNew) return;
    if (!window.confirm("Hapus catatan absensi ini?")) return;
    try {
      await attendanceApi.delete(record.id);
      toast.success("Catatan absensi dihapus");
      navigate("/desk/attendance");
    } catch {
      toast.error("Gagal menghapus absensi");
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Memuat detail Attendance...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-7 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/desk/attendance")}
            className="h-10 w-10 rounded-xl"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                {isNew ? "New Attendance" : record.id}
              </h1>
              <Badge variant="outline" className="text-xs bg-slate-50">
                {record.status || "Present"}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Catatan kehadiran individual karyawan harian.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="h-10 w-10 rounded-xl text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
          >
            <Save className="size-4 mr-1.5" />
            {saving ? "Menyimpan..." : "Save Attendance"}
          </Button>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <UserCheck className="size-4 text-emerald-600" /> Detail Kehadiran Karyawan
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Employee Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Pilih Karyawan (Employee) *</label>
            <div className="mt-1">
              <SearchableSelect
                value={record.user_id || ""}
                options={employeeSelectOptions}
                onChange={handleEmployeeChange}
                placeholder="Pilih karyawan..."
                searchPlaceholder="Cari nama atau email karyawan..."
              />
            </div>
            {record.employee_name && (
              <p className="text-[11px] text-slate-500 mt-1">
                Karyawan: <strong>{record.employee_name}</strong> {record.employee_email ? `(${record.employee_email})` : ""}
              </p>
            )}
          </div>

          {/* Attendance Date */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Tanggal Kehadiran (Attendance Date) *</label>
            <Input
              type="date"
              max={todayStr()} // Cannot be marked for future dates
              value={record.attendance_date ? record.attendance_date.split("T")[0] : ""}
              onChange={(e) => updateField("attendance_date", e.target.value)}
              className="mt-1 h-10 rounded-xl"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              * Absensi tidak dapat dibuat untuk tanggal masa depan (future dates).
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Status Kehadiran *</label>
            <ERPSelect
              value={record.status || "Present"}
              onChange={(e) => updateField("status", e.target.value as AttendanceStatus)}
              className="mt-1 h-10 w-full rounded-xl border"
            >
              <ERPSelectOption value="Present">Present (Hadir)</ERPSelectOption>
              <ERPSelectOption value="Half Day">Half Day (Setengah Hari)</ERPSelectOption>
              <ERPSelectOption value="On Leave">On Leave (Cuti / Izin)</ERPSelectOption>
              <ERPSelectOption value="Absent">Absent (Mangkir)</ERPSelectOption>
            </ERPSelect>
          </div>

          {/* Shift */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Shift Kerja</label>
            <ERPSelect
              value={record.shift || "General Shift (08:00 - 17:00)"}
              onChange={(e) => updateField("shift", e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border"
            >
              {(options?.shifts || ["General Shift (08:00 - 17:00)", "Morning Shift (07:00 - 15:00)", "Afternoon Shift (15:00 - 23:00)"]).map((s) => (
                <ERPSelectOption key={s} value={s}>
                  {s}
                </ERPSelectOption>
              ))}
            </ERPSelect>
          </div>

          {/* In Time */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Jam Masuk (In Time)</label>
            <Input
              type="datetime-local"
              value={record.in_time ? record.in_time.slice(0, 16) : ""}
              onChange={(e) => updateField("in_time", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
              className="mt-1 h-10 rounded-xl"
            />
          </div>

          {/* Out Time */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Jam Keluar (Out Time)</label>
            <Input
              type="datetime-local"
              value={record.out_time ? record.out_time.slice(0, 16) : ""}
              onChange={(e) => updateField("out_time", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
              className="mt-1 h-10 rounded-xl"
            />
          </div>

          {/* Working Hours */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Total Jam Kerja (Working Hours)</label>
            <Input
              type="number"
              step="0.1"
              value={record.working_hours ?? 0}
              onChange={(e) => updateField("working_hours", Number(e.target.value))}
              className="mt-1 h-10 rounded-xl"
            />
          </div>

          {/* Source */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Sumber Absensi (Source)</label>
            <ERPSelect
              value={record.source || "Manual"}
              onChange={(e) => updateField("source", e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border"
            >
              <ERPSelectOption value="Manual">Manual Entry</ERPSelectOption>
              <ERPSelectOption value="QR Code">QR Code Scan</ERPSelectOption>
              <ERPSelectOption value="Fingerprint">Fingerprint Biometrik</ERPSelectOption>
              <ERPSelectOption value="RFID">Kartu RFID / NFC</ERPSelectOption>
              <ERPSelectOption value="Attendance Tool">Employee Attendance Tool</ERPSelectOption>
            </ERPSelect>
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="text-xs font-semibold text-slate-700">Catatan / Keterangan (Remarks)</label>
          <Input
            value={record.remarks || ""}
            onChange={(e) => updateField("remarks", e.target.value)}
            placeholder="Catatan izin, lembur, atau alasan dispensasi..."
            className="mt-1 h-10 rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}

export default AttendanceFormPage;
