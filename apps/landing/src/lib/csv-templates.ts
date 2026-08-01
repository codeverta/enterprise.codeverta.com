/**
 * CSV import templates for all CMS content types.
 *
 * Each template defines: target table, required columns, optional columns,
 * column → friendly label, allowed enums, and 5 original sample rows.
 *
 * Used by <BulkContentImport /> in admin to download templates, validate
 * uploads, and preview/fix/publish in bulk.
 */

export type ColumnType = "text" | "longtext" | "number" | "boolean" | "enum" | "url" | "tags";

export interface ColumnSpec {
  key: string;
  label: string;
  type: ColumnType;
  required?: boolean;
  enumValues?: string[];
  hint?: string;
}

export interface CsvTemplate {
  id: string;
  label: string;
  description: string;
  table: string;
  /** Hard-coded values applied to every imported row (e.g. asset_type). */
  fixed?: Record<string, string | number | boolean>;
  columns: ColumnSpec[];
  /** 5 original sample rows. */
  samples: Record<string, string | number | boolean>[];
}

/* ───────────────────────── Shared enums ───────────────────────── */

export const LEVEL_ENUM = ["early", "elementary", "middle", "high"];
export const ACCESS_ENUM = ["free_preview", "included", "premium_addon", "level_locked"];
export const STATUS_ENUM = ["draft", "reviewed", "published", "archived"];
export const ASSET_TYPE_ENUM = [
  "digital_library", "audio_story", "audio_lesson", "short_video",
  "worksheet", "quiz", "project", "portfolio", "parent_guide",
];
export const PUBLISHED_ENUM = ["true", "false"];

/* Common column groups */
const bilingualTitle = (): ColumnSpec[] => [
  { key: "title_id", label: "Judul (ID)", type: "text", required: true },
  { key: "title_en", label: "Title (EN)", type: "text", required: true },
];
const bilingualDesc = (): ColumnSpec[] => [
  { key: "description_id", label: "Deskripsi (ID)", type: "longtext" },
  { key: "description_en", label: "Description (EN)", type: "longtext" },
];
const levelPillar = (): ColumnSpec[] => [
  { key: "level", label: "Level", type: "enum", enumValues: LEVEL_ENUM, required: true },
  { key: "pillar", label: "Pillar id", type: "text", required: true, hint: "e.g. el_baca, mid_finlit" },
];
const accessCol = (): ColumnSpec => ({
  key: "access_type", label: "Access", type: "enum", enumValues: ACCESS_ENUM, required: true,
});
const statusCol = (): ColumnSpec => ({
  key: "status", label: "Status", type: "enum", enumValues: STATUS_ENUM, required: true,
});
const mediaCols = (): ColumnSpec[] => [
  { key: "thumbnail_url", label: "Thumbnail URL", type: "url" },
  { key: "file_url",      label: "File URL",      type: "url" },
  { key: "audio_url",     label: "Audio URL",     type: "url" },
  { key: "video_url",     label: "Video URL",     type: "url" },
  { key: "worksheet_url", label: "Worksheet URL", type: "url" },
];

/* ───────────────────────── Templates ───────────────────────── */

