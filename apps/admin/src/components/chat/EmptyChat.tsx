import React from 'react'
import { Button } from '../ui/button';
import { MessageCircle } from "lucide-react";


/* ─────────────────────────────────────────────
   Empty / new conversation state
───────────────────────────────────────────── */
function EmptyChat({ context, onStartNew }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
        <MessageCircle className="h-7 w-7 text-blue-600" />
      </div>
      <div>
        <p className="font-semibold text-slate-800">
          {context.lesson_id ? "Tanya tentang lesson ini" : "Pilih percakapan"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {context.lesson_id
            ? `"${context.lesson_title}" — ${context.module_title}`
            : "Atau mulai percakapan baru dengan mentor."}
        </p>
      </div>
      {/* {context.lesson_id && (
        <Button onClick={onStartNew} className="gap-2">
          <MessageCircle className="h-4 w-4" /> Mulai Percakapan
        </Button>
      )} */}
    </div>
  );
}

export default EmptyChat