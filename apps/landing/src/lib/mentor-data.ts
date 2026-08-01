/**
 * Mentor seed data — used by the dashboards' free-mentor preview sections.
 * 2 free mentors per audience; rest are gated behind subscription / Parent Circle.
 */

import type { LevelId } from "./curriculum-data";

export interface MentorProfile {
  id: string;
  name: string;
  headline_id: string;
  headline_en: string;
  bio_id: string;
  bio_en: string;
  topic_id: string;
  topic_en: string;
  expertise: string[];
}

/** Free mentors for student dashboard, keyed by the student's level. */
export const STUDENT_FREE_MENTORS: Record<LevelId, MentorProfile[]> = {
  early: [
    {
      id: "m-ey-1",
      name: "Panduan Orang Tua: Aktivitas Emosi",
      headline_id: "Aktivitas Emosi Bersama Anak",
      headline_en: "Emotion Activities with Your Child",
      bio_id: "Panduan untuk orang tua mendampingi anak mengenali dan menamai emosi melalui permainan ringan.",
      bio_en: "Guide for parents to help young children recognize and name emotions through gentle play.",
      topic_id: "Pendampingan Emosi",
      topic_en: "Emotion Companionship",
      expertise: ["Parenting", "SEL"],
    },
    {
      id: "m-ey-2",
      name: "Panduan Orang Tua: Cerita Bersama",
      headline_id: "Cerita dan Karya Bersama Keluarga",
      headline_en: "Stories and Creations Together",
      bio_id: "Panduan membaca cerita dan membuat karya sederhana yang memperkuat bonding keluarga.",
      bio_en: "A guide to reading stories and creating simple art that strengthens family bonding.",
      topic_id: "Cerita Keluarga",
      topic_en: "Family Storytelling",
      expertise: ["Storytelling", "Bonding"],
    },
  ],
  elementary: [
    {
      id: "m-el-1",
      name: "Kakak Aira — SMP",
      headline_id: "Belajar Mandiri & Proyek Mini",
      headline_en: "Independent Learning & Mini Projects",
      bio_id: "Berbagi cara membangun kebiasaan belajar, membaca, dan membuat proyek kecil dengan percaya diri.",
      bio_en: "Shares how to build study habits, reading, and small projects with confidence.",
      topic_id: "Belajar Mandiri & Proyek Mini",
      topic_en: "Independent Learning & Mini Projects",
      expertise: ["Study Habits", "Mini Projects"],
    },
    {
      id: "m-el-2",
      name: "Kakak Raka — SMA",
      headline_id: "Portfolio Anak & Skill Digital",
      headline_en: "Kids Portfolio & Digital Skills",
      bio_id: "Berbagi pengalaman membuat portfolio pertama, presentasi karya, dan belajar skill digital sejak dini.",
      bio_en: "Shares making a first portfolio, presenting work, and learning digital skills early.",
      topic_id: "Portfolio Anak & Skill Digital",
      topic_en: "Kids Portfolio & Digital Skills",
      expertise: ["Portfolio", "Digital Skills"],
    },
  ],
  middle: [
    {
      id: "m-ms-1",
      name: "Mentor Bisnis Pemula",
      headline_id: "Memulai Bisnis Remaja",
      headline_en: "Starting a Teen Business",
      bio_id: "Mengenalkan cara menemukan ide bisnis sederhana dari masalah di sekitar.",
      bio_en: "Introduces how to find simple business ideas from problems around you.",
      topic_id: "Memulai Bisnis Remaja",
      topic_en: "Starting a Teen Business",
      expertise: ["Entrepreneurship", "Validation"],
    },
    {
      id: "m-ms-2",
      name: "Mentor Finansial Muda",
      headline_id: "Sukses Finansial Dasar",
      headline_en: "Foundational Financial Success",
      bio_id: "Mengenalkan cara mengatur uang, menabung, dan membangun kebiasaan finansial sehat.",
      bio_en: "Introduces budgeting, saving, and building healthy financial habits.",
      topic_id: "Sukses Finansial Dasar",
      topic_en: "Foundational Financial Success",
      expertise: ["Budgeting", "Saving"],
    },
  ],
  high: [
    {
      id: "m-hs-1",
      name: "Praktisi Bisnis Digital",
      headline_id: "Bisnis Digital & AI",
      headline_en: "Digital Business & AI",
      bio_id: "Berbagi cara memulai bisnis digital, membangun portfolio, dan menggunakan AI untuk peluang masa depan.",
      bio_en: "Shares how to launch a digital business, build a portfolio, and use AI for future opportunity.",
      topic_id: "Bisnis Digital & AI",
      topic_en: "Digital Business & AI",
      expertise: ["AI", "Digital Business"],
    },
    {
      id: "m-hs-2",
      name: "Mentor Finansial dan Karier",
      headline_id: "Financial Builder & Career Readiness",
      headline_en: "Financial Builder & Career Readiness",
      bio_id: "Berbagi strategi membangun skill, network, personal branding, dan kesiapan finansial sebelum dewasa.",
      bio_en: "Strategies for building skill, network, personal branding, and financial readiness before adulthood.",
      topic_id: "Financial Builder & Career",
      topic_en: "Financial Builder & Career",
      expertise: ["Career", "Financial Builder"],
    },
  ],
};

/** Free mentors for parent dashboard — financially upscale / AI-era business stories. */
export const PARENT_FREE_MENTORS: MentorProfile[] = [
  {
    id: "m-pa-1",
    name: "Orang Tua Pebisnis Era AI",
    headline_id: "Bisnis Keluarga & AI",
    headline_en: "Family Business & AI",
    bio_id: "Berbagi perjalanan membangun bisnis keluarga, menggunakan AI untuk efisiensi, dan menyiapkan anak menghadapi masa depan.",
    bio_en: "Sharing the journey of building a family business, using AI for efficiency, and preparing kids for the future.",
    topic_id: "Bisnis Keluarga & AI",
    topic_en: "Family Business & AI",
    expertise: ["AI", "Family Business"],
  },
  {
    id: "m-pa-2",
    name: "Orang Tua Financially Upscaled",
    headline_id: "Financial Upscaling Keluarga",
    headline_en: "Family Financial Upscaling",
    bio_id: "Berbagi cara mengubah mindset finansial keluarga, membangun income tambahan, dan membuat keputusan ekonomi yang lebih sadar.",
    bio_en: "How to shift the family financial mindset, build extra income, and make more conscious economic decisions.",
    topic_id: "Financial Upscaling Keluarga",
    topic_en: "Family Financial Upscaling",
    expertise: ["Financial Planning", "Side Income"],
  },
];

// Backwards compatibility for old mentor page (now redirected)
export const MENTORS = PARENT_FREE_MENTORS;