const COURSES: CsvTemplate = {
  id: "courses",
  label: "Courses",
  description: "Top-level courses within a pillar.",
  table: "courses",
  columns: [
    { key: "slug", label: "Slug", type: "text", required: true },
    ...bilingualTitle(),
    ...bilingualDesc(),
    ...levelPillar(),
    { key: "access", label: "Access", type: "enum", enumValues: ACCESS_ENUM, required: true },
    { key: "duration_minutes", label: "Duration (min)", type: "number" },
    { key: "lessons_count", label: "Lessons #", type: "number" },
    { key: "thumbnail_url", label: "Thumbnail URL", type: "url" },
    { key: "sort_order", label: "Order", type: "number" },
    { key: "published", label: "Published", type: "boolean" },
  ],
  samples: [
    { slug: "literasi-keluarga-1", title_id: "Literasi Keluarga 1", title_en: "Family Literacy 1", description_id: "Pengantar literasi yang menyenangkan untuk anak dan orang tua.", description_en: "Joyful intro to literacy for kids and parents.", level: "early", pillar: "ey_sel", access: "included", duration_minutes: 60, lessons_count: 6, thumbnail_url: "", sort_order: 1, published: true },
    { slug: "pengantar-finlit-sd", title_id: "Pengantar Finansial Anak", title_en: "Kids Money Basics", description_id: "Mengenal uang, menabung, dan berbagi.", description_en: "Money, saving, and sharing — gently introduced.", level: "elementary", pillar: "el_finlit", access: "included", duration_minutes: 90, lessons_count: 8, thumbnail_url: "", sort_order: 2, published: true },
    { slug: "berpikir-kritis-smp", title_id: "Berpikir Kritis untuk SMP", title_en: "Critical Thinking for Middle", description_id: "Logika harian, bias, dan keputusan.", description_en: "Daily logic, biases, and decisions.", level: "middle", pillar: "mid_crit", access: "included", duration_minutes: 120, lessons_count: 10, thumbnail_url: "", sort_order: 3, published: true },
    { slug: "intro-ai-sma", title_id: "Pengantar AI untuk SMA", title_en: "Intro to AI for High", description_id: "Konsep AI, prompt, dan penggunaan etis.", description_en: "AI concepts, prompting, and ethical use.", level: "high", pillar: "hs_ai", access: "premium_addon", duration_minutes: 180, lessons_count: 12, thumbnail_url: "", sort_order: 4, published: true },
    { slug: "portofolio-kreatif", title_id: "Membangun Portofolio Kreatif", title_en: "Building a Creative Portfolio", description_id: "Kurasi karya dan refleksi belajar.", description_en: "Curate work and reflect on learning.", level: "high", pillar: "hs_port", access: "included", duration_minutes: 90, lessons_count: 7, thumbnail_url: "", sort_order: 5, published: true },
  ],
};

const MODULES: CsvTemplate = {
  id: "modules",
  label: "Modules",
  description: "Modules grouped under a course.",
  table: "modules",
  columns: [
    { key: "course_id", label: "Course UUID", type: "text", required: true, hint: "Paste a course UUID from the Courses tab." },
    { key: "slug", label: "Slug", type: "text", required: true },
    ...bilingualTitle(),
    ...bilingualDesc(),
    { key: "sort_order", label: "Order", type: "number" },
    { key: "published", label: "Published", type: "boolean" },
  ],
  samples: [
    { course_id: "<course-uuid>", slug: "modul-pengenalan", title_id: "Modul Pengenalan", title_en: "Intro Module", description_id: "Pemanasan dan tujuan belajar.", description_en: "Warm-up and learning goals.", sort_order: 1, published: true },
    { course_id: "<course-uuid>", slug: "modul-praktik-1", title_id: "Praktik 1", title_en: "Practice 1", description_id: "Latihan kasus harian.", description_en: "Daily case practice.", sort_order: 2, published: true },
    { course_id: "<course-uuid>", slug: "modul-praktik-2", title_id: "Praktik 2", title_en: "Practice 2", description_id: "Latihan lanjutan.", description_en: "Advanced practice.", sort_order: 3, published: true },
    { course_id: "<course-uuid>", slug: "modul-refleksi", title_id: "Refleksi", title_en: "Reflection", description_id: "Jurnal mingguan keluarga.", description_en: "Weekly family journaling.", sort_order: 4, published: true },
    { course_id: "<course-uuid>", slug: "modul-portofolio", title_id: "Portofolio", title_en: "Portfolio", description_id: "Kompilasi karya akhir.", description_en: "Final work compilation.", sort_order: 5, published: true },
  ],
};

