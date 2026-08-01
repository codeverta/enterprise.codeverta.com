/**
 * Scalable CMS content architecture — supports 100,000+ learning assets.
 *
 * Hierarchy: Level → Pillar → Course → Module → Lesson → Asset
 *
 * This file is the single source of truth for the typed contract. All
 * Supabase tables (modules, lessons, learning_assets, parent_guides,
 * student_progress, level_unlocks, subscriptions, payments) mirror these
 * shapes. Use this file in admin editors, dashboards, and import scripts.
 *
 * NOTE: We use ONE polymorphic `learning_assets` table for every asset
 * type (audio_story, audio_lesson, short_video, worksheet, quiz, project,
 * portfolio, parent_guide, digital_library) instead of 9 separate tables.
 * This keeps the catalog query path simple and scales to millions of rows.
 */

import type { LevelId } from "./curriculum-data";

/* ───────────────────────── Asset taxonomy ───────────────────────── */

export type AssetType =
  | "digital_library"
  | "audio_story"
  | "audio_lesson"
  | "short_video"
  | "worksheet"
  | "quiz"
  | "project"
  | "portfolio"
  | "parent_guide";

export const ASSET_TYPE_LABELS: Record<AssetType, { id: string; en: string }> = {
  digital_library: { id: "Digital Library", en: "Digital Library" },
  audio_story:     { id: "Audio Story",     en: "Audio Story" },
  audio_lesson:    { id: "Audio Lesson",    en: "Audio Lesson" },
  short_video:     { id: "Short Video",     en: "Short Video" },
  worksheet:       { id: "Worksheet",       en: "Worksheet" },
  quiz:            { id: "Quiz",            en: "Quiz" },
  project:         { id: "Project Task",    en: "Project Task" },
  portfolio:       { id: "Portfolio Task",  en: "Portfolio Task" },
  parent_guide:    { id: "Panduan Orang Tua", en: "Parent Guide" },
};

export type AssetFormat =
  | "pdf" | "epub" | "html" | "interactive"
  | "mp3" | "wav" | "audio_url"
  | "mp4" | "video_url" | "youtube"
  | "image" | "doc" | "text";

export type AccessType =
  | "free_preview"
  | "included"
  | "premium_addon"
  | "level_locked";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type AssetStatus = "draft" | "reviewed" | "published" | "archived";

/* ───────────────────────── Core entity types ───────────────────────── */

