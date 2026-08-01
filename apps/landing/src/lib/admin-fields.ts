import type { FieldDef } from "@/components/admin/generic-table-editor";

export const COURSE_FIELDS: FieldDef[] = [
  { key: "slug", label: "Slug (unique)", kind: "text", required: true, placeholder: "ai-for-kids" },
  { key: "title_id", label: "Title (ID)", kind: "text", required: true },
  { key: "title_en", label: "Title (EN)", kind: "text", required: true },
  { key: "description_id", label: "Description (ID)", kind: "textarea", fullWidth: true },
  { key: "description_en", label: "Description (EN)", kind: "textarea", fullWidth: true },
  { key: "level", label: "Level (early|elementary|middle|high)", kind: "text" },
  { key: "pillar", label: "Pillar id (e.g. el_baca, hs_ai)", kind: "text" },
  { key: "access", label: "Access (included|premium_addon|free_preview|level_locked)", kind: "text" },
  { key: "duration_minutes", label: "Duration (minutes)", kind: "number" },
  { key: "lessons_count", label: "Lessons count", kind: "number" },
  { key: "thumbnail_url", label: "Thumbnail URL", kind: "text", fullWidth: true },
  { key: "sort_order", label: "Sort order", kind: "number" },
  { key: "published", label: "Published", kind: "boolean" },
];

export const MODULE_FIELDS: FieldDef[] = [
  { key: "course_id", label: "Course ID (uuid)", kind: "text", required: true },
  { key: "slug", label: "Slug", kind: "text", required: true },
  { key: "title_id", label: "Title (ID)", kind: "text", required: true },
  { key: "title_en", label: "Title (EN)", kind: "text", required: true },
  { key: "description_id", label: "Description (ID)", kind: "textarea", fullWidth: true },
  { key: "description_en", label: "Description (EN)", kind: "textarea", fullWidth: true },
  { key: "sort_order", label: "Sort order", kind: "number" },
  { key: "published", label: "Published", kind: "boolean" },
];

export const LESSON_FIELDS: FieldDef[] = [
  { key: "course_id", label: "Course ID (uuid)", kind: "text", required: true },
  { key: "module_id", label: "Module ID (uuid)", kind: "text", required: true },
  { key: "slug", label: "Slug", kind: "text", required: true },
  { key: "title_id", label: "Title (ID)", kind: "text", required: true },
  { key: "title_en", label: "Title (EN)", kind: "text", required: true },
  { key: "description_id", label: "Description (ID)", kind: "textarea", fullWidth: true },
  { key: "description_en", label: "Description (EN)", kind: "textarea", fullWidth: true },
  { key: "duration_minutes", label: "Duration (minutes)", kind: "number" },
  { key: "sort_order", label: "Sort order", kind: "number" },
  { key: "is_required", label: "Required for completion", kind: "boolean" },
  { key: "published", label: "Published", kind: "boolean" },
];

export const LEARNING_ASSET_FIELDS: FieldDef[] = [
  { key: "level", label: "Level (early|elementary|middle|high)", kind: "text", required: true },
  { key: "pillar", label: "Pillar id", kind: "text", required: true },
  { key: "asset_type", label: "Asset type (digital_library|audio_story|audio_lesson|short_video|worksheet|quiz|project|portfolio|parent_guide)", kind: "text", required: true },
  { key: "title_id", label: "Title (ID)", kind: "text", required: true },
  { key: "title_en", label: "Title (EN)", kind: "text", required: true },
  { key: "description_id", label: "Description (ID)", kind: "textarea", fullWidth: true },
  { key: "description_en", label: "Description (EN)", kind: "textarea", fullWidth: true },
  { key: "course_id", label: "Course ID", kind: "text" },
  { key: "module_id", label: "Module ID", kind: "text" },
  { key: "lesson_id", label: "Lesson ID", kind: "text" },
  { key: "format", label: "Format (pdf|mp3|mp4|youtube|interactive|...)", kind: "text" },
  { key: "duration_minutes", label: "Duration (minutes)", kind: "number" },
  { key: "difficulty", label: "Difficulty (beginner|intermediate|advanced)", kind: "text" },
  { key: "access_type", label: "Access (free_preview|included|premium_addon|level_locked)", kind: "text" },
  { key: "is_required_for_level_completion", label: "Required for level completion", kind: "boolean" },
  { key: "preview_order", label: "Preview order", kind: "number" },
  { key: "thumbnail_url", label: "Thumbnail URL", kind: "text", fullWidth: true },
  { key: "file_url", label: "File URL", kind: "text", fullWidth: true },
  { key: "audio_url", label: "Audio URL", kind: "text", fullWidth: true },
  { key: "video_url", label: "Video URL", kind: "text", fullWidth: true },
  { key: "worksheet_url", label: "Worksheet URL", kind: "text", fullWidth: true },
  { key: "status", label: "Status (draft|reviewed|published|archived)", kind: "text" },
  { key: "tags", label: "Tags — one per line", kind: "json", fullWidth: true },
];