const LESSONS: CsvTemplate = {
  id: "lessons",
  label: "Lessons",
  description: "Lessons inside a module (and parent course).",
  table: "lessons",
  columns: [
    { key: "course_id", label: "Course UUID", type: "text", required: true },
    { key: "module_id", label: "Module UUID", type: "text", required: true },
    { key: "slug", label: "Slug", type: "text", required: true },
    ...bilingualTitle(),
    ...bilingualDesc(),
    { key: "duration_minutes", label: "Duration (min)", type: "number" },
    { key: "is_required", label: "Required for level", type: "boolean" },
    { key: "sort_order", label: "Order", type: "number" },
    { key: "published", label: "Published", type: "boolean" },
  ],
  samples: [
    { course_id: "<course-uuid>", module_id: "<module-uuid>", slug: "p1-membaca-cermat", title_id: "Membaca Cermat", title_en: "Reading Carefully", description_id: "Teknik membaca aktif untuk pemula.", description_en: "Active reading techniques for beginners.", duration_minutes: 12, is_required: true, sort_order: 1, published: true },
    { course_id: "<course-uuid>", module_id: "<module-uuid>", slug: "p2-rangkum-cerita", title_id: "Merangkum Cerita", title_en: "Summarising a Story", description_id: "Latihan 5W+1H.", description_en: "5W+1H practice.", duration_minutes: 15, is_required: true, sort_order: 2, published: true },
    { course_id: "<course-uuid>", module_id: "<module-uuid>", slug: "p3-uang-jajan", title_id: "Mengatur Uang Jajan", title_en: "Managing Pocket Money", description_id: "Memisah tabung, jajan, berbagi.", description_en: "Split saving, spending, sharing.", duration_minutes: 18, is_required: true, sort_order: 3, published: true },
    { course_id: "<course-uuid>", module_id: "<module-uuid>", slug: "p4-keputusan-baik", title_id: "Membuat Keputusan Baik", title_en: "Making Good Decisions", description_id: "Kerangka pikir sederhana.", description_en: "A simple thinking framework.", duration_minutes: 20, is_required: false, sort_order: 4, published: true },
    { course_id: "<course-uuid>", module_id: "<module-uuid>", slug: "p5-refleksi-mingguan", title_id: "Refleksi Mingguan", title_en: "Weekly Reflection", description_id: "Catat apa yang dipelajari.", description_en: "Capture what you learned.", duration_minutes: 10, is_required: true, sort_order: 5, published: true },
  ],
};

/* Polymorphic asset templates — all target `learning_assets` with a fixed asset_type */

function assetTemplate(id: string, label: string, assetType: string, formatDefault: string, sampleTitles: { id: string; en: string; desc_id: string; desc_en: string }[]): CsvTemplate {
  return {
    id,
    label,
    description: `Imports rows into learning_assets with asset_type = ${assetType}.`,
    table: "learning_assets",
    fixed: { asset_type: assetType },
    columns: [
      ...levelPillar(),
      { key: "course_id", label: "Course UUID (optional)", type: "text" },
      { key: "module_id", label: "Module UUID (optional)", type: "text" },
      { key: "lesson_id", label: "Lesson UUID (optional)", type: "text" },
      ...bilingualTitle(),
      ...bilingualDesc(),
      { key: "format", label: "Format", type: "text", hint: `e.g. ${formatDefault}` },
      { key: "duration_minutes", label: "Duration (min)", type: "number" },
      { key: "difficulty", label: "Difficulty", type: "enum", enumValues: ["beginner", "intermediate", "advanced"] },
      accessCol(),
      { key: "is_required_for_level_completion", label: "Required for level", type: "boolean" },
      { key: "preview_order", label: "Preview order", type: "number" },
      ...mediaCols(),
      statusCol(),
      { key: "tags", label: "Tags (pipe-separated)", type: "tags" },
    ],
    samples: sampleTitles.map((t, i) => ({
      level: ["early", "elementary", "middle", "high"][i % 4],
      pillar: ["ey_sel", "el_baca", "mid_finlit", "hs_ai"][i % 4],
      course_id: "", module_id: "", lesson_id: "",
      title_id: t.id, title_en: t.en, description_id: t.desc_id, description_en: t.desc_en,
      format: formatDefault, duration_minutes: 10 + i * 3, difficulty: "beginner",
      access_type: ["free_preview", "included", "included", "premium_addon", "level_locked"][i],
      is_required_for_level_completion: i < 2,
      preview_order: i,
      thumbnail_url: "", file_url: "", audio_url: "", video_url: "", worksheet_url: "",
      status: "published",
      tags: "",
    })),
  };
}

