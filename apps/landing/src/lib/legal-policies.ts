import {
  Shield, FileText, Baby, Handshake, Database, AlertTriangle, Bot, Users,
  type LucideIcon,
} from "lucide-react";

export type PolicyMeta = {
  slug: string;
  to: "/privacy-policy" | "/terms-of-service" | "/child-protection-policy" | "/parent-consent-policy" | "/data-retention-policy" | "/incident-response-procedure" | "/ai-ethics-safety-policy" | "/parent-partnership-agreement";
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
};

export const POLICIES: PolicyMeta[] = [
  {
    slug: "privacy-policy",
    to: "/privacy-policy",
    title: "Privacy Policy",
    eyebrow: "Privasi",
    description: "Bagaimana kami mengumpulkan, menggunakan, dan melindungi data pribadi anak dan keluarga Anda.",
    icon: Shield,
  },
  {
    slug: "terms-of-service",
    to: "/terms-of-service",
    title: "Terms of Service",
    eyebrow: "Ketentuan Layanan",
    description: "Syarat dan ketentuan penggunaan platform KITA Future Homeschool.",
    icon: FileText,
  },
  {
    slug: "child-protection-policy",
    to: "/child-protection-policy",
    title: "Child Protection Policy",
    eyebrow: "Perlindungan Anak",
    description: "Komitmen kami terhadap keselamatan, keamanan, dan kesejahteraan setiap anak.",
    icon: Baby,
  },
  {
    slug: "parent-consent-policy",
    to: "/parent-consent-policy",
    title: "Parent Consent Policy",
    eyebrow: "Persetujuan Orang Tua",
    description: "Peran orang tua dalam memberikan persetujuan dan mengontrol partisipasi anak.",
    icon: Handshake,
  },
  {
    slug: "data-retention-policy",
    to: "/data-retention-policy",
    title: "Data Retention Policy",
    eyebrow: "Retensi Data",
    description: "Berapa lama kami menyimpan data dan kapan data dihapus secara aman.",
    icon: Database,
  },
  {
    slug: "incident-response-procedure",
    to: "/incident-response-procedure",
    title: "Incident Response Procedure",
    eyebrow: "Respon Insiden",
    description: "Prosedur tanggap insiden keamanan, kebocoran data, dan komunikasi ke keluarga.",
    icon: AlertTriangle,
  },
  {
    slug: "ai-ethics-safety-policy",
    to: "/ai-ethics-safety-policy",
    title: "AI Ethics & Safety Policy",
    eyebrow: "Etika & Keamanan AI",
    description: "Prinsip penggunaan AI yang aman, etis, dan ramah anak di seluruh platform.",
    icon: Bot,
  },
  {
    slug: "parent-partnership-agreement",
    to: "/parent-partnership-agreement",
    title: "Parent Partnership Agreement",
    eyebrow: "Kemitraan Orang Tua",
    description: "Kesepakatan kemitraan antara KITA Future Homeschool dan keluarga.",
    icon: Users,
  },
];
