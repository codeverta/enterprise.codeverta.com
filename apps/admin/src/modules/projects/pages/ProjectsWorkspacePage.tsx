import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FolderKanban,
  Layers,
  Plus,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { projectsApi, type Project, type Task } from "../api";

export function ProjectsWorkspacePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      projectsApi.listProjects({ status: "Open" }),
      projectsApi.listTasks({ status: "Open" }),
    ])
      .then(([pRes, tRes]) => {
        setProjects(pRes.data.data || []);
        setTasks(tRes.data.data || []);
      })
      .catch((err) => console.error("Error loading workspace data", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-7">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Projects</h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Workspace
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Pusat manajemen proyek, pembagian tugas tim, pelacakan linimasa, dan progress pencapaian.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => navigate("/desk/task/new")}
            className="rounded-xl border-slate-200"
          >
            <Plus className="size-4 mr-1.5" />
            New Task
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

      {/* Shortcuts Cards */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Quick Navigation & Documents
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => navigate("/desk/project")}
            className="rounded-2xl border border-slate-200 bg-white p-4.5 text-left transition hover:border-blue-300 hover:shadow-xs group"
          >
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 w-fit group-hover:bg-blue-600 group-hover:text-white transition">
              <Briefcase className="size-5" />
            </div>
            <h3 className="mt-3 font-bold text-slate-900 group-hover:text-blue-600 transition">Project</h3>
            <p className="text-xs text-slate-400 mt-0.5">Daftar semua proyek & rencana kerja</p>
          </button>

          <button
            type="button"
            onClick={() => navigate("/desk/task")}
            className="rounded-2xl border border-slate-200 bg-white p-4.5 text-left transition hover:border-blue-300 hover:shadow-xs group"
          >
            <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600 w-fit group-hover:bg-purple-600 group-hover:text-white transition">
              <FolderKanban className="size-5" />
            </div>
            <h3 className="mt-3 font-bold text-slate-900 group-hover:text-purple-600 transition">Task</h3>
            <p className="text-xs text-slate-400 mt-0.5">Rincian penugasan & milestone</p>
          </button>

          <button
            type="button"
            onClick={() => navigate("/desk/project?status=Open")}
            className="rounded-2xl border border-slate-200 bg-white p-4.5 text-left transition hover:border-emerald-300 hover:shadow-xs group"
          >
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 w-fit group-hover:bg-emerald-600 group-hover:text-white transition">
              <TrendingUp className="size-5" />
            </div>
            <h3 className="mt-3 font-bold text-slate-900 group-hover:text-emerald-600 transition">
              Open Projects
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{projects.length} proyek aktif berjalan</p>
          </button>

          <button
            type="button"
            onClick={() => navigate("/desk/timesheet")}
            className="rounded-2xl border border-slate-200 bg-white p-4.5 text-left transition hover:border-amber-300 hover:shadow-xs group"
          >
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 w-fit group-hover:bg-amber-600 group-hover:text-white transition">
              <Clock className="size-5" />
            </div>
            <h3 className="mt-3 font-bold text-slate-900 group-hover:text-amber-600 transition">Timesheet</h3>
            <p className="text-xs text-slate-400 mt-0.5">Catatan jam kerja per aktivitas</p>
          </button>
        </div>
      </div>

      {/* Two Column Layout: Active Projects & Recent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Projects */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="size-4 text-blue-600" />
              Active Projects ({projects.length})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/desk/project?status=Open")}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              View All <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
              Tidak ada proyek aktif saat ini.
            </div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/desk/project/${encodeURIComponent(p.id)}`)}
                  className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">{p.project_name}</span>
                    <Badge variant="outline" className="text-[11px] font-mono">
                      {p.id}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>{p.customer || p.department || "Internal"}</span>
                    <span className="font-bold text-blue-600">{Math.round(p.percent_complete || 0)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(p.percent_complete || 0, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Open Tasks */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderKanban className="size-4 text-purple-600" />
              Open Tasks ({tasks.length})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/desk/task")}
              className="text-xs text-purple-600 hover:text-purple-700"
            >
              View All <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </div>

          {tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
              Tidak ada task yang sedang menunggu pengerjaan.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/desk/task/${encodeURIComponent(t.id)}`)}
                  className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 cursor-pointer transition flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="font-semibold text-sm text-slate-900 block">{t.subject}</span>
                    <span className="text-xs text-slate-400 mt-0.5 block">
                      {t.project_name ? `${t.project_name} · ` : ""}
                      {t.assigned_to ? `PIC: ${t.assigned_to}` : "Unassigned"}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {t.priority}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectsWorkspacePage;
