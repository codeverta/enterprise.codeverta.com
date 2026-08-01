/**
 * Digital Library data — scalable seed for the 100,000+ reading library MVP.
 *
 * All titles & descriptions are original KITA content (no third-party text).
 * Production catalog will live in Supabase (digital_library_items table).
 */

import type { LevelId, AccessType, PublishStatus, Difficulty } from "./curriculum-data";

export type LibraryAudience = LevelId | "parent";
export type LibraryLanguage = "id" | "en" | "bilingual";

export type LibraryType =
  | "story"
  | "non_fiction"
  | "worksheet"
  | "activity_book"
  | "financial_literacy"
  | "business_story"
  | "ai_literacy"
  | "emotional_learning"
  | "family_reading"
  | "creativity"
  | "career_skills"
  | "leadership";

export type LibraryFormat = "text" | "pdf" | "audio" | "video_story" | "interactive";

export interface LibraryItem {
  id: string;
  audience: LibraryAudience;
  language: LibraryLanguage;
  type: LibraryType;
  format: LibraryFormat;
  title_id: string;
  title_en: string;
  summary_id: string;
  summary_en: string;
  topic_id: string;
  topic_en: string;
  ageRange: string;
  readingMinutes: 5 | 10 | 15 | 20 | 30;
  difficulty: Difficulty;
  access: AccessType;
  status: PublishStatus;
  tags?: string[];
}

type Seed = [
  string, // id
  LibraryAudience,
  LibraryType,
  LibraryFormat,
  string, // title_id
  string, // title_en
  string, // summary_id
  string, // summary_en
  string, // topic_id
  string, // topic_en
  string, // ageRange
  LibraryItem["readingMinutes"],
  LibraryLanguage,
  AccessType,
];

const mk = (s: Seed): LibraryItem => ({
  id: s[0],
  audience: s[1],
  type: s[2],
  format: s[3],
  title_id: s[4],
  title_en: s[5],
  summary_id: s[6],
  summary_en: s[7],
  topic_id: s[8],
  topic_en: s[9],
  ageRange: s[10],
  readingMinutes: s[11],
  language: s[12],
  access: s[13],
  difficulty: "beginner",
  status: "published",
});

