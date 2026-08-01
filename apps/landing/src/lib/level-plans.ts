/**
 * KITA Future Homeschool — level-based learning plans.
 * Each plan = one stage of the progression system (Early Years → SMA).
 * Used by the pricing page, checkout, and dashboards.
 */

export type LevelPlanId = "early-years" | "sd-1-3" | "sd-4-6" | "smp" | "sma";

export interface LevelPlan {
  id: LevelPlanId;
  product: string;          // KITA Future {Level} Access
  name_id: string;
  name_en: string;
  age_id: string;
  age_en: string;
  price: number;            // IDR / month
  cta_id: string;
  cta_en: string;
  benefits_id: string[];
  benefits_en: string[];
  badge_id?: string;
  badge_en?: string;
  highlighted?: boolean;
}

export interface LevelDescription {
  id: "early" | "elementary" | "middle" | "high";
  name_id: string;
  name_en: string;
  skills_id: string[];
  skills_en: string[];
  desc_id: string;
  desc_en: string;
}

export const LEVEL_DESCRIPTIONS: LevelDescription[] = [
  {
    id: "early",
    name_id: "Early Years",
    name_en: "Early Years",
    skills_id: [
      "Social-Emotional Learning",
      "Pra-Membaca & Bahasa",
      "Kreativitas & Imajinasi",
      "Motorik Halus & Sensorik",
      "Kemandirian",
      "Berteman dan Berbagi",
    ],
    skills_en: [
      "Social-Emotional Learning",
      "Pre-Reading & Language",
      "Creativity & Imagination",
      "Fine Motor & Sensory",
      "Independence",
      "Friendship & Sharing",
    ],
    desc_id:
      "Bermain, berkomunikasi, dan membangun karakter sebagai fondasi kemandirian.",
    desc_en:
      "Play, communicate, and build character as the foundation of independence.",
  },
  {
    id: "elementary",
    name_id: "SD / Elementary",
    name_en: "Elementary",
    skills_id: [
      "Social-Emotional Learning",
      "Reading & Communication",
      "Financial Literacy",
      "Entrepreneurship",
      "Digital Literacy",
      "Community & Project Collaboration",
    ],
    skills_en: [
      "Social-Emotional Learning",
      "Reading & Communication",
      "Financial Literacy",
      "Entrepreneurship",
      "Digital Literacy",
      "Community & Project Collaboration",
    ],
    desc_id:
      "Memahami dunia bekerja, mengelola uang, memanfaatkan teknologi, dan berkarya melalui proyek nyata.",
    desc_en:
      "Understand how the world works, manage money, leverage technology, and create through real-world projects.",
  },
  {
    id: "middle",
    name_id: "SMP / Middle School",
    name_en: "Middle School",
    skills_id: [
      "Social-Emotional Resilience",
      "Reading & Communication",
      "Financial Literacy",
      "Entrepreneurship",
      "AI Literacy",
      "Network Building",
    ],
    skills_en: [
      "Social-Emotional Resilience",
      "Reading & Communication",
      "Financial Literacy",
      "Entrepreneurship",
      "AI Literacy",
      "Network Building",
    ],
    desc_id:
      "Mengasah resiliensi, AI, kewirausahaan, dan jejaring untuk menjadi remaja yang adaptif dan berdaya cipta.",
    desc_en:
      "Sharpen resilience, AI, entrepreneurship, and networking to become an adaptive and creative teen.",
  },
  {
    id: "high",
    name_id: "SMA / High School",
    name_en: "High School",
    skills_id: [
      "Social-Emotional Smart",
      "Leadership & Communication",
      "Financial Builder",
      "Business & Entrepreneurship",
      "AI Engineering",
      "High-Value Network & Mentorship",
    ],
    skills_en: [
      "Social-Emotional Smart",
      "Leadership & Communication",
      "Financial Builder",
      "Business & Entrepreneurship",
      "AI Engineering",
      "High-Value Network & Mentorship",
    ],
    desc_id:
      "Membangun jaringan bernilai dengan mentor, entrepreneur, founder, profesional, dan investor melalui komunikasi yang efektif.",
    desc_en:
      "Build high-value networks with mentors, entrepreneurs, founders, professionals, and investors through effective communication.",
  },
];

export const LEVEL_PLANS: LevelPlan[] = [
];

export function getLevelPlan(id: string | null | undefined): LevelPlan {
  return LEVEL_PLANS.find((p) => p.id === id) ?? LEVEL_PLANS[1]; // default SD 1–3
}

export function formatRupiah(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}