const LEARNING_ASSETS: CsvTemplate = {
  id: "learning_assets",
  label: "Learning Assets (any type)",
  description: "Generic polymorphic asset import — set asset_type per row.",
  table: "learning_assets",
  columns: [
    { key: "asset_type", label: "Asset type", type: "enum", enumValues: ASSET_TYPE_ENUM, required: true },
    ...levelPillar(),
    { key: "course_id", label: "Course UUID", type: "text" },
    { key: "module_id", label: "Module UUID", type: "text" },
    { key: "lesson_id", label: "Lesson UUID", type: "text" },
    ...bilingualTitle(),
    ...bilingualDesc(),
    { key: "format", label: "Format", type: "text" },
    { key: "duration_minutes", label: "Duration (min)", type: "number" },
    { key: "difficulty", label: "Difficulty", type: "enum", enumValues: ["beginner", "intermediate", "advanced"] },
    accessCol(),
    { key: "is_required_for_level_completion", label: "Required for level", type: "boolean" },
    { key: "preview_order", label: "Preview order", type: "number" },
    ...mediaCols(),
    statusCol(),
    { key: "tags", label: "Tags (pipe-separated)", type: "tags" },
  ],
  samples: [
    { asset_type: "audio_story", level: "early", pillar: "ey_sel", course_id: "", module_id: "", lesson_id: "", title_id: "Cerita Bintang Kecil", title_en: "The Little Star", description_id: "Dongeng tentang keberanian.", description_en: "A tale about courage.", format: "mp3", duration_minutes: 7, difficulty: "beginner", access_type: "free_preview", is_required_for_level_completion: false, preview_order: 1, thumbnail_url: "", file_url: "", audio_url: "", video_url: "", worksheet_url: "", status: "published", tags: "cerita|keberanian" },
    { asset_type: "short_video", level: "elementary", pillar: "el_baca", course_id: "", module_id: "", lesson_id: "", title_id: "Membaca Aktif 3 Menit", title_en: "Active Reading in 3 Min", description_id: "Trik membaca aktif.", description_en: "Active reading trick.", format: "mp4", duration_minutes: 3, difficulty: "beginner", access_type: "included", is_required_for_level_completion: true, preview_order: 1, thumbnail_url: "", file_url: "", audio_url: "", video_url: "", worksheet_url: "", status: "published", tags: "literasi" },
    { asset_type: "worksheet", level: "elementary", pillar: "el_finlit", course_id: "", module_id: "", lesson_id: "", title_id: "Lembar Tabungan Mingguan", title_en: "Weekly Savings Sheet", description_id: "Cetak dan isi setiap minggu.", description_en: "Print and fill every week.", format: "pdf", duration_minutes: 15, difficulty: "beginner", access_type: "included", is_required_for_level_completion: false, preview_order: 2, thumbnail_url: "", file_url: "", audio_url: "", video_url: "", worksheet_url: "", status: "published", tags: "finlit" },
    { asset_type: "quiz", level: "middle", pillar: "mid_crit", course_id: "", module_id: "", lesson_id: "", title_id: "Kuis Bias Logika", title_en: "Logic Bias Quiz", description_id: "10 soal pilihan ganda.", description_en: "10 multiple-choice items.", format: "interactive", duration_minutes: 12, difficulty: "intermediate", access_type: "included", is_required_for_level_completion: false, preview_order: 3, thumbnail_url: "", file_url: "", audio_url: "", video_url: "", worksheet_url: "", status: "reviewed", tags: "critical-thinking" },
    { asset_type: "project", level: "high", pillar: "hs_ai", course_id: "", module_id: "", lesson_id: "", title_id: "Project Prompt AI", title_en: "AI Prompt Project", description_id: "Buat asisten AI untuk keluarga.", description_en: "Build a family AI assistant.", format: "doc", duration_minutes: 90, difficulty: "advanced", access_type: "premium_addon", is_required_for_level_completion: true, preview_order: 4, thumbnail_url: "", file_url: "", audio_url: "", video_url: "", worksheet_url: "", status: "draft", tags: "ai|project" },
  ],
};

