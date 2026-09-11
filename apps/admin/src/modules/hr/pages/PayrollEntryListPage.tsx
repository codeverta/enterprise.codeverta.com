import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { payrollApi, type PayrollEntry } from "../api";

const money = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v || 0);

export function PayrollEntryListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await payrollApi.list({
        q: query,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setRows(data);
    } catch {
      toast.error("Gagal memuat daftar Payroll Entry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [statusFilter]);

  const handleDelete = async (id: string, status: string) => {
    if (status === "Submitted") {
      toast.error("Payroll Entry yang sudah Submitted tidak dapat dihapus");
      return;
    }
    if (!window.confirm("Hapus Payroll Entry ini?")) return;
    try {
      await payrollApi.delete(id);
      toast.success("Payroll Entry berhasil dihapus");
      void loadData();
    } catch {
      toast.error("Gagal menghapus Payroll Entry");
    }
  };

  const filteredRows = rows.filter((r) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      (r.company && r.company.toLowerCase().includes(q)) ||
      (r.department && r.department.toLowerCase().includes(q))
    );
  });

  const totalRuns = rows.length;
  const draftRuns = rows.filter((r) => r.status === "Draft").length;
  const submittedRuns = rows.filter((r) => r.status === "Submitted").length;
  const totalNetPaid = rows
    .filter((r) => r.status === "Submitted")
    .reduce((sum, r) => sum + (r.total_net_pay || 0), 0);

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Payroll Entry</h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              HR & Penggajian
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Kelola proses pemrosesan gaji karyawan, komputasi tunjangan & potongan, serta pembuatan slip gaji.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => void loadData()}
            className="h-10 rounded-xl"
          >
            <RefreshCw className="size-4 mr-1.5" /> Refresh
          </Button>
          <Button
            onClick={() => navigate("/desk/payroll-entry/new")}
            className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="size-4 mr-1.5" /> New Payroll Entry
          </Button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <FileSpreadsheet className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Payroll Runs</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalRuns}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Draft Runs</p>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{draftRuns}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted Runs</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{submittedRuns}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Banknote className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Processed Net Pay</p>
            <p className="text-xl font-bold text-purple-700 mt-0.5">{money(totalNetPaid)}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari berdasarkan ID, perusahaan, atau departemen..."
            className="h-10 pl-9 rounded-xl border-slate-200 bg-slate-50"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          <ERPSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 w-44 rounded-xl border-slate-200 bg-white text-xs font-medium"
          >
            <ERPSelectOption value="all">Semua Status</ERPSelectOption>
            <ERPSelectOption value="Draft">Draft</ERPSelectOption>
            <ERPSelectOption value="Submitted">Submitted</ERPSelectOption>
            <ERPSelectOption value="Cancelled">Cancelled</ERPSelectOption>
          </ERPSelect>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-4">ID Payroll Entry</th>
                <th className="p-4">Posting Date</th>
                <th className="p-4">Company & Department</th>
                <th className="p-4">Period</th>
                <th className="p-4 text-center">Employees</th>
                <th className="p-4 text-right">Total Net Pay</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2" />
                    Memuat data Payroll Entry...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    Tidak ada Payroll Entry ditemukan. Silakan buat baru.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => navigate(`/desk/payroll-entry/${row.id}`)}
                  >
                    <td className="p-4 font-bold text-blue-600">
                      {row.id}
                    </td>
                    <td className="p-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-slate-400" />
                        {row.posting_date ? new Date(row.posting_date).toLocaleDateString("id-ID") : "-"}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-slate-400" />
                        {row.company || "PT ZENIT TECHNOLOGY SOLUTION"}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {row.department || "All Departments"}
                      </p>
                    </td>
                    <td className="p-4 text-xs text-slate-600">
                      {row.start_date ? new Date(row.start_date).toLocaleDateString("id-ID") : ""} -{" "}
                      {row.end_date ? new Date(row.end_date).toLocaleDateString("id-ID") : ""}
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        <Users className="size-3" />
                        {row.total_employees || (row.items ? row.items.length : 0)}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-900">
                      {money(row.total_net_pay)}
                    </td>
                    <td className="p-4 text-center">
                      {row.status === "Submitted" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="size-3" /> Submitted
                        </span>
                      ) : row.status === "Draft" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                          <Clock className="size-3" /> Draft
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                          Cancelled
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/desk/payroll-entry/${row.id}`)}
                          className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          View / Edit
                        </Button>
                        {row.status === "Draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(row.id, row.status)}
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

export default PayrollEntryListPage;
