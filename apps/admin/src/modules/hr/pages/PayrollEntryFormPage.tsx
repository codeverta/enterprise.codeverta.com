import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CompanySelect } from "@/components/CompanySelect";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { payrollApi, type PayrollEntry, type PayrollEntryEmployee, type PayrollEntryOptions } from "../api";

const money = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v || 0);

const todayStr = () => new Date().toISOString().split("T")[0];
const firstDayOfMonthStr = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
};
const lastDayOfMonthStr = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
};

const defaultEntry = (): Partial<PayrollEntry> => ({
  posting_date: todayStr(),
  payroll_frequency: "Monthly",
  company: "",
  department: "All Departments",
  start_date: firstDayOfMonthStr(),
  end_date: lastDayOfMonthStr(),
  currency: "IDR",
  exchange_rate: 1.0,
  status: "Draft",
  payment_account: "1110 - Cash / Bank Account",
  cost_center: "Main - Cost Center",
  items: [],
});

export function PayrollEntryFormPage() {
  const params = useParams();
  const id = params.id || params["*"]?.split("/").filter(Boolean)[0];
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [entry, setEntry] = useState<Partial<PayrollEntry>>(defaultEntry());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [fetchingEmployees, setFetchingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState<PayrollEntryOptions | null>(null);

  const loadData = async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const data = await payrollApi.get(id);
      setEntry(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal memuat detail Payroll Entry");
      navigate("/desk/payroll-entry");
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const opt = await payrollApi.options();
      setOptions(opt);
    } catch {
      /* fallback options */
    }
  };

  useEffect(() => {
    void loadOptions();
    if (!isNew && id) {
      void loadData();
    }
  }, [id, isNew]);

  const updateField = <K extends keyof PayrollEntry>(key: K, value: PayrollEntry[K]) => {
    setEntry((prev) => ({ ...prev, [key]: value }));
  };

  const updateItem = (index: number, fields: Partial<PayrollEntryEmployee>) => {
    setEntry((prev) => {
      const items = [...(prev.items || [])];
      if (!items[index]) return prev;

      const updatedItem = { ...items[index], ...fields };
      const basic = updatedItem.basic_salary || 0;
      const allowances = updatedItem.allowances || 0;
      const deductions = updatedItem.deductions || 0;
      const gross = basic + allowances;
      const net = gross - deductions;

      updatedItem.gross_pay = gross;
      updatedItem.net_pay = net;
      items[index] = updatedItem;

      // Re-calculate entry totals
      const totalGross = items.reduce((sum, item) => sum + (item.gross_pay || 0), 0);
      const totalDed = items.reduce((sum, item) => sum + (item.deductions || 0), 0);
      const totalNet = items.reduce((sum, item) => sum + (item.net_pay || 0), 0);

      return {
        ...prev,
        items,
        total_employees: items.length,
        total_gross_pay: totalGross,
        total_deductions: totalDed,
        total_net_pay: totalNet,
      };
    });
  };

  const removeItem = (index: number) => {
    setEntry((prev) => {
      const items = (prev.items || []).filter((_, i) => i !== index);
      const totalGross = items.reduce((sum, item) => sum + (item.gross_pay || 0), 0);
      const totalDed = items.reduce((sum, item) => sum + (item.deductions || 0), 0);
      const totalNet = items.reduce((sum, item) => sum + (item.net_pay || 0), 0);

      return {
        ...prev,
        items,
        total_employees: items.length,
        total_gross_pay: totalGross,
        total_deductions: totalDed,
        total_net_pay: totalNet,
      };
    });
  };

  const addEmptyEmployee = () => {
    setEntry((prev) => {
      const items = [...(prev.items || [])];
      const newItem: PayrollEntryEmployee = {
        id: "pre-manual-" + Math.random().toString(36).slice(2, 8),
        payroll_entry_id: prev.id || "",
        employee_name: "Nama Karyawan",
        department: prev.department || "Operational",
        designation: "Staff",
        basic_salary: 4500000,
        allowances: 675000,
        deductions: 225000,
        gross_pay: 5175000,
        net_pay: 4950000,
        status: "Pending",
      };
      items.push(newItem);

      const totalGross = items.reduce((sum, item) => sum + (item.gross_pay || 0), 0);
      const totalDed = items.reduce((sum, item) => sum + (item.deductions || 0), 0);
      const totalNet = items.reduce((sum, item) => sum + (item.net_pay || 0), 0);

      return {
        ...prev,
        items,
        total_employees: items.length,
        total_gross_pay: totalGross,
        total_deductions: totalDed,
        total_net_pay: totalNet,
      };
    });
  };

  const handleSave = async () => {
    if (!entry.company) {
      toast.error("Company wajib diisi");
      return;
    }
    setSaving(true);
    try {
      let result: PayrollEntry;
      if (isNew) {
        result = await payrollApi.create(entry);
        toast.success("Payroll Entry berhasil dibuat!");
        navigate(`/desk/payroll-entry/${result.id}`, { replace: true });
      } else {
        result = await payrollApi.update(entry.id!, entry);
        toast.success("Payroll Entry berhasil disimpan!");
        setEntry(result);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Payroll Entry");
    } finally {
      setSaving(false);
    }
  };

  const handleGetEmployees = async () => {
    if (isNew) {
      // Create draft first
      try {
        const created = await payrollApi.create(entry);
        setEntry(created);
        setFetchingEmployees(true);
        const updated = await payrollApi.getEmployees(created.id);
        setEntry(updated);
        toast.success(`Berhasil menarik ${updated.total_employees} karyawan ke Payroll Entry!`);
        navigate(`/desk/payroll-entry/${created.id}`, { replace: true });
      } catch (err: any) {
        toast.error(err?.response?.data?.error || "Gagal menarik daftar karyawan");
      } finally {
        setFetchingEmployees(false);
      }
      return;
    }

    setFetchingEmployees(true);
    try {
      const updated = await payrollApi.getEmployees(entry.id!);
      setEntry(updated);
      toast.success(`Berhasil menarik ${updated.total_employees} karyawan ke Payroll Entry!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menarik daftar karyawan");
    } finally {
      setFetchingEmployees(false);
    }
  };

  const handleSubmitPayroll = async () => {
    if (!entry.id || isNew) {
      toast.error("Simpan Payroll Entry terlebih dahulu sebelum Submit");
      return;
    }
    if (!entry.items || entry.items.length === 0) {
      toast.error("Payroll Entry harus memiliki minimal 1 karyawan. Klik 'Get Employees' terlebih dahulu.");
      return;
    }
    if (!window.confirm("Submit Payroll Entry dan proses pembuatan slip gaji karyawan?")) return;

    setSubmitting(true);
    try {
      const res = await payrollApi.submit(entry.id);
      toast.success("Payroll Entry berhasil disubmit!");
      setEntry(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal mensubmit Payroll Entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!entry.id || isNew) return;
    if (!window.confirm("Hapus Payroll Entry ini?")) return;
    try {
      await payrollApi.delete(entry.id);
      toast.success("Payroll Entry dihapus");
      navigate("/desk/payroll-entry");
    } catch {
      toast.error("Gagal menghapus Payroll Entry");
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Memuat detail Payroll Entry...</div>;
  }

  const isSubmitted = entry.status === "Submitted";

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/desk/payroll-entry")}
            className="h-10 w-10 rounded-xl"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                {isNew ? "New Payroll Entry" : entry.id}
              </h1>
              {entry.status === "Submitted" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="size-3.5" /> Submitted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  <Clock className="size-3.5" /> Draft
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Proses entri gaji bulanan/mingguan karyawan perusahaan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isSubmitted && (
            <Button
              variant="outline"
              onClick={handleGetEmployees}
              disabled={fetchingEmployees}
              className="h-10 rounded-xl border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100"
            >
              <UserCheck className="size-4 mr-1.5" />
              {fetchingEmployees ? "Pulling Employees..." : "Get Employees"}
            </Button>
          )}

          {!isSubmitted && (
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving}
              className="h-10 rounded-xl"
            >
              <Save className="size-4 mr-1.5" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
          )}

          {!isSubmitted && !isNew && (
            <Button
              onClick={handleSubmitPayroll}
              disabled={submitting}
              className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <CheckCircle2 className="size-4 mr-1.5" />
              {submitting ? "Submitting..." : "Submit Payroll"}
            </Button>
          )}

          {!isSubmitted && !isNew && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              className="h-10 rounded-xl text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Form Fields Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="size-4 text-blue-600" /> Information & Period
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">Posting Date</label>
            <Input
              type="date"
              disabled={isSubmitted}
              value={entry.posting_date ? entry.posting_date.split("T")[0] : ""}
              onChange={(e) => updateField("posting_date", e.target.value)}
              className="mt-1 h-10 rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Payroll Frequency</label>
            <ERPSelect
              disabled={isSubmitted}
              value={entry.payroll_frequency || "Monthly"}
              onChange={(e) => updateField("payroll_frequency", e.target.value)}
              className="mt-1 h-10 rounded-xl"
            >
              {(options?.payroll_frequencies || ["Monthly", "Weekly", "Bimonthly", "Fortnightly"]).map((f) => (
                <ERPSelectOption key={f} value={f}>
                  {f}
                </ERPSelectOption>
              ))}
            </ERPSelect>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Company</label>
            <CompanySelect
              disabled={isSubmitted}
              value={entry.company}
              onChange={(company) => updateField("company", company)}
              className="mt-1 [&_button]:h-10 [&_button]:rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Department</label>
            <ERPSelect
              disabled={isSubmitted}
              value={entry.department || "All Departments"}
              onChange={(e) => updateField("department", e.target.value)}
              className="mt-1 h-10 rounded-xl"
            >
              {(options?.departments || ["All Departments", "Human Resources", "Engineering & IT", "Finance & Accounting", "Sales & Marketing"]).map((d) => (
                <ERPSelectOption key={d} value={d}>
                  {d}
                </ERPSelectOption>
              ))}
            </ERPSelect>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Start Date (Periode Mulai)</label>
            <Input
              type="date"
              disabled={isSubmitted}
              value={entry.start_date ? entry.start_date.split("T")[0] : ""}
              onChange={(e) => updateField("start_date", e.target.value)}
              className="mt-1 h-10 rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">End Date (Periode Selesai)</label>
            <Input
              type="date"
              disabled={isSubmitted}
              value={entry.end_date ? entry.end_date.split("T")[0] : ""}
              onChange={(e) => updateField("end_date", e.target.value)}
              className="mt-1 h-10 rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Payment Account</label>
            <Input
              disabled={isSubmitted}
              value={entry.payment_account || ""}
              onChange={(e) => updateField("payment_account", e.target.value)}
              placeholder="e.g. 1110 - Bank Mandiri Payroll"
              className="mt-1 h-10 rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Cost Center</label>
            <Input
              disabled={isSubmitted}
              value={entry.cost_center || ""}
              onChange={(e) => updateField("cost_center", e.target.value)}
              placeholder="e.g. Main - Cost Center"
              className="mt-1 h-10 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Employee Payroll Table Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="size-4 text-blue-600" /> Employee Payroll Table ({entry.items?.length || 0} Employees)
            </h2>
            <p className="text-xs text-slate-500">
              Gaji pokok, tunjangan, dan potongan karyawan yang akan diproses pada siklus payroll ini.
            </p>
          </div>
          {!isSubmitted && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetEmployees}
                disabled={fetchingEmployees}
                className="h-9 rounded-xl text-xs"
              >
                <UserCheck className="size-3.5 mr-1" /> Get Employees from DB
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addEmptyEmployee}
                className="h-9 rounded-xl text-xs"
              >
                <Plus className="size-3.5 mr-1" /> Add Row
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">Employee Name</th>
                <th className="p-3">Dept & Designation</th>
                <th className="p-3 w-36 text-right">Basic Salary</th>
                <th className="p-3 w-36 text-right">Allowances</th>
                <th className="p-3 w-36 text-right">Deductions</th>
                <th className="p-3 w-36 text-right">Gross Pay</th>
                <th className="p-3 w-36 text-right">Net Pay</th>
                {!isSubmitted && <th className="p-3 w-12 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!entry.items || entry.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400">
                    Belum ada karyawan. Klik <strong>"Get Employees"</strong> untuk menarik otomatis daftar user dari database.
                  </td>
                </tr>
              ) : (
                entry.items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 text-center text-xs font-medium text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <Input
                        disabled={isSubmitted}
                        value={item.employee_name}
                        onChange={(e) => updateItem(idx, { employee_name: e.target.value })}
                        className="h-9 font-semibold text-slate-900 rounded-lg"
                      />
                      {item.employee_email && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.employee_email}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <Input
                        disabled={isSubmitted}
                        value={item.department || ""}
                        onChange={(e) => updateItem(idx, { department: e.target.value })}
                        placeholder="Department"
                        className="h-8 text-xs mb-1 rounded-lg"
                      />
                      <Input
                        disabled={isSubmitted}
                        value={item.designation || ""}
                        onChange={(e) => updateItem(idx, { designation: e.target.value })}
                        placeholder="Designation"
                        className="h-8 text-xs rounded-lg"
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        type="number"
                        disabled={isSubmitted}
                        value={item.basic_salary}
                        onChange={(e) => updateItem(idx, { basic_salary: Number(e.target.value) })}
                        className="h-9 text-right font-medium rounded-lg"
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        type="number"
                        disabled={isSubmitted}
                        value={item.allowances}
                        onChange={(e) => updateItem(idx, { allowances: Number(e.target.value) })}
                        className="h-9 text-right font-medium rounded-lg text-emerald-700"
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        type="number"
                        disabled={isSubmitted}
                        value={item.deductions}
                        onChange={(e) => updateItem(idx, { deductions: Number(e.target.value) })}
                        className="h-9 text-right font-medium rounded-lg text-rose-700"
                      />
                    </td>
                    <td className="p-3 text-right font-bold text-slate-800">
                      {money(item.gross_pay)}
                    </td>
                    <td className="p-3 text-right font-bold text-blue-700">
                      {money(item.net_pay)}
                    </td>
                    {!isSubmitted && (
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(idx)}
                          className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Box */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <Banknote className="size-4 text-emerald-400" /> Ringkasan Total Payroll
          </div>
          <p className="text-2xl font-bold text-white">
            {money(entry.total_net_pay || 0)}
          </p>
          <p className="text-xs text-slate-400">
            Total Gaji Bersih (Net Pay) untuk {entry.total_employees || entry.items?.length || 0} Karyawan
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 text-right border-t lg:border-t-0 border-slate-800 pt-4 lg:pt-0">
          <div>
            <p className="text-xs text-slate-400">Total Gross Pay</p>
            <p className="text-lg font-bold text-slate-200 mt-0.5">{money(entry.total_gross_pay || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Deductions</p>
            <p className="text-lg font-bold text-rose-400 mt-0.5">-{money(entry.total_deductions || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-emerald-400 font-semibold">Total Net Pay</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">{money(entry.total_net_pay || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PayrollEntryFormPage;
