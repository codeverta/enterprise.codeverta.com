import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import {
  Sparkles,
  Brain,
  Package,
  TrendingUp,
  Rocket,
  Check,
  ArrowRight,
  BookOpen,
  FileText,
  ClipboardList,
  Video,
  Users,
  Wrench,
  Briefcase,
  Lightbulb,
  Building2,
  Crown,
  Star,
  Target,
  GraduationCap,
  Trophy,
  Coins,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/site-layout";
import { useLang } from "@/lib/i18n";
import { motion, useScroll, useTransform } from "framer-motion";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Guru2Digit — Transformasi Guru di Era AI" },
      {
        name: "description",
        content:
          "Ekosistem pembelajaran untuk guru Indonesia: manfaatkan AI, bangun aset digital, ciptakan produk edukasi, dan buka peluang penghasilan baru.",
      },
      { property: "og:title", content: "Guru2Digit — Transformasi Guru di Era AI" },
      {
        property: "og:description",
        content:
          "Guru hebat tidak hanya mengajar. Guru juga bisa membangun aset digital, personal brand, dan bisnis edukasi berbasis AI.",
      },
    ],
  }),
  component: Guru2DigitPage,
});

type LangPair = { id: string; en: string };
const pick = (lang: "id" | "en", p: LangPair) => p[lang];