// ---------------- Early Years (20) ----------------
const EARLY: Seed[] = [
  ["lib-ey-01", "early", "story", "video_story", "Si Kancil dan Pelangi Pagi", "Kancil and the Morning Rainbow", "Cerita pendek tentang rasa syukur saat melihat pelangi.", "A short story about gratitude when seeing a rainbow.", "Cerita Bergambar", "Picture Story", "3–6", 5, "id", "included"],
  ["lib-ey-02", "early", "emotional_learning", "video_story", "Aku Sedih, Aku Belajar", "I'm Sad, I Learn", "Mengenalkan empat emosi inti melalui karakter ramah.", "Introducing four core emotions with friendly characters.", "Emosi Anak", "Child Emotions", "3–6", 5, "id", "included"],
  ["lib-ey-03", "early", "activity_book", "interactive", "Aktivitas Sensorik Pagi Hari", "Morning Sensory Play", "Tujuh aktivitas indra sederhana di rumah.", "Seven simple sensory activities at home.", "Aktivitas Sensorik", "Sensory", "3–5", 10, "id", "included"],
  ["lib-ey-04", "early", "story", "audio", "Lullaby Nusantara", "Nusantara Lullabies", "Koleksi audio lagu tidur dari berbagai daerah.", "Audio lullaby collection from many regions.", "Keluarga", "Family", "3–6", 10, "bilingual", "included"],
  ["lib-ey-05", "early", "story", "video_story", "Kebiasaan Pagi Si Beruang", "Bear's Morning Routine", "Cerita rutinitas pagi: bangun, cuci muka, sarapan.", "A morning routine story: wake, wash, eat.", "Kebiasaan Baik", "Good Habits", "3–6", 5, "id", "included"],
  ["lib-ey-06", "early", "activity_book", "pdf", "Pra-Membaca: Bunyi & Huruf", "Pre-Reading: Sounds & Letters", "Latihan bunyi awal kata untuk persiapan membaca.", "Initial sound practice for early readers.", "Pra-Membaca", "Pre-Reading", "4–6", 15, "id", "included"],
  ["lib-ey-07", "early", "story", "text", "Petualangan Bebek Kecil", "Little Duck's Adventure", "Cerita pendek tentang keberanian mencoba hal baru.", "Short tale about the courage to try new things.", "Cerita Bergambar", "Picture Story", "3–6", 5, "id", "included"],
  ["lib-ey-08", "early", "emotional_learning", "video_story", "Marah Itu Tidak Apa-apa", "It's Okay to Be Angry", "Mengelola amarah dengan napas pelangi.", "Managing anger with rainbow breathing.", "Emosi Anak", "Child Emotions", "4–6", 5, "id", "premium_addon"],
  ["lib-ey-09", "early", "story", "video_story", "Keluarga Kucing Pelangi", "The Rainbow Cat Family", "Cerita tentang keluarga yang berbeda-beda dan saling sayang.", "A story about diverse, loving families.", "Keluarga", "Family", "3–6", 5, "id", "included"],
  ["lib-ey-10", "early", "activity_book", "interactive", "Bermain Warna dan Bentuk", "Play with Color and Shape", "Aktivitas mengenal warna primer dan bentuk dasar.", "Activity to learn primary colors and basic shapes.", "Aktivitas Sensorik", "Sensory", "3–5", 10, "id", "included"],
  ["lib-ey-11", "early", "story", "audio", "Cerita Sebelum Tidur: Bintang Kecil", "Bedtime: Little Star", "Audio cerita lembut untuk pengantar tidur.", "Gentle bedtime audio story.", "Cerita Bergambar", "Picture Story", "3–6", 10, "id", "included"],
  ["lib-ey-12", "early", "non_fiction", "video_story", "Hewan-hewan di Sekitarku", "Animals Around Me", "Pengenalan 10 hewan sehari-hari.", "Introducing 10 everyday animals.", "Sains Awal", "Early Science", "4–6", 10, "bilingual", "included"],
  ["lib-ey-13", "early", "emotional_learning", "text", "Aku Sayang Adik", "I Love My Sibling", "Cerita berbagi dan empati di rumah.", "Story about sharing and empathy at home.", "Keluarga", "Family", "4–6", 5, "id", "included"],
  ["lib-ey-14", "early", "activity_book", "pdf", "Tracing Garis & Lengkungan", "Tracing Lines & Curves", "Lembar menebalkan garis untuk motorik halus.", "Tracing sheets for fine motor practice.", "Pra-Membaca", "Pre-Reading", "4–6", 15, "id", "included"],
  ["lib-ey-15", "early", "story", "video_story", "Hari Pertama ke Taman", "First Day at the Park", "Cerita berani mencoba pertemanan baru.", "A story about brave new friendships.", "Kebiasaan Baik", "Good Habits", "3–6", 5, "id", "included"],
  ["lib-ey-16", "early", "story", "text", "Si Kura-kura Sabar", "The Patient Turtle", "Cerita pendek tentang kesabaran.", "Short story about patience.", "Cerita Bergambar", "Picture Story", "3–6", 5, "id", "included"],
  ["lib-ey-17", "early", "activity_book", "interactive", "Ayo Bersihkan Kamar", "Let's Tidy the Room", "Aktivitas menyusun barang sesuai kategori.", "Activity sorting items by category.", "Kebiasaan Baik", "Good Habits", "4–6", 10, "id", "included"],
  ["lib-ey-18", "early", "emotional_learning", "audio", "Napas Pelangi 3 Menit", "3-Minute Rainbow Breath", "Audio pendek menenangkan diri sebelum tidur.", "Short calming audio before bedtime.", "Emosi Anak", "Child Emotions", "3–6", 5, "bilingual", "included"],
  ["lib-ey-19", "early", "non_fiction", "video_story", "Cuaca Hari Ini", "Today's Weather", "Pengenalan cuaca: panas, hujan, mendung.", "Intro to weather: sunny, rainy, cloudy.", "Sains Awal", "Early Science", "4–6", 10, "id", "included"],
  ["lib-ey-20", "early", "activity_book", "pdf", "Buku Aktivitas Keluarga", "Family Activity Book", "10 aktivitas akhir pekan untuk keluarga.", "10 weekend activities for the family.", "Keluarga", "Family", "3–6", 20, "id", "premium_addon"],
];

