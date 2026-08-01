
# Rencana Upgrade: KITA Future Homeschool Platform

Permintaanmu sangat besar (navbar baru, 2 dashboard penuh, Digital Library, Kelas marketplace, Komunitas, Mentor, struktur CMS, bilingual). Kalau dikerjakan sekaligus dalam 1 batch akan berisiko: file terlalu panjang, bugs sulit dilacak, dan kamu tidak bisa review per bagian.

Saya rekomendasikan **memecah jadi 4 fase**. Setiap fase shippable dan bisa kamu review sebelum lanjut.

---

## Fase 1 — Fondasi (saya kerjakan sekarang setelah kamu setuju)

**Tujuan:** struktur navigasi + arsitektur data siap, dashboard demo bisa diakses dari navbar.

1. **Navigasi baru** (`src/components/site-layout.tsx` + `src/lib/i18n.tsx`)
   - Hapus konsep "Login Student" / "Login Parent" terpisah.
   - Navbar: Beranda · Kurikulum · Kelas · Digital Library · Komunitas · Mentor · Harga · Dashboard Siswa · Dashboard Orang Tua · FAQ · Masuk · Daftar.
   - Dashboard Siswa & Orang Tua jadi **demo preview publik** (lepas `RequireAuth` sementara, tambahkan banner "Mode Preview").

2. **Arsitektur data scalable** (`src/lib/curriculum-data.ts`, `src/lib/library-data.ts`, `src/lib/community-data.ts`, `src/lib/membership-data.ts`)
   - TypeScript types untuk: `Level`, `LearningPillar`, `Course`, `LibraryItem`, `MembershipPlan`, `CommunityPost`, `MentorProfile`.
   - Field bilingual (`title_id`/`title_en`, `description_id`/`description_en`), `access_type` (`included` | `premium_addon` | `free_preview`), `status`, `difficulty`, `duration`, `pillar`, `level`, `tags`.
   - Seed: 4 level × 15 course = 60 sample courses + 20 library items + 8 community posts + 3 membership plans + 4 mentor.
   - Pillars dibuat per level sesuai brief (Early Years pakai bahasa lembut, SMA pakai AI Mastery for Business dsb.).

3. **Update `src/lib/db-schema.ts`** sebagai kontrak Supabase masa depan (courses, lessons, learning_pillars, levels, digital_library_items, library_access_rules, membership_plans, community_posts, mentor_profiles). Belum migrate DB — kita tunggu Fase 4.

4. **Stub route bilingual** untuk halaman baru supaya navbar tidak 404:
   - `/kelas`, `/digital-library`, `/komunitas`, `/mentor` — placeholder ringan dengan hero + CTA, isi penuh di Fase 2–3.

**Output Fase 1:** navbar baru, arsitektur data lengkap, semua link hidup, dashboard demo accessible.

---

## Fase 2 — Student Dashboard + halaman Kelas (sesudah Fase 1 di-approve)

- Rewrite `src/routes/siswa.tsx` jadi portal lengkap: Welcome, Level Selector tabs (Early Years/SD/SMP/SMA), Course Library grid dengan filter & search, counter "250+ courses · 100+ projects · 100.000+ library", Adaptive Recommendations, Activity Tracking (weekly calendar/streak/badges), Portfolio preview.
- Komponen reusable: `<CourseCard>`, `<LevelTabs>`, `<PillarFilter>`, `<ProgressRing>`.
- Halaman `/kelas` marketplace: 2 tab (Kelas Anak / Kelas Orang Tua), filter level + pillar + access, search, badge Included/Premium.

---

## Fase 3 — Parent Dashboard + Digital Library + Komunitas + Mentor

- Rewrite `src/routes/orangtua.tsx`:
  - Banner "KITA Parent Circle" di paling atas (sebelum progress anak).
  - 3 kartu membership (Legacy Contributor Gratis, Business Parent AI Club Rp129k, Family Financial Builder Rp495k).
  - Child progress upgrade (strengths, learning gaps, reading minutes, financial literacy).
  - Parent Insights, Notifications, Community Preview, Parent Course Library Preview.
- `/digital-library`: filter Level/Language/Type/Access/Reading time/Format/Topic/Age/Difficulty, counter "100.000+ bacaan", 20 sample cards, CTA Baca / Buka Premium.
- `/komunitas`: feed + kategori + events + leaderboard + monthly challenge + mentor posts.
- `/mentor`: profil mentor + booking CTA placeholder.

---

## Fase 4 — Backend & CMS (opsional, setelah UI di-approve)

- Migrasi Supabase: tabel `courses`, `lessons`, `learning_pillars`, `levels`, `student_progress`, `digital_library_items`, `library_access_rules`, `membership_plans`, `community_posts`, `mentor_profiles` (sesuai schema di Fase 1) + RLS + GRANT.
- Seed lewat `supabase--insert`.
- Re-aktifkan `RequireAuth` di kedua dashboard + role-based access (parent vs student) via tabel `user_roles` yang sudah ada.
- Admin panel ringan di `/admin` untuk toggle access_type & status published/draft.

---

## Catatan teknis

- Konten brief sangat panjang → file route bisa membengkak. Saya akan **pecah jadi banyak komponen kecil** (`src/components/siswa/*`, `src/components/orangtua/*`, `src/components/library/*`) supaya maintainable.
- Bilingual: semua copy lewat `useLang()` + helper `t(id, en)` atau lookup `item.title_id` / `item.title_en`.
- Design tokens tetap pakai `src/styles.css` (warm premium). Tidak ada hex hardcoded.
- Mobile-first dengan grid responsive yang sudah ada.
- Tidak ada konten yang menjiplak Schoolio/Time4Learning/Skool dsb. — hanya pola UX.

---

## Pertanyaan kecil sebelum mulai Fase 1

1. **Setuju dengan pemecahan 4 fase?** Atau kamu mau saya kerjakan semua sekaligus (risiko: build lebih lama, lebih banyak bug, lebih sulit kamu review)?
2. **Mentor menu** — kamu mau halaman terpisah `/mentor` (booking + profil) atau cukup section di dalam Komunitas?
3. **Harga membership orang tua** di banner Parent Dashboard — apakah angka Rp129k & Rp495k itu sudah final, atau placeholder yang nanti diatur lewat Supabase `pricing_settings`?

Setelah kamu jawab/setujui, saya langsung eksekusi **Fase 1** dalam satu pass.
