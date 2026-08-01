import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site-layout";
import { accentLast } from "@/lib/accent-title";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Clock,
  HelpCircle,
  Trophy,
  Heart,
  CreditCard,
  Star,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { LEVEL_PLANS, LEVEL_DESCRIPTIONS, formatRupiah } from "@/lib/level-plans";
import api from "@/lib/api";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/harga")({
  head: () => ({
    meta: [
      { title: "Jalur Pembelajaran & Harga — KITA Future Homeschool" },
      {
        name: "description",
        content:
          "Pilih jalur pembelajaran anak dari Early Years hingga SMA. Mulai dari Rp149.000/bulan dengan sistem progression yang fleksibel.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { lang } = useLang();
  const en = lang === "en";

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/lms/subscription-plans")
      .then(res => {
        if (res.data && res.data.data) {
          setPlans(res.data.data);
        } else {
          setError("Data format invalid");
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch subscription plans:", err);
        setError(err.response?.data?.message || err.message || "Failed to load plans");
        setLoading(false);
      });
  }, []);

  const activePlans = plans.length > 0 ? plans
    .filter(p => p.pricing_category?.slug !== "guru-2-digit" && p.slug !== "guru-ai-income-system" && p.slug !== "guru-ai-1-miliar-challenge")
    .map(p => {
      const slug = p.slug;
      const localPlan = LEVEL_PLANS.find(lp => lp.id === slug) || LEVEL_PLANS[1];
      return {
        id: slug,
        name_id: p.name,
        name_en: p.name,
        price: p.amount,
        benefits_id: p.features && p.features.length > 0 ? p.features.map((f: any) => f.feature_key) : [],
        benefits_en: p.features && p.features.length > 0 ? p.features.map((f: any) => f.feature_key) : [],
        pricing_category: p.pricing_category
      };
    }) : LEVEL_PLANS;

  // Group plans by category
  const categoriesList = activePlans.reduce((acc: any[], p: any) => {
    const catSlug = p.pricing_category?.slug || "parent-system";
    const catName = p.pricing_category?.name || (catSlug === "parent-system" ? "Parent System" : "Lainnya");
    
    let category = acc.find(c => c.slug === catSlug);
    if (!category) {
      category = {
        slug: catSlug,
        name: catName,
        plans: []
      };
      acc.push(category);
    }
    
    category.plans.push(p);
    return acc;
  }, []);

  // Sort categories so they appear in order: parent-system, sd, smp, sma
  const catOrder = ["parent-system", "sd", "smp", "sma"];
  categoriesList.sort((a, b) => {
    const indexA = catOrder.indexOf(a.slug);
    const indexB = catOrder.indexOf(b.slug);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const faqs = en
    ? [
        {
          q: "Can I switch levels later?",
          a: "Yes. Your child can progress to the next level as soon as they complete the learning targets — no waiting for a new academic year.",
        },
        {
          q: "Is there a free trial?",
          a: "Every level comes with a 7-day free trial. No card required to start.",
        },
        {
          q: "How does billing work?",
          a: "Monthly subscription. Cancel anytime from your parent dashboard, no long contracts.",
        },
        {
          q: "What payment methods do you accept?",
          a: "QRIS, bank transfer, virtual account, e-wallet (OVO, DANA, GoPay, ShopeePay), and credit/debit card.",
        },
      ]
    : [
        {
          q: "Apakah bisa pindah level nanti?",
          a: "Bisa. Anak dapat naik level segera setelah menyelesaikan target pembelajaran — tanpa menunggu tahun ajaran baru.",
        },
        {
          q: "Apakah ada free trial?",
          a: "Setiap level tersedia free trial. Tanpa perlu kartu kredit untuk mulai.",
        },
        {
          q: "Bagaimana sistem pembayarannya?",
          a: "Berlangganan bulanan. Bisa berhenti kapan saja lewat dashboard orang tua, tanpa kontrak panjang.",
        },
        {
          q: "Metode pembayaran apa saja yang diterima?",
          a: "QRIS, transfer bank, virtual account, e-wallet (OVO, DANA, GoPay, ShopeePay), dan kartu kredit/debit.",
        },
      ];

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-16 h-80 w-80 rounded-full bg-accent/50 blur-3xl animate-float-slow" />
          <div className="absolute top-10 right-0 h-96 w-96 rounded-full bg-primary/25 blur-3xl animate-float" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[oklch(0.92_0.08_320)]/40 blur-3xl animate-float-delay" />
        </div>
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-14 text-center">
          <Badge
            variant="secondary"
            className="glass rounded-full px-5 py-2 text-base font-semibold shadow-soft"
          >
            <Sparkles className="mr-2 h-4 w-4 text-primary" />{" "}
            {en ? "Learning Paths" : "Jalur Belajar"}
          </Badge>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
            {en ? "Choose your child's " : "Pilih Jalur Pembelajaran "}
            <span className="text-accent-grad">{en ? "learning path" : "Anak"}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            {en
              ? "From age 3 through high school with a progression system that lets your child grow at their own pace."
              : "Mulai dari usia 3 tahun hingga SMA dengan sistem progression yang memungkinkan anak berkembang sesuai ritmenya sendiri."}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 text-xs">
            {[
              { icon: ShieldCheck, t: en ? "No annual contract" : "Tanpa kontrak tahunan" },
              { icon: Clock, t: en ? "Level up when ready" : "Naik level saat siap" },
              { icon: Check, t: en ? "Try free" : "Coba gratis" },
              {
                icon: CreditCard,
                t: en ? "QRIS · VA · E-wallet · Card" : "QRIS · VA · E-wallet · Kartu",
              },
            ].map((chip, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-3.5 py-1.5 font-medium text-foreground/80 shadow-soft backdrop-blur"
              >
                <chip.icon className="h-3.5 w-3.5 text-primary" />
                {chip.t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing grid */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        {error && (
          <div className="mx-auto max-w-3xl mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800 shadow-soft">
            {en
              ? "Offline fallback mode: failed to reach pricing server."
              : "Menggunakan data offline: gagal menghubungi server harga."}{" "}
            ({error})
          </div>
        )}
        {loading && plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Clock className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">
              {en
                ? "Fetching latest plans & pricing..."
                : "Mengambil data harga & paket terbaru..."}
            </p>
          </div>
        ) : (
          <div className="space-y-16 w-full flex flex-col items-center">
            {categoriesList.map((cat) => (
              <div key={cat.slug} className="w-full space-y-6">
                <div className="flex items-center gap-3 border-b border-border/60 pb-3 w-full">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    {cat.name}
                  </h2>
                  <Badge variant="secondary" className="rounded-full">
                    {cat.plans.length} {en ? "Plans" : "Paket"}
                  </Badge>
                </div>
                <div className="flex flex-wrap justify-center sm:justify-start gap-6">
                  {cat.plans.map((p, i) => {
                    const flagship = p.highlighted;
                    const tints = [
                      "from-rose-400 to-orange-400",
                      "from-sky-400 to-cyan-400",
                      "from-emerald-400 to-teal-500",
                      "from-violet-500 to-indigo-500",
                      "from-amber-400 to-pink-500",
                    ];
                    const tint = tints[i % tints.length];
                    return (
                      <Card
                        key={p.id}
                        className={[
                          "group relative flex flex-col overflow-hidden rounded-[1.75rem] border transition-all duration-300 hover-lift w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] min-w-[280px] max-w-[350px]",
                          flagship
                            ? "border-transparent bg-gradient-to-br from-primary via-primary to-[oklch(0.55_0.18_265)] text-primary-foreground shadow-elegant"
                            : "border-border/60 bg-card/90 backdrop-blur shadow-soft hover:shadow-elegant",
                        ].join(" ")}
                      >
                        {/* top accent bar */}
                        {!flagship && (
                          <div
                            className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tint} opacity-80`}
                          />
                        )}
                        {flagship && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full bg-amber-400 px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-950 shadow-elegant ring-2 ring-amber-300/60">
                            <Trophy className="mr-1 inline h-3 w-3 -mt-0.5" />{" "}
                            {en ? p.badge_en : p.badge_id}
                          </div>
                        )}

                        {/* soft floating glow */}
                        <div
                          className={[
                            "pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl transition-opacity duration-500",
                            flagship
                              ? "bg-white/20 opacity-100"
                              : "bg-primary/15 opacity-50 group-hover:opacity-100",
                          ].join(" ")}
                        />

                        <CardContent className="relative flex flex-1 flex-col p-7">
                          <div
                            className={[
                              "text-[11px] font-bold uppercase tracking-[0.16em]",
                              flagship ? "text-white/80" : "text-muted-foreground",
                            ].join(" ")}
                          >
                            {en ? p.age_en : p.age_id}
                          </div>
                          <h3
                            className={[
                              "mt-1.5 text-xl font-bold leading-tight",
                              flagship ? "text-white" : "",
                            ].join(" ")}
                          >
                            {en ? p.name_en : p.name_id}
                          </h3>

                          <div className="mt-4 flex items-baseline gap-1.5">
                            <span
                              className={[
                                "text-4xl font-extrabold tracking-tight",
                                flagship
                                  ? "text-white"
                                  : "bg-gradient-to-br from-primary to-[oklch(0.55_0.18_265)] bg-clip-text text-transparent",
                              ].join(" ")}
                            >
                              {formatRupiah(p.price)}
                            </span>
                            <span
                              className={[
                                "text-xs",
                                flagship ? "text-white/80" : "text-muted-foreground",
                              ].join(" ")}
                            >
                              {en ? "/month" : "/bulan"}
                            </span>
                          </div>
                          <div
                            className={["my-5 h-px", flagship ? "bg-white/20" : "bg-border/60"].join(" ")}
                          />

                          <ul className="flex-1 space-y-2.5">
                            {(en ? p.benefits_en : p.benefits_id).map((b: string) => (
                              <li
                                key={b}
                                className={[
                                  "flex items-start gap-2 text-sm",
                                  flagship ? "text-white/95" : "text-foreground/85",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full",
                                    flagship ? "bg-white/20 text-white" : "bg-primary/12 text-primary",
                                  ].join(" ")}
                                >
                                  <Check className="h-3 w-3" strokeWidth={3} />
                                </span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>

                          <Button
                            asChild
                            size="lg"
                            className={[
                              "mt-7 w-full rounded-full font-bold",
                              flagship
                                ? "bg-white text-primary shadow-elegant hover:bg-white/90"
                                : "bg-gradient-to-r from-primary to-[oklch(0.55_0.18_265)] text-primary-foreground shadow-soft hover:shadow-elegant",
                            ].join(" ")}
                          >
                            <Link to="/pembayaran" search={{ level: p.id }}>
                              Pilih Paket Ini <ArrowRight className="ml-1.5 h-4 w-4" />
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reassurance strip */}
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-3">
          {[
            {
              icon: Heart,
              title: en ? "Risk-free start" : "Mulai tanpa risiko",
              desc: en
                ? "7-day free trial, no card required."
                : "Coba 7 hari gratis tanpa kartu kredit.",
              tone: "from-rose-500/15 to-rose-500/5 text-rose-700 dark:text-rose-400",
            },
            {
              icon: ShieldCheck,
              title: en ? "Secure payment" : "Pembayaran aman",
              desc: en
                ? "All major Indonesian methods supported."
                : "Semua metode pembayaran utama Indonesia.",
              tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-400",
            },
            {
              icon: Clock,
              title: en ? "Cancel anytime" : "Berhenti kapan saja",
              desc: en
                ? "No long contracts. One click from dashboard."
                : "Tanpa kontrak panjang. Satu klik dari dashboard.",
              tone: "from-sky-500/15 to-sky-500/5 text-sky-700 dark:text-sky-400",
            },
          ].map((r) => (
            <Card
              key={r.title}
              className="hover-lift rounded-2xl border-border/60 bg-card/80 shadow-soft backdrop-blur"
            >
              <CardContent className="flex items-start gap-4 p-5">
                <div
                  className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${r.tone}`}
                >
                  <r.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">{r.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{r.desc}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Value note */}
        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center text-sm leading-relaxed text-foreground/85">
          <span className="font-bold text-primary">
            {en ? "What you're paying for: " : "Yang Anda bayar: "}
          </span>
          {en
            ? "access to a learning level matched to your child's stage. Access can be upgraded to the next level once learning targets are completed."
            : "akses ke level pembelajaran sesuai tahap perkembangan anak. Akses dapat ditingkatkan ke level berikutnya setelah target pembelajaran selesai."}
        </div>
      </section>

      {/* Level Descriptions — Six Pioneering Skills */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="text-center">
          <Badge variant="outline" className="glass rounded-full px-5 py-2 text-base font-semibold">
            <Star className="mr-2 h-4 w-4 text-primary" />
            {en ? "Six Pioneering Skills per Level" : "6 Skill Pionir per Level"}
          </Badge>
          <h2 className="mt-4 text-3xl font-bold md:text-4xl">
            {accentLast(
              en ? "Future-ready skills at every stage" : "Skill Masa Depan di Setiap Jenjang",
            )}
          </h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {LEVEL_DESCRIPTIONS.map((ld) => {
            const tintColors: Record<string, string> = {
              early: "from-rose-400 to-orange-400",
              elementary: "from-sky-400 to-cyan-400",
              middle: "from-emerald-400 to-teal-500",
              high: "from-violet-500 to-indigo-500",
            };
            const tint = tintColors[ld.id] ?? "from-primary to-primary";
            return (
              <Card
                key={ld.id}
                className="group hover-lift relative overflow-hidden rounded-[1.75rem] border-border/60 bg-card/90 backdrop-blur shadow-soft"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tint} opacity-80`}
                />
                <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl opacity-50 transition-opacity duration-500 group-hover:opacity-100" />
                <CardContent className="relative flex flex-col p-7">
                  <h3 className="text-lg font-bold leading-tight">
                    {en ? ld.name_en : ld.name_id}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/85">
                    {en ? ld.desc_en : ld.desc_id}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(en ? ld.skills_en : ld.skills_id).map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-semibold text-primary"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-20">
        <div className="text-center">
          <Badge variant="outline" className="glass rounded-full px-5 py-2 text-base font-semibold">
            <HelpCircle className="mr-2 h-4 w-4 text-primary" /> FAQ
          </Badge>
          <h2 className="mt-4 text-3xl font-bold md:text-4xl">
            {accentLast(en ? "Pricing questions, answered" : "Pertanyaan Seputar Harga")}
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {faqs.map((f, i) => (
            <Card
              key={i}
              className="rounded-2xl border-border/60 bg-card/80 shadow-soft backdrop-blur transition-all hover:border-primary/40 hover:shadow-card"
            >
              <CardContent className="p-6">
                <div className="text-base font-bold">{f.q}</div>
                <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <Card className="relative overflow-hidden rounded-[2rem] border-0 bg-gradient-primary text-primary-foreground shadow-elegant">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 -left-10 h-72 w-72 rounded-full bg-white/15 blur-3xl animate-float-slow" />
            <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-float" />
            <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
          </div>
          <CardContent className="relative grid items-center gap-8 p-10 md:grid-cols-[1fr_auto] md:p-14">
            <div>
              <Badge className="rounded-full border-0 bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {en ? "Start Today" : "Mulai Hari Ini"}
              </Badge>
              <h3 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">
                {en
                  ? "Not sure which level fits? Start with a free trial."
                  : "Belum yakin pilih level? Mulai dengan coba gratis."}
              </h3>
              <p className="mt-3 text-base opacity-90 md:text-lg">
                {en
                  ? "7 days to explore the full curriculum together with your child."
                  : "7 hari untuk eksplorasi seluruh kurikulum bersama anak."}
              </p>
            </div>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="rounded-full px-8 py-6 text-base font-bold shadow-elegant hover-lift"
            >
              <Link to="/coba-gratis">
                {en ? "Try Free for" : "Coba Gratis "} <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </SiteLayout>
  );
}