// ---------------- Elementary (20) ----------------
const ELEM: Seed[] = [
  ["lib-el-01", "elementary", "story", "text", "Anak-anak Pasar Pagi", "Children of the Morning Market", "Cerita anak Indonesia tentang kerja keluarga di pasar.", "Indonesian children's story about family work at the market.", "Cerita Anak Indonesia", "Indonesian Story", "7–10", 10, "id", "included"],
  ["lib-el-02", "elementary", "financial_literacy", "pdf", "Buku Saku Menabung 30 Hari", "30-Day Pocket Savings Book", "Panduan praktis menabung uang saku selama satu bulan.", "Practical 30-day pocket money savings guide.", "Literasi Finansial Anak", "Financial Literacy", "8–12", 20, "id", "included"],
  ["lib-el-03", "elementary", "non_fiction", "interactive", "Sains Dapur: Telur Ajaib", "Kitchen Science: Magic Egg", "Eksperimen aman dengan bahan dapur.", "Safe experiment using kitchen items.", "Sains Sederhana", "Simple Science", "8–12", 20, "id", "included"],
  ["lib-el-04", "elementary", "worksheet", "pdf", "Matematika Uang Belanja", "Shopping Money Math", "Soal cerita belanja sehari-hari.", "Everyday shopping word problems.", "Matematika Uang", "Money Math", "9–12", 30, "id", "included"],
  ["lib-el-05", "elementary", "story", "video_story", "Sahabat Sejati", "True Friends", "Cerita persahabatan yang menghadapi konflik kecil.", "A friendship story facing small conflicts.", "Persahabatan", "Friendship", "7–11", 10, "id", "included"],
  ["lib-el-06", "elementary", "creativity", "interactive", "Proyek Mini: Kartu Pop-up", "Mini Project: Pop-up Card", "Panduan membuat kartu pop-up pertama.", "Guide to making your first pop-up card.", "Proyek Mini", "Mini Project", "8–12", 30, "id", "included"],
  ["lib-el-07", "elementary", "non_fiction", "video_story", "Aku dan Tubuhku", "Me and My Body", "Pengenalan organ tubuh dan fungsinya.", "Intro to body organs and their functions.", "Sains Sederhana", "Simple Science", "7–10", 15, "id", "included"],
  ["lib-el-08", "elementary", "story", "text", "Petualangan di Hutan Mangrove", "Adventure in the Mangrove Forest", "Cerita ekologi tentang pesisir Indonesia.", "Eco story about Indonesian coasts.", "Cerita Anak Indonesia", "Indonesian Story", "8–12", 15, "id", "included"],
  ["lib-el-09", "elementary", "financial_literacy", "interactive", "Toples Tiga Warna", "The Three-Color Jars", "Belajar membagi uang: simpan, kebutuhan, donasi.", "Learning to split money: save, need, give.", "Literasi Finansial Anak", "Financial Literacy", "8–12", 15, "id", "included"],
  ["lib-el-10", "elementary", "creativity", "video_story", "Komunikasi Lewat Surat", "Communicating by Letter", "Belajar menulis surat sederhana untuk keluarga.", "Learning to write simple letters to family.", "Komunikasi", "Communication", "9–12", 10, "id", "included"],
  ["lib-el-11", "elementary", "story", "video_story", "Kakak, Adik, dan Layang-layang", "Brother, Sister, and the Kite", "Cerita kerjasama saudara.", "Story of sibling cooperation.", "Persahabatan", "Friendship", "7–10", 10, "id", "included"],
  ["lib-el-12", "elementary", "creativity", "interactive", "Kreativitas Digital: Membuat Stiker", "Digital Creativity: Make a Sticker", "Pengantar membuat stiker digital sederhana.", "Intro to making simple digital stickers.", "Kreativitas Digital", "Digital Creativity", "9–12", 20, "id", "included"],
  ["lib-el-13", "elementary", "non_fiction", "pdf", "Mengenal Profesi Indonesia", "Indonesian Professions", "10 profesi unik di Indonesia.", "10 unique Indonesian professions.", "Sains Sederhana", "Simple Science", "8–12", 15, "id", "included"],
  ["lib-el-14", "elementary", "worksheet", "pdf", "Latihan Membaca Cepat", "Fast Reading Practice", "Lima bacaan pendek + kuis pemahaman.", "Five short reads + comprehension quiz.", "Komunikasi", "Communication", "9–12", 20, "id", "included"],
  ["lib-el-15", "elementary", "story", "audio", "Dongeng Nusantara: Telaga Bidadari", "Nusantara Tale: Angel Lake", "Audio dongeng lokal yang diceritakan ulang.", "Locally retold folk tale in audio.", "Cerita Anak Indonesia", "Indonesian Story", "7–11", 15, "bilingual", "included"],
  ["lib-el-16", "elementary", "financial_literacy", "pdf", "Daftar Belanja Hemat", "Smart Shopping List", "Cara membuat daftar belanja realistis.", "How to make a realistic shopping list.", "Matematika Uang", "Money Math", "9–12", 10, "id", "included"],
  ["lib-el-17", "elementary", "creativity", "interactive", "Proyek Mini: Kebun Mini di Pot", "Mini Project: Pot Garden", "Panduan menanam sayur di pot kecil.", "Guide to planting vegetables in small pots.", "Proyek Mini", "Mini Project", "8–12", 30, "id", "included"],
  ["lib-el-18", "elementary", "emotional_learning", "video_story", "Saat Aku Cemburu", "When I Feel Jealous", "Memahami cemburu sebagai emosi yang wajar.", "Understanding jealousy as a normal emotion.", "Persahabatan", "Friendship", "8–12", 10, "id", "premium_addon"],
  ["lib-el-19", "elementary", "non_fiction", "video_story", "AI untuk Anak SD", "AI for Elementary Kids", "Pengantar sederhana tentang AI.", "A simple intro to AI.", "Kreativitas Digital", "Digital Creativity", "9–12", 15, "bilingual", "included"],
  ["lib-el-20", "elementary", "creativity", "pdf", "Jurnal Ide Mingguan", "Weekly Idea Journal", "Template jurnal ide untuk anak.", "Idea journal template for kids.", "Proyek Mini", "Mini Project", "8–12", 10, "id", "included"],
];

