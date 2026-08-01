import React, { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X, Loader2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import MarkdownView from "../course-editor/MarkdownView";

const DEFAULT_SUGGESTIONS = [
  "Ringkas materi lesson ini",
  "Rekomendasikan materi terkait",
  "Buatkan saya quiz dari materi ini",
];

export default function LessonAskPanel({
  open,
  onClose,
  lessonTitle,
  messages,
  thinking,
  onSend,
  suggestions = DEFAULT_SUGGESTIONS,
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const bottomRef = useRef(null);

  // Fix LaTeX delimiters: \[...\] → $$...$$, \(...\) → $...$
  const renderBody = (body) => {
    let s = body || "";
    s = s.replace(/\\\[/g, "\x00\x00").replace(/\\\]/g, "\x00\x00"); // \[ → placeholder
    s = s.replace(/\\\(/g, "\x01").replace(/\\\)/g, "\x01");         // \( → placeholder
    s = s.replace(/\x00\x00/g, "$$").replace(/\x01/g, "$");           // placeholder → actual delimiters
    return s;
  };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    const handleEsc = (e) => e.key === "Escape" && onClose?.();

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages]);

  const handleSend = (text) => {
    const msg = (text ?? input).trim();
    if (!msg || thinking) return;
    onSend?.(msg);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="inset-x-3 bottom-3 z-50 flex max-h-[80vh] flex-col rounded-2xl border bg-white shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-2xl border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-bold text-slate-950">AI Tutor</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-[200px] max-h-[50vh]">
        {messages.length === 0 ? (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
              <Sparkles className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-sm leading-6 text-slate-700">
              Halo! Ada yang ingin kamu tanyakan seputar{" "}
              <span className="font-semibold text-slate-900">
                {lessonTitle || "lesson ini"}
              </span>
              ? Aku siap bantu.
            </p>
            <p className="text-xs font-semibold text-slate-400">
              Coba salah satu ini:
            </p>
            <div className="flex flex-col items-end gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  disabled={thinking}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-right text-sm text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-end gap-3",
                msg.sender_role === "ai"
                  ? "justify-start"
                  : "justify-end"
              )}
            >
              {msg.sender_role === "ai" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.sender_role === "ai"
                    ? "bg-slate-100 text-slate-800 rounded-bl-md"
                    : "bg-blue-600 text-white rounded-br-md"
                )}
              >
                <div className="prose prose-slate prose-sm max-w-none [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0">
                    <MarkdownView content={renderBody(msg.body)}/>
                </div>
              </div>
            </div>
          ))
        )}
        {thinking && (
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            AI sedang menulis...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="rounded-b-2xl border-t px-5 py-4">
        <p className="mb-2 text-center text-[11px] text-slate-400">
          AI bisa saja keliru, selalu periksa kembali jawabannya.
        </p>
        <div className="flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tulis pertanyaan..."
            disabled={thinking}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || thinking}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {thinking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_SUGGESTIONS };
