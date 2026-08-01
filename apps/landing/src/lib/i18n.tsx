import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "id" | "en";

type Dict = Record<string, { id: string; en: string }>;

export const t: Dict = {
  // Nav
  nav_home: { id: "Beranda", en: "Home" },
  nav_curriculum: { id: "Kurikulum", en: "Curriculum" },
  nav_classes: { id: "Kelas", en: "Classes" },
  nav_library: { id: "Digital Library", en: "Digital Library" },
  nav_community: { id: "Komunitas Orang Tua", en: "Parent Community" },
  nav_mentor: { id: "Mentor", en: "Mentor" },
  nav_international: { id: "Internasional", en: "International" },
  nav_guru2digit: { id: "Guru2Digit", en: "Guru2Digit" },
  nav_pricing: { id: "Harga", en: "Pricing" },
  nav_dashboard: { id: "Dashboard", en: "Dashboard" },
  nav_dashboard_student: { id: "Siswa", en: "Student" },
  nav_dashboard_parent: { id: "Orang Tua", en: "Parent" },
  nav_faq: { id: "FAQ", en: "FAQ" },
  nav_login: { id: "Masuk", en: "Sign In" },
  nav_register: { id: "Daftar / Mulai Belajar", en: "Sign Up / Start Learning" },
  nav_try_free: { id: "Coba Gratis", en: "Try Free" },
  nav_program: { id: "Program", en: "Program" },

  // Tagline
  tagline: {
    id: "Mentransformasi Keluarga, Membangun Generasi Tangguh",
    en: "Transforming Families. Building Resilient Generations",
  },

  // Hero
  hero_eyebrow: { id: "Untuk usia 3 tahun – SMA", en: "For ages 3 – High School" },
  hero_title_a: { id: "Homeschooling Masa Depan", en: "The Future of Homeschooling" },
  hero_title_b: { id: "", en: "" },
  hero_title_c: { id: "", en: "" },
  hero_sub: {
    id: "Merupakan Designer Life Curriculum dan Pioneering Skills Pertama di Indonesia — yang akan terpakai di masa depan kalian, terutama pioneering skills, literasi finansial, literasi digital dan entrepreneurship. Belajar lebih fleksibel, ramah neurodivergent dan terjangkau.",
    en: "A Designer Life Curriculum and Pioneering Skills — the first of its kind in Indonesia — equipping you with skills for the future, especially pioneering skills, financial literacy, digital literacy, and entrepreneurship. Learn flexibly, neurodivergent-friendly, and affordable.",
  },
  cta_primary: { id: "Mulai dari Rp149.000/Bulan", en: "Start from Rp149,000/Month" },
  cta_secondary: { id: "Lihat Kurikulum", en: "See Curriculum" },
  cta_trial: { id: "Coba Gratis", en: "Try Free" },
  trial_note: {
    id: "Tanpa kartu kredit · Batalkan kapan saja",
    en: "No credit card · Cancel anytime",
  },
  badge_no_contract: { id: "Tanpa kontrak panjang", en: "No long contracts" },
  badge_neuro: { id: "Ramah neurodivergent", en: "Neurodivergent friendly" },
  badge_pace: { id: "Belajar sesuai ritme", en: "Learn at your pace" },

  // Vision & Mission
  vm_eyebrow: { id: "Visi & Misi", en: "Vision & Mission" },
  vm_title: {
    id: "Pendidikan Berbasis Keluarga, Untuk Masa Depan Yang Lebih Cerah",
    en: "Family-Centered Education For A Brighter Future",
  },
  vision_label: { id: "Visi", en: "Vision" },
  mission_label: { id: "Misi", en: "Mission" },
  vision_id: {
    id: "Membangun pendidikan berbasis keluarga yang mentransformasi keluarga dan membekali anak dengan kecakapan hidup esensial untuk masa depan yang lebih cerah.",
    en: "To build a family-centered education that transforms families and equips children with essential life skills for a brighter future.",
  },
  mission_1: {
    id: "Membekali anak dengan kecakapan hidup inti — kecerdasan sosial-emosional, literasi finansial, literasi digital, dan kewirausahaan — melalui pembelajaran berbasis pengalaman dan proyek nyata.",
    en: "Equip children with core life skills — social-emotional intelligence, financial literacy, digital literacy, and entrepreneurship — through experiential and project-based learning.",
  },
  mission_2: {
    id: "Memberdayakan orang tua melalui pendidikan parenting transformatif yang memperkuat kesadaran diri, kecerdasan emosional, dan sistem keluarga.",
    en: "Empower parents through transformative parenting education that strengthens self-awareness, emotional intelligence, and family systems.",
  },
  mission_3: {
    id: "Menyediakan program pemberdayaan ekonomi bagi orang tua, termasuk edukasi bisnis digital dan keterampilan kewirausahaan praktis.",
    en: "Provide economic empowerment programs for parents, including digital business education and practical entrepreneurship skills.",
  },
  mission_4: {
    id: "Mengintegrasikan platform akademik global dengan pengalaman belajar kontekstual yang relevan dengan kehidupan nyata.",
    en: "Integrate global academic platforms with contextual, real-world learning experiences.",
  },
  mission_5: {
    id: "Membangun lingkungan pembelajaran berkelanjutan yang berakar pada nilai kebersamaan, inovasi, dan tanggung jawab.",
    en: "Cultivate a sustainable learning environment rooted in community, innovation, and responsibility.",
  },

  // Footer
  footer_desc: {
    id: "Designer Life Curriculum dan Pioneering Skills System pertama yang membantu anak berkembang dari usia 3 tahun hingga SMA melalui literasi finansial, entrepreneurship, AI, komunikasi, dan portfolio dunia nyata.",
    en: "The first Designer Life Curriculum and Pioneering Skills System that helps children grow from age 3 to high school through financial literacy, entrepreneurship, AI, communication, and real-world portfolios.",
  },
  footer_platform: { id: "Platform", en: "Platform" },
  footer_account: { id: "Akun", en: "Account" },
  footer_legal: { id: "Disclaimer", en: "Disclaimer" },
  footer_legal_text: {
    id: "KITA Future Homeschool adalah pendamping digital yang membekali anak dan keluarga dengan skill yang akan terpakai di masa depan. Untuk mendapatkan legalitas ijazah kesetaraan A (Jenjang SD), B (Jenjang SMP) dan C (Jenjang SMA) silahkan daftarkan ke SKB atau PKBM yang Terakreditasi di wilayah Anda.",
    en: "KITA Future Homeschool is a digital companion that equips children and families with skills for the future. To obtain equivalency diploma legality A (Elementary), B (Middle School), and C (High School), please register with an accredited SKB or PKBM in your area.",
  },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; tr: (key: keyof typeof t) => string };
const LangCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kf_lang") as Lang | null;
      if (saved === "id" || saved === "en") setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("kf_lang", l); } catch {}
  };

  const tr = (key: keyof typeof t) => t[key]?.[lang] ?? String(key);
  return <LangCtx.Provider value={{ lang, setLang, tr }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) return { lang: "id" as Lang, setLang: () => {}, tr: (k: keyof typeof t) => t[k]?.id ?? String(k) };
  return ctx;
}