function Pathway({ lang, pathway, pick }: any) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.8", "end 0.2"], // mulai gambar garis saat top masuk 80% viewport, selesai saat bottom keluar 20%
  });

  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
          {lang === "id" ? "Success Pathway" : "Success Pathway"}
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {lang === "id" ? "Perjalanan Guru2Digit" : "The Guru2Digit Journey"}
        </h2>
      </div>

      <div ref={containerRef} className="relative mt-14">
        {/* Track garis utama (statis, redup) */}
        <div
          aria-hidden
          className="absolute left-1/2 top-0 hidden h-full w-0 -translate-x-1/2 border-l-2 border-dashed border-amber-400/15 md:block"
        />
        {/* Garis utama yang "tumbuh" mengikuti scroll */}
        <motion.div
          aria-hidden
          style={{ scaleY: lineScale, transformOrigin: "top" }}
          className="absolute left-1/2 top-0 hidden h-full w-0 -translate-x-1/2 border-l-2 border-dashed border-amber-400/60 md:block"
        />

        <div className="space-y-6">
          {pathway.map((s: any, i: number) => {
            const Icon = s.icon;
            const right = i % 2 === 1;
            return (
              <div key={s.label.en} className="relative">
                <div
                  className={`md:grid md:grid-cols-2 md:gap-8 ${right ? "md:[&>*:first-child]:order-2" : ""}`}
                >
                  <div
                    className={`flex ${right ? "md:justify-start md:pl-10" : "md:justify-end md:pr-10"}`}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 24, x: right ? -16 : 16 }}
                      whileInView={{ opacity: 1, y: 0, x: 0 }}
                      viewport={{ once: false, amount: 0.5 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="group flex w-full max-w-md items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-colors duration-500 hover:border-amber-400/40 hover:shadow-lg"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/20 to-primary/15 text-amber-600 ring-1 ring-amber-400/30">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {lang === "id" ? "Tahap" : "Stage"} {String(i + 1).padStart(2, "0")}
                        </div>
                        <div className="text-lg font-semibold text-foreground">
                          {pick(lang, s.label)}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                  <div className="hidden md:block" aria-hidden />
                </div>

                {/* Garis penghubung horizontal */}
                <motion.div
                  aria-hidden
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: false, amount: 0.5 }}
                  transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
                  style={{ transformOrigin: right ? "left" : "right" }}
                  className={`absolute top-1/2 hidden h-0 w-10 -translate-y-1/2 border-t-2 border-dashed border-amber-400/50 md:block ${
                    right ? "left-1/2" : "right-1/2"
                  }`}
                />

                {/* Dot */}
                <motion.div
                  aria-hidden
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: false, amount: 0.5 }}
                  transition={{ duration: 0.35, ease: "backOut" }}
                  className="absolute left-1/2 top-1/2 z-10 hidden h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-400 to-primary ring-4 ring-background md:block"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Guru2DigitPage() {
  const { lang } = useLang();
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await api.get("/lms/subscription-plans");
        const data = res.data?.data || res.data || [];
        setPlans(data);
      } catch (err) {
        console.error("Failed to fetch plans", err);
      }
    };
    fetchPlans();
  }, []);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const planMetadata: Record<string, {
    badge: LangPair;
    headline: LangPair;
    per: LangPair;
    target: LangPair[];
    elite: boolean;
    cta: LangPair;
  }> = {
    "guru-ai-income-system": {
      badge: { id: "MOST POPULAR", en: "MOST POPULAR" },
      headline: { id: "Mulai Bisnis Digital dengan Bantuan AI", en: "Start Your Digital Business with AI" },
      per: { id: "Sekali Bayar", en: "One-Time Payment" },
      target: [
        { id: "Guru Pemula", en: "Beginner Teachers" },
        { id: "Guru Gaptek", en: "Non-Tech Teachers" },
        { id: "Guru Honorer", en: "Contract Teachers" },
        { id: "Tutor", en: "Tutors" },
        { id: "Homeschool Educator", en: "Homeschool Educators" },
      ],
      elite: false,
      cta: { id: "Mulai Sekarang", en: "Start Now" },
    },
    "guru-ai-1-miliar-challenge": {
      badge: { id: "ELITE PROGRAM", en: "ELITE PROGRAM" },
      headline: { id: "Scale Up Menuju Bisnis Edukasi Bernilai Tinggi", en: "Scale Up Toward a High-Value Education Business" },
      per: { id: "Program", en: "Program" },
      target: [
        { id: "Guru Berpengalaman", en: "Experienced Teachers" },
        { id: "Trainer", en: "Trainers" },
        { id: "Coach", en: "Coaches" },
        { id: "Pemilik Lembaga Pendidikan", en: "Education Institution Owners" },
        { id: "Edupreneur", en: "Edupreneurs" },
      ],
      elite: true,
      cta: { id: "Gabung Challenge", en: "Join Challenge" },
    },
  };

  const guruPlans = plans.filter((p) => p.pricing_category?.slug === "guru-2-digit");

  const whyCards = [
    {
      icon: Brain,
      title: { id: "AI Is The New Literacy", en: "AI Is The New Literacy" },
      desc: {
        id: "Guru yang memahami AI memiliki peluang lebih besar untuk berkembang di masa depan.",
        en: "Teachers who understand AI have greater opportunities to grow in the future.",
      },
    },
    {
      icon: Package,
      title: { id: "Build Digital Assets", en: "Build Digital Assets" },
      desc: {
        id: "Ubah pengetahuan menjadi e-book, modul, worksheet, video course, dan membership.",
        en: "Turn your knowledge into e-books, modules, worksheets, video courses, and memberships.",
      },
    },
    {
      icon: TrendingUp,
      title: { id: "Increase Income", en: "Increase Income" },
      desc: {
        id: "Ciptakan sumber penghasilan tambahan berbasis keahlian yang dimiliki.",
        en: "Create additional income streams based on the expertise you already have.",
      },
    },
    {
      icon: Rocket,
      title: { id: "Future Ready Educator", en: "Future Ready Educator" },
      desc: {
        id: "Menjadi guru yang relevan di era teknologi dan ekonomi digital.",
        en: "Become a teacher who stays relevant in the era of technology and digital economy.",
      },
    },
  ];

  const pathway = [
    { icon: GraduationCap, label: { id: "Guru Tradisional", en: "Traditional Teacher" } },
    { icon: Brain, label: { id: "AI Literacy", en: "AI Literacy" } },
    { icon: Package, label: { id: "Digital Product Creation", en: "Digital Product Creation" } },
    { icon: Star, label: { id: "Personal Branding", en: "Personal Branding" } },
    { icon: Coins, label: { id: "Recurring Income", en: "Recurring Income" } },
    { icon: Building2, label: { id: "Education Business", en: "Education Business" } },
    { icon: Network, label: { id: "Digital Asset Ecosystem", en: "Digital Asset Ecosystem" } },
    { icon: Trophy, label: { id: "Financial Freedom", en: "Financial Freedom" } },
  ];

  const products = [
    { icon: BookOpen, label: { id: "E-book", en: "E-books" } },
    { icon: FileText, label: { id: "Modul Digital", en: "Digital Modules" } },
    { icon: ClipboardList, label: { id: "Worksheet", en: "Worksheets" } },
    { icon: Video, label: { id: "Video Course", en: "Video Courses" } },
    { icon: Users, label: { id: "Komunitas Membership", en: "Membership Communities" } },
    { icon: Lightbulb, label: { id: "Sumber Belajar", en: "Learning Resources" } },
    { icon: Wrench, label: { id: "Tools AI", en: "AI Tools" } },
    { icon: Briefcase, label: { id: "Konsultasi Guru", en: "Teacher Consulting" } },
    { icon: Building2, label: { id: "Bisnis Edukasi", en: "Educational Businesses" } },
  ];

  const communityFeatures = [
    { id: "Networking", en: "Networking" },
    { id: "Collaboration", en: "Collaboration" },
    { id: "Accountability", en: "Accountability" },
    { id: "Sharing Sessions", en: "Sharing Sessions" },
    { id: "Business Discussions", en: "Business Discussions" },
  ];

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[oklch(0.16_0.04_265)] via-[oklch(0.13_0.05_270)] to-[oklch(0.10_0.04_260)] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
              backgroundSize: "28px 28px",
            }}
          />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-24 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Guru2Digit
            </div>
            <h1 className="bg-gradient-to-br from-white via-amber-100 to-amber-300 bg-clip-text text-4xl font-bold leading-tight tracking-tight text-transparent md:text-6xl">
              {lang === "id" ? (
                <>
                  Guru Hebat Tidak Hanya Mengajar.
                  <br />
                  Guru Juga Bisa Membangun Aset Digital.
                </>
              ) : (
                <>
                  Great Teachers Don't Just Teach.
                  <br />
                  They Build Digital Assets.
                </>
              )}
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg font-medium text-white/80 md:text-xl">
              {lang === "id"
                ? "Pelajari cara memanfaatkan AI untuk menciptakan produk digital, membangun personal brand, dan membuka peluang penghasilan baru tanpa harus menjadi reseller, affiliate, atau influencer."
                : "Learn how to leverage AI to create digital products, build a personal brand, and unlock new income opportunities — without becoming a reseller, affiliate, or influencer."}
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/60">
              {lang === "id"
                ? "Guru2Digit adalah ekosistem pembelajaran yang membantu guru Indonesia berkembang di era AI melalui keterampilan digital, entrepreneurship, dan penciptaan aset intelektual."
                : "Guru2Digit is a learning ecosystem helping Indonesian teachers grow in the AI era through digital skills, entrepreneurship, and intellectual asset creation."}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-7 font-bold text-[oklch(0.16_0.04_265)] shadow-[0_10px_40px_-10px_oklch(0.75_0.15_75/0.6)] hover:-translate-y-0.5 hover:shadow-[0_15px_50px_-10px_oklch(0.75_0.15_75/0.8)]"
              >
                <a href="#programs">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {lang === "id" ? "Mulai dari Rp99.000" : "Start from Rp99,000"}
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/25 bg-white/5 px-7 font-semibold text-white backdrop-blur hover:bg-white/15 hover:text-white"
              >
                <a href="#programs">
                  {lang === "id" ? "Lihat Program" : "See Programs"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
            {lang === "id" ? "Mengapa Guru2Digit" : "Why Guru2Digit"}
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {lang === "id" ? "Mengapa Guru Perlu Belajar AI?" : "Why Teachers Need to Learn AI"}
          </h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whyCards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title.en}
                className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-[0_20px_50px_-20px_oklch(0.75_0.15_75/0.3)]"
              >
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-amber-400/0 to-primary/0 opacity-0 transition-opacity duration-500 group-hover:from-amber-400/5 group-hover:to-primary/5 group-hover:opacity-100" />
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-primary/15 text-amber-600 ring-1 ring-amber-400/30">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{pick(lang, c.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pick(lang, c.desc)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Programs */}
      <section id="programs" className="bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
              {lang === "id" ? "Program" : "Programs"}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {lang === "id" ? "Pilih Jalur Pertumbuhan Anda" : "Choose Your Growth Path"}
            </h2>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {guruPlans.map((p) => {
              const meta = planMetadata[p.slug] || {
                badge: { id: "PROGRAM", en: "PROGRAM" },
                headline: { id: "", en: "" },
                per: { id: "Sekali Bayar", en: "One-Time Payment" },
                target: [],
                elite: false,
                cta: { id: "Mulai Sekarang", en: "Start Now" },
              };
              const elite = meta.elite;
              const benefits = p.features || [];
              const price = formatRupiah(p.amount);

              return (
                <div
                  key={p.id}
                  className={`relative overflow-hidden rounded-3xl border p-8 transition-all duration-500 hover:-translate-y-1 ${
                    elite
                      ? "border-amber-400/40 bg-gradient-to-br from-[oklch(0.18_0.04_265)] via-[oklch(0.15_0.05_270)] to-[oklch(0.12_0.04_260)] text-white shadow-[0_30px_70px_-30px_oklch(0.16_0.04_265/0.6)]"
                      : "border-border/60 bg-card shadow-[0_20px_50px_-25px_oklch(0.62_0.12_240/0.3)]"
                  }`}
                >
                  {elite && (
                    <div aria-hidden className="pointer-events-none absolute inset-0">
                      <div className="absolute -top-20 right-0 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
                    </div>
                  )}
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          elite
                            ? "bg-gradient-to-r from-amber-400 to-amber-500 text-[oklch(0.16_0.04_265)]"
                            : "bg-primary/10 text-primary ring-1 ring-primary/20"
                        }`}
                      >
                        {elite ? <Crown className="h-3 w-3" /> : <Star className="h-3 w-3" />}
                        {pick(lang, meta.badge)}
                      </div>
                    </div>

                    <h3
                      className={`mt-5 text-2xl font-bold tracking-tight ${elite ? "text-white" : "text-foreground"}`}
                    >
                      {p.name}
                    </h3>
                    <p
                      className={`mt-2 text-sm font-medium ${elite ? "text-amber-200" : "text-primary"}`}
                    >
                      {pick(lang, meta.headline)}
                    </p>

                    <div className="mt-6 flex items-baseline gap-2">
                      <span
                        className={`text-4xl font-bold ${elite ? "text-white" : "text-foreground"}`}
                      >
                        {price}
                      </span>
                      <span
                        className={`text-sm ${elite ? "text-white/60" : "text-muted-foreground"}`}
                      >
                        / {pick(lang, meta.per)}
                      </span>
                    </div>

                    <p
                      className={`mt-5 text-sm leading-relaxed ${elite ? "text-white/75" : "text-muted-foreground"}`}
                    >
                      {p.description}
                    </p>

                    <ul className="mt-6 space-y-2.5">
                      {benefits.map((b: any) => (
                        <li key={b.id} className="flex items-start gap-2.5 text-sm">
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                              elite
                                ? "bg-amber-400/20 text-amber-300"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                          <span className={elite ? "text-white/85" : "text-foreground/85"}>
                            {b.feature_key}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div
                      className={`mt-6 border-t pt-5 ${elite ? "border-white/10" : "border-border/60"}`}
                    >
                      <div
                        className={`text-[10px] font-bold uppercase tracking-wider ${elite ? "text-white/50" : "text-muted-foreground"}`}
                      >
                        {lang === "id" ? "Untuk" : "For"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {meta.target.map((t) => (
                          <span
                            key={t.en}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              elite
                                ? "bg-white/10 text-white/80 ring-1 ring-white/15"
                                : "bg-muted text-foreground/70"
                            }`}
                          >
                            {pick(lang, t)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <Button
                      asChild
                      size="lg"
                      className={`mt-7 w-full rounded-full font-bold ${
                        elite
                          ? "bg-gradient-to-r from-amber-400 to-amber-500 text-[oklch(0.16_0.04_265)] hover:shadow-[0_15px_40px_-10px_oklch(0.75_0.15_75/0.7)]"
                          : "bg-gradient-to-r from-primary to-indigo-500 text-primary-foreground"
                      }`}
                    >
                      <Link to="/pembayaran" search={{ level: p.slug as any }}>
                        {pick(lang, meta.cta)}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pathway */}
      <Pathway lang={lang} pathway={pathway} pick={pick} />
      {/* Products */}
      <section className="bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
              {lang === "id" ? "What Can Teachers Build" : "What Can Teachers Build"}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {lang === "id"
                ? "Produk yang Bisa Dibangun dengan AI"
                : "Products You Can Build with AI"}
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.label.en}
                  className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-all duration-500 hover:-translate-y-0.5 hover:border-amber-400/40 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/15 to-primary/10 text-amber-600 ring-1 ring-amber-400/25 transition-transform duration-500 group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {pick(lang, p.label)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-amber-50/40 p-8 md:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-amber-300/20 blur-3xl"
          />
          <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
                {lang === "id" ? "Komunitas" : "Community"}
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {lang === "id"
                  ? "Bertumbuh Bersama Ribuan Guru Indonesia"
                  : "Grow Together with Thousands of Indonesian Teachers"}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {lang === "id"
                  ? "Belajar bersama komunitas guru yang ingin berkembang, berbagi ide, membangun karya, dan memanfaatkan AI secara produktif."
                  : "Learn alongside a community of teachers who want to grow, share ideas, build their work, and harness AI productively."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {communityFeatures.map((f) => (
                <div
                  key={f.en}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 backdrop-blur"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/15 text-amber-600 ring-1 ring-amber-400/30">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{pick(lang, f)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
          <Target className="h-3 w-3" /> {lang === "id" ? "Visi" : "Vision"}
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
          {lang === "id"
            ? "Menciptakan Generasi Guru Dua Digit"
            : "Creating a Generation of Two-Digit Teachers"}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {lang === "id"
            ? "Kami percaya guru tidak hanya berhak menjadi pendidik yang hebat."
            : "We believe teachers don't just deserve to be great educators."}
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {lang === "id"
            ? "Guru juga berhak menjadi inovator, pencipta karya, dan pemilik aset intelektual yang memberikan dampak serta nilai ekonomi jangka panjang."
            : "Teachers also deserve to be innovators, creators, and owners of intellectual assets that generate lasting impact and economic value."}
        </p>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[oklch(0.16_0.04_265)] via-[oklch(0.13_0.05_270)] to-[oklch(0.10_0.04_260)] py-24 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute -bottom-40 right-1/3 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <h2 className="bg-gradient-to-br from-white to-amber-200 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
            {lang === "id" ? "Mulai Perjalanan Anda Hari Ini" : "Start Your Journey Today"}
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            {lang === "id" ? (
              <>
                Tidak perlu menjadi ahli teknologi.
                <br />
                Tidak perlu menjadi influencer.
              </>
            ) : (
              <>
                You don't need to be a tech expert.
                <br />
                You don't need to be an influencer.
              </>
            )}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/60 md:text-base">
            {lang === "id"
              ? "Mulailah dengan pengetahuan yang Anda miliki dan manfaatkan AI untuk memperluas dampak serta peluang Anda."
              : "Start with the knowledge you already have, and use AI to expand your impact and opportunities."}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-7 font-bold text-[oklch(0.16_0.04_265)] shadow-[0_10px_40px_-10px_oklch(0.75_0.15_75/0.6)] hover:-translate-y-0.5"
            >
              <Link to="/coba-gratis">
                <Sparkles className="mr-2 h-4 w-4" />
                {lang === "id" ? "Mulai Guru AI Income System" : "Start Guru AI Income System"}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-white/25 bg-white/5 px-7 font-semibold text-white backdrop-blur hover:bg-white/15 hover:text-white"
            >
              <Link to="/coba-gratis">
                <Crown className="mr-2 h-4 w-4" />
                {lang === "id"
                  ? "Gabung Guru AI 1 Miliar Challenge"
                  : "Join Guru AI 1 Billion Challenge"}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
