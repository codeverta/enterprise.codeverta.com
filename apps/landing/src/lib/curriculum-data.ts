/**
 * Curriculum data — exact 7 pillars per level, scalable seed for the LMS.
 * Bilingual ID/EN. CMS-ready (mirrors Supabase `courses` shape).
 */

export type LevelId = "early" | "elementary" | "middle" | "high";

export interface LevelMeta {
  id: LevelId;
  label_id: string;
  label_en: string;
  ageRange_id: string;
  ageRange_en: string;
  tagline_id: string;
  tagline_en: string;
}

export const LEVELS: LevelMeta[] = [
  {
    id: "early",
    label_id: "Early Years",
    label_en: "Early Years",
    ageRange_id: "Usia 3–6 tahun",
    ageRange_en: "Ages 3–6",
    tagline_id: "",
    tagline_en: "",
  },
  {
    id: "elementary",
    label_id: "SD / Elementary",
    label_en: "Elementary",
    ageRange_id: "Kelas 1–6",
    ageRange_en: "Grade 1–6",
    tagline_id: "",
    tagline_en: "",
  },
  {
    id: "middle",
    label_id: "SMP / Middle School",
    label_en: "Middle School",
    ageRange_id: "Kelas 7–9",
    ageRange_en: "Grade 7–9",
    tagline_id: "",
    tagline_en: "",
  },
  {
    id: "high",
    label_id: "SMA / High School",
    label_en: "High School",
    ageRange_id: "Kelas 10–12",
    ageRange_en: "Grade 10–12",
    tagline_id: "",
    tagline_en: "",
  },
];

export interface Pillar {
  id: string;
  level: LevelId;
  name_id: string;
  name_en: string;
  order: number;
}

/** Exactly 6 Pioneer Skills per level, in the prescribed order. */
export const PILLARS: Pillar[] = [
  // ── Early Years
  { id: "ey_sel",      level: "early", order: 1, name_id: "Social-Emotional Learning",        name_en: "Social-Emotional Learning" },
  { id: "ey_prabaca",  level: "early", order: 2, name_id: "Pra-Membaca & Bahasa",             name_en: "Pre-Reading & Language" },
  { id: "ey_kreatif",  level: "early", order: 3, name_id: "Kreativitas & Imajinasi",          name_en: "Creativity & Imagination" },
  { id: "ey_motorik",  level: "early", order: 4, name_id: "Motorik Halus & Sensorik",         name_en: "Fine Motor & Sensory" },
  { id: "ey_mandiri",  level: "early", order: 5, name_id: "Kemandirian",                     name_en: "Independence" },
  { id: "ey_galeri",   level: "early", order: 6, name_id: "Berteman dan Berbagi",              name_en: "Friendship & Sharing" },

  // ── Elementary / SD
  { id: "el_sel",       level: "elementary", order: 1, name_id: "Social-Emotional Learning", name_en: "Social-Emotional Learning" },
  { id: "el_baca",      level: "elementary", order: 2, name_id: "Reading & Communication",   name_en: "Reading & Communication" },
  { id: "el_finansial", level: "elementary", order: 3, name_id: "Financial Literacy",        name_en: "Financial Literacy" },
  { id: "el_entrep",    level: "elementary", order: 4, name_id: "Entrepreneurship",          name_en: "Entrepreneurship" },
  { id: "el_digital",   level: "elementary", order: 5, name_id: "Digital Literacy",          name_en: "Digital Literacy" },
  { id: "el_kolab",     level: "elementary", order: 6, name_id: "Komunitas & Kolaborasi Proyek",  name_en: "Community & Project Collaboration" },

  // ── Middle / SMP
  { id: "ms_sel",       level: "middle", order: 1, name_id: "Social-Emotional Resilience", name_en: "Social-Emotional Resilience" },
  { id: "ms_baca",      level: "middle", order: 2, name_id: "Reading & Communication",     name_en: "Reading & Communication" },
  { id: "ms_finansial", level: "middle", order: 3, name_id: "Financial Literacy",          name_en: "Financial Literacy" },
  { id: "ms_entrep",    level: "middle", order: 4, name_id: "Entrepreneurship",            name_en: "Entrepreneurship" },
  { id: "ms_ai",        level: "middle", order: 5, name_id: "AI Literacy",                 name_en: "AI Literacy" },
  { id: "ms_komunitas", level: "middle", order: 6, name_id: "Network Building", name_en: "Network Building" },

  // ── High / SMA
  { id: "hs_sel",       level: "high", order: 1, name_id: "Social-Emotional Smart",       name_en: "Social-Emotional Smart" },
  { id: "hs_leader",    level: "high", order: 2, name_id: "Leadership & Communication",   name_en: "Leadership & Communication" },
  { id: "hs_finansial", level: "high", order: 3, name_id: "Financial Builder",            name_en: "Financial Builder" },
  { id: "hs_biz",       level: "high", order: 4, name_id: "Business & Entrepreneurship",  name_en: "Business & Entrepreneurship" },
  { id: "hs_ai",        level: "high", order: 5, name_id: "AI Engineering",               name_en: "AI Engineering" },
  { id: "hs_network",   level: "high", order: 6, name_id: "High-Value Network & Mentorship", name_en: "High-Value Network & Mentorship" },
];

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type AccessType = "included" | "premium_addon" | "free_preview";
export type CourseStatus = "not_started" | "in_progress" | "completed";
export type PublishStatus = "draft" | "published";

