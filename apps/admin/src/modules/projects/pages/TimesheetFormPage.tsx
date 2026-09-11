import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileSpreadsheet,
  FileText,
  Plus,
  Save,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CompanySelect } from "@/components/CompanySelect";
import {
  timesheetApi,
  type Timesheet,
  type TimesheetDetail,
  type TimesheetOptions,
} from "../api";

const todayDateStr = () => new Date().toISOString().split("T")[0];
const nowDateTimeStr = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
};

export function TimesheetFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isNew = !id || id.startsWith("new");
  const [activeTab, setActiveTab] = useState<"details" | "billing" | "references">("details");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<TimesheetOptions | null>(null);

  const [form, setForm] = useState<Partial<Timesheet>>({
    series: "TS-.YYYY.-.#####",
    employee_id: "",
    employee_name: "",
    employee_email: "",
    company: "",
    customer: "",
    currency: "IDR",
    exchange_rate: 1,
    status: "Draft",
    project_id: null,
    project_name: "",
    start_date: todayDateStr(),
    end_date: todayDateStr(),
    sales_invoice: "",
    notes: "",
    total_working_hours: 0,
    total_billable_hours: 0,
    total_billable_amount: 0,
    total_costing_amount: 0,
    time_logs: [],
  });

  // Calculate row hours and grand totals locally
  const recalculateTotals = (logs: TimesheetDetail[]) => {
    let working = 0;
    let billable = 0;
    let billableAmt = 0;
    let costingAmt = 0;

    const updatedLogs = logs.map((log, idx) => {
      let hrs = log.hours || 0;
      if (log.from_time && log.to_time) {
        const from = new Date(log.from_time).getTime();
        const to = new Date(log.to_time).getTime();
        if (to > from) {
          hrs = Math.round(((to - from) / (1000 * 60 * 60)) * 100) / 100;
        }
      }
      const bAmt = log.is_billable ? Math.round(hrs * (log.billing_rate || 0) * 100) / 100 : 0;
      const cAmt = Math.round(hrs * (log.costing_rate || 0) * 100) / 100;

      working += hrs;
      if (log.is_billable) {
        billable += hrs;
        billableAmt += bAmt;
      }
      costingAmt += cAmt;

      return {
        ...log,
        idx: idx + 1,
        hours: hrs,
        billing_amount: bAmt,
        costing_amount: cAmt,
      };
    });

    setForm((prev) => ({
      ...prev,
      time_logs: updatedLogs,
      total_working_hours: Math.round(working * 100) / 100,
      total_billable_hours: Math.round(billable * 100) / 100,
      total_billable_amount: Math.round(billableAmt * 100) / 100,
      total_costing_amount: Math.round(costingAmt * 100) / 100,
    }));
  };

  useEffect(() => {
    timesheetApi
      .getTimesheetOptions()
      .then((res) => {
        setOptions(res.data);
        if (isNew && res.data.employees?.length > 0 && !form.employee_id) {
          const firstEmp = res.data.employees[0];
          setForm((prev) => ({
            ...prev,
            employee_id: firstEmp.id,
            employee_name: firstEmp.name,
            employee_email: firstEmp.email,
          }));
        }
      })
      .catch((err) => console.error(err));

    if (!isNew && id) {
      setLoading(true);
      timesheetApi
        .getTimesheet(id)
        .then((res) => {
          const ts = res.data.data;
          setForm({
            ...ts,
            start_date: ts.start_date ? ts.start_date.slice(0, 10) : "",
            end_date: ts.end_date ? ts.end_date.slice(0, 10) : "",
            time_logs: (ts.time_logs || []).map((l) => ({
              ...l,
              from_time: l.from_time ? l.from_time.slice(0, 16) : "",
              to_time: l.to_time ? l.to_time.slice(0, 16) : "",
            })),
          });
        })
        .catch((err) => {
          toast.error(err.response?.data?.error || "Gagal memuat detail timesheet");
          navigate("/desk/timesheet");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const handleAddRow = () => {
    const defaultAct = options?.activity_types?.[0] || "Communication";
    const newLog: TimesheetDetail = {
      activity_type: defaultAct,
      from_time: nowDateTimeStr(),
      to_time: nowDateTimeStr(),
      hours: 1,
      project_id: form.project_id || null,
      project_name: form.project_name || "",
      is_billable: true,
      billing_rate: 150000,
      billing_amount: 150000,
      costing_rate: 100000,
      costing_amount: 100000,
      description: "",
    };
    const nextLogs = [...(form.time_logs || []), newLog];
    recalculateTotals(nextLogs);
  };

  const handleRemoveRow = (idx: number) => {
    const nextLogs = (form.time_logs || []).filter((_, i) => i !== idx);
    recalculateTotals(nextLogs);
  };

  const handleUpdateRow = (idx: number, patch: Partial<TimesheetDetail>) => {
    const nextLogs = (form.time_logs || []).map((l, i) => {
      if (i !== idx) return l;
      return { ...l, ...patch };
    });
    recalculateTotals(nextLogs);
  };

  const handleSave = async () => {
    if (!form.employee_id) {
      toast.error("Pilih Karyawan terlebih dahulu");
      return;
    }
    if (!form.company) {
      toast.error("Pilih Perusahaan (Company)");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Timesheet> = {
        ...form,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        time_logs: (form.time_logs || []).map((l) => ({
          ...l,
          from_time: l.from_time ? new Date(l.from_time).toISOString() : new Date().toISOString(),
          to_time: l.to_time ? new Date(l.to_time).toISOString() : null,
        })),
      };

      if (isNew) {
        const res = await timesheetApi.createTimesheet(payload);
        toast.success(res.data.message || "Timesheet berhasil dibuat");
        navigate(`/desk/timesheet/${encodeURIComponent(res.data.data.id)}`);
      } else if (id) {
        const res = await timesheetApi.updateTimesheet(id, payload);
        toast.success(res.data.message || "Timesheet berhasil diperbarui");
        setForm((prev) => ({ ...prev, ...res.data.data }));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menyimpan timesheet");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!id || isNew) {
      toast.error("Simpan sebagai draft terlebih dahulu sebelum submit");
      return;
    }
    if (!window.confirm("Submit timesheet ini untuk mengonfirmasi jam kerja? Dokumen yang disubmit tidak dapat diedit lagi.")) return;
    try {
      const res = await timesheetApi.submitTimesheet(id);
      toast.success(res.data.message || "Timesheet berhasil disubmit");
      setForm((prev) => ({ ...prev, status: "Submitted" }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal submit timesheet");
    }
  };

  const handleCancel = async () => {
    if (!id || isNew) return;
    if (!window.confirm("Batalkan timesheet ini?")) return;
    try {
      const res = await timesheetApi.cancelTimesheet(id);
      toast.success(res.data.message || "Timesheet berhasil dibatalkan");
      setForm((prev) => ({ ...prev, status: "Cancelled" }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal membatalkan timesheet");
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!window.confirm("Yakin ingin menghapus timesheet ini?")) return;
    try {
      await timesheetApi.deleteTimesheet(id);
      toast.success("Timesheet berhasil dihapus");
      navigate("/desk/timesheet");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menghapus timesheet");
    }
  };

  const isLocked = form.status === "Submitted";

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center text-slate-500">Memuat detail timesheet...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-xl p-4 lg:p-7 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/desk/timesheet")}
            className="rounded-xl h-9 w-9 p-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                {form.employee_name || (isNew ? "New Timesheet" : form.id)}
              </h1>
              <Badge variant="outline" className="bg-slate-50 text-slate-600 font-mono text-xs">
                {isNew ? form.series : form.id}
              </Badge>
              <Badge
                className={
                  form.status === "Submitted"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : form.status === "Cancelled"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }
              >
                {form.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {form.company} · Total: {form.total_working_hours || 0} hrs · Billable: {form.total_billable_hours || 0} hrs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && form.status === "Draft" && (
            <Button
              onClick={handleSubmit}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Send className="size-4 mr-1.5" />
              Submit
            </Button>
          )}
          {!isNew && form.status === "Submitted" && (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              <XCircle className="size-4 mr-1.5" />
              Cancel Timesheet
            </Button>
          )}
          {!isLocked && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Save className="size-4 mr-1.5" />
              {saving ? "Menyimpan..." : "Save Draft"}
            </Button>
          )}
          {!isNew && form.status !== "Submitted" && (
            <Button
              variant="outline"
              onClick={handleDelete}
              className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Action banner if Draft */}
      {form.status === "Draft" && !isNew && (
        <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-600" />
            <span>Dokumen ini masih berstatus <strong>Draft</strong>. Klik tombol <strong>Submit</strong> untuk mengonfirmasi catatan waktu ini.</span>
          </div>
          <Button size="sm" onClick={handleSubmit} className="bg-amber-600 hover:bg-amber-700 text-white h-7 text-xs rounded-lg">
            Submit Now
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "details"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Clock className="size-4" />
          Details & Time Sheets
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("billing")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "billing"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Coins className="size-4" />
          Billing & Invoice
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("references")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "references"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileText className="size-4" />
          References & Notes
        </button>
      </div>

      {/* Tab: DETAILS */}
      {activeTab === "details" && (
        <div className="space-y-6">
          {/* Header metadata */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Company <span className="text-rose-500">*</span>
                </label>
                <CompanySelect
                  value={form.company}
                  disabled={isLocked}
                  onChange={(company) => setForm((current) => ({ ...current, company }))}
                  className="mt-1 [&_button]:h-10 [&_button]:rounded-xl [&_button]:text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Customer</label>
                <select
                  aria-label="Customer"
                  disabled={isLocked}
                  value={form.customer || ""}
                  onChange={(e) => setForm({ ...form, customer: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                >
                  <option value="">-- Pilih Customer (Optional) --</option>
                  {(options?.customers || [
                    "PT Pelanggan Indonesia",
                    "PT Maju Bersama",
                    "CV Sinar Makmur",
                    "Global Logistics Pte Ltd",
                  ]).map((cust) => (
                    <option key={cust} value={cust}>
                      {cust}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Project</label>
                <select
                  aria-label="Project"
                  disabled={isLocked}
                  value={form.project_id || ""}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const p = options?.projects.find((proj) => proj.id === pid);
                    setForm({
                      ...form,
                      project_id: pid || null,
                      project_name: p?.project_name || "",
                      customer: p?.customer || form.customer,
                    });
                  }}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                >
                  <option value="">-- Pilih Project (Optional) --</option>
                  {(options?.projects || []).map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.project_name} ({proj.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Currency</label>
                <Input
                  value={form.currency || "IDR"}
                  disabled={isLocked}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="mt-1 h-10 rounded-xl uppercase font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Exchange Rate</label>
                <Input
                  type="number"
                  value={form.exchange_rate ?? 1}
                  disabled={isLocked}
                  onChange={(e) => setForm({ ...form, exchange_rate: parseFloat(e.target.value) || 1 })}
                  className="mt-1 h-10 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Status</label>
                <select
                  aria-label="Status"
                  value={form.status || "Draft"}
                  disabled={isLocked}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                >
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Billed">Billed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Start Date</label>
                <Input
                  type="date"
                  value={form.start_date || ""}
                  disabled={isLocked}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">End Date</label>
                <Input
                  type="date"
                  value={form.end_date || ""}
                  disabled={isLocked}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
            </div>

            {/* Employee Detail Section */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Employee Detail
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Employee <span className="text-rose-500">*</span>
                  </label>
                  <select
                    aria-label="Employee"
                    disabled={isLocked}
                    value={form.employee_id || ""}
                    onChange={(e) => {
                      const empId = e.target.value;
                      const emp = options?.employees.find((x) => x.id === empId);
                      setForm({
                        ...form,
                        employee_id: empId,
                        employee_name: emp?.name || "",
                        employee_email: emp?.email || "",
                      });
                    }}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                  >
                    <option value="">-- Pilih Karyawan --</option>
                    {(options?.employees || []).map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email || emp.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Employee Name</label>
                  <Input
                    value={form.employee_name || ""}
                    disabled={isLocked}
                    onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                    className="mt-1 h-10 rounded-xl bg-slate-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Time Sheets Table (time_logs) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Time Sheets (time_logs)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Catat aktivitas pekerjaan, jam mulai & selesai, keterkaitan proyek, dan status billable.
                </p>
              </div>
              {!isLocked && (
                <Button
                  type="button"
                  onClick={handleAddRow}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  size="sm"
                >
                  <Plus className="size-4 mr-1.5" />
                  Add Row
                </Button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5 w-10">No.</th>
                    <th className="px-3 py-2.5 min-w-[150px]">Activity Type</th>
                    <th className="px-3 py-2.5 min-w-[150px]">From Time</th>
                    <th className="px-3 py-2.5 min-w-[150px]">To Time</th>
                    <th className="px-3 py-2.5 w-20">Hrs</th>
                    <th className="px-3 py-2.5 min-w-[150px]">Project</th>
                    <th className="px-3 py-2.5 w-24 text-center">Is Billable</th>
                    <th className="px-3 py-2.5 min-w-[120px]">Billing Rate</th>
                    <th className="px-3 py-2.5 min-w-[120px]">Billing Amount</th>
                    {!isLocked && <th className="px-3 py-2.5 w-12 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(form.time_logs || []).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                        Belum ada catatan log waktu. Klik tombol "+ Add Row" untuk menambahkan.
                      </td>
                    </tr>
                  ) : (
                    form.time_logs?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <select
                            aria-label={`Activity Type Row ${idx + 1}`}
                            disabled={isLocked}
                            value={row.activity_type}
                            onChange={(e) => handleUpdateRow(idx, { activity_type: e.target.value })}
                            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                          >
                            {(options?.activity_types || [
                              "Communication",
                              "Planning",
                              "Development",
                              "Design",
                              "Testing",
                              "Review",
                              "Deployment",
                              "Support",
                            ]).map((act) => (
                              <option key={act} value={act}>
                                {act}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="datetime-local"
                            disabled={isLocked}
                            value={row.from_time || ""}
                            onChange={(e) => handleUpdateRow(idx, { from_time: e.target.value })}
                            className="h-8 text-xs rounded-lg"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="datetime-local"
                            disabled={isLocked}
                            value={row.to_time || ""}
                            onChange={(e) => handleUpdateRow(idx, { to_time: e.target.value })}
                            className="h-8 text-xs rounded-lg"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.25"
                            disabled={isLocked}
                            value={row.hours}
                            onChange={(e) => handleUpdateRow(idx, { hours: parseFloat(e.target.value) || 0 })}
                            className="h-8 w-18 text-xs font-semibold text-center rounded-lg"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            aria-label={`Project Row ${idx + 1}`}
                            disabled={isLocked}
                            value={row.project_id || ""}
                            onChange={(e) => {
                              const pid = e.target.value;
                              const p = options?.projects.find((proj) => proj.id === pid);
                              handleUpdateRow(idx, {
                                project_id: pid || null,
                                project_name: p?.project_name || "",
                              });
                            }}
                            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                          >
                            <option value="">-- Project --</option>
                            {(options?.projects || []).map((proj) => (
                              <option key={proj.id} value={proj.id}>
                                {proj.project_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={Boolean(row.is_billable)}
                            onChange={(e) => handleUpdateRow(idx, { is_billable: e.target.checked })}
                            className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            disabled={isLocked || !row.is_billable}
                            value={row.billing_rate}
                            onChange={(e) => handleUpdateRow(idx, { billing_rate: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-xs font-mono rounded-lg"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono font-medium text-slate-700">
                          {new Intl.NumberFormat("id-ID", { style: "currency", currency: form.currency || "IDR", maximumFractionDigits: 0 }).format(row.billing_amount || 0)}
                        </td>
                        {!isLocked && (
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Metrics */}
            <div className="flex flex-wrap items-center justify-end gap-6 pt-3 border-t border-slate-100 text-sm">
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Total Working Hours</span>
                <span className="text-lg font-bold text-slate-900">{form.total_working_hours || 0} hrs</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Total Billable Hours</span>
                <span className="text-lg font-bold text-blue-600">{form.total_billable_hours || 0} hrs</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Total Billable Amount</span>
                <span className="text-lg font-bold text-emerald-600 font-mono">
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: form.currency || "IDR", maximumFractionDigits: 0 }).format(form.total_billable_amount || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: BILLING */}
      {activeTab === "billing" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Billing & Invoicing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Sales Invoice</label>
              <Input
                placeholder="e.g. ACC-SINV-2026-0001"
                disabled={isLocked}
                value={form.sales_invoice || ""}
                onChange={(e) => setForm({ ...form, sales_invoice: e.target.value })}
                className="mt-1 h-10 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Total Billed Hours</label>
              <Input
                type="number"
                disabled={isLocked}
                value={form.total_billed_hours ?? 0}
                onChange={(e) => setForm({ ...form, total_billed_hours: parseFloat(e.target.value) || 0 })}
                className="mt-1 h-10 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Total Billable Amount</label>
              <Input
                type="number"
                disabled
                value={form.total_billable_amount ?? 0}
                className="mt-1 h-10 rounded-xl bg-slate-50 font-mono font-bold text-blue-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Total Costing Amount</label>
              <Input
                type="number"
                disabled
                value={form.total_costing_amount ?? 0}
                className="mt-1 h-10 rounded-xl bg-slate-50 font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab: REFERENCES */}
      {activeTab === "references" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Comments & References
          </h2>
          <div>
            <label className="text-xs font-semibold text-slate-700">Notes / Comments</label>
            <textarea
              rows={6}
              disabled={isLocked}
              placeholder="Catatan pengerjaan atau komentar untuk timesheet ini..."
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default TimesheetFormPage;
