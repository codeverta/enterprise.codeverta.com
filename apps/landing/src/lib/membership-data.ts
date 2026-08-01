/**
 * Parent membership plans for KITA Parent Circle.
 * UI source of truth; later moved to Supabase (membership_plans).
 */

export type MembershipTier = "legacy_contributor" | "business_parent_ai" | "family_financial_builder";

export interface MembershipPlan {
  id: MembershipTier;
  name_id: string;
  name_en: string;
  priceLabel_id: string;
  priceLabel_en: string;
  forWhom_id: string;
  forWhom_en: string;
  benefits_id: string[];
  benefits_en: string[];
  cta_id: string;
  cta_en: string;
  highlighted?: boolean;
}

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: "legacy_contributor",
    name_id: "Legacy Contributor",
    name_en: "Legacy Contributor",
    priceLabel_id: "Gratis · By Application",
    priceLabel_en: "Free · By Application",
    forWhom_id:
      "Orang tua berpenghasilan Rp1 Miliar+/bulan yang bersedia berbagi perjalanan bisnis dari nol sampai sukses.",
    forWhom_en:
      "Parents earning Rp1B+/month who are willing to share their journey from zero to success.",
    benefits_id: [
      "Upload sharing perjalanan bisnis",
      "Berbagi pelajaran dari nol sampai sukses",
      "Membangun legacy untuk generasi berikutnya",
      "Profil contributor",
    ],
    benefits_en: [
      "Upload your business journey",
      "Share lessons from zero to success",
      "Build a legacy for the next generation",
      "Featured contributor profile",
    ],
    cta_id: "Ajukan Diri sebagai Contributor",
    cta_en: "Apply as Contributor",
  },
  {
    id: "business_parent_ai",
    name_id: "Business Parent AI Club",
    name_en: "Business Parent AI Club",
    priceLabel_id: "Rp129.000/bulan",
    priceLabel_en: "Rp129,000/month",
    forWhom_id:
      "Orang tua pebisnis yang ingin upgrade skill AI untuk peluang cuan, konten, sales, automation, dan pertumbuhan bisnis.",
    forWhom_en:
      "Business-owner parents who want to level up AI skills for revenue, content, sales, automation, and growth.",
    benefits_id: [
      "AI untuk pertumbuhan bisnis",
      "Workflow konten dan sales",
      "Prompt library untuk pebisnis",
      "Studi kasus bisnis",
      "Diskusi komunitas",
      "Tantangan implementasi bulanan",
    ],
    benefits_en: [
      "AI for business growth",
      "Content & sales workflows",
      "Prompt library for entrepreneurs",
      "Business case studies",
      "Community discussions",
      "Monthly implementation challenges",
    ],
    cta_id: "Upgrade Skill AI Bisnis",
    cta_en: "Level Up AI for Business",
    highlighted: true,
  },
  {
    id: "family_financial_builder",
    name_id: "Family Financial Builder",
    name_en: "Family Financial Builder",
    priceLabel_id: "Rp495.000/bulan",
    priceLabel_en: "Rp495,000/month",
    forWhom_id:
      "Orang tua karyawan, pekerja sibuk, atau bergaji bulanan yang ingin membangun income tambahan dan ketahanan finansial keluarga.",
    forWhom_en:
      "Employee parents, busy professionals, or salaried parents who want extra income and family financial resilience.",
    benefits_id: [
      "AI Financial Builder for Family",
      "Penemuan ide income dengan AI",
      "Perencanaan keuangan keluarga",
      "Roadmap mingguan untuk orang tua sibuk",
      "Skill digital untuk orang tua",
      "Dukungan komunitas",
    ],
    benefits_en: [
      "AI Financial Builder for Family",
      "AI-powered income discovery",
      "Family financial planning",
      "Weekly roadmap for busy parents",
      "Digital skills for parents",
      "Community support",
    ],
    cta_id: "Bangun Finansial Keluarga",
    cta_en: "Build Family Finances",
  },
];