export const PARENT_GUIDE_FIELDS: FieldDef[] = [
  { key: "level", label: "Level (early|elementary|middle|high)", kind: "text", required: true },
  { key: "pillar", label: "Pillar id (optional)", kind: "text" },
  { key: "lesson_id", label: "Lesson ID (optional)", kind: "text" },
  { key: "title_id", label: "Title (ID)", kind: "text", required: true },
  { key: "title_en", label: "Title (EN)", kind: "text", required: true },
  { key: "body_id", label: "Body (ID)", kind: "textarea", fullWidth: true, rows: 6 },
  { key: "body_en", label: "Body (EN)", kind: "textarea", fullWidth: true, rows: 6 },
  { key: "reading_time_minutes", label: "Reading time (minutes)", kind: "number" },
  { key: "sort_order", label: "Sort order", kind: "number" },
  { key: "published", label: "Published", kind: "boolean" },
];

export const LIBRARY_FIELDS: FieldDef[] = [
  { key: "title_id", label: "Title (ID)", kind: "text", required: true },
  { key: "title_en", label: "Title (EN)", kind: "text", required: true },
  { key: "description_id", label: "Description (ID)", kind: "textarea", fullWidth: true },
  { key: "description_en", label: "Description (EN)", kind: "textarea", fullWidth: true },
  { key: "audience", label: "Audience (early|elementary|middle|high|parent)", kind: "text" },
  { key: "type", label: "Type (worksheet|ebook|video|ai-literacy|finance)", kind: "text" },
  { key: "language", label: "Language (id|en)", kind: "text" },
  { key: "format", label: "Format (pdf|video|audio|interactive)", kind: "text" },
  { key: "thumbnail_url", label: "Thumbnail URL", kind: "text" },
  { key: "resource_url", label: "Resource URL", kind: "text" },
  { key: "premium", label: "Premium", kind: "boolean" },
  { key: "published", label: "Published", kind: "boolean" },
  { key: "sort_order", label: "Sort order", kind: "number" },
];

export const MEMBERSHIP_FIELDS: FieldDef[] = [
  { key: "slug", label: "Slug", kind: "text", required: true },
  { key: "name_id", label: "Name (ID)", kind: "text", required: true },
  { key: "name_en", label: "Name (EN)", kind: "text", required: true },
  { key: "tagline_id", label: "Tagline (ID)", kind: "textarea" },
  { key: "tagline_en", label: "Tagline (EN)", kind: "textarea" },
  { key: "price_idr", label: "Price (IDR)", kind: "number" },
  { key: "period", label: "Period (monthly|annual)", kind: "text" },
  { key: "benefits_id", label: "Benefits (ID) — one per line", kind: "json", fullWidth: true, rows: 6 },
  { key: "benefits_en", label: "Benefits (EN) — one per line", kind: "json", fullWidth: true, rows: 6 },
  { key: "featured", label: "Featured", kind: "boolean" },
  { key: "published", label: "Published", kind: "boolean" },
  { key: "sort_order", label: "Sort order", kind: "number" },
];

