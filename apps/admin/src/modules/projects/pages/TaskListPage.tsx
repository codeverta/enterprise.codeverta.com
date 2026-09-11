import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  FolderKanban,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { projectsApi, type Task, type TaskOptions, type TaskStatus } from "../api";

export function TaskListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [options, setOptions] = useState<TaskOptions | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters from query params
  const initialProject = searchParams.get("project_id") || "all";
  const initialStatus = searchParams.get("status") || "all";

  const [projectFilter, setProjectFilter] = useState<string>(initialProject);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await projectsApi.listTasks({
        project_id: projectFilter !== "all" ? projectFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        q: searchQuery || undefined,
      });
      setTasks(res.data.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Gagal memuat daftar task");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    projectsApi.getTaskOptions().then((res) => setOptions(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [projectFilter, statusFilter, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTasks();
  };

  const handleProjectFilterChange = (val: string) => {
    setProjectFilter(val);
    if (val === "all") searchParams.delete("project_id");
    else searchParams.set("project_id", val);
    setSearchParams(searchParams, { replace: true });
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    if (val === "all") searchParams.delete("status");
    else searchParams.set("status", val);
    setSearchParams(searchParams, { replace: true });
  };

  const handleDelete = async (id: string, subject: string) => {
    if (!window.confirm(`Hapus task "${subject}"?`)) return;
    try {
      await projectsApi.deleteTask(id);
      toast.success("Task berhasil dihapus");
      fetchTasks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menghapus task");
    }
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const openCount = tasks.filter((t) => t.status === "Open").length;
    const workingCount = tasks.filter((t) => t.status === "Working").length;
    const completedCount = tasks.filter((t) => t.status === "Completed").length;
    return { total, openCount, workingCount, completedCount };
  }, [tasks]);

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case "Open":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Open</Badge>;
      case "Working":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Working</Badge>;
      case "Pending Review":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Pending Review</Badge>;
      case "Completed":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Completed</Badge>;
      case "Overdue":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Overdue</Badge>;
      case "Cancelled":
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return <Badge className="bg-rose-600 text-white border-none">Urgent</Badge>;
      case "high":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">High</Badge>;
      case "medium":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Medium</Badge>;
      case "low":
        return <Badge className="bg-slate-50 text-slate-700 border-slate-200">Low</Badge>;
      default:
        return <Badge variant="outline">{priority || "Medium"}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Tasks</h1>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              Task Management
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Daftar tugas, pencatatan waktu, progres pengerjaan, milestone, dan dependensi antar tugas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => navigate("/desk/project")}
            className="rounded-xl border-slate-200"
          >
            <FolderKanban className="size-4 mr-1.5 text-slate-600" />
            View Projects
          </Button>
          <Button
            onClick={() => navigate("/desk/task/new")}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Plus className="size-4 mr-1.5" />
            New Task
          </Button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Tasks
            </span>
            <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
              <FolderKanban className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-400 mt-0.5">Semua task yang tercatat</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Open Tasks
            </span>
            <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-900">{stats.openCount}</p>
          <p className="text-xs text-blue-600/80 mt-0.5">Task menunggu pengerjaan</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              In Progress
            </span>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900">{stats.workingCount}</p>
          <p className="text-xs text-amber-600/80 mt-0.5">Task sedang dikerjakan</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Completed
            </span>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{stats.completedCount}</p>
          <p className="text-xs text-emerald-600/80 mt-0.5">Task telah selesai</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Cari judul task, nomor task, project, atau PIC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Project:</span>
              <select
                aria-label="Filter Project"
                value={projectFilter}
                onChange={(e) => handleProjectFilterChange(e.target.value)}
                className="h-10 max-w-[200px] truncate rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Project</option>
                {(options?.projects || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                aria-label="Filter Status"
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="Open">Open</option>
                <option value="Working">Working</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Overdue">Overdue</option>
                <option value="Template">Template</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Priority:</span>
              <select
                aria-label="Filter Priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Prioritas</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={fetchTasks}
              className="h-10 rounded-xl border-slate-200 px-3"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </form>
      </div>

      {/* Tasks Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Subject & Code</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">% Progress</th>
                <th className="px-4 py-3">Expected End</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto size-6 animate-spin text-blue-600 mb-2" />
                    Memuat daftar tugas...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <FolderKanban className="mx-auto size-8 text-slate-300 mb-2" />
                    Tidak ada tugas yang ditemukan.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {task.color && (
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: task.color }}
                          />
                        )}
                        <div>
                          <button
                            type="button"
                            onClick={() => navigate(`/desk/task/${encodeURIComponent(task.id)}`)}
                            className="font-semibold text-slate-900 hover:text-blue-600 text-left block"
                          >
                            {task.subject}
                          </button>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-slate-400 font-mono">{task.task_code}</span>
                            {task.is_milestone && (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                                Milestone
                              </Badge>
                            )}
                            {task.is_group && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-500">
                                Group
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {task.project_name ? (
                        <button
                          type="button"
                          onClick={() =>
                            task.project_id &&
                            navigate(`/desk/project/${encodeURIComponent(task.project_id)}`)
                          }
                          className="text-xs font-medium text-slate-700 hover:text-blue-600 underline-offset-2 hover:underline text-left block"
                        >
                          {task.project_name}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(task.status)}</td>
                    <td className="px-4 py-3.5">{getPriorityBadge(task.priority)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(task.progress || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-700">
                          {Math.round(task.progress || 0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {task.exp_end_date ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 text-slate-400" />
                          {task.exp_end_date.slice(0, 10)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {task.assigned_to || "-"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/desk/task/${encodeURIComponent(task.id)}`)}
                          className="h-8 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(task.id, task.subject)}
                          className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
    </div>
  );
}

export default TaskListPage;
