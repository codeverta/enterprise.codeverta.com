import React from "react";
import {
  ArrowLeft,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Eye,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const CourseHeader = ({
  course,
  sidebarOpen,
  setSidebarOpen,
  navigate,
  setModuleForm,
  emptyModuleForm,
  loadModules,
  setActiveType,
}) => {
  return (
    <header className="h-14 border-b border-zinc-200 bg-white flex items-center gap-3 px-4 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
        <BookOpen className="h-4 w-4 text-white" />
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="text-sm font-semibold text-zinc-900 truncate">
          {course?.title || "Manajemen Konten Kursus"}
        </h1>
        <p className="text-[11px] text-zinc-400 mt-px">
          Kurikulum & Silabus Editor
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen((v) => !v)}
          className="h-8 gap-1.5 text-xs text-zinc-500 hidden md:flex"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          )}
          {sidebarOpen ? "Tutup Panel" : "Buka Panel"}
        </Button>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`?view=true`)}
          className="h-8 gap-1.5 text-xs"
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Preview</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setModuleForm(emptyModuleForm);
            setActiveType && setActiveType("module");
          }}
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Unit Baru</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => loadModules && loadModules(course?.id)}
          className="h-8 w-8 p-0 text-zinc-400"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
};
