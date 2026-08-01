import {
  Heart, BookOpen, Briefcase, Bot, Users,
  Palette, Star, Sparkles, Coins, Tablet,
  FolderHeart, Lightbulb, Cpu, Network, TrendingUp, MessageCircle,
  Blocks, Rocket, ScrollText,
} from "lucide-react";
import type { LevelId } from "@/lib/curriculum-data";

export function EarlyThumb() {
  return (
    <div className="relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br from-rose-100 via-amber-100 to-orange-200 shadow-inner">
      <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-rose-300/60 blur-xl" />
      <div className="absolute -bottom-8 -right-4 h-28 w-28 rounded-full bg-amber-300/60 blur-xl" />
      <div className="absolute inset-0 flex items-center justify-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/80 shadow-md">
          <BookOpen className="h-7 w-7 text-rose-500" />
        </div>
        <div className="grid h-16 w-16 -translate-y-2 place-items-center rounded-full bg-white shadow-lg">
          <Heart className="h-8 w-8 text-rose-500" fill="currentColor" />
        </div>
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/80 shadow-md">
          <Blocks className="h-7 w-7 text-amber-500" />
        </div>
      </div>
      <Sparkles className="absolute right-3 top-3 h-4 w-4 text-amber-500/80" />
    </div>
  );
}

export function ElementaryThumb() {
  return (
    <div className="relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-100 via-emerald-100 to-teal-200 shadow-inner">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-300/60 blur-xl" />
      <div className="absolute -bottom-6 -left-4 h-24 w-24 rounded-full bg-sky-300/60 blur-xl" />
      <div className="absolute inset-0 grid grid-cols-2 gap-2 p-4">
        <div className="flex items-end justify-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white shadow-md"><BookOpen className="h-6 w-6 text-sky-600" /></div>
        </div>
        <div className="flex items-start justify-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white shadow-md"><Coins className="h-6 w-6 text-amber-500" /></div>
        </div>
        <div className="flex items-start justify-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white shadow-md"><Tablet className="h-6 w-6 text-emerald-600" /></div>
        </div>
        <div className="flex items-end justify-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white shadow-md"><Users className="h-6 w-6 text-teal-600" /></div>
        </div>
      </div>
      <FolderHeart className="absolute right-3 top-3 h-4 w-4 text-emerald-600/70" />
    </div>
  );
}

export function MiddleThumb() {
  return (
    <div className="relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-200 via-violet-200 to-fuchsia-200 shadow-inner">
      <div className="absolute -left-8 top-4 h-28 w-28 rounded-full bg-indigo-300/60 blur-xl" />
      <div className="absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-fuchsia-300/60 blur-xl" />
      <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 200 160" fill="none">
        <line x1="40" y1="40" x2="100" y2="80" stroke="rgb(99,102,241)" strokeWidth="1.5" />
        <line x1="100" y1="80" x2="160" y2="50" stroke="rgb(168,85,247)" strokeWidth="1.5" />
        <line x1="100" y1="80" x2="60" y2="120" stroke="rgb(168,85,247)" strokeWidth="1.5" />
        <line x1="100" y1="80" x2="150" y2="120" stroke="rgb(217,70,239)" strokeWidth="1.5" />
      </svg>
      <div className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-lg bg-white shadow-md"><Lightbulb className="h-5 w-5 text-amber-500" /></div>
      <div className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-white shadow-lg"><Bot className="h-7 w-7 text-indigo-600" /></div>
      <div className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-lg bg-white shadow-md"><Users className="h-5 w-5 text-violet-600" /></div>
      <div className="absolute bottom-3 left-4 grid h-10 w-10 place-items-center rounded-lg bg-white shadow-md"><MessageCircle className="h-5 w-5 text-fuchsia-600" /></div>
      <div className="absolute bottom-3 right-4 grid h-10 w-10 place-items-center rounded-lg bg-white shadow-md"><Rocket className="h-5 w-5 text-indigo-600" /></div>
    </div>
  );
}

export function HighThumb() {
  return (
    <div className="relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 shadow-inner">
      <svg className="absolute inset-0 h-full w-full opacity-20" viewBox="0 0 200 160" fill="none">
        <path d="M0 40 L60 40 L60 80 L120 80 L120 30 L200 30" stroke="rgb(34,211,238)" strokeWidth="1" />
        <path d="M0 110 L40 110 L40 140 L200 140" stroke="rgb(168,85,247)" strokeWidth="1" />
        <circle cx="60" cy="40" r="2.5" fill="rgb(34,211,238)" />
        <circle cx="120" cy="80" r="2.5" fill="rgb(34,211,238)" />
        <circle cx="40" cy="110" r="2.5" fill="rgb(168,85,247)" />
      </svg>
      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-300/40">
        <Star className="h-3 w-3" fill="currentColor" /> Pioneering Skills
      </div>
      <div className="absolute inset-0 grid grid-cols-4 items-center gap-2 px-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20"><Cpu className="h-6 w-6 text-cyan-300" /></div>
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20"><TrendingUp className="h-6 w-6 text-emerald-300" /></div>
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20"><Network className="h-6 w-6 text-violet-300" /></div>
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20"><Briefcase className="h-6 w-6 text-amber-300" /></div>
      </div>
      <ScrollText className="absolute bottom-2 left-3 h-4 w-4 text-cyan-300/70" />
      <Palette className="hidden" />
    </div>
  );
}

export const LEVEL_THUMBS: Record<LevelId, () => React.ReactElement> = {
  early: EarlyThumb,
  elementary: ElementaryThumb,
  middle: MiddleThumb,
  high: HighThumb,
};
