import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Layers, Award, Settings, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import {
  DropResult,
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
export interface Module {
  id: string;
  title: string;
  is_published?: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  is_preview?: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  lesson_id?: string;
  is_published?: boolean;
}

export type ActiveType =
  | "module"
  | "lesson"
  | "quiz"
  | "students"
  | "assignments"
  | "certificate"
  | null;

interface CourseSidebarProps {
  sidebarOpen: boolean;
  modules: Module[];
  lessonsByModule: Record<string, Lesson[]>;
  quizzesByModule: Record<string, Quiz[]>;
  expandedModules: Record<string, boolean>;
  toggleModule: (id: string) => void;
  selectedModuleId: string | null;
  selectedLessonId: string | null;
  activeType: ActiveType;
  handleSelectModule: (mod: Module) => void;
  handleSelectLesson: (les: Lesson) => void;
  handleCreateNewLesson: (modId: string) => void;
  deleteModule: (modId: string) => void;
  deleteLesson: (modId: string, lesId: string) => void;
  canManageCourses: boolean;
  handleOnDragEnd: (result: DropResult) => void;
  navigate: (path: string) => void;
  handleCreateNewQuiz: (modId: string, lesId?: string) => void;
  handleSelectQuiz: (quiz: Quiz) => void;
  ModuleItem: React.ComponentType<ModuleItemProps>;
  onOpenSettings: () => void;
}

// ─── Course Sidebar ────────────────────────────────────────────────────────────

export const CourseSidebar: React.FC<CourseSidebarProps> = ({
  sidebarOpen,
  modules,
  lessonsByModule,
  quizzesByModule,
  expandedModules,
  toggleModule,
  selectedModuleId,
  selectedLessonId,
  activeType,
  handleSelectModule,
  handleSelectLesson,
  handleCreateNewLesson,
  deleteModule,
  deleteLesson,
  canManageCourses,
  handleOnDragEnd,
  navigate,
  handleCreateNewQuiz,
  handleSelectQuiz,
  ModuleItem,
  onOpenSettings,
}) => {
  return (
    <aside
      className={cn(
        "flex flex-col border-r border-zinc-200 bg-white transition-all duration-200 shrink-0",
        // SOLUSI: Menambahkan 'w-72' agar lebar konsisten dan fitur truncate teks berjalan maksimal
        sidebarOpen ? "w-72" : "w-0 overflow-hidden"
      )}
    >
      <div className="px-3 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
            Daftar Unit
          </span>
        </div>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {modules.length}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        <DragDropContext onDragEnd={handleOnDragEnd}>
          <Droppable droppableId="modules-droppable">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2 min-w-0 w-full"
              >
                {modules.length === 0 && (
                  <div className="text-center py-10 text-zinc-400">
                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">Belum ada unit</p>
                    <p className="text-[11px] opacity-70 mt-1">
                      Klik "Unit Baru" untuk mulai
                    </p>
                  </div>
                )}

                {modules.map((mod, index) => {
                  const lessons = lessonsByModule[mod.id] || [];
                  const quizzes = quizzesByModule[mod.id] || [];
                  const isExpanded = expandedModules[mod.id] !== false;

                  return (
                    <Draggable
                      key={mod.id}
                      draggableId={mod.id}
                      index={index}
                      isDragDisabled={!canManageCourses}
                    >
                      {(provided, snapshot) => (
                        <ModuleItem
                          mod={mod}
                          index={index}
                          lessons={lessons}
                          quizzes={quizzes}
                          isExpanded={isExpanded}
                          onToggle={() => toggleModule(mod.id)}
                          selectedModuleId={selectedModuleId}
                          selectedLessonId={selectedLessonId}
                          activeType={activeType}
                          onSelectModule={handleSelectModule}
                          onSelectLesson={handleSelectLesson}
                          onAddLesson={handleCreateNewLesson}
                          onDeleteModule={deleteModule}
                          onDeleteLesson={deleteLesson}
                          canManage={canManageCourses}
                          provided={provided}
                          snapshot={snapshot}
                          navigate={navigate}
                          handleCreateNewQuiz={handleCreateNewQuiz}
                          handleSelectQuiz={handleSelectQuiz}
                        />
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* Certificate & Course Settings links */}
      {canManageCourses && (
        <div className="border-t border-zinc-100 px-3 py-3 space-y-1">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <Settings className="h-4 w-4 text-zinc-400" />
            Pengaturan Course
          </button>

          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("set-active-type", { detail: "students" })
              );
            }}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeType === "students"
                ? "bg-indigo-50 text-indigo-700"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            <Users className="h-4 w-4 text-zinc-400" />
            Partner
          </button>

          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("set-active-type", { detail: "assignments" })
              );
            }}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeType === "assignments"
                ? "bg-indigo-50 text-indigo-700"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            <FileText className="h-4 w-4 text-zinc-400" />
            Tugas
          </button>

          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("set-active-type", { detail: "certificate" })
              );
            }}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeType === "certificate"
                ? "bg-amber-50 text-amber-700"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            <Award className="h-4 w-4 text-zinc-400" />
            Template Sertifikat
          </button>
        </div>
      )}
    </aside>
  );
};