const DIGITAL_LIBRARY: CsvTemplate = {
  id: "library_items",
  label: "Digital Library Items",
  description: "Stand-alone library catalog (separate from polymorphic assets).",
  table: "library_items",
  columns: [
    ...bilingualTitle(),
    ...bilingualDesc(),
    { key: "audience", label: "Audience", type: "text", required: true, hint: "anak|orangtua|keluarga" },
    { key: "type", label: "Type", type: "text", required: true, hint: "ebook|audiobook|article|guide" },
    { key: "language", label: "Language", type: "text" },
    { key: "format", label: "Format", type: "text" },
    { key: "reading_time_minutes", label: "Reading time (min)", type: "number" },
    { key: "price_addon_idr", label: "Add-on price (IDR)", type: "number" },
    { key: "premium", label: "Premium?", type: "boolean" },
    { key: "published", label: "Published", type: "boolean" },
    { key: "thumbnail_url", label: "Thumbnail URL", type: "url" },
    { key: "resource_url", label: "Resource URL", type: "url" },
    { key: "tags", label: "Tags (pipe-separated)", type: "tags" },
    { key: "sort_order", label: "Order", type: "number" },
  ],
  samples: [
    { title_id: "Buku Kecil Keberanian", title_en: "Tiny Book of Courage", description_id: "Kumpulan cerita pendek anak.", description_en: "Short stories for kids.", audience: "anak", type: "ebook", language: "id", format: "pdf", reading_time_minutes: 12, price_addon_idr: 0, premium: false, published: true, thumbnail_url: "", resource_url: "", tags: "cerita|sel", sort_order: 1 },
    { title_id: "Panduan Keuangan Keluarga", title_en: "Family Finance Guide", description_id: "Langkah praktis atur uang keluarga.", description_en: "Practical family money steps.", audience: "orangtua", type: "guide", language: "id", format: "pdf", reading_time_minutes: 25, price_addon_idr: 0, premium: false, published: true, thumbnail_url: "", resource_url: "", tags: "finlit", sort_order: 2 },
    { title_id: "Audiobook: Petualangan Kebun", title_en: "Audiobook: Garden Adventure", description_id: "Audiobook anak 15 menit.", description_en: "15-min kids audiobook.", audience: "anak", type: "audiobook", language: "id", format: "mp3", reading_time_minutes: 15, price_addon_idr: 0, premium: false, published: true, thumbnail_url: "", resource_url: "", tags: "audio|cerita", sort_order: 3 },
    { title_id: "Artikel: Otak yang Berkembang", title_en: "Article: The Growing Brain", description_id: "Bagaimana otak anak belajar.", description_en: "How a child's brain learns.", audience: "orangtua", type: "article", language: "id", format: "html", reading_time_minutes: 8, price_addon_idr: 0, premium: false, published: true, thumbnail_url: "", resource_url: "", tags: "parenting", sort_order: 4 },
    { title_id: "Workbook AI untuk Remaja", title_en: "AI Workbook for Teens", description_id: "Latihan AI etis 30 halaman.", description_en: "30-page ethical AI workbook.", audience: "anak", type: "ebook", language: "id", format: "pdf", reading_time_minutes: 45, price_addon_idr: 49000, premium: true, published: true, thumbnail_url: "", resource_url: "", tags: "ai|sma", sort_order: 5 },
  ],
};

