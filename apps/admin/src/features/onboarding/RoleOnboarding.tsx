import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/lib/constants";

const ONBOARDING_VERSION = "role-onboarding-tour-v2";
const TOUR_PROGRESS_PREFIX = "roleOnboardingTour:";
const TOUR_COMPLETION_PREFIX = "roleOnboardingCompleted:";
const SPOTLIGHT_GAP = 8;

const roleLabels = {
  [ROLES.MERCHANT]: "Merchant",
  [ROLES.PARTNER]: "Partner",
  [ROLES.INSTRUCTOR]: "Guru Internal",
  [ROLES.MENTOR_EXTERNAL]: "Guru External",
  [ROLES.ADMIN]: "Admin",
  [ROLES.SUPERADMIN]: "Super Admin",
};

const targetHref = (href: string) =>
  `[data-onboarding-href="${href}"], a[href="/dashboard${href}"]`;

const introStep = {
  id: "welcome",
  eyebrow: "Selamat datang",
  title: "Mari kenali ruang kerja Anda",
  description:
    "Kami akan menyorot menu penting satu per satu. Area yang terang adalah lokasi yang sedang dijelaskan.",
  icon: Sparkles,
};

const commonSteps = {
  home: {
    id: "home",
    eyebrow: "Titik awal",
    title: "Mulai dari Beranda",
    description:
      "Klik Beranda kapan pun Anda ingin kembali ke ringkasan aktivitas, agenda, dan informasi akun terbaru.",
    icon: LayoutDashboard,
    target: targetHref("/"),
  },
  settings: {
    id: "settings",
    eyebrow: "Personalisasi",
    title: "Atur pengalaman aplikasi",
    description:
      "Pengaturan Aplikasi adalah tempat memilih bahasa, pet pendamping, tampilan navigasi, serta preferensi lainnya.",
    icon: Settings,
    target: targetHref("/settings"),
  },
};