// ---------------- Middle (20) ----------------
const MID: Seed[] = [
  ["lib-ms-01", "middle", "ai_literacy", "interactive", "AI Primer untuk SMP", "AI Primer for Middle School", "Cara kerja AI dan etika dasarnya.", "How AI works and basic ethics.", "AI Literacy", "AI Literacy", "12–15", 30, "bilingual", "included"],
  ["lib-ms-02", "middle", "business_story", "text", "Remaja Pemilik Brand Stiker", "Teen Sticker Brand Story", "Studi kasus bisnis pertama remaja SMP.", "First business case of a middle schooler.", "Kisah Bisnis Remaja", "Teen Business", "13–15", 20, "id", "included"],
  ["lib-ms-03", "middle", "financial_literacy", "pdf", "Budget Uang Saku Bulanan", "Monthly Allowance Budget", "Template realistis mengelola uang saku.", "Realistic allowance budget template.", "Pengelolaan Uang Saku", "Allowance Management", "12–15", 10, "id", "included"],
  ["lib-ms-04", "middle", "emotional_learning", "audio", "Refleksi 10 Menit Harian", "10-Minute Daily Reflection", "Audio panduan refleksi untuk remaja.", "Reflection audio guide for teens.", "Emotional Resilience", "Emotional Resilience", "12–15", 10, "id", "included"],
  ["lib-ms-05", "middle", "non_fiction", "pdf", "10 Skill Masa Depan", "10 Future Skills", "Ringkasan skill yang menua dengan baik.", "Brief on skills that age well.", "Career Skills", "Career Skills", "13–15", 20, "bilingual", "premium_addon"],
  ["lib-ms-06", "middle", "ai_literacy", "video_story", "AI: Apa yang Bisa dan Tidak", "AI: What It Can and Can't", "Mengenali batas dan bias AI.", "Recognizing AI's limits and bias.", "AI Literacy", "AI Literacy", "13–15", 15, "id", "included"],
  ["lib-ms-07", "middle", "creativity", "interactive", "Portfolio Pertama Kamu", "Your First Portfolio", "Panduan menyusun portfolio digital.", "Guide to building a digital portfolio.", "Portfolio Building", "Portfolio", "13–15", 30, "id", "included"],
  ["lib-ms-08", "middle", "non_fiction", "text", "Berpikir Kritis: 5 Pertanyaan", "Critical Thinking: 5 Questions", "Lima pertanyaan untuk menilai informasi.", "Five questions to evaluate information.", "Berpikir Kritis", "Critical Thinking", "12–15", 15, "id", "included"],
  ["lib-ms-09", "middle", "business_story", "video_story", "Kisah Bisnis Kue Sekolah", "School Bake Sale Story", "Studi kasus bisnis kue mingguan remaja.", "Weekly bake business case study.", "Kisah Bisnis Remaja", "Teen Business", "13–15", 15, "id", "included"],
  ["lib-ms-10", "middle", "financial_literacy", "interactive", "Simulasi Beli vs Sewa", "Buy vs Rent Simulation", "Latihan keputusan finansial sederhana.", "Simple financial decision practice.", "Pengelolaan Uang Saku", "Allowance Management", "13–15", 20, "id", "included"],
  ["lib-ms-11", "middle", "non_fiction", "pdf", "Komunikasi Digital yang Sehat", "Healthy Digital Communication", "Etika berbicara di chat dan media sosial.", "Etiquette for chat and social media.", "Komunikasi Digital", "Digital Communication", "12–15", 15, "id", "included"],
  ["lib-ms-12", "middle", "emotional_learning", "video_story", "Bangkit dari Kegagalan", "Bouncing Back from Failure", "Cerita & latihan untuk emotional resilience.", "Story & exercise for resilience.", "Emotional Resilience", "Emotional Resilience", "13–15", 15, "id", "included"],
  ["lib-ms-13", "middle", "creativity", "interactive", "Kolaborasi Proyek Tim", "Team Project Collaboration", "Cara membagi peran dalam tim kecil.", "How to split roles in a small team.", "Kolaborasi Proyek", "Collaboration", "13–15", 20, "id", "included"],
  ["lib-ms-14", "middle", "ai_literacy", "pdf", "Prompting Dasar untuk Pelajar", "Prompting Basics for Students", "Membuat prompt AI yang jelas dan aman.", "Writing clear, safe AI prompts.", "AI Literacy", "AI Literacy", "13–15", 20, "bilingual", "included"],
  ["lib-ms-15", "middle", "business_story", "text", "Remaja & Jasa Edit Foto", "Teens & Photo Editing Service", "Studi kasus jasa kecil di komunitas sekolah.", "School community micro-service case.", "Kisah Bisnis Remaja", "Teen Business", "13–15", 15, "id", "premium_addon"],
  ["lib-ms-16", "middle", "non_fiction", "video_story", "Logika & Argumen Sederhana", "Simple Logic & Argument", "Membedakan opini, fakta, dan asumsi.", "Telling opinion, fact, and assumption apart.", "Berpikir Kritis", "Critical Thinking", "13–15", 15, "id", "included"],
  ["lib-ms-17", "middle", "creativity", "pdf", "Membangun Portfolio Online", "Building an Online Portfolio", "Checklist 10 langkah portfolio.", "10-step portfolio checklist.", "Portfolio Building", "Portfolio", "13–15", 20, "id", "included"],
  ["lib-ms-18", "middle", "emotional_learning", "text", "Batas Sehat di Media Sosial", "Healthy Social Media Limits", "Panduan menjaga waktu dan energi.", "Guide to protecting time and energy.", "Komunikasi Digital", "Digital Communication", "12–15", 10, "id", "included"],
  ["lib-ms-19", "middle", "non_fiction", "interactive", "Negosiasi Sehari-hari", "Everyday Negotiation", "Latihan negosiasi sopan & efektif.", "Polite, effective negotiation practice.", "Kolaborasi Proyek", "Collaboration", "13–15", 20, "id", "included"],
  ["lib-ms-20", "middle", "career_skills", "pdf", "Peta Minat & Bakat Remaja", "Teen Interest & Talent Map", "Worksheet refleksi minat & bakat.", "Worksheet reflecting interests & talents.", "Career Skills", "Career Skills", "13–15", 20, "id", "included"],
];

