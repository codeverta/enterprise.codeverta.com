import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  FolderKanban,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  projectsApi,
  type Project,
  type ProjectOptions,
  type Task,
} from "../api";

export function ProjectFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // If id starts with "new" (e.g. "new" or "new-project-...") it's a new entry
  const isNew = !id || id.startsWith("new");

  const [activeTab, setActiveTab] = useState<"details" | "costing" | "tasks" | "more">("details");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<ProjectOptions | null>(null);

  // Form State
  const [form, setForm] = useState<Partial<Project>>({
    naming_series: "PROJ-.####",
    project_name: "",
    status: "Open",
    project_type: "External",
    percent_complete_method: "Task Completion",
    percent_complete: 0,
    project_template: "",
    priority: "Medium",
    department: "Engineering & IT",
    customer: "",
    is_active: true,
    expected_start_date: "",
    expected_end_date: "",
    actual_start_date: "",
    actual_end_date: "",
    estimated_cost: 0,
    total_costing_amount: 0,
    total_expense_claim: 0,
    notes: "",
  });

  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    projectsApi.getProjectOptions().then((res) => {
      setOptions(res.data);
    }).catch((err) => console.error("Error loading project options", err));

    if (!isNew && id) {
      setLoading(true);
      projectsApi
        .getProject(id)
        .then((res) => {
          const p = res.data.data;
          setForm({
            ...p,
            expected_start_date: p.expected_start_date ? p.expected_start_date.slice(0, 10) : "",
            expected_end_date: p.expected_end_date ? p.expected_end_date.slice(0, 10) : "",
            actual_start_date: p.actual_start_date ? p.actual_start_date.slice(0, 10) : "",
            actual_end_date: p.actual_end_date ? p.actual_end_date.slice(0, 10) : "",
          });
          setTasks(p.tasks || []);
        })
        .catch((err) => {
          toast.error(err.response?.data?.error || "Gagal mengambil detail proyek");
          navigate("/desk/project");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const handleSave = async () => {
    if (!form.project_name?.trim()) {
      toast.error("Project Name wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Project> = {
        ...form,
        expected_start_date: form.expected_start_date ? new Date(form.expected_start_date).toISOString() : null,
        expected_end_date: form.expected_end_date ? new Date(form.expected_end_date).toISOString() : null,
        actual_start_date: form.actual_start_date ? new Date(form.actual_start_date).toISOString() : null,
        actual_end_date: form.actual_end_date ? new Date(form.actual_end_date).toISOString() : null,
      };

      if (isNew) {
        const res = await projectsApi.createProject(payload);
        toast.success(res.data.message || "Proyek berhasil dibuat");
        navigate(`/desk/project/${encodeURIComponent(res.data.data.id)}`);
      } else if (id) {
        const res = await projectsApi.updateProject(id, payload);
        toast.success(res.data.message || "Proyek berhasil diperbarui");
        setForm(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menyimpan proyek");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!window.confirm("Yakin ingin menghapus proyek ini?")) return;
    try {
      await projectsApi.deleteProject(id);
      toast.success("Proyek berhasil dihapus");
      navigate("/desk/project");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menghapus proyek");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center text-slate-500">Memuat detail proyek...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-xl p-4 lg:p-7 space-y-6">
      {/* Top Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/desk/project")}
            className="rounded-xl h-9 w-9 p-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                {isNew ? "New Project" : form.project_name || "Project"}
              </h1>
              <Badge variant="outline" className="bg-slate-50 text-slate-600 font-mono text-xs">
                {isNew ? form.naming_series : form.id}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isNew ? "Not Saved" : `Status: ${form.status} · Progress: ${Math.round(form.percent_complete || 0)}%`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              variant="outline"
              onClick={handleDelete}
              className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="size-4 mr-1.5" />
              Delete
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Save className="size-4 mr-1.5" />
            {saving ? "Menyimpan..." : "Save Project"}
          </Button>
        </div>
      </header>

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
          <Briefcase className="size-4" />
          Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("costing")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "costing"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <DollarSign className="size-4" />
          Costing & Budget
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "tasks"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FolderKanban className="size-4" />
          Tasks ({tasks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("more")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "more"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileText className="size-4" />
          More Info
        </button>
      </div>

      {/* Tab: DETAILS */}
      {activeTab === "details" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              General Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Series</label>
                <Input
                  value={form.naming_series || "PROJ-.####"}
                  disabled={!isNew}
                  onChange={(e) => setForm({ ...form, naming_series: e.target.value })}
                  className="mt-1 h-10 rounded-xl bg-slate-50 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. ERP System Migration"
                  value={form.project_name || ""}
                  onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Status</label>
                <select
                  aria-label="Status"
                  value={form.status || "Open"}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Open">Open</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Project Type</label>
                <select
                  aria-label="Project Type"
                  value={form.project_type || ""}
                  onChange={(e) => setForm({ ...form, project_type: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Project Type --</option>
                  {(options?.project_types || ["Internal", "External", "Service", "Research & Development"]).map(
                    (t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">% Complete Method</label>
                <select
                  aria-label="Complete Method"
                  value={form.percent_complete_method || "Task Completion"}
                  onChange={(e) => setForm({ ...form, percent_complete_method: e.target.value as any })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Manual">Manual</option>
                  <option value="Task Completion">Task Completion (Persentase jumlah task selesai)</option>
                  <option value="Task Progress">Task Progress (Rata-rata progres tiap task)</option>
                  <option value="Task Weight">Task Weight (Rata-rata tertimbang bobot task)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  % Complete {form.percent_complete_method !== "Manual" && "(Auto Calculated)"}
                </label>
                <div className="flex items-center gap-3 mt-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    disabled={form.percent_complete_method !== "Manual"}
                    value={form.percent_complete ?? 0}
                    onChange={(e) => setForm({ ...form, percent_complete: parseFloat(e.target.value) || 0 })}
                    className="h-10 w-28 rounded-xl font-bold text-blue-600"
                  />
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(form.percent_complete || 0, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Priority</label>
                <select
                  aria-label="Priority"
                  value={form.priority || "Medium"}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Department</label>
                <select
                  aria-label="Department"
                  value={form.department || ""}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Department --</option>
                  {(options?.departments || [
                    "Engineering & IT",
                    "Operations & Logistics",
                    "Sales & Marketing",
                    "Finance & Accounting",
                  ]).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Customer</label>
                <Input
                  placeholder="Nama Pelanggan / Klien"
                  value={form.customer || ""}
                  onChange={(e) => setForm({ ...form, customer: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Is Active</label>
                <select
                  aria-label="Is Active"
                  value={form.is_active ? "Yes" : "No"}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === "Yes" })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>
          </div>

          {/* Timeline Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Timeline & Schedule
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Expected Start Date</label>
                <Input
                  type="date"
                  value={form.expected_start_date || ""}
                  onChange={(e) => setForm({ ...form, expected_start_date: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Expected End Date</label>
                <Input
                  type="date"
                  value={form.expected_end_date || ""}
                  onChange={(e) => setForm({ ...form, expected_end_date: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Actual Start Date</label>
                <Input
                  type="date"
                  value={form.actual_start_date || ""}
                  onChange={(e) => setForm({ ...form, actual_start_date: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Actual End Date</label>
                <Input
                  type="date"
                  value={form.actual_end_date || ""}
                  onChange={(e) => setForm({ ...form, actual_end_date: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: COSTING */}
      {activeTab === "costing" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Costing & Financial Tracking
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Estimated Cost (IDR)</label>
              <Input
                type="number"
                value={form.estimated_cost ?? 0}
                onChange={(e) => setForm({ ...form, estimated_cost: parseFloat(e.target.value) || 0 })}
                className="mt-1 h-10 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Total Costing Amount (IDR)</label>
              <Input
                type="number"
                value={form.total_costing_amount ?? 0}
                onChange={(e) => setForm({ ...form, total_costing_amount: parseFloat(e.target.value) || 0 })}
                className="mt-1 h-10 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Total Expense Claim (IDR)</label>
              <Input
                type="number"
                value={form.total_expense_claim ?? 0}
                onChange={(e) => setForm({ ...form, total_expense_claim: parseFloat(e.target.value) || 0 })}
                className="mt-1 h-10 rounded-xl font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab: TASKS */}
      {activeTab === "tasks" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Tasks for this Project
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar task yang terhubung langsung dengan proyek ini.
              </p>
            </div>
            {!isNew && (
              <Button
                onClick={() => navigate(`/desk/task/new?project_id=${encodeURIComponent(form.id || "")}`)}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                size="sm"
              >
                <Plus className="size-4 mr-1.5" />
                Add Task
              </Button>
            )}
          </div>

          {isNew ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
              Simpan proyek terlebih dahulu untuk mulai menambahkan task.
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
              <FolderKanban className="size-8 mx-auto mb-2 text-slate-300" />
              Belum ada task untuk proyek ini. Klik tombol "Add Task" di atas untuk menambahkan.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Subject</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Priority</th>
                    <th className="px-4 py-2.5">Progress</th>
                    <th className="px-4 py-2.5">Weight</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/desk/task/${encodeURIComponent(t.id)}`)}
                          className="font-medium text-slate-900 hover:text-blue-600 text-left"
                        >
                          {t.subject}
                        </button>
                        <span className="block text-[11px] font-mono text-slate-400">{t.task_code}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-xs">
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{t.priority}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">
                        {Math.round(t.progress || 0)}%
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{t.task_weight || 1}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/desk/task/${encodeURIComponent(t.id)}`)}
                          className="h-7 text-xs text-blue-600"
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: MORE INFO */}
      {activeTab === "more" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Notes & Additional Description
          </h2>
          <div>
            <textarea
              rows={6}
              placeholder="Catatan proyek, lingkup pekerjaan (SOW), deliverables..."
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectFormPage;