const AUDIO_ITEMS = assetTemplate(
  "audio_items", "Audio Items", "audio_lesson", "mp3",
  [
    { id: "Cerita Pagi: Tetangga Baik", en: "Morning Story: Good Neighbour", desc_id: "Cerita 5 menit tentang empati.", desc_en: "5-min story about empathy." },
    { id: "Pelajaran Audio: Bunyi & Huruf", en: "Audio Lesson: Sounds & Letters", desc_id: "Latihan fonik anak.", desc_en: "Kids phonics drill." },
    { id: "Audio: Apa Itu Uang?", en: "Audio: What Is Money?", desc_id: "Pengantar uang harian.", desc_en: "Daily money intro." },
    { id: "Audio: Berpikir Sebelum Bicara", en: "Audio: Think Before You Speak", desc_id: "Praktik berhenti sejenak.", desc_en: "Pause-and-think practice." },
    { id: "Audio: Etika AI Sehari-hari", en: "Audio: Everyday AI Ethics", desc_id: "Diskusi etika AI singkat.", desc_en: "Brief AI ethics talk." },
  ],
);

const VIDEO_ITEMS = assetTemplate(
  "video_items", "Video Items", "short_video", "mp4",
  [
    { id: "Video: Sapaan Pertama", en: "Video: First Greeting", desc_id: "Sapaan ramah sehari-hari.", desc_en: "Friendly daily greeting." },
    { id: "Video: Membaca Aktif", en: "Video: Active Reading", desc_id: "Trik membaca aktif.", desc_en: "Active reading trick." },
    { id: "Video: Mengatur Uang Jajan", en: "Video: Pocket Money", desc_id: "Tiga toples uang.", desc_en: "Three money jars." },
    { id: "Video: Berpikir Kritis 101", en: "Video: Critical Thinking 101", desc_id: "Awas bias konfirmasi.", desc_en: "Beware confirmation bias." },
    { id: "Video: Prompt AI Aman", en: "Video: Safe AI Prompting", desc_id: "Aturan prompt yang aman.", desc_en: "Safe prompting rules." },
  ],
);

const WORKSHEETS = assetTemplate(
  "worksheets", "Worksheets", "worksheet", "pdf",
  [
    { id: "Worksheet: Emosi Hari Ini", en: "Worksheet: Today's Feelings", desc_id: "Tulis perasaan dan alasan.", desc_en: "Write feelings + reason." },
    { id: "Worksheet: Jurnal Membaca", en: "Worksheet: Reading Journal", desc_id: "Catat 3 buku minggu ini.", desc_en: "Log 3 books this week." },
    { id: "Worksheet: Anggaran Mini", en: "Worksheet: Mini Budget", desc_id: "Bagi pemasukan jadi 3.", desc_en: "Split income into 3." },
    { id: "Worksheet: Peta Argumen", en: "Worksheet: Argument Map", desc_id: "Buat peta pendapat.", desc_en: "Map an argument." },
    { id: "Worksheet: Rencana Project AI", en: "Worksheet: AI Project Plan", desc_id: "Sketsa ide AI keluarga.", desc_en: "Sketch a family AI idea." },
  ],
);

const QUIZZES = assetTemplate(
  "quizzes", "Quizzes", "quiz", "interactive",
  [
    { id: "Kuis: Nama Emosi", en: "Quiz: Naming Feelings", desc_id: "10 soal SEL.", desc_en: "10 SEL items." },
    { id: "Kuis: Pemahaman Bacaan", en: "Quiz: Reading Check", desc_id: "Cek pemahaman cerita.", desc_en: "Story comprehension check." },
    { id: "Kuis: Hitung Uang", en: "Quiz: Money Math", desc_id: "Hitungan harian.", desc_en: "Daily math." },
    { id: "Kuis: Bias Logika", en: "Quiz: Logic Bias", desc_id: "Spot the bias.", desc_en: "Spot the bias." },
    { id: "Kuis: Etika AI", en: "Quiz: AI Ethics", desc_id: "Pilihan kasus etika.", desc_en: "Ethics case choices." },
  ],
);