// ---------------- High (20) ----------------
const HIGH: Seed[] = [
  ["lib-hs-01", "high", "ai_literacy", "interactive", "AI Workflow untuk Bisnis Kecil", "AI Workflow for Small Business", "Pola workflow AI dari riset ke produksi.", "AI workflow patterns from research to ship.", "AI untuk Bisnis", "AI for Business", "15–18", 30, "bilingual", "included"],
  ["lib-hs-02", "high", "business_story", "video_story", "Membangun Brand dari Nol", "Building a Brand from Zero", "Studi kasus 12 bulan pertama brand digital remaja.", "Case study: first 12 months of a teen brand.", "Entrepreneurship", "Entrepreneurship", "15–18", 30, "id", "premium_addon"],
  ["lib-hs-03", "high", "financial_literacy", "pdf", "Roadmap Investasi Remaja", "Teen Investing Roadmap", "Edukasi risiko & disiplin jangka panjang.", "Risk and long-term discipline education.", "Financial Builder Remaja", "Teen Financial Builder", "16–18", 30, "id", "included"],
  ["lib-hs-04", "high", "career_skills", "pdf", "CV Pertama yang Berdampak", "Your First Impact CV", "Template CV berbasis hasil, bukan tugas.", "Outcome-based CV template, not tasks.", "Career Skills", "Career Skills", "16–18", 20, "bilingual", "included"],
  ["lib-hs-05", "high", "creativity", "interactive", "Personal Branding 101", "Personal Branding 101", "Cara menyusun narasi diri otentik.", "Building an authentic personal narrative.", "Personal Branding", "Personal Branding", "15–18", 20, "id", "included"],
  ["lib-hs-06", "high", "leadership", "video_story", "High-value Network Remaja", "Teen High-value Network", "Cara membangun jejaring berkualitas.", "How to build a quality network.", "High-value Network", "High-value Network", "16–18", 20, "id", "included"],
  ["lib-hs-07", "high", "leadership", "text", "Memimpin Proyek Pertama", "Leading Your First Project", "Prinsip leadership dalam tim kecil.", "Leadership principles in small teams.", "Leadership", "Leadership", "15–18", 15, "id", "included"],
  ["lib-hs-08", "high", "creativity", "interactive", "Real-world Portfolio", "Real-world Portfolio", "Menyusun portfolio dengan klien atau brief nyata.", "Portfolio with real clients or briefs.", "Real-world Portfolio", "Real-world Portfolio", "16–18", 30, "id", "included"],
  ["lib-hs-09", "high", "ai_literacy", "video_story", "AI Agent untuk Produktivitas", "AI Agents for Productivity", "Mengenal AI agent dasar.", "Intro to basic AI agents.", "AI untuk Bisnis", "AI for Business", "16–18", 20, "bilingual", "included"],
  ["lib-hs-10", "high", "business_story", "text", "Dari Side Project ke Income", "From Side Project to Income", "Cerita monetisasi side project remaja.", "Monetizing a teen's side project.", "Entrepreneurship", "Entrepreneurship", "15–18", 20, "id", "included"],
  ["lib-hs-11", "high", "career_skills", "pdf", "Interview Skills 30 Menit", "30-Minute Interview Skills", "Latihan menjawab pertanyaan inti.", "Practice answering core questions.", "Career Skills", "Career Skills", "16–18", 30, "id", "included"],
  ["lib-hs-12", "high", "creativity", "interactive", "Membuat Digital Product Pertama", "Launching Your First Digital Product", "Dari ide ke landing page sederhana.", "From idea to a simple landing page.", "Digital Product", "Digital Product", "16–18", 30, "id", "included"],
  ["lib-hs-13", "high", "financial_literacy", "interactive", "Cashflow Pribadi Remaja", "Teen Personal Cashflow", "Template kas masuk-keluar bulanan.", "Monthly cash in/out template.", "Financial Builder Remaja", "Teen Financial Builder", "15–18", 20, "id", "included"],
  ["lib-hs-14", "high", "non_fiction", "pdf", "Membaca Ekonomi Masa Depan", "Reading the Future Economy", "Tren kerja & income 5–10 tahun ke depan.", "5–10 year work & income trends.", "Future Economy", "Future Economy", "16–18", 30, "bilingual", "premium_addon"],
  ["lib-hs-15", "high", "leadership", "video_story", "Public Speaking Tanpa Drama", "Public Speaking Without Drama", "Struktur 3-bagian untuk presentasi pendek.", "3-part structure for short talks.", "Leadership", "Leadership", "15–18", 20, "id", "included"],
  ["lib-hs-16", "high", "creativity", "text", "Storytelling untuk Brand Pribadi", "Storytelling for Personal Brand", "Membangun narasi 60 detik.", "Building a 60-second narrative.", "Personal Branding", "Personal Branding", "16–18", 15, "id", "included"],
  ["lib-hs-17", "high", "ai_literacy", "pdf", "Etika & Risiko AI", "AI Ethics & Risks", "Panduan singkat untuk pengguna remaja.", "Short guide for teen users.", "AI untuk Bisnis", "AI for Business", "16–18", 20, "bilingual", "included"],
  ["lib-hs-18", "high", "business_story", "video_story", "Studi Kasus: Jasa AI Lokal", "Case: Local AI Service", "Cerita jasa berbasis AI di kota kecil.", "AI-based service story from a small city.", "Entrepreneurship", "Entrepreneurship", "16–18", 20, "id", "included"],
  ["lib-hs-19", "high", "career_skills", "interactive", "High-value Network Map", "High-value Network Map", "Memetakan 50 koneksi & nilai bersama.", "Mapping 50 connections & shared value.", "High-value Network", "High-value Network", "16–18", 30, "id", "premium_addon"],
  ["lib-hs-20", "high", "non_fiction", "video_story", "Future Economy: Skill yang Bertahan", "Future Economy: Durable Skills", "Skill yang tetap relevan di era AI.", "Skills that stay relevant in the AI era.", "Future Economy", "Future Economy", "16–18", 20, "bilingual", "included"],
];