const roleSteps: Record<number, any[]> = {
  [ROLES.PARTNER]: [
    {
      id: "my-classes",
      eyebrow: "Belajar",
      title: "Buka Kelas Saya",
      description:
        "Semua kelas dari paket subscription atau pembelian aktif tersedia di sini. Klik sebuah kartu kelas untuk melanjutkan lesson terakhir.",
      icon: BookOpen,
      target: targetHref("/my-courses"),
    },
    {
      id: "quiz",
      eyebrow: "Evaluasi",
      title: "Kerjakan quiz",
      description:
        "Buka menu Quiz untuk melihat evaluasi yang tersedia, mengerjakan soal, dan memeriksa hasil belajar Anda.",
      icon: MessageSquare,
      target: targetHref("/quizzes"),
    },
    {
      id: "schedule",
      eyebrow: "Rutinitas",
      title: "Ikuti Jadwal Belajar",
      description:
        "Gunakan Jadwal Belajar untuk melihat agenda hari ini, tenggat tugas, dan rencana belajar berikutnya.",
      icon: CalendarDays,
      target: targetHref("/schedule"),
    },
    commonSteps.settings,
  ],
  [ROLES.MERCHANT]: [
    {
      id: "children",
      eyebrow: "Pendampingan",
      title: "Kelola Akun Anak",
      description:
        "Di sini Anda menambah atau memilih akun anak. Pastikan data anak benar agar kelas, subscription, dan progres tercatat pada partner yang tepat.",
      icon: Users,
      target: targetHref("/akun-anak"),
    },
    {
      id: "subscriptions",
      eyebrow: "Akses kelas",
      title: "Pilih paket Langganan",
      description:
        "Buka Langganan untuk membeli atau memperpanjang paket. Kelas yang didapat akan otomatis muncul pada Kelas Saya.",
      icon: CreditCard,
      target: targetHref("/payments"),
    },
    {
      id: "my-classes",
      eyebrow: "Kelas aktif",
      title: "Temukan Kelas Saya",
      description:
        "Menu ini berisi kelas yang sudah termasuk dalam paket atau sudah dibeli. Untuk parent external, buka grup Kelas lalu pilih Kelas Saya.",
      icon: GraduationCap,
      target: targetHref("/my-courses"),
    },
  ],
  [ROLES.INSTRUCTOR]: [
    {
      id: "create-class",
      eyebrow: "Konten belajar",
      title: "Buat kelas dari Tambah Kelas",
      description:
        "Klik Tambah Kelas untuk membuat course, lalu lengkapi informasi, modul, dan lesson sebelum memublikasikannya.",
      icon: BookOpen,
      target: targetHref("/courses/add"),
      fallbackTarget: targetHref("/courses"),
    },
    {
      id: "student-progress",
      eyebrow: "Pendampingan",
      title: "Pantau Progress Partner",
      description:
        "Lihat siapa yang aktif, siapa yang tertinggal, dan materi yang membutuhkan penjelasan tambahan melalui menu ini.",
      icon: GraduationCap,
      target: targetHref("/mentor/student-progress"),
    },
    {
      id: "schedule",
      eyebrow: "Perencanaan",
      title: "Susun Jadwal Belajar",
      description:
        "Gunakan Jadwal Belajar untuk menyiapkan agenda yang konsisten dan mengatur kegiatan partner.",
      icon: CalendarDays,
      target: targetHref("/schedule"),
    },
  ],
  [ROLES.MENTOR_EXTERNAL]: [
    {
      id: "my-classes",
      eyebrow: "Kelas aktif",
      title: "Buka Kelas Saya",
      description:
        "Kelas dari subscription atau pembelian Anda tersimpan di sini dan siap digunakan untuk belajar maupun referensi mengajar.",
      icon: BookOpen,
      target: targetHref("/my-courses"),
    },
    {
      id: "create-class",
      eyebrow: "Fitur paket",
      title: "Buat course melalui Tambah Kelas",
      description:
        "Menu ini hanya muncul saat subscription Anda memiliki rule can_create_course. Jika tidak terlihat, pilih paket yang mendukung pembuatan course.",
      icon: Sparkles,
      target: targetHref("/courses/add"),
      optional: true,
    },
    {
      id: "finance",
      eyebrow: "Pendapatan",
      title: "Kelola Keuangan",
      description:
        "Setelah syarat penjualan terpenuhi, buka Keuangan untuk melengkapi rekening payout dan memantau transaksi course.",
      icon: Wallet,
      target: targetHref("/finance"),
    },
  ],
  [ROLES.ADMIN]: [
    {
      id: "manage-classes",
      eyebrow: "Kelola konten",
      title: "Kelola course platform",
      description:
        "Buka grup Kelas lalu pilih Tambah Kelas untuk meninjau course guru internal, membuat course, dan mengatur struktur materinya.",
      icon: BookOpen,
      target: targetHref("/courses/add"),
      fallbackTarget: targetHref("/courses"),
    },
    {
      id: "subscriptions",
      eyebrow: "Akses & paket",
      title: "Atur Langganan",
      description:
        "Di sini Anda mengelola harga paket aplikasi",
      icon: CreditCard,
      target: targetHref("/subscriptions"),
    },
    {
      id: "users",
      eyebrow: "Akun platform",
      title: "Kelola Pengguna",
      description:
        "Gunakan menu Pengguna untuk memeriksa partner, parent, mentor, role, serta akun yang membutuhkan approval.",
      icon: Users,
      target: targetHref("/users/list"),
    },
    {
      id: "finance",
      eyebrow: "Operasional",
      title: "Pantau Keuangan",
      description:
        "Menu Keuangan merangkum transaksi dan aktivitas finansial yang perlu dipantau oleh admin.",
      icon: Wallet,
      target: targetHref("/finance"),
    },
  ],
};

roleSteps[ROLES.SUPERADMIN] = [
  ...(roleSteps[ROLES.ADMIN] || []),
  {
    id: "system-settings",
    eyebrow: "Kontrol sistem",
    title: "Buka pengaturan sistem",
    description:
      "Gunakan kontrol ini untuk konfigurasi tingkat sistem. Periksa dampaknya terlebih dahulu karena perubahan berlaku lebih luas.",
    icon: Settings,
    target: '[data-onboarding="system-settings"]',
    optional: true,
  },
];

const isVisible = (element: Element | null) => {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};

const findVisibleTarget = (selector?: string) => {
  if (!selector) return null;
  return Array.from(document.querySelectorAll(selector)).find(isVisible) as HTMLElement | undefined;
};

const findClosedMenuForHref = (href?: string) => {
  if (!href) return null;
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-onboarding-child-hrefs]")
  ).find((element) => {
    const childHrefs = (element.dataset.onboardingChildHrefs || "")
      .split(/\s+/)
      .filter(Boolean);
    return childHrefs.includes(href) && isVisible(element) && element.getAttribute("aria-expanded") !== "true";
  });
};