export interface Course {
  id: string;
  level: LevelId;
  pillar: string;
  title_id: string;
  title_en: string;
  description_id: string;
  description_en: string;
  difficulty: Difficulty;
  durationMinutes: number;
  access: AccessType;
  status: CourseStatus;
  publishStatus: PublishStatus;
  progress: number;
  tags?: string[];
}

const mk = (
  id: string,
  level: LevelId,
  pillar: string,
  title_id: string,
  title_en: string,
  desc_id: string,
  desc_en: string,
  opts: Partial<Course> = {},
): Course => ({
  id,
  level,
  pillar,
  title_id,
  title_en,
  description_id: desc_id,
  description_en: desc_en,
  difficulty: opts.difficulty ?? "beginner",
  durationMinutes: opts.durationMinutes ?? 30,
  access: opts.access ?? "included",
  status: opts.status ?? "not_started",
  publishStatus: opts.publishStatus ?? "published",
  progress: opts.progress ?? 0,
  tags: opts.tags ?? [],
});

export const COURSES: Course[] = [
  // ───── EARLY YEARS
  mk("ey-01", "early", "ey_sel", "Mengenal Emosi Dasar", "Recognizing Basic Emotions", "Anak belajar menamai senang, sedih, marah, takut lewat permainan kartu emosi.", "Children learn to name happy, sad, angry, and afraid through emotion card play.", { progress: 45, status: "in_progress", access: "free_preview" }),
  mk("ey-02", "early", "ey_sel", "Aku Bisa Menunggu Giliran", "I Can Wait My Turn", "Latihan kesabaran dan empati lewat aktivitas keluarga.", "Practice patience and empathy through family activities.", { access: "free_preview" }),
  mk("ey-03", "early", "ey_prabaca", "Cerita Bergambar Pertamaku", "My First Picture Story", "Membaca bersama orang tua dengan cerita lokal Nusantara.", "Read along with parents using local Nusantara stories."),
  mk("ey-04", "early", "ey_prabaca", "Bermain Bunyi Huruf", "Playing with Letter Sounds", "Pengenalan fonik dengan lagu dan gerakan.", "Phonics introduction with songs and movement."),
  mk("ey-05", "early", "ey_kreatif", "Menggambar Perasaan", "Drawing My Feelings", "Ekspresi emosi lewat warna dan bentuk bebas.", "Express emotion through colors and free shapes."),
  mk("ey-06", "early", "ey_mandiri", "Merapikan Mainan Sendiri", "Tidying Up On My Own", "Kebiasaan baik harian dengan reward chart sederhana.", "Daily good habits with a simple reward chart."),
  mk("ey-07", "early", "ey_mandiri", "Mengenal Konsep Menabung", "Understanding Saving", "Cerita celengan ajaib dan tantangan menabung mingguan.", "The magic piggy bank story and a weekly savings challenge."),
  mk("ey-08", "early", "ey_motorik", "Aktivitas Sensorik di Rumah", "Sensory Play at Home", "Eksplorasi tekstur, bau, dan suara dengan bahan dapur.", "Explore texture, smell, and sound with kitchen materials."),
  mk("ey-09", "early", "ey_prabaca", "Cerita Keluargaku", "My Family Story", "Anak membuat buku cerita tentang keluarga sendiri.", "Children create a storybook about their own family."),
  mk("ey-10", "early", "ey_galeri", "Galeri Karya Pertamaku", "My First Gallery", "Pameran kecil di rumah untuk membangun rasa bangga.", "A small home exhibit to build a sense of pride."),
  mk("ey-11", "early", "ey_kreatif", "Membuat Boneka Kertas", "Make Paper Puppets", "Aktivitas kreatif untuk bercerita peran sederhana.", "Creative activity for simple role-play storytelling."),
  mk("ey-12", "early", "ey_motorik", "Jari-jari Lincah", "Nimble Fingers", "Latihan motorik halus dengan menjepit, meronce, menggunting.", "Fine motor practice with pinching, threading, cutting."),
  mk("ey-13", "early", "ey_mandiri", "Aku Bisa Makan Sendiri", "I Can Eat By Myself", "Rutinitas makan mandiri dengan dukungan orang tua.", "Independent eating routines with parent support."),
  mk("ey-14", "early", "ey_sel", "Sahabat Bonekaku", "My Doll Friend", "Belajar empati dan caring lewat permainan boneka.", "Learn empathy and caring through doll play."),
  mk("ey-15", "early", "ey_mandiri", "Jajan dengan Bijak", "Snack Time with Care", "Pengenalan pilihan dan pengendalian diri saat jajan.", "Introducing choice and self-control during snack time.", { access: "premium_addon" }),

  // ───── ELEMENTARY
  mk("el-01", "elementary", "el_baca", "Membaca Cerita Rakyat Indonesia", "Reading Indonesian Folk Tales", "Cerita rakyat dari berbagai daerah dengan pertanyaan pemahaman.", "Folk tales from many regions with comprehension prompts.", { progress: 60, status: "in_progress", access: "free_preview" }),
  mk("el-02", "elementary", "el_baca", "Komunikasi Percaya Diri", "Confident Communication", "Latihan berbicara di depan keluarga dan komunitas.", "Practice speaking in front of family and community.", { access: "free_preview" }),
  mk("el-03", "elementary", "el_finansial", "Matematika Uang Sehari-hari", "Everyday Money Math", "Konsep belanja, kembalian, dan diskon dengan studi kasus warung.", "Shopping, change, and discount concepts with warung case studies."),
  mk("el-04", "elementary", "el_finansial", "Proyek Celengan Pertamaku", "My First Savings Project", "Tantangan menabung 30 hari dengan jurnal mingguan.", "A 30-day savings challenge with a weekly journal.", { progress: 25, status: "in_progress" }),
  mk("el-05", "elementary", "el_digital", "Sains Dapur Rumah", "Kitchen Science", "Eksperimen aman dengan bahan dapur.", "Safe experiments with kitchen ingredients."),
  mk("el-06", "elementary", "el_digital", "Kreativitas Digital Anak", "Kids Digital Creativity", "Pengenalan canva for kids dan storytelling visual.", "Introduction to kid-safe design tools and visual storytelling."),
  mk("el-07", "elementary", "el_kolab", "Berteman dan Berkolaborasi", "Friendship & Collaboration", "Aturan main bersama, konflik, dan kompromi.", "Shared rules, conflict, and compromise."),
  mk("el-08", "elementary", "el_baca", "Membuat Presentasi Mini", "Make a Mini Presentation", "Belajar membuat slide 5 halaman tentang minat sendiri.", "Learn to make a 5-slide deck about a personal interest."),
  mk("el-09", "elementary", "el_finansial", "Literasi Finansial Anak", "Kids Financial Literacy", "Konsep kebutuhan vs keinginan, tabungan, dan amal.", "Needs vs wants, saving, and giving concepts."),
  mk("el-10", "elementary", "el_kolab", "Portofolio Karya Mingguan", "Weekly Portfolio Showcase", "Membangun kebiasaan dokumentasi karya tiap minggu.", "Build the habit of documenting work every week."),
  mk("el-11", "elementary", "el_sel", "Mengelola Marah dengan Sehat", "Healthy Anger Management", "Strategi nafas, jeda, dan kata-kata yang membantu.", "Breath, pause, and helpful words strategies."),
  mk("el-12", "elementary", "el_entrep", "Bisnis Kue Akhir Pekan", "Weekend Bake Business", "Memulai bisnis kecil dari dapur rumah.", "Start a small business from the home kitchen."),
  mk("el-13", "elementary", "el_digital", "Ekosistem Halaman Rumah", "Backyard Ecosystem", "Observasi serangga, tanaman, dan cuaca.", "Observing insects, plants, and weather."),
  mk("el-14", "elementary", "el_digital", "Bercerita dengan Foto", "Storytelling with Photos", "Komposisi foto sederhana dan caption.", "Simple photo composition and captions."),
  mk("el-15", "elementary", "el_kolab", "Pameran Karya Keluarga", "Family Work Exhibition", "Acara pameran karya di rumah dengan undangan.", "A home work exhibition with invitations.", { access: "premium_addon" }),

  // ───── MIDDLE SCHOOL
  mk("ms-01", "middle", "ms_baca", "Cara Berpikir Kritis", "How To Think Critically", "Kerangka argumen, bias, dan evaluasi sumber.", "Argument frameworks, bias, and source evaluation.", { difficulty: "intermediate", access: "free_preview" }),
  mk("ms-02", "middle", "ms_finansial", "Mengelola Uang Saku", "Managing Pocket Money", "Budgeting, savings rate, dan target keuangan remaja.", "Budgeting, savings rate, and teen money goals.", { progress: 30, status: "in_progress", access: "free_preview" }),
  mk("ms-03", "middle", "ms_entrep", "Ide Bisnis Sederhana untuk Remaja", "Simple Business Ideas for Teens", "Validasi ide, riset pasar mini, dan eksekusi pertama.", "Idea validation, mini market research, and first execution.", { difficulty: "intermediate" }),
  mk("ms-04", "middle", "ms_ai", "AI untuk Tugas dan Kreativitas", "AI for Homework & Creativity", "Pemakaian AI yang etis untuk belajar dan berkarya.", "Ethical AI use for learning and creating."),
  mk("ms-05", "middle", "ms_ai", "Membuat Konten Edukatif dengan AI", "Make Educational Content with AI", "Skrip, rekaman, dan editing video sederhana.", "Script, record, and edit simple video.", { difficulty: "intermediate" }),
  mk("ms-06", "middle", "ms_komunitas", "Kolaborasi Proyek Tim", "Team Project Collaboration", "Peran, deadline, dan komunikasi tim.", "Roles, deadlines, and team communication."),
  mk("ms-07", "middle", "ms_baca", "Public Speaking Dasar", "Foundational Public Speaking", "Struktur 5 menit dan teknik kontrol gugup.", "5-minute structure and nerve-control techniques."),
  mk("ms-08", "middle", "ms_sel", "Emotional Resilience untuk Remaja", "Teen Emotional Resilience", "Mindfulness sederhana dan reframing pikiran negatif.", "Simple mindfulness and reframing negative thoughts."),
  mk("ms-09", "middle", "ms_ai", "Membangun Portfolio Digital", "Building a Digital Portfolio", "Halaman karya online dengan deskripsi proyek.", "An online work page with project descriptions.", { difficulty: "intermediate" }),
  mk("ms-10", "middle", "ms_komunitas", "Komunitas Positif dan Networking Dasar", "Positive Community & Networking 101", "Etika online dan membangun lingkar pertemanan sehat.", "Online etiquette and building healthy circles."),
  mk("ms-11", "middle", "ms_ai", "Prompt Dasar untuk Pelajar", "Prompting 101 for Students", "Pola prompt yang efektif untuk belajar.", "Effective prompt patterns for learning."),
  mk("ms-12", "middle", "ms_entrep", "Validasi Ide dengan Survey Mini", "Validate Ideas with Mini Surveys", "Membuat survey 5 pertanyaan dan baca insight.", "Build a 5-question survey and read insight.", { access: "premium_addon" }),
  mk("ms-13", "middle", "ms_ai", "Desain Poster dengan AI", "Poster Design with AI", "Brief, gaya visual, dan output siap cetak.", "Brief, visual style, and print-ready output."),
  mk("ms-14", "middle", "ms_finansial", "Investasi Pertamaku (Edukasi)", "My First Investment (Education)", "Konsep risiko, return, dan disiplin jangka panjang.", "Risk, return, and long-term discipline concepts.", { difficulty: "intermediate" }),
  mk("ms-15", "middle", "ms_sel", "Mengelola Stres Ujian", "Managing Exam Stress", "Rutinitas belajar dan istirahat berbasis sains.", "Science-based study and rest routines."),

  // ───── HIGH SCHOOL
  mk("hs-01", "high", "hs_ai", "AI Engineering untuk Bisnis", "AI Engineering for Business", "Workflow AI end-to-end untuk konten, sales, dan operasi.", "End-to-end AI workflows for content, sales, and ops.", { difficulty: "advanced", durationMinutes: 60, access: "free_preview" }),
  mk("hs-02", "high", "hs_biz", "Membangun Ide Bisnis dari Nol", "Build a Business Idea from Zero", "Dari masalah, segmen, hingga MVP pertama.", "From problem and segment to first MVP.", { difficulty: "intermediate", access: "free_preview" }),
  mk("hs-03", "high", "hs_finansial", "Financial Builder untuk Remaja", "Financial Builder for Teens", "Income stream, kontrol biaya, dan investasi awal.", "Income streams, cost control, and early investing.", { difficulty: "intermediate" }),
  mk("hs-04", "high", "hs_sel", "Personal Branding di Era AI", "Personal Branding in the AI Era", "Positioning, narasi diri, dan portofolio publik.", "Positioning, personal narrative, and public portfolio."),
  mk("hs-05", "high", "hs_network", "High-Value Network & Mentorship", "High-Value Network & Mentorship", "Memilih lingkaran, outreach, dan menjaga hubungan.", "Choosing circles, outreach, and nurturing relationships.", { difficulty: "advanced" }),
  mk("hs-06", "high", "hs_leader", "Berkomunikasi dengan Mentor", "Communicating with Mentors", "Etika, pertanyaan tajam, dan tindak lanjut.", "Etiquette, sharp questions, and follow-up."),
  mk("hs-07", "high", "hs_biz", "Business Model Dasar", "Foundational Business Model", "Canvas, unit economics, dan asumsi inti.", "Canvas, unit economics, and core assumptions.", { difficulty: "intermediate" }),
  mk("hs-08", "high", "hs_leader", "Membuat Portfolio Profesional", "Building a Professional Portfolio", "Studi kasus, proses, dan dampak terukur.", "Case studies, process, and measurable impact.", { difficulty: "intermediate" }),
  mk("hs-09", "high", "hs_ai", "Digital Product Starter", "Digital Product Starter", "Membuat produk digital pertama dengan AI sebagai co-builder.", "Build your first digital product with AI as co-builder.", { difficulty: "advanced", access: "premium_addon" }),
  mk("hs-10", "high", "hs_leader", "Career Path dan Future Skills", "Career Path & Future Skills", "Eksplorasi karier non-tradisional dan skill yang menua dengan baik.", "Non-traditional careers and skills that age well."),
  mk("hs-11", "high", "hs_ai", "AI untuk Sales dan Outreach", "AI for Sales & Outreach", "Riset prospek, copywriting, dan follow-up berbasis AI.", "Prospect research, copywriting, and AI-driven follow-up.", { difficulty: "advanced" }),
  mk("hs-12", "high", "hs_finansial", "Membaca Laporan Keuangan Sederhana", "Reading Simple Financials", "P&L, cashflow, dan kesehatan bisnis kecil.", "P&L, cashflow, and small-business health.", { difficulty: "intermediate" }),
  mk("hs-13", "high", "hs_sel", "Konten Video Pendek Berdampak", "Impactful Short-Form Video", "Hook, narasi 30 detik, dan iterasi cepat.", "Hook, 30-second narrative, and fast iteration."),
  mk("hs-14", "high", "hs_leader", "Memimpin Proyek Tim Kecil", "Leading Small Team Projects", "Visi, ritme kerja, dan retrospektif.", "Vision, work rhythm, and retrospectives.", { difficulty: "intermediate" }),
  mk("hs-15", "high", "hs_network", "Etiket Komunitas Pebisnis", "Business Community Etiquette", "Memberi sebelum meminta dan menjadi anggota yang dicari.", "Give before you ask and become a sought-after member."),
];

export const COURSE_STATS = {
  totalCourses: 250,
  totalProjects: 100,
  totalLibrary: 100_000,
};

export function coursesByLevel(level: LevelId): Course[] {
  return COURSES.filter((c) => c.level === level);
}

export function pillarsByLevel(level: LevelId): Pillar[] {
  return PILLARS.filter((p) => p.level === level).sort((a, b) => a.order - b.order);
}

/** Lessons-per-course estimate for marketing copy (CMS-ready field later). */
export function lessonsByLevel(level: LevelId): number {
  // Each course averages 6 lessons in the production catalog.
  return coursesByLevel(level).length * 6;
}
