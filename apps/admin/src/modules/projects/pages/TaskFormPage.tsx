import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  FolderKanban,
  Save,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  projectsApi,
  type Task,
  type TaskOptions,
  type TaskPriority,
  type TaskStatus,
} from "../api";

export function TaskFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isNew = !id || id.startsWith("new");
  const prefillProjectID = searchParams.get("project_id") || "";

  const [activeTab, setActiveTab] = useState<"details" | "timeline" | "dependencies" | "more">("details");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<TaskOptions | null>(null);

  const [form, setForm] = useState<Partial<Task>>({
    subject: "",
    project_id: prefillProjectID || null,
    project_name: "",
    issue: "",
    type: "Task",
    color: "#3B82F6",
    is_group: false,
    status: "Open",
    priority: "Medium",
    task_weight: 1,
    parent_task_id: null,
    is_template: false,
    exp_start_date: "",
    expected_time: 0,
    exp_end_date: "",
    act_start_date: "",
    act_end_date: "",
    actual_time: 0,
    progress: 0,
    is_milestone: false,
    description: "",
    depends_on_tasks: "",
    assigned_to: "",
  });

  useEffect(() => {
    projectsApi.getTaskOptions().then((res) => {
      setOptions(res.data);
      if (prefillProjectID && (!form.project_name || form.project_name === "")) {
        const found = res.data.projects.find((p) => p.id === prefillProjectID);
        if (found) {
          setForm((prev) => ({ ...prev, project_id: found.id, project_name: found.project_name }));
        }
      }
    }).catch((err) => console.error(err));

    if (!isNew && id) {
      setLoading(true);
      projectsApi
        .getTask(id)
        .then((res) => {
          const t = res.data.data;
          setForm({
            ...t,
            exp_start_date: t.exp_start_date ? t.exp_start_date.slice(0, 10) : "",
            exp_end_date: t.exp_end_date ? t.exp_end_date.slice(0, 10) : "",
            act_start_date: t.act_start_date ? t.act_start_date.slice(0, 10) : "",
            act_end_date: t.act_end_date ? t.act_end_date.slice(0, 10) : "",
          });
        })
        .catch((err) => {
          toast.error(err.response?.data?.error || "Gagal memuat detail task");
          navigate("/desk/task");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate, prefillProjectID]);

  const handleSave = async () => {
    if (!form.subject?.trim()) {
      toast.error("Subject task wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Task> = {
        ...form,
        exp_start_date: form.exp_start_date ? new Date(form.exp_start_date).toISOString() : null,
        exp_end_date: form.exp_end_date ? new Date(form.exp_end_date).toISOString() : null,
        act_start_date: form.act_start_date ? new Date(form.act_start_date).toISOString() : null,
        act_end_date: form.act_end_date ? new Date(form.act_end_date).toISOString() : null,
      };

      if (isNew) {
        const res = await projectsApi.createTask(payload);
        toast.success(res.data.message || "Task berhasil dibuat");
        navigate(`/desk/task/${encodeURIComponent(res.data.data.id)}`);
      } else if (id) {
        const res = await projectsApi.updateTask(id, payload);
        toast.success(res.data.message || "Task berhasil diperbarui");
        setForm(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menyimpan task");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!window.confirm("Yakin ingin menghapus task ini?")) return;
    try {
      await projectsApi.deleteTask(id);
      toast.success("Task berhasil dihapus");
      navigate("/desk/task");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menghapus task");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center text-slate-500">Memuat detail task...</div>
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
            onClick={() => navigate("/desk/task")}
            className="rounded-xl h-9 w-9 p-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                {isNew ? "New Task" : form.subject || "Task"}
              </h1>
              <Badge variant="outline" className="bg-slate-50 text-slate-600 font-mono text-xs">
                {isNew ? "Not Saved" : form.task_code || form.id}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isNew
                ? "Buat tugas baru dan kaitkan dengan proyek"
                : `Project: ${form.project_name || "None"} · Status: ${form.status} · Progress: ${Math.round(form.progress || 0)}%`}
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
            {saving ? "Menyimpan..." : "Save Task"}
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
          <FolderKanban className="size-4" />
          Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("timeline")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "timeline"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Clock className="size-4" />
          Timeline
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("dependencies")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "dependencies"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Flag className="size-4" />
          Dependencies
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
              Task Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">
                  Subject <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Desain skema arsitektur database"
                  value={form.subject || ""}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Project</label>
                <select
                  aria-label="Project"
                  value={form.project_id || ""}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const pObj = options?.projects.find((p) => p.id === pid);
                    setForm({
                      ...form,
                      project_id: pid || null,
                      project_name: pObj?.project_name || "",
                    });
                  }}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Project (Optional) --</option>
                  {(options?.projects || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_name} ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Issue</label>
                <Input
                  placeholder="ID Issue terkait (e.g. ISS-001)"
                  value={form.issue || ""}
                  onChange={(e) => setForm({ ...form, issue: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Type</label>
                <select
                  aria-label="Type"
                  value={form.type || "Task"}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {(options?.types || ["Task", "Milestone", "Bug", "Enhancement", "Documentation"]).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Color</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={form.color || "#3B82F6"}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-10 w-12 rounded-xl border border-slate-200 p-1 cursor-pointer bg-white"
                  />
                  <Input
                    value={form.color || "#3B82F6"}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-10 rounded-xl font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Status</label>
                <select
                  aria-label="Status"
                  value={form.status || "Open"}
                  onChange={(e) => {
                    const st = e.target.value as TaskStatus;
                    setForm({
                      ...form,
                      status: st,
                      progress: st === "Completed" ? 100 : form.progress,
                    });
                  }}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Open">Open</option>
                  <option value="Working">Working</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Template">Template</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Priority</label>
                <select
                  aria-label="Priority"
                  value={form.priority || "Medium"}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Weight</label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={form.task_weight ?? 1}
                  onChange={(e) => setForm({ ...form, task_weight: parseFloat(e.target.value) || 1 })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Parent Task</label>
                <select
                  aria-label="Parent Task"
                  value={form.parent_task_id || ""}
                  onChange={(e) => setForm({ ...form, parent_task_id: e.target.value || null })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Tidak ada Parent Task --</option>
                  {(options?.parent_tasks || []).map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.subject} ({pt.task_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_group)}
                    onChange={(e) => setForm({ ...form, is_group: e.target.checked })}
                    className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Is Group (Bisa punya sub-task)
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_template)}
                    onChange={(e) => setForm({ ...form, is_template: e.target.checked })}
                    className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Is Template
                </label>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Task Description
            </h2>
            <textarea
              rows={5}
              placeholder="Jelaskan instruksi pengerjaan task ini..."
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Tab: TIMELINE */}
      {activeTab === "timeline" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Timeline & Progress
            </h2>
            <Badge variant="outline" className="bg-slate-50 text-slate-600 text-xs">
              Timezone: Asia/Jakarta
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Expected Start Date <span className="text-[11px] text-slate-400">(Asia/Jakarta)</span>
              </label>
              <Input
                type="date"
                value={form.exp_start_date || ""}
                onChange={(e) => setForm({ ...form, exp_start_date: e.target.value })}
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Expected End Date <span className="text-[11px] text-slate-400">(Asia/Jakarta)</span>
              </label>
              <Input
                type="date"
                value={form.exp_end_date || ""}
                onChange={(e) => setForm({ ...form, exp_end_date: e.target.value })}
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Expected Time (in hours)
              </label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={form.expected_time ?? 0}
                onChange={(e) => setForm({ ...form, expected_time: parseFloat(e.target.value) || 0 })}
                className="mt-1 h-10 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Actual Time Spent (in hours)
              </label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={form.actual_time ?? 0}
                onChange={(e) => setForm({ ...form, actual_time: parseFloat(e.target.value) || 0 })}
                className="mt-1 h-10 rounded-xl font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">% Progress</label>
                <span className="text-xs font-bold text-blue-600">{Math.round(form.progress || 0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={form.progress || 0}
                onChange={(e) => {
                  const p = parseInt(e.target.value, 10);
                  setForm({
                    ...form,
                    progress: p,
                    status: p === 100 ? "Completed" : form.status === "Completed" ? "Working" : form.status,
                  });
                }}
                className="w-full accent-blue-600 h-2 bg-slate-100 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_milestone"
                checked={Boolean(form.is_milestone)}
                onChange={(e) => setForm({ ...form, is_milestone: e.target.checked })}
                className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is_milestone" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Is Milestone (Tandai sebagai tonggak penting proyek)
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab: DEPENDENCIES */}
      {activeTab === "dependencies" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Dependencies & Predecessor Tasks
          </h2>
          <div>
            <label className="text-xs font-semibold text-slate-700">Depends On Tasks</label>
            <Input
              placeholder="Task code yang harus diselesaikan lebih dulu, e.g. TASK-2026-0001, TASK-2026-0002"
              value={form.depends_on_tasks || ""}
              onChange={(e) => setForm({ ...form, depends_on_tasks: e.target.value })}
              className="mt-1 h-10 rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Tab: MORE INFO */}
      {activeTab === "more" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Assignment & Actual Dates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Assigned To (PIC)</label>
              <Input
                placeholder="Nama atau Email karyawan penanggung jawab"
                value={form.assigned_to || ""}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Actual Start Date</label>
              <Input
                type="date"
                value={form.act_start_date || ""}
                onChange={(e) => setForm({ ...form, act_start_date: e.target.value })}
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Actual End Date</label>
              <Input
                type="date"
                value={form.act_end_date || ""}
                onChange={(e) => setForm({ ...form, act_end_date: e.target.value })}
                className="mt-1 h-10 rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskFormPage;
