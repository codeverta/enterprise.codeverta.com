import { Link } from "@tanstack/react-router";
import {
  Menu,
  X,
  Languages,
  ShieldCheck,
  Sparkles,
  Heart,
  Mail,
  ChevronDown,
  Globe2,
  GraduationCap,
  LayoutDashboard,
  Users,
} from "lucide-react";
import logoKita from "@/assets/logo-kita.png";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import FloatingContact from "./FloatingContact";

function LangToggle({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const { lang, setLang } = useLang();
  const isDark = tone === "dark";
  return (
    <div
      className={`inline-flex items-center rounded-full p-0.5 text-xs font-medium backdrop-blur ${
        isDark
          ? "border border-white/15 bg-white/10"
          : "border border-border/60 bg-card/70"
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => setLang("id")}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-all duration-300 ${
          lang === "id"
            ? "bg-gradient-to-r from-primary to-indigo-500 text-primary-foreground shadow-sm"
            : isDark
            ? "text-white/60 hover:text-white"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Bahasa Indonesia"
      >
        <Languages className="h-3 w-3" /> ID
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`rounded-full px-2.5 py-1 transition-all duration-300 ${
          lang === "en"
            ? "bg-gradient-to-r from-primary to-indigo-500 text-primary-foreground shadow-sm"
            : isDark
            ? "text-white/60 hover:text-white"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [mobileProgramOpen, setMobileProgramOpen] = useState(false);
  const { tr } = useLang();
  const { isAdmin } = useAuth();
  const adminUrl = import.meta.env.VITE_ADMIN_URL || "http://localhost:5174";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const programItems = [
    {
      to: "/international" as const,
      label: tr("nav_international"),
      desc: "Kurikulum berstandar internasional untuk anak Anda",
      icon: Globe2,
    },
    {
      to: "/guru2digit" as const,
      label: tr("nav_guru2digit"),
      desc: "Kelas bersama mentor digital profesional",
      icon: GraduationCap,
    },
    {
      to: "/siswa" as const,
      label: tr("nav_dashboard_student"),
      desc: "Pantau progres belajar siswa secara real-time",
      icon: LayoutDashboard,
    },
    {
      to: "/orangtua" as const,
      label: tr("nav_dashboard_parent"),
      desc: "Ruang khusus orang tua memantau perkembangan anak",
      icon: Users,
    },
  ] as const;

  const navLinks = [
    { to: "/", label: tr("nav_home"), exact: true },
    { to: "/kurikulum", label: tr("nav_curriculum"), exact: false },
    { to: "/harga", label: "Harga", exact: false },
  ] as const;


  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-500 ${
        scrolled
          ? "border-b border-border/40 bg-background shadow-[0_4px_30px_-15px_oklch(0.4_0.08_240/0.25)]"
          : "border-b border-transparent bg-background"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:h-[4.5rem]">
        {/* Brand */}
        <Link
          to="/"
          className="group flex shrink-0 items-center gap-2.5 font-semibold"
          onClick={() => setOpen(false)}
        >
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-primary/30 to-fuchsia-500/20 opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-100"
            />
            <img
              src={logoKita}
              alt="KITA Future Homeschool"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 object-contain transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3"
            />
          </div>
          <span className="text-[15px] tracking-tight">
            KITA{" "}
            <span className="bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
              Future
            </span>{" "}
            Homeschool
          </span>
        </Link>

        {/* Desktop Nav — floating pill */}
        <nav className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-1.5 py-1 backdrop-blur">
            {/* Home */}
            <Link
              to={navLinks[0].to}
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-300 hover:bg-muted/70 hover:text-foreground"
              activeProps={{
                className:
                  "bg-gradient-to-r from-primary/15 to-indigo-500/10 text-foreground shadow-sm ring-1 ring-primary/20",
              }}
              activeOptions={{ exact: navLinks[0].exact }}
            >
              {navLinks[0].label}
            </Link>

            {/* Program mega menu */}
            <div
              className="relative"
              onMouseEnter={() => setProgramOpen(true)}
              onMouseLeave={() => setProgramOpen(false)}
            >
              <button
                type="button"
                className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-300 ${
                  programOpen
                    ? "bg-gradient-to-r from-primary/15 to-indigo-500/10 text-foreground shadow-sm ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
                aria-haspopup="true"
                aria-expanded={programOpen}
              >
                {tr("nav_program") ?? "Program"}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-300 ${
                    programOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Invisible bridge so hover doesn't drop when moving from button to panel */}
              <div
                className={`absolute left-1/2 top-full h-3 w-full -translate-x-1/2 ${
                  programOpen ? "block" : "hidden"
                }`}
              />

              <div
                className={`absolute left-1/2 top-full z-50 mt-3 w-[36rem] -translate-x-1/2 transition-all duration-300 ${
                  programOpen
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none -translate-y-2 opacity-0"
                }`}
              >
                <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/95 p-2 shadow-[0_20px_60px_-15px_oklch(0.2_0.05_265/0.35)] backdrop-blur-xl">
                  <div className="grid grid-cols-2 gap-1.5 p-2">
                    {programItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="group flex items-start gap-3 rounded-2xl p-3 transition-all duration-300 hover:bg-muted/70"
                          onClick={() => setProgramOpen(false)}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-indigo-500/10 text-primary transition-transform duration-300 group-hover:scale-105">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground">
                              {item.label}
                            </div>
                            <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
                              {item.desc}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Remaining links (Kurikulum, Harga, ...) */}
            {navLinks.slice(1).map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-300 hover:bg-muted/70 hover:text-foreground"
                activeProps={{
                  className:
                    "bg-gradient-to-r from-primary/15 to-indigo-500/10 text-foreground shadow-sm ring-1 ring-primary/20",
                }}
                activeOptions={{ exact: l.exact }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Right actions */}
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <LangToggle />
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <a href={adminUrl}>
                <ShieldCheck className="mr-1 h-4 w-4" /> Login sebagai Seller
              </a>
            </Button>
          {/* <Button
            asChild
            size="sm"
            className="rounded-full bg-gradient-to-r from-primary to-indigo-500 px-4 font-semibold text-primary-foreground shadow-soft transition-all duration-300 hover:shadow-[0_10px_30px_-10px_oklch(0.62_0.12_240/0.6)] hover:-translate-y-0.5"
          >
            <Link to="/coba-gratis">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              {tr("nav_try_free")}

            </Link>
          </Button> */}
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-2 md:hidden">
          <LangToggle />
          <button
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/70 backdrop-blur transition-all duration-300 hover:bg-muted active:scale-95"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
          >
            <span className="sr-only">Toggle menu</span>
            <Menu
              className={`absolute h-5 w-5 transition-all duration-300 ${
                open ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
            <X
              className={`absolute h-5 w-5 transition-all duration-300 ${
                open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu — slide down panel */}
      <div
        className={`overflow-hidden border-b border-border/40 bg-background/95 backdrop-blur-xl transition-all duration-500 md:hidden ${
          open ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
          {/* Home */}
          <Link
            to={navLinks[0].to}
            className="flex items-center justify-between rounded-2xl border border-transparent px-4 py-3 text-base font-medium transition-all duration-300 hover:border-border/60 hover:bg-card hover:shadow-sm"
            activeProps={{
              className:
                "border-primary/20 bg-gradient-to-r from-primary/10 to-indigo-500/5 text-foreground",
            }}
            activeOptions={{ exact: navLinks[0].exact }}
            onClick={() => setOpen(false)}
          >
            <span>{navLinks[0].label}</span>
            <span className="text-xs text-muted-foreground">→</span>
          </Link>

          {/* Program collapsible */}
          <div className="rounded-2xl border border-transparent">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-base font-medium transition-all duration-300 hover:border-border/60 hover:bg-card hover:shadow-sm"
              onClick={() => setMobileProgramOpen((v) => !v)}
              aria-expanded={mobileProgramOpen}
            >
              <span>{tr("nav_program") ?? "Program"}</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
                  mobileProgramOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                mobileProgramOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="flex flex-col gap-1 py-1 pl-4">
                {programItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-300 hover:bg-card hover:text-foreground"
                      onClick={() => {
                        setOpen(false);
                        setMobileProgramOpen(false);
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Remaining links */}
          {navLinks.slice(1).map((l, i) => (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center justify-between rounded-2xl border border-transparent px-4 py-3 text-base font-medium transition-all duration-300 hover:border-border/60 hover:bg-card hover:shadow-sm"
              activeProps={{
                className:
                  "border-primary/20 bg-gradient-to-r from-primary/10 to-indigo-500/5 text-foreground",
              }}
              activeOptions={{ exact: l.exact }}
              onClick={() => setOpen(false)}
              style={{
                animation: open ? `fade-in 0.4s ease-out ${i * 60}ms backwards` : undefined,
              }}
            >
              <span>{l.label}</span>
              <span className="text-xs text-muted-foreground">→</span>
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-medium text-muted-foreground hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              <ShieldCheck className="h-4 w-4" /> Admin
            </Link>
          )}
          <a
            href={adminUrl}
            className="flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-medium text-muted-foreground hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <ShieldCheck className="h-4 w-4" /> Login sebagai Seller
          </a>
          <div className="mt-3 border-t border-border/40 pt-3">
            <Button
              asChild
              size="lg"
              className="w-full rounded-full bg-gradient-to-r from-primary to-indigo-500 font-semibold text-primary-foreground shadow-soft"
            >
              <Link to="/coba-gratis" onClick={() => setOpen(false)}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                {tr("nav_try_free")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { tr } = useLang();
  const legalLinks = [
    { to: "/privacy-policy" as const, label: "Privacy Policy" },
    { to: "/terms-of-service" as const, label: "Terms of Service" },
    { to: "/child-protection-policy" as const, label: "Child Protection" },
    { to: "/parent-consent-policy" as const, label: "Parent Consent" },
    { to: "/data-retention-policy" as const, label: "Data Retention" },
    { to: "/incident-response-procedure" as const, label: "Incident Response" },
    { to: "/ai-ethics-safety-policy" as const, label: "AI Ethics & Safety" },
    { to: "/parent-partnership-agreement" as const, label: "Parent Partnership" },
  ];

  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-[oklch(0.18_0.04_265)] via-[oklch(0.15_0.05_270)] to-[oklch(0.12_0.04_260)] text-white">
      {/* Ambient aurora */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-16">
        {/* Brand statement strip */}
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-5">
            <Link to="/" className="group inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3">
                <img
                  src={logoKita}
                  alt="KITA Future Homeschool"
                  width={32}
                  height={32}
                  loading="lazy"
                  className="h-8 w-8 object-contain"
                />
              </div>
              <span className="text-lg font-semibold tracking-tight">
                KITA{" "}
                <span className="bg-gradient-to-r from-primary-foreground via-white to-indigo-200 bg-clip-text text-transparent">
                  Future
                </span>{" "}
                Homeschool
              </span>
            </Link>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
              {tr("footer_desc")}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
              <Heart className="h-3.5 w-3.5 text-rose-300" />
              <span className="italic">{tr("tagline")}</span>
            </div>
          </div>

          {/* Platform */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
              {tr("footer_platform")}
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              {[
                { to: "/" as const, label: tr("nav_home") },
                { to: "/kurikulum" as const, label: tr("nav_curriculum") },
                { to: "/harga" as const, label: "Harga" },
                { to: "/siswa" as const, label: tr("nav_dashboard_student") },
                { to: "/orangtua" as const, label: tr("nav_dashboard_parent") },
              ].map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="group inline-flex items-center gap-1 transition-colors hover:text-white"
                  >
                    <span className="border-b border-transparent transition-colors group-hover:border-white/40">
                      {l.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal & Trust */}
          <div className="md:col-span-4">
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/50">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              <Link to="/legal" className="transition-colors hover:text-white">
                Legal & Trust Center
              </Link>
            </h4>
            <ul className="mt-4 grid gap-2.5 text-sm text-white/75 sm:grid-cols-2">
              {legalLinks.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="group inline-flex items-center gap-1.5 transition-colors hover:text-white"
                  >
                    <span className="h-1 w-1 rounded-full bg-white/30 transition-colors group-hover:bg-emerald-300" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-14 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur md:grid-cols-3 md:p-6">
          {[
            {
              icon: ShieldCheck,
              label: "Child Safe by Design",
              sub: "Privacy-first, mentor-approved content",
              tone: "text-emerald-300",
            },
            {
              icon: Sparkles,
              label: "AI Ethics Certified",
              sub: "Transparent AI, human-supervised",
              tone: "text-indigo-300",
            },
            {
              icon: Heart,
              label: "Made with Care",
              sub: "Crafted in Indonesia for Indonesian families",
              tone: "text-rose-300",
            },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.label} className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 ${t.tone}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{t.label}</div>
                  <div className="text-xs text-white/60">{t.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-white/55 md:flex-row">
          <div>
            © {new Date().getFullYear()} KITA Future Homeschool · Made with{" "}
            <Heart className="inline h-3 w-3 fill-rose-300 text-rose-300" /> in Indonesia
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/40">
              Custom Learning System by{" "}
              <a
                href="https://kitafuture.com"
                target="_blank"
                rel="noopener"
                className="text-white/55 hover:text-white transition-colors"
              >
                HSKita
              </a>{" "}
              &{" "}
              <a
                href="https://codeverta.com"
                target="_blank"
                rel="noopener"
                className="text-white/55 hover:text-white transition-colors"
              >
                codeverta.com
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* <SiteHeader /> */}
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <FloatingContact />
    </div>
  );
}
