import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight, FileQuestion, GripVertical, Plus, Trash2, CheckCircle2 } from "lucide-react";
import {cn} from "@/lib/utils";
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

export interface ModuleItemProps {
  mod: Module;
  index: number;
  lessons: Lesson[];
  quizzes: Quiz[];
  isExpanded: boolean;
  onToggle: () => void;
  selectedModuleId: string | null;
  selectedLessonId: string | null;
  activeType: ActiveType;
  onSelectModule: (mod: Module) => void;
  onSelectLesson: (les: Lesson) => void;
  onAddLesson: (modId: string) => void;
  onDeleteModule: (modId: string) => void;
  onDeleteLesson: (modId: string, lesId: string) => void;
  canManage: boolean;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  navigate: (path: string) => void;
  handleCreateNewQuiz: (modId: string, lesId?: string) => void;
  handleSelectQuiz: (quiz: Quiz) => void;
}
// ─── Module Item ───────────────────────────────────────────────────────────────

export const ModuleItem: React.FC<ModuleItemProps> = ({
  mod,
  index,
  lessons,
  quizzes,
  isExpanded,
  onToggle,
  selectedModuleId,
  selectedLessonId,
  activeType,
  onSelectModule,
  onSelectLesson,
  onAddLesson,
  onDeleteModule,
  onDeleteLesson,
  canManage,
  provided,
  snapshot,
  navigate,
  handleCreateNewQuiz,
  handleSelectQuiz,
}) => {
  const isModActive = selectedModuleId === mod.id && activeType === "module";

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={cn(
        "rounded-lg border transition-all duration-150 overflow-hidden",
        snapshot.isDragging
          ? "shadow-lg border-indigo-300 bg-white"
          : "border-zinc-200 bg-white hover:border-zinc-300",
        isModActive && "border-indigo-400 ring-1 ring-indigo-200"
      )}
    >
      {/* Module Header */}
      <div className="flex items-center gap-1 px-2 py-2">
        {canManage && (
          <div
            {...provided.dragHandleProps}
            className="text-zinc-300 hover:text-zinc-500 p-1 cursor-grab active:cursor-grabbing transition-colors"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-600 transition-colors p-0.5 rounded shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        <div
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer py-0.5"
          onClick={() => onSelectModule(mod)}
        >
          <span className="text-[10px] font-bold text-indigo-400 shrink-0 font-mono">
            {index + 1}
          </span>
          <span
            className={cn(
              "text-sm font-medium flex-1 min-w-0 truncate transition-colors",
              isModActive ? "text-indigo-700" : "text-zinc-800"
            )}
            title={mod.title}
          >
            {mod.title}
          </span>
          {!mod.is_published && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 h-4 border-amber-300 text-amber-600 shrink-0"
            >
              Draft
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {canManage && (
            <div className="flex items-center gap-0.5 shrink-0">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onAddLesson(mod.id)}
                      className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Tambah Lesson
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleCreateNewQuiz(mod.id)}
                      className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <FileQuestion className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Tambah Quiz
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => onDeleteModule(mod.id)}
              className="h-6 w-6 rounded flex items-center justify-center text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Lessons */}
      {isExpanded && (
        <div className="px-2 pb-2 space-y-0.5 bg-zinc-50/60">
          {lessons.length === 0 && (
            <p className="text-[11px] text-zinc-400 italic px-2 py-1.5">
              Belum ada lesson
            </p>
          )}
          {lessons.map((les, lIdx) => {
            const isLesActive =
              selectedLessonId === les.id && activeType === "lesson";
            const lessonQuizzes = quizzes.filter(
              (quiz) => quiz.lesson_id === les.id
            );

            return (
              <React.Fragment key={les.id}>
                <div
                  className={cn(
                    "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all min-w-0",
                    isLesActive
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  )}
                  onClick={() => onSelectLesson(les)}
                >
                  <span
                    className={cn(
                      "text-[10px] font-mono shrink-0",
                      isLesActive ? "text-indigo-200" : "text-zinc-400"
                    )}
                  >
                    {index + 1}.{lIdx + 1}
                  </span>
                  <span
                    className="text-xs font-medium flex-1 min-w-0 truncate"
                    title={les.title}
                  >
                    {les.title}
                  </span>
                  {les.is_preview && (
                    <Badge
                      className={cn(
                        "text-[9px] px-1 py-0 h-4 shrink-0",
                        isLesActive
                          ? "bg-indigo-500 text-indigo-100"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200"
                      )}
                    >
                      Free
                    </Badge>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateNewQuiz(mod.id, les.id);
                      }}
                      className={cn(
                        "h-4 w-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0",
                        isLesActive
                          ? "text-indigo-200 hover:text-white"
                          : "text-zinc-400 hover:text-blue-500"
                      )}
                      title="Tambah quiz ke lesson"
                    >
                      <FileQuestion className="h-2.5 w-2.5" />
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLesson(mod.id, les.id);
                      }}
                      className={cn(
                        "h-4 w-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0",
                        isLesActive
                          ? "text-indigo-200 hover:text-white"
                          : "text-zinc-400 hover:text-rose-500"
                      )}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>

                {lessonQuizzes.map((quiz, qIdx) => {
                  const isQuizActive =
                    selectedLessonId === quiz.id && activeType === "quiz";
                  return (
                    <button
                      key={quiz.id}
                      type="button"
                      onClick={() => handleSelectQuiz(quiz)}
                      className={cn(
                        "group ml-5 flex w-[calc(100%-1.25rem)] items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors min-w-0",
                        isQuizActive
                          ? "bg-indigo-600 text-white"
                          : "text-blue-600 hover:bg-blue-50"
                      )}
                    >
                      <FileQuestion
                        className={cn(
                          "h-3 w-3 shrink-0",
                          isQuizActive ? "text-white" : "text-blue-400"
                        )}
                      />
                      <span
                        className="flex-1 min-w-0 truncate"
                        title={quiz.title}
                      >
                        {" "}
                        Quiz Lesson {qIdx + 1}: {quiz.title}
                      </span>
                      {quiz.is_published && (
                        <CheckCircle2
                          className={cn(
                            "h-3 w-3 shrink-0",
                            isQuizActive ? "text-white" : "text-emerald-500"
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}

          {quizzes
            .filter((quiz) => !quiz.lesson_id)
            .map((quiz, qIdx) => {
              const isQuizActive =
                selectedLessonId === quiz.id && activeType === "quiz";
              return (
                <button
                  key={quiz.id}
                  type="button"
                  onClick={() => handleSelectQuiz(quiz)}
                  className={cn(
                    "group flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors min-w-0",
                    isQuizActive
                      ? "bg-indigo-600 text-white"
                      : "text-blue-600 hover:bg-blue-50"
                  )}
                >
                  <FileQuestion
                    className={cn(
                      "h-3 w-3 shrink-0",
                      isQuizActive ? "text-white" : "text-blue-400"
                    )}
                  />
                  <span className="truncate flex-1" title={quiz.title}>
                    Quiz {qIdx + 1}: {quiz.title}
                  </span>
                  {quiz.is_published && (
                    <CheckCircle2
                      className={cn(
                        "h-3 w-3 shrink-0",
                        isQuizActive ? "text-white" : "text-emerald-500"
                      )}
                    />
                  )}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default ModuleItem;