export interface ModuleRow {
  id: string;
  course_id: string;
  slug: string;
  title_id: string;
  title_en: string;
  description_id: string;
  description_en: string;
  sort_order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface LessonRow {
  id: string;
  module_id: string;
  course_id: string;
  slug: string;
  title_id: string;
  title_en: string;
  description_id: string;
  description_en: string;
  duration_minutes: number;
  sort_order: number;
  is_required: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearningAssetRow {
  id: string;
  level: LevelId;
  pillar: string;
  course_id: string | null;
  module_id: string | null;
  lesson_id: string | null;
  asset_type: AssetType;
  title_id: string;
  title_en: string;
  description_id: string;
  description_en: string;
  format: AssetFormat;
  duration_minutes: number;
  difficulty: Difficulty;
  access_type: AccessType;
  is_required_for_level_completion: boolean;
  preview_order: number;
  file_url: string | null;
  thumbnail_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  worksheet_url: string | null;
  status: AssetStatus;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ParentGuideRow {
  id: string;
  level: LevelId;
  pillar: string | null;
  lesson_id: string | null;
  title_id: string;
  title_en: string;
  body_id: string;
  body_en: string;
  reading_time_minutes: number;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/* ───────────────────────── Student state ───────────────────────── */

export type ProgressStatus = "not_started" | "in_progress" | "completed";

export interface StudentProgressRow {
  id: string;
  student_id: string;
  parent_id: string;
  asset_id: string | null;
  lesson_id: string | null;
  level: LevelId;
  status: ProgressStatus;
  progress: number;
  completed_at: string | null;
}

export type LevelUnlockStatus = "pending" | "paid" | "active" | "refunded";

export interface LevelUnlockRow {
  id: string;
  student_id: string;
  parent_id: string;
  level: LevelId;
  unlock_fee_idr: number;
  payment_id: string | null;
  status: LevelUnlockStatus;
  unlocked_at: string | null;
}

/* ───────────────────────── Payments / subscriptions ───────────────────────── */

export type SubscriptionStatus =
  | "trial" | "active" | "past_due" | "canceled" | "expired";

export type PaymentPurpose =
  | "monthly_subscription"
  | "level_unlock_fee"
  | "premium_addon"
  | "annual_dev_fee";

export const PAYMENT_PURPOSE_LABELS: Record<PaymentPurpose, { id: string; en: string }> = {
  monthly_subscription: { id: "Langganan Bulanan",            en: "Monthly Subscription" },
  level_unlock_fee:     { id: "Biaya Aktivasi Level Baru",    en: "Level Unlock Fee" },
  premium_addon:        { id: "Premium Add-on",               en: "Premium Add-on" },
  annual_dev_fee:       { id: "Biaya Pengembangan Tahunan",   en: "Annual Development Fee" },
};

/* ───────────────────────── Level access logic ───────────────────────── */

/** Pricing for unlocking the next level — CMS-overridable later. */
export const LEVEL_UNLOCK_FEE_IDR = 499_000;

/** Free-preview cap for the next level a student has NOT unlocked. */
export const NEXT_LEVEL_FREE_PREVIEW_LIMIT = 2;

/** Ordered ladder used by has-next-level / unlock-next-level helpers. */
export const LEVEL_ORDER: LevelId[] = ["early", "elementary", "middle", "high"];

export function nextLevel(current: LevelId): LevelId | null {
  const i = LEVEL_ORDER.indexOf(current);
  return i >= 0 && i < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[i + 1] : null;
}

/** Items required for level completion. CMS will override per level later. */
export interface LevelCompletionRequirement {
  key:
    | "core_lessons"
    | "additional_courses"
    | "reading_target"
    | "portfolio_projects"
    | "parent_confirmation"
    | "mentor_approval";
  label_id: string;
  label_en: string;
  target: number;
  optional?: boolean;
}

export const LEVEL_REQUIREMENTS: LevelCompletionRequirement[] = [
  { key: "core_lessons",        target: 100, label_id: "Pelajaran inti selesai",       label_en: "Core lessons completed" },
  { key: "additional_courses",  target: 20,  label_id: "Kelas tambahan selesai",       label_en: "Additional courses completed" },
  { key: "reading_target",      target: 50,  label_id: "Target bacaan tercapai",       label_en: "Reading target completed" },
  { key: "portfolio_projects",  target: 5,   label_id: "Project portofolio selesai",   label_en: "Portfolio projects completed" },
  { key: "parent_confirmation", target: 1,   label_id: "Konfirmasi orang tua",         label_en: "Parent confirmation" },
  { key: "mentor_approval",     target: 1,   label_id: "Persetujuan mentor/admin",     label_en: "Mentor / admin approval", optional: true },
];

export interface LevelProgressSnapshot {
  core_lessons: number;
  additional_courses: number;
  reading_target: number;
  portfolio_projects: number;
  parent_confirmation: 0 | 1;
  mentor_approval: 0 | 1;
}

export function isLevelComplete(snap: LevelProgressSnapshot): boolean {
  return LEVEL_REQUIREMENTS.every((r) =>
    r.optional ? true : (snap[r.key] ?? 0) >= r.target,
  );
}

/* ───────────────────────── Asset counter aggregates ───────────────────────── */

export interface AssetCounters {
  totalAvailable: number;
  unlocked: number;
  completed: number;
  levelProgressPct: number;
  portfolioCompleted: number;
}

/** Compute counters from a list of assets + a per-asset progress map. */
export function buildCounters(
  assets: Pick<LearningAssetRow, "id" | "asset_type" | "access_type" | "level">[],
  progressByAssetId: Map<string, ProgressStatus>,
  activeLevel: LevelId,
): AssetCounters {
  const inLevel = assets.filter((a) => a.level === activeLevel);
  const unlocked = inLevel.filter(
    (a) => a.access_type === "included" || a.access_type === "free_preview",
  );
  const completed = unlocked.filter(
    (a) => progressByAssetId.get(a.id) === "completed",
  );
  const portfolio = inLevel.filter(
    (a) => a.asset_type === "portfolio" && progressByAssetId.get(a.id) === "completed",
  );
  return {
    totalAvailable: inLevel.length,
    unlocked: unlocked.length,
    completed: completed.length,
    levelProgressPct: unlocked.length
      ? Math.round((completed.length / unlocked.length) * 100)
      : 0,
    portfolioCompleted: portfolio.length,
  };
}