export const POST_FIELDS: FieldDef[] = [
  { key: "title_id", label: "Title (ID)", kind: "text", required: true },
  { key: "title_en", label: "Title (EN)", kind: "text", required: true },
  { key: "body_id", label: "Body (ID)", kind: "textarea", fullWidth: true, rows: 4 },
  { key: "body_en", label: "Body (EN)", kind: "textarea", fullWidth: true, rows: 4 },
  { key: "category", label: "Category", kind: "text" },
  { key: "author_name", label: "Author name", kind: "text" },
  { key: "author_avatar_url", label: "Author avatar URL", kind: "text" },
  { key: "likes", label: "Likes", kind: "number" },
  { key: "comments", label: "Comments", kind: "number" },
  { key: "published", label: "Published", kind: "boolean" },
];

export const MENTOR_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", kind: "text", required: true },
  { key: "role_id", label: "Role (ID)", kind: "text" },
  { key: "role_en", label: "Role (EN)", kind: "text" },
  { key: "bio_id", label: "Bio (ID)", kind: "textarea", fullWidth: true },
  { key: "bio_en", label: "Bio (EN)", kind: "textarea", fullWidth: true },
  { key: "expertise", label: "Expertise — one tag per line", kind: "json", fullWidth: true },
  { key: "avatar_url", label: "Avatar URL", kind: "text" },
  { key: "rating", label: "Rating (0–5)", kind: "number" },
  { key: "published", label: "Published", kind: "boolean" },
  { key: "sort_order", label: "Sort order", kind: "number" },
];

export const PROFILE_FIELDS: FieldDef[] = [
  { key: "email", label: "Email", kind: "text", required: true },
  { key: "full_name", label: "Full name", kind: "text", required: true },
  { key: "role_hint", label: "Role hint (parent|student|mentor|admin)", kind: "text" },
  { key: "parent_id", label: "Parent profile ID (for students)", kind: "text" },
  { key: "whatsapp", label: "WhatsApp", kind: "text" },
  { key: "city", label: "City", kind: "text" },
  { key: "student_level", label: "Student level", kind: "text" },
  { key: "active", label: "Active", kind: "boolean" },
];

export const USER_ROLE_FIELDS: FieldDef[] = [
  { key: "user_id", label: "User ID", kind: "text", required: true },
  { key: "role", label: "Role (admin|mentor|parent|student)", kind: "text", required: true },
];

export const SUBSCRIPTION_FIELDS: FieldDef[] = [
  { key: "parent_id", label: "Parent ID", kind: "text", required: true },
  { key: "status", label: "Status (trial|active|past_due|canceled|expired)", kind: "text", required: true },
  { key: "plan", label: "Plan (monthly|yearly)", kind: "text" },
  { key: "level_id", label: "Level plan ID", kind: "text" },
  { key: "seats", label: "Seats", kind: "number" },
  { key: "price_per_seat_idr", label: "Price per seat (IDR)", kind: "number" },
  { key: "current_period_start", label: "Current period start", kind: "text" },
  { key: "current_period_end", label: "Current period end", kind: "text" },
  { key: "cancel_at_period_end", label: "Cancel at period end", kind: "boolean" },
  { key: "provider", label: "Provider", kind: "text" },
  { key: "provider_subscription_id", label: "Provider subscription ID", kind: "text" },
];

export const PAYMENT_FIELDS: FieldDef[] = [
  { key: "parent_id", label: "Parent ID", kind: "text", required: true },
  { key: "subscription_id", label: "Subscription ID", kind: "text" },
  { key: "amount_idr", label: "Amount (IDR)", kind: "number" },
  { key: "method", label: "Method (qris|va|bank_transfer|ewallet|card)", kind: "text" },
  { key: "provider", label: "Provider", kind: "text" },
  { key: "provider_reference", label: "Provider reference", kind: "text" },
  { key: "status", label: "Status (pending|paid|failed|expired|refunded)", kind: "text" },
  { key: "paid_at", label: "Paid at", kind: "text" },
];

export const STUDENT_PROGRESS_FIELDS: FieldDef[] = [
  { key: "student_id", label: "Student ID", kind: "text", required: true },
  { key: "course_id", label: "Course ID", kind: "text" },
  { key: "module_id", label: "Module ID", kind: "text" },
  { key: "lesson_id", label: "Lesson ID", kind: "text" },
  { key: "status", label: "Status (not_started|in_progress|completed)", kind: "text" },
  { key: "score", label: "Score", kind: "number" },
  { key: "completed_at", label: "Completed at", kind: "text" },
];
