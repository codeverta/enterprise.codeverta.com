import React from 'react'
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Copy, GripVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MarkdownView from './MarkdownView';

function QuestionList({
  questions,
  isAdmin,
  onEdit,
  onDuplicate,
  onDelete,
  onDragEnd,
  sidebar = false,
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-white shadow-sm",
        sidebar ? "p-4 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto" : "p-5"
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-zinc-800">Question List</h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {questions.length} soal di quiz ini
          </p>
        </div>
        <span className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-600">
          {questions.length}
        </span>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="questions-droppable">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-3"
            >
              {questions.map((question, index) => (
                <Draggable
                  key={question.id}
                  draggableId={question.id}
                  index={index}
                  isDragDisabled={!isAdmin}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        "rounded-lg border bg-white transition-all duration-150",
                        sidebar ? "p-3" : "p-4",
                        snapshot.isDragging
                          ? "shadow-lg border-indigo-300 ring-1 ring-indigo-100"
                          : "hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1">
                          {isAdmin && (
                            <div
                              {...provided.dragHandleProps}
                              className="text-zinc-300 hover:text-zinc-500 p-0.5 cursor-grab active:cursor-grabbing shrink-0 mt-0.5"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="font-semibold text-xs text-zinc-800 flex items-start gap-1 leading-relaxed">
                              <span>{index + 1}.</span>
                              <div className="flex-1">
                                <MarkdownView
                                  content={question.question_text}
                                />
                              </div>
                            </div>
                            <p className="mt-1 text-[10px] text-zinc-400 uppercase font-mono">
                              {question.question_type} / {question.points} poin
                            </p>
                            {question.always_correct && (
                              <span className="mt-1.5 inline-flex rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Always correct
                              </span>
                            )}
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              title="Edit soal"
                              onClick={() => onEdit(question)}
                            >
                              <Pencil className="h-3.5 w-3.5 text-zinc-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              title="Duplikasi soal"
                              onClick={() => onDuplicate(question.id)}
                            >
                              <Copy className="h-3.5 w-3.5 text-zinc-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 w-7 p-0"
                              title="Hapus soal"
                              onClick={() => onDelete(question.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div
                        className={cn(
                          "mt-3 grid gap-2 pl-6",
                          sidebar ? "grid-cols-1" : "md:grid-cols-2"
                        )}
                      >
                        {(question.options || []).map((option) => (
                          <div
                            key={option.id || option.option_text}
                            className="rounded bg-zinc-50 px-3 py-1.5 text-xs flex justify-between items-center border border-transparent"
                          >
                            <span>{option.option_text}</span>
                            {option.is_correct && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                                Kunci
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {questions.length === 0 && (
        <div className="rounded-lg border border-dashed p-5 text-center text-xs text-zinc-400">
          Belum ada soal terdaftar
        </div>
      )}
    </section>
  );
}

export default QuestionList
