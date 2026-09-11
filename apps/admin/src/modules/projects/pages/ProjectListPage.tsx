import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  FolderKanban,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { projectsApi, type Project, type ProjectStatus } from "../api";

export function ProjectListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters initialized from URL search params if present
  const initialStatus = searchParams.get("status") || "all";
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await projectsApi.listProjects({
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        q: searchQuery || undefined,
      });
      setProjects(res.data.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Gagal memuat daftar proyek");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [statusFilter, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjects();
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    if (status === "all") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", status);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus proyek "${name}"?`)) return;
    try {
      await projectsApi.deleteProject(id);
      toast.success("Proyek berhasil dihapus");
      fetchProjects();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menghapus proyek");
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = projects.length;
    const openCount = projects.filter((p) => p.status === "Open").length;
    const completedCount = projects.filter((p) => p.status === "Completed").length;
    const avgProgress =
      total > 0
        ? Math.round(projects.reduce((acc, p) => acc + (p.percent_complete || 0), 0) / total)
        : 0;
    return { total, openCount, completedCount, avgProgress };
  }, [projects]);

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case "Open":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Open</Badge>;
      case "Completed":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Completed</Badge>;
      case "Cancelled":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">High</Badge>;
      case "medium":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Medium</Badge>;
      case "low":
        return <Badge className="bg-slate-50 text-slate-700 border-slate-200">Low</Badge>;
      default:
        return <Badge variant="outline">{priority || "Normal"}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Projects</h1>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
              Projects & Tasks
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Kelola proyek, pelacakan progres (% complete), tenggat waktu, dan alokasi tugas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => navigate("/desk/task")}
            className="rounded-xl border-slate-200"
          >
            <FolderKanban className="size-4 mr-1.5 text-slate-600" />
            View Tasks
          </Button>
          <Button
            onClick={() => navigate("/desk/project/new")}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Plus className="size-4 mr-1.5" />
            New Project
          </Button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Projects
            </span>
            <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
              <Briefcase className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-400 mt-0.5">Semua proyek terdaftar</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Open Projects
            </span>
            <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-900">{stats.openCount}</p>
          <p className="text-xs text-blue-600/80 mt-0.5">Proyek sedang aktif berjalan</p>
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
          <p className="text-xs text-emerald-600/80 mt-0.5">Proyek telah rampung</p>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Avg Progress
            </span>
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
              <FolderKanban className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-900">{stats.avgProgress}%</p>
          <div className="w-full bg-indigo-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(stats.avgProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Cari nama proyek, nomor ID, customer, atau departemen..."
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
                <option value="Open">Open</option>
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
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={fetchProjects}
              className="h-10 rounded-xl border-slate-200 px-3"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </form>
      </div>

      {/* Projects Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Project Name & ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">% Complete</th>
                <th className="px-4 py-3">Customer / Dept</th>
                <th className="px-4 py-3">Expected End</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto size-6 animate-spin text-blue-600 mb-2" />
                    Memuat data proyek...
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Briefcase className="mx-auto size-8 text-slate-300 mb-2" />
                    Tidak ada proyek yang sesuai kriteria.
                  </td>
                </tr>
              ) : (
                projects.map((proj) => (
                  <tr key={proj.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/desk/project/${encodeURIComponent(proj.id)}`)}
                        className="font-semibold text-slate-900 hover:text-blue-600 text-left block"
                      >
                        {proj.project_name}
                      </button>
                      <span className="text-xs text-slate-400 font-mono">{proj.id}</span>
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(proj.status)}</td>
                    <td className="px-4 py-3.5">{getPriorityBadge(proj.priority)}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {proj.percent_complete_method || "Task Completion"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(proj.percent_complete || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-10">
                          {Math.round(proj.percent_complete || 0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-slate-800 font-medium">
                        {proj.customer || "-"}
                      </div>
                      <div className="text-[11px] text-slate-400">{proj.department || "-"}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {proj.expected_end_date ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 text-slate-400" />
                          {proj.expected_end_date.slice(0, 10)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/desk/project/${encodeURIComponent(proj.id)}`)}
                          className="h-8 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(proj.id, proj.project_name)}
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

export default ProjectListPage;
