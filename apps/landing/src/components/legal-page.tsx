import { Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site-layout";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ShieldCheck, Mail, CheckCircle2, Calendar } from "lucide-react";
import { accentLast } from "@/lib/accent-title";

export type LegalSection = {
  heading: string;
  body: string | string[];
};

export function LegalPage({
  eyebrow,
  title,
  intro,
  effectiveDate = "1 Juni 2026",
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  effectiveDate?: string;
  sections: LegalSection[];
}) {
  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl animate-float" />
        <div className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl animate-float" style={{ animationDelay: "1.2s" }} />

        <div className="relative mx-auto max-w-4xl px-4 py-20 md:py-24">
          <Link
            to="/legal"
            className="group mb-6 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-md transition-all hover:-translate-x-0.5 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Legal &amp; Trust Center
          </Link>

          <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/60 px-3.5 py-1.5 text-xs font-semibold text-primary backdrop-blur-md shadow-soft">
            <ShieldCheck className="h-3.5 w-3.5" />
            {eyebrow}
          </span>

          <h1 className="mt-5 text-3xl font-bold leading-[1.1] tracking-tight md:text-5xl">
            {accentLast(title)}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{intro}</p>
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border/50 backdrop-blur">
            <Calendar className="h-3 w-3" />
            Berlaku Efektif: {effectiveDate}
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          {/* Sticky TOC */}
          <aside className="hidden md:block">
            <div className="sticky top-24">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                On this page
              </p>
              <nav className="flex flex-col gap-1">
                {sections.map((s, i) => (
                  <a
                    key={i}
                    href={`#sec-${i}`}
                    className="group flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-primary/5 hover:text-primary"
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="truncate">{s.heading}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <div>
            <Card className="overflow-hidden rounded-3xl border-0 shadow-soft ring-1 ring-border/40">
              <div className="h-1 w-full bg-gradient-to-r from-primary via-indigo-500 to-fuchsia-500" />
              <CardContent className="space-y-10 p-6 md:p-10">
                {sections.map((s, i) => (
                  <section key={i} id={`sec-${i}`} className="scroll-mt-24">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-indigo-500 text-sm font-bold text-primary-foreground shadow-soft">
                        {i + 1}
                      </div>
                      <h2 className="text-xl font-bold tracking-tight md:text-2xl">{s.heading}</h2>
                    </div>
                    {Array.isArray(s.body) ? (
                      <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground md:text-base">
                        {s.body.map((b, j) => (
                          <li key={j} className="flex items-start gap-2.5">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm leading-relaxed text-muted-foreground md:text-base">{s.body}</p>
                    )}
                  </section>
                ))}

                <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-indigo-500/5 to-fuchsia-500/10 p-5">
                  <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
                  <div className="relative flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/90 text-primary shadow-soft ring-1 ring-white/60">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="text-sm">
                      <div className="font-semibold text-foreground">Punya pertanyaan?</div>
                      <p className="mt-1 text-muted-foreground">
                        Hubungi tim Trust &amp; Safety di{" "}
                        <a href="mailto:admin@kitafuture.com" className="font-semibold text-primary hover:underline">
                          admin@kitafuture.com
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