const getStepHref = (selector?: string) =>
  selector?.match(/data-onboarding-href="([^"]+)"/)?.[1];

const readSavedStep = (key: string) => {
  try {
    return Number(sessionStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
};

const hasLocalCompletion = (key: string) => {
  try {
    return localStorage.getItem(key) === ONBOARDING_VERSION;
  } catch {
    return false;
  }
};

export function RoleOnboarding({ user, onboarding, onCompleted }) {
  const role = Number(user?.role || 0);
  const progressKey = `${TOUR_PROGRESS_PREFIX}${user?.id || "guest"}`;
  const completionKey = `${TOUR_COMPLETION_PREFIX}${user?.id || "guest"}`;
  const [open, setOpen] = useState(
    !!user?.id &&
      !hasLocalCompletion(completionKey) &&
      (onboarding?.completed !== true || onboarding?.version !== ONBOARDING_VERSION)
  );
  const [stepIndex, setStepIndex] = useState(() => readSavedStep(progressKey));
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [saving, setSaving] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(
    () => [introStep, commonSteps.home, ...(roleSteps[role] || roleSteps[ROLES.PARTNER])],
    [role]
  );
  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex];
  const Icon = step.icon;
  const isLast = safeIndex === steps.length - 1;
  const progress = Math.round(((safeIndex + 1) / steps.length) * 100);

  useEffect(() => {
    if (onboarding?.completed !== true || onboarding?.version !== ONBOARDING_VERSION) return;
    try {
      localStorage.setItem(completionKey, ONBOARDING_VERSION);
    } catch {
      // Database state is still enough when local storage is unavailable.
    }
  }, [completionKey, onboarding?.completed, onboarding?.version]);

  useEffect(() => {
    const restartTour = () => {
      setStepIndex(0);
      setOpen(true);
    };
    window.addEventListener("onboarding:start", restartTour);
    return () => window.removeEventListener("onboarding:start", restartTour);
  }, []);

  useEffect(() => {
    if (!open) return;
    try {
      sessionStorage.setItem(progressKey, String(safeIndex));
    } catch {
      // Session persistence is a convenience; the tour still works without it.
    }
  }, [open, progressKey, safeIndex]);

  useEffect(() => {
    if (!open) return;

    let frame = 0;
    let openTimer = 0;
    const menusOpenedByTour: HTMLElement[] = [];
    const updateTarget = () => {
      const target = findVisibleTarget(step.target) || findVisibleTarget(step.fallbackTarget);
      if (target) {
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
        setTargetRect(target.getBoundingClientRect());
      } else {
        setTargetRect(null);
        const menuOpener = findClosedMenuForHref(getStepHref(step.target));
        if (menuOpener) {
          menusOpenedByTour.push(menuOpener);
          menuOpener.click();
          window.clearTimeout(openTimer);
          openTimer = window.setTimeout(scheduleUpdate, 100);
        }
      }
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateTarget);
    };

    const timer = window.setTimeout(updateTarget, 120);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true });
    updateTarget();

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(openTimer);
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      [...menusOpenedByTour].reverse().forEach((menu) => {
        if (menu.isConnected && menu.getAttribute("aria-expanded") === "true") {
          menu.click();
        }
      });
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && !saving) {
        event.preventDefault();
        setStepIndex((value) => Math.min(value + 1, steps.length - 1));
      }
      if (event.key === "ArrowLeft" && !saving) {
        event.preventDefault();
        setStepIndex((value) => Math.max(value - 1, 0));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, steps.length]);

  const saveCompletion = async (skipped = false) => {
    setSaving(true);
    try {
      const response = await api.put("/lms/my-settings/onboarding", {
        role: roleLabels[role] || "User",
        version: ONBOARDING_VERSION,
        skipped,
      });
      try {
        localStorage.setItem(completionKey, ONBOARDING_VERSION);
      } catch {
        // The database remains the source of truth when local storage is unavailable.
      }
      onCompleted?.(response.data?.data || { completed: true });
      setOpen(false);
      try {
        sessionStorage.removeItem(progressKey);
      } catch {
        // Ignore unavailable storage.
      }
      toast.success(skipped ? "Selamat anda bisa mulai menggunakan dashboard." : "Selamat menggunakan dashboard.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Gagal menyimpan status onboarding");
    } finally {
      setSaving(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const paddedRect = targetRect
    ? {
        top: Math.max(0, targetRect.top - SPOTLIGHT_GAP),
        left: Math.max(0, targetRect.left - SPOTLIGHT_GAP),
        right: Math.min(viewportWidth, targetRect.right + SPOTLIGHT_GAP),
        bottom: Math.min(viewportHeight, targetRect.bottom + SPOTLIGHT_GAP),
      }
    : null;
  const tooltipWidth = Math.min(384, viewportWidth - 32);
  const placeRight = paddedRect && paddedRect.right + tooltipWidth + 28 <= viewportWidth;
  const placeLeft = paddedRect && !placeRight && paddedRect.left - tooltipWidth - 28 >= 0;
  const tooltipStyle: React.CSSProperties = paddedRect
    ? {
        width: tooltipWidth,
        left: placeRight
          ? paddedRect.right + 16
          : placeLeft
            ? paddedRect.left - tooltipWidth - 16
            : Math.max(16, Math.min(paddedRect.left, viewportWidth - tooltipWidth - 16)),
        top: placeRight || placeLeft
          ? Math.max(16, Math.min(paddedRect.top, viewportHeight - 330))
          : paddedRect.bottom + 16 + 300 <= viewportHeight
            ? paddedRect.bottom + 16
            : Math.max(16, paddedRect.top - 316),
      }
    : {
        width: tooltipWidth,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Tour pengenalan dashboard">
      {paddedRect ? (
        <>
          <div className="fixed inset-x-0 top-0 bg-slate-950/72 backdrop-blur-[1px]" style={{ height: paddedRect.top }} />
          <div className="fixed left-0 bg-slate-950/72 backdrop-blur-[1px]" style={{ top: paddedRect.top, width: paddedRect.left, height: paddedRect.bottom - paddedRect.top }} />
          <div className="fixed right-0 bg-slate-950/72 backdrop-blur-[1px]" style={{ top: paddedRect.top, left: paddedRect.right, height: paddedRect.bottom - paddedRect.top }} />
          <div className="fixed inset-x-0 bottom-0 bg-slate-950/72 backdrop-blur-[1px]" style={{ top: paddedRect.bottom }} />
          <div
            className="pointer-events-none fixed rounded-xl border-2 border-sky-400 shadow-[0_0_0_4px_rgba(56,189,248,0.2),0_0_30px_rgba(56,189,248,0.5)] motion-safe:animate-pulse"
            style={{
              top: paddedRect.top,
              left: paddedRect.left,
              width: paddedRect.right - paddedRect.left,
              height: paddedRect.bottom - paddedRect.top,
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-slate-950/72 backdrop-blur-[2px]" />
      )}

      <div
        ref={tooltipRef}
        className="pointer-events-auto fixed overflow-hidden rounded-2xl border border-white/30 bg-white shadow-2xl shadow-slate-950/30"
        style={tooltipStyle}
      >
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
              <Icon className="h-5 w-5" />
            </div>
            <button
              type="button"
              onClick={() => saveCompletion(true)}
              disabled={saving}
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="Lewati tour"
              title="Lewati tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-600">{step.eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">{step.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
          {step.target && !targetRect && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              Menu ini mungkin berada di dalam grup menu atau tidak tersedia pada paket Anda. Deskripsinya tetap bisa Anda pelajari di sini.
            </p>
          )}

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => saveCompletion(true)}
              disabled={saving}
              className="text-xs font-semibold text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline disabled:opacity-50"
            >
              Lewati tur
            </button>
            <div className="flex items-center gap-2">
              {safeIndex > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setStepIndex((value) => Math.max(value - 1, 0))} disabled={saving}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Kembali
                </Button>
              )}
              {isLast ? (
                <Button size="sm" onClick={() => saveCompletion(false)} disabled={saving} className="bg-sky-600 hover:bg-sky-700">
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                  Selesai
                </Button>
              ) : (
                <Button size="sm" onClick={() => setStepIndex((value) => Math.min(value + 1, steps.length - 1))} disabled={saving} className="bg-sky-600 hover:bg-sky-700">
                  Berikutnya
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">Langkah {safeIndex + 1} dari {steps.length} · gunakan tombol panah keyboard</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
