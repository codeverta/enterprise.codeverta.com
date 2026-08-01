import { BookOpen, X } from 'lucide-react';
import React from 'react'

/* ─────────────────────────────────────────────
   Lesson context banner
   (shown when navigating from a lesson page)
───────────────────────────────────────────── */
function LessonContextBanner({ context, onDismiss, onInsert }) {
  if (!context.lesson_id) return null;
  return (
    <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50 px-4 py-2.5 text-sm">
      <BookOpen className="h-4 w-4 flex-shrink-0 text-blue-500" />
      <div className="min-w-0 flex-1">
        <span className="text-blue-700">Bertanya tentang lesson </span>
        <span className="font-semibold text-blue-900 truncate">
          {context.lesson_title}
        </span>
        {context.module_title && (
          <span className="text-blue-600"> · {context.module_title}</span>
        )}
      </div>
      <button
        onClick={onInsert}
        className="flex-shrink-0 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
      >
        Sisipkan ke pesan
      </button>
      <button onClick={onDismiss} className="text-blue-400 hover:text-blue-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
export default LessonContextBanner