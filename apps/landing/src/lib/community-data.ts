/**
 * KITA Parent Circle — community page seed data.
 * Categories, posts, events, leaderboard.
 */

export type CommunityCategory =
  | "homeschool"
  | "ai_parents"
  | "family_finance"
  | "business_zero"
  | "parenting_emotion"
  | "child_portfolio"
  | "network_mentor"
  | "success_stories";

export const COMMUNITY_CATEGORIES: { id: CommunityCategory; label_id: string; label_en: string }[] = [
  { id: "homeschool", label_id: "Homeschooling Masa Depan", label_en: "Future Homeschooling" },
  { id: "ai_parents", label_id: "AI untuk Orang Tua", label_en: "AI for Parents" },
  { id: "family_finance", label_id: "Finansial Keluarga", label_en: "Family Finance" },
  { id: "business_zero", label_id: "Bisnis dari Nol", label_en: "Business from Zero" },
  { id: "parenting_emotion", label_id: "Parenting & Emosi Anak", label_en: "Parenting & Child Emotions" },
  { id: "child_portfolio", label_id: "Portfolio Anak", label_en: "Child Portfolio" },
  { id: "network_mentor", label_id: "Networking & Mentorship", label_en: "Networking & Mentorship" },
  { id: "success_stories", label_id: "Success Stories", label_en: "Success Stories" },
];

export interface CommunityPost {
  id: string;
  category: CommunityCategory;
  author: string;
  role_id: string;
  role_en: string;
  title_id: string;
  title_en: string;
  excerpt_id: string;
  excerpt_en: string;
  likes: number;
  comments: number;
  postedAgo_id: string;
  postedAgo_en: string;
}

export const COMMUNITY_POSTS: CommunityPost[] = [
  { id: "p1", category: "ai_parents", author: "Pak Bagus", role_id: "Orang tua · Tangerang", role_en: "Parent · Tangerang", title_id: "Anak SMP saya bangun brand stiker dengan AI", title_en: "My junior-high kid built a sticker brand with AI", excerpt_id: "Akhir pekan kemarin kami buat logo, mockup, dan foto produk. Anak bahkan sudah punya 12 follower pertama.", excerpt_en: "Last weekend we made the logo, mockups, and product photos. He even has his first 12 followers.", likes: 124, comments: 38, postedAgo_id: "2 jam lalu", postedAgo_en: "2 hours ago" },
  { id: "p2", category: "family_finance", author: "Ibu Linda", role_id: "Orang tua · Bekasi", role_en: "Parent · Bekasi", title_id: "AI bantu saya bangun income side dalam 2 bulan", title_en: "AI helped me build a side income in 2 months", excerpt_id: "Belajar dari komunitas, side project mingguan saya sekarang menutup SPP anak setiap bulan.", excerpt_en: "Learning from the community, my weekly side project now covers tuition every month.", likes: 211, comments: 64, postedAgo_id: "5 jam lalu", postedAgo_en: "5 hours ago" },
  { id: "p3", category: "homeschool", author: "Ibu Maya", role_id: "Homeschool mom · Yogyakarta", role_en: "Homeschool mom · Yogyakarta", title_id: "Anak SD pertama kali jual slime ke teman", title_en: "First grader's first slime sale", excerpt_id: "Modul entrepreneurship membuatnya percaya diri. Dia bahkan menulis label sendiri.", excerpt_en: "The entrepreneurship module gave her confidence — she even wrote the labels herself.", likes: 98, comments: 22, postedAgo_id: "1 hari lalu", postedAgo_en: "1 day ago" },
  { id: "p4", category: "business_zero", author: "Mas Reza", role_id: "Founder · Surabaya", role_en: "Founder · Surabaya", title_id: "5 pelajaran dari 100 hari pertama bisnis digital", title_en: "5 lessons from the first 100 days of digital business", excerpt_id: "Validasi dulu, baru produksi. Komunitas membantu saya menahan diri dari over-engineering.", excerpt_en: "Validate first, build second. The community kept me from over-engineering.", likes: 312, comments: 87, postedAgo_id: "2 hari lalu", postedAgo_en: "2 days ago" },
  { id: "p5", category: "parenting_emotion", author: "Bu Sari", role_id: "Konselor keluarga", role_en: "Family counselor", title_id: "Cara dampingi anak saat marah meledak", title_en: "How to be present when a child explodes in anger", excerpt_id: "Tiga langkah: hadir, nama-kan emosi, lalu cari solusi. Kuncinya bukan menghentikan emosi.", excerpt_en: "Three steps: be present, name the emotion, then find a solution. The key is not stopping the feeling.", likes: 178, comments: 41, postedAgo_id: "3 hari lalu", postedAgo_en: "3 days ago" },
  { id: "p6", category: "child_portfolio", author: "Pak Andi", role_id: "Orang tua · Bandung", role_en: "Parent · Bandung", title_id: "Pameran karya pertama anak di ruang tamu", title_en: "First exhibition in our living room", excerpt_id: "Anak sangat bangga. Kakek dan nenek datang menonton dan memberikan feedback.", excerpt_en: "She was so proud. Her grandparents came and gave feedback.", likes: 86, comments: 19, postedAgo_id: "4 hari lalu", postedAgo_en: "4 days ago" },
  { id: "p7", category: "network_mentor", author: "Mbak Dini", role_id: "Mentor · Jakarta", role_en: "Mentor · Jakarta", title_id: "Etika outreach ke mentor: jangan minta tanpa memberi", title_en: "Outreach etiquette: don't ask without giving", excerpt_id: "Mulai dengan menghargai waktu mereka. Bawa pertanyaan tajam, bukan permintaan umum.", excerpt_en: "Start by respecting their time. Bring sharp questions, not vague asks.", likes: 145, comments: 33, postedAgo_id: "6 hari lalu", postedAgo_en: "6 days ago" },
  { id: "p8", category: "success_stories", author: "Keluarga Wibowo", role_id: "Anggota Family Builder", role_en: "Family Builder member", title_id: "Dari karyawan ke punya 3 sumber income", title_en: "From employee to 3 income streams", excerpt_id: "Roadmap mingguan komunitas membuat semua terasa mungkin. Anak ikut belajar dari proses.", excerpt_en: "The community's weekly roadmap made it all feel possible. Our kids learned from the process too.", likes: 402, comments: 121, postedAgo_id: "1 minggu lalu", postedAgo_en: "1 week ago" },
];

