import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Users, Lock, BrainCircuit, Rocket, ArrowRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { accentLast, accentFrom } from "@/lib/accent-title";


const BADGES = [
  {
    icon: ShieldCheck,
    title: "Child Safety First",
    desc: "Kami menerapkan Child Protection Policy untuk menciptakan lingkungan belajar yang aman, positif, dan ramah anak.",
    linkText: "Pelajari Kebijakan Perlindungan Anak",
    href: "/child-protection-policy",
  },
  {
    icon: Users,
    title: "Parent Partnership",
    desc: "Kami percaya pendidikan terbaik terjadi ketika keluarga dan sistem pembelajaran berjalan bersama.",
    linkText: "Lihat Parent Partnership Agreement",
    href: "/parent-partnership-agreement",
  },
  {
    icon: Lock,
    title: "Data Protection",
    desc: "Data siswa dan keluarga dikelola dengan prinsip privasi, keamanan, dan transparansi.",
    linkText: "Lihat Privacy Policy",
    href: "/privacy-policy",
  },
  {
    icon: BrainCircuit,
    title: "Responsible AI",
    desc: "Anak belajar menggunakan AI secara etis, bertanggung jawab, dan aman untuk masa depan.",
    linkText: "Lihat AI Ethics Policy",
    href: "/ai-ethics-safety-policy",
  },
  {
    icon: Rocket,
    title: "Future Readiness",
    desc: "Kurikulum dirancang untuk membangun karakter, finansial, komunikasi, AI, dan portfolio dunia nyata.",
    linkText: "Lihat Kurikulum",
    href: "/kurikulum",
  },
] as const;

const TRUST_PILLS = [
  "Child Safety",
  "Parent Partnership",
  "Responsible AI",
  "Data Protection",
  "Future Readiness",
];

type Counter = {
  value: string;
  label: string;
  desc: string;
  numeric?: { end: number; suffix?: string };
};

const COUNTERS: Counter[] = [
  {
    value: "100,000+",
    label: "Digital Library Resources",
    desc: "Buku digital, bacaan, referensi, dan sumber belajar lintas level.",
    numeric: { end: 100000, suffix: "+" },
  },
  {
    value: "3,000+",
    label: "Courses & Lessons",
    desc: "Materi pembelajaran yang terus berkembang dari Early Years hingga SMA.",
    numeric: { end: 3000, suffix: "+" },
  },
  {
    value: "6 Skill Pionir",
    label: "6 Skill Pionir",
    desc: "Social Emotional Smart, Reading & Communication, Financial Literacy, Digital Literacy, High Value Network.",
  },
  {
    value: "Early Years – SMA",
    label: "Learning Pathway",
    desc: "Jalur pembelajaran berkelanjutan dari usia 3 tahun hingga SMA.",
  },
  {
    value: "Parent Ecosystem",
    label: "Family Transformation",
    desc: "Komunitas orang tua, mentoring, AI, bisnis, dan pengembangan keluarga.",
  },
  {
    value: "AI Era Ready",
    label: "Future Readiness System",
    desc: "Persiapan menghadapi dunia kerja, bisnis, dan teknologi masa depan.",
  },
];

function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

function AnimatedCounter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true;
            const duration = 1800;
            const start = performance.now();
            const tick = (now: number) => {
              const p = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - p, 3);
              setValue(Math.round(end * eased));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [end]);

  return (
    <span ref={ref}>
      {formatNumber(value)}
      {suffix}
    </span>
  );
}

export function TrustEcosystemSection() {
  return (
    <>
      {/* SECTION 1 — Trust Badges */}
      <section className="bg-background py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              {accentFrom("Mengapa Memilih KITA Future Homeschool?", 2)}
            </h2>
            <p className="mt-4 text-muted-foreground md:text-lg">
              Lebih dari sekadar homeschooling. Kami membangun lingkungan belajar yang aman,
              relevan, dan siap menghadapi masa depan untuk anak dan keluarga.
            </p>
          </div>

          {/* Mobile: horizontal swipe */}
          <div className="mt-12 -mx-4 px-4 md:hidden">
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {BADGES.map((b) => (
                <BadgeCard key={b.title} badge={b} className="min-w-[78%] snap-start" />
              ))}
            </div>
          </div>

          {/* Tablet (2 cols) + Desktop (5 cols) */}
          <div className="mt-12 hidden gap-5 md:grid md:grid-cols-2 lg:grid-cols-5">
            {BADGES.map((b) => (
              <BadgeCard key={b.title} badge={b} />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2 — Ecosystem Overview */}
      <section className="bg-secondary/40 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              KITA Future Homeschool
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              {accentLast("Ekosistem Pembelajaran Masa Depan untuk Anak dan Keluarga", 3)}
            </h2>
            <p className="mt-4 text-muted-foreground md:text-lg">
              Ribuan Sumber Belajar, Kurikulum Terkurasi, dan Pembelajaran Adaptif — Semua Dalam Satu Platform.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3">
            {COUNTERS.map((c) => (
              <Card
                key={c.label}
                className="group hover-lift rounded-3xl border-border/60 bg-background shadow-soft"
              >
                <CardContent className="flex h-full flex-col p-5">
                  <div className="bg-gradient-to-r from-primary via-[oklch(0.55_0.18_265)] to-[oklch(0.6_0.14_200)] bg-clip-text text-2xl font-bold leading-tight text-transparent md:text-[1.6rem]">
                    {c.numeric ? (
                      <AnimatedCounter end={c.numeric.end} suffix={c.numeric.suffix} />
                    ) : (
                      c.value
                    )}
                  </div>
                  <div className="mt-2 text-sm font-semibold">{c.label}</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-8 text-center text-xs italic text-muted-foreground">
            Jumlah resource, mentor, program, dan komunitas akan terus berkembang seiring
            pertumbuhan ekosistem KITA Future Homeschool.
          </p>

        </div>
      </section>
    </>
  );
}

function BadgeCard({
  badge,
  className = "",
}: {
  badge: (typeof BADGES)[number];
  className?: string;
}) {
  const Icon = badge.icon;
  return (
    <Card
      className={`group hover-lift relative flex flex-col overflow-hidden rounded-3xl border-border/60 bg-background shadow-soft ${className}`}
    >
      <div className="pointer-events-none absolute -top-12 -right-12 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-40" />
      <CardContent className="relative flex h-full flex-col p-6">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary transition-all duration-500 group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-[oklch(0.55_0.18_265)] group-hover:text-primary-foreground group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-glow">
          <Icon className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-base font-bold">{badge.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{badge.desc}</p>
        <Link
          to={badge.href}
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {badge.linkText}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      </CardContent>
    </Card>
  );
}