const PROJECTS = assetTemplate(
  "projects", "Projects", "project", "doc",
  [
    { id: "Project: Sudut Tenang Rumah", en: "Project: Calm Corner at Home", desc_id: "Rancang sudut tenang.", desc_en: "Design a calm corner." },
    { id: "Project: Klub Buku Keluarga", en: "Project: Family Book Club", desc_id: "Buat klub buku.", desc_en: "Start a book club." },
    { id: "Project: Bisnis Kecil Anak", en: "Project: Kid's Mini Business", desc_id: "Jual karya sendiri.", desc_en: "Sell your own craft." },
    { id: "Project: Debat Mini", en: "Project: Mini Debate", desc_id: "Atur debat keluarga.", desc_en: "Run a family debate." },
    { id: "Project: Asisten AI Keluarga", en: "Project: Family AI Assistant", desc_id: "Prototipe asisten AI.", desc_en: "Prototype an AI helper." },
  ],
);

const PARENT_GUIDES: CsvTemplate = {
  id: "parent_guides",
  label: "Parent Guides",
  description: "Standalone parent guidance articles (rendered in Parent Dashboard).",
  table: "parent_guides",
  columns: [
    { key: "level", label: "Level", type: "enum", enumValues: LEVEL_ENUM, required: true },
    { key: "pillar", label: "Pillar id (optional)", type: "text" },
    { key: "lesson_id", label: "Lesson UUID (optional)", type: "text" },
    ...bilingualTitle(),
    { key: "body_id", label: "Isi (ID)", type: "longtext", required: true },
    { key: "body_en", label: "Body (EN)", type: "longtext", required: true },
    { key: "reading_time_minutes", label: "Reading time", type: "number" },
    { key: "sort_order", label: "Order", type: "number" },
    { key: "published", label: "Published", type: "boolean" },
  ],
  samples: [
    { level: "early", pillar: "ey_sel", lesson_id: "", title_id: "Menemani Emosi Anak", title_en: "Walking With Your Child's Emotions", body_id: "Tiga langkah mendampingi emosi: namai, validasi, alihkan dengan lembut.", body_en: "Three steps to walk with feelings: name, validate, gently redirect.", reading_time_minutes: 4, sort_order: 1, published: true },
    { level: "elementary", pillar: "el_baca", lesson_id: "", title_id: "Membangun Rutin Membaca", title_en: "Building a Reading Routine", body_id: "Pilih waktu tetap dan ritual sederhana setiap hari.", body_en: "Pick a fixed time and a simple daily ritual.", reading_time_minutes: 5, sort_order: 2, published: true },
    { level: "elementary", pillar: "el_finlit", lesson_id: "", title_id: "Mengajarkan Uang dengan Tenang", title_en: "Teaching Money Calmly", body_id: "Gunakan kasus harian untuk diskusi uang.", body_en: "Use daily cases to discuss money.", reading_time_minutes: 6, sort_order: 3, published: true },
    { level: "middle", pillar: "mid_crit", lesson_id: "", title_id: "Diskusi Tanpa Menggurui", title_en: "Discussing Without Lecturing", body_id: "Ajukan pertanyaan terbuka.", body_en: "Ask open questions.", reading_time_minutes: 5, sort_order: 4, published: true },
    { level: "high", pillar: "hs_ai", lesson_id: "", title_id: "Mendampingi Remaja di Era AI", title_en: "Mentoring Teens in the AI Era", body_id: "Bicarakan batas, etika, dan keamanan.", body_en: "Talk about limits, ethics, and safety.", reading_time_minutes: 7, sort_order: 5, published: true },
  ],
};

export const CSV_TEMPLATES: CsvTemplate[] = [
  COURSES,
  MODULES,
  LESSONS,
  LEARNING_ASSETS,
  DIGITAL_LIBRARY,
  AUDIO_ITEMS,
  VIDEO_ITEMS,
  WORKSHEETS,
  QUIZZES,
  PROJECTS,
  PARENT_GUIDES,
];

export function findTemplate(id: string): CsvTemplate | undefined {
  return CSV_TEMPLATES.find((t) => t.id === id);
}