export interface CommunityEvent {
  id: string;
  title_id: string;
  title_en: string;
  when_id: string;
  when_en: string;
  host: string;
}

export const COMMUNITY_EVENTS: CommunityEvent[] = [
  { id: "e1", title_id: "Live: AI untuk Konten Bisnis", title_en: "Live: AI for Business Content", when_id: "Kamis, 19:30 WIB", when_en: "Thursday, 19:30 WIB", host: "Mbak Dini" },
  { id: "e2", title_id: "Workshop: Dana Darurat Keluarga 6 Bulan", title_en: "Workshop: 6-Month Family Emergency Fund", when_id: "Sabtu, 09:00 WIB", when_en: "Saturday, 09:00 WIB", host: "Pak Reza" },
  { id: "e3", title_id: "Mentor Hour: Validasi Ide Bisnis", title_en: "Mentor Hour: Validating Business Ideas", when_id: "Senin depan, 20:00 WIB", when_en: "Next Monday, 20:00 WIB", host: "Bu Sari" },
];

export const COMMUNITY_LEADERBOARD = [
  { rank: 1, name: "Ibu Linda", points: 1240 },
  { rank: 2, name: "Pak Bagus", points: 1105 },
  { rank: 3, name: "Mas Reza", points: 980 },
  { rank: 4, name: "Ibu Maya", points: 842 },
  { rank: 5, name: "Pak Andi", points: 701 },
];

export const MONTHLY_CHALLENGE = {
  title_id: "Tantangan Bulan Ini: Income Eksperimen 30 Hari",
  title_en: "This Month's Challenge: 30-Day Income Experiment",
  desc_id: "Jalankan satu eksperimen income sederhana selama 30 hari, dokumentasikan setiap minggu di komunitas.",
  desc_en: "Run one simple income experiment for 30 days and document weekly in the community.",
};