// ---------------- Parent (20) ----------------
const PARENT: Seed[] = [
  ["lib-pa-01", "parent", "family_reading", "pdf", "10 Pertanyaan Reflektif Orang Tua", "10 Reflective Questions for Parents", "Pemantik diskusi keluarga mingguan.", "Weekly family discussion starters.", "Parenting", "Parenting", "Parent", 10, "id", "included"],
  ["lib-pa-02", "parent", "business_story", "video_story", "AI sebagai Income Machine Keluarga", "AI as a Family Income Machine", "Studi kasus orang tua membangun income baru dengan AI.", "Parents building new income with AI.", "AI · Bisnis", "AI · Business", "Parent", 30, "id", "premium_addon"],
  ["lib-pa-03", "parent", "financial_literacy", "pdf", "Dana Darurat Keluarga", "Family Emergency Fund", "Panduan membangun dana darurat 6 bulan.", "6-month emergency fund guide.", "Finansial", "Financial", "Parent", 20, "id", "included"],
  ["lib-pa-04", "parent", "family_reading", "text", "Membaca Bersama Anak Tiap Malam", "Reading with Your Child Every Night", "Manfaat rutinitas baca bersama untuk perkembangan anak.", "Benefits of nightly reading routines for child development.", "Parenting", "Parenting", "Parent", 15, "id", "included"],
  ["lib-pa-05", "parent", "non_fiction", "pdf", "Panduan Gizi Seimbang Keluarga", "Family Balanced Nutrition Guide", "Rencana makan sederhana untuk keluarga sibuk.", "Simple meal plans for busy families.", "Kesehatan", "Health", "Parent", 20, "id", "included"],
  ["lib-pa-06", "parent", "emotional_learning", "audio", "Mendengarkan Anak dengan Penuh", "Listening to Your Child Fully", "Audio panduan teknik mendengarkan aktif.", "Audio guide to active listening techniques.", "Parenting", "Parenting", "Parent", 15, "id", "included"],
  ["lib-pa-07", "parent", "financial_literacy", "interactive", "Budget Keluarga Sederhana", "Simple Family Budget", "Template alokasi pendapatan keluarga bulanan.", "Monthly family income allocation template.", "Finansial", "Financial", "Parent", 20, "id", "included"],
  ["lib-pa-08", "parent", "non_fiction", "video_story", "Mengenal Gaya Belajar Anak", "Understanding Your Child's Learning Style", "Pengenalan tiga gaya belajar utama dan cara mendukungnya.", "Intro to three main learning styles and how to support them.", "Pendidikan", "Education", "Parent", 20, "id", "included"],
  ["lib-pa-09", "parent", "family_reading", "pdf", "Kisah Bedtime dari Orang Tua", "Bedtime Stories from Parents", "Koleksi cerita pendek yang bisa diceritakan ulang.", "Collection of short stories parents can retell.", "Parenting", "Parenting", "Parent", 15, "id", "premium_addon"],
  ["lib-pa-10", "parent", "non_fiction", "text", "Batas Layar yang Sehat", "Healthy Screen Boundaries", "Panduan membatasi waktu digital tanpa konflik.", "Guide to limiting digital time without conflict.", "Digital Parenting", "Digital Parenting", "Parent", 15, "id", "included"],
  ["lib-pa-11", "parent", "career_skills", "pdf", "Kembali Bekerja Setelah Lahir", "Returning to Work After Parental Leave", "Tips transisi karier untuk orang tua.", "Career transition tips for parents.", "Karier", "Career", "Parent", 20, "id", "included"],
  ["lib-pa-12", "parent", "financial_literacy", "video_story", "Investasi Pendidikan Anak", "Investing in Your Child's Education", "Perencanaan dana pendidikan jangka panjang.", "Long-term education fund planning.", "Finansial", "Financial", "Parent", 30, "id", "premium_addon"],
  ["lib-pa-13", "parent", "emotional_learning", "text", "Mengelola Stres Orang Tua", "Managing Parental Stress", "Teknik sederhana menjaga keseimbangan emosi.", "Simple techniques to maintain emotional balance.", "Kesehatan Mental", "Mental Health", "Parent", 15, "id", "included"],
  ["lib-pa-14", "parent", "non_fiction", "interactive", "Rencana Akhir Pekan Keluarga", "Family Weekend Planner", "Template aktivitas akhir pekan yang edukatif.", "Educational weekend activity template.", "Parenting", "Parenting", "Parent", 15, "id", "included"],
  ["lib-pa-15", "parent", "business_story", "text", "Bisnis Rumahan untuk Orang Tua", "Home-based Business for Parents", "Studi kasus memulai bisnis dari rumah.", "Case study on starting a business from home.", "Bisnis", "Business", "Parent", 20, "id", "included"],
  ["lib-pa-16", "parent", "family_reading", "audio", "Podcast Parenting 15 Menit", "15-Minute Parenting Podcast", "Episode pendek tentang tantangan parenting harian.", "Short episodes on daily parenting challenges.", "Parenting", "Parenting", "Parent", 15, "id", "included"],
  ["lib-pa-17", "parent", "non_fiction", "pdf", "Memahami Perkembangan Otak Anak", "Understanding Child Brain Development", "Ringkasan sains perkembangan otak usia dini.", "Science summary of early brain development.", "Pendidikan", "Education", "Parent", 30, "id", "premium_addon"],
  ["lib-pa-18", "parent", "financial_literacy", "interactive", "Asuransi Jiwa & Kesehatan", "Life & Health Insurance Guide", "Panduan memilih perlindungan untuk keluarga.", "Guide to choosing family protection.", "Finansial", "Financial", "Parent", 30, "id", "included"],
  ["lib-pa-19", "parent", "emotional_learning", "video_story", "Komunikasi Positif di Rumah", "Positive Communication at Home", "Teknik berbicara yang membangun kepercayaan anak.", "Speaking techniques that build child trust.", "Parenting", "Parenting", "Parent", 20, "id", "included"],
  ["lib-pa-20", "parent", "non_fiction", "text", "Membangun Tradisi Keluarga", "Building Family Traditions", "Ide tradisi sederhana yang memperkuat ikatan.", "Simple tradition ideas that strengthen bonds.", "Keluarga", "Family", "Parent", 15, "id", "included"],
];

export const LIBRARY_ITEMS: LibraryItem[] = [...EARLY, ...ELEM, ...MID, ...HIGH, ...PARENT].map(mk);

export const LIBRARY_STATS = {
  totalReading: 100_000,
  levels: 4,
  categories: 12,
  accessTiers: 2,
  curatedLanguages: 2,
  partnersPlanned: 25,
};
