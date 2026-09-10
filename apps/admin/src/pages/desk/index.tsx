import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowRight,
  Bell,
  ChevronLeft,
  Command as CommandIcon,
  LayoutGrid,
  LogOut,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { accountingMenus, deskModules, hrSubmodules, isAdminRole } from "@/lib/erp-desk";
import { clearImpersonationStorage } from "@/lib/impersonation";
import { erpWorkspaces, type WorkspaceNavigationItem } from "@/lib/erp-workspaces";
import { useSettingsStore } from "@/store/useSettingsStore";
import { DEFAULT_APP_LOGO, getStorageUrl } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const normalize = (value: string) => value.trim().toLocaleLowerCase("id-ID");

type DeskUser = {
  display_name?: string;
  username?: string;
  email?: string;
  role?: number;
};

type DeskHeaderProps = {
  user: DeskUser | null;
  onSearchOpen: () => void;
  onLogout: () => void;
};

type SearchResult = {
  type: "module" | "feature";
  name: string;
  href: string;
  moduleName: string;
  moduleSlug: string;
  icon: typeof Search;
};

function BrandMark() {
  const { settings, fetchSettings } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const logo = settings?.app_logo ? getStorageUrl(settings.app_logo) : DEFAULT_APP_LOGO;
  const name = settings?.app_name || "Codeverta Enterprise System";

  return (
    <Link to="/desk" aria-label={`${name} home`} className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-100">
      <img
        src={logo}
        alt={name}
        className="size-9 shrink-0 rounded-[10px] object-contain shadow-sm"
      />
      <span className="hidden max-w-52 truncate text-sm font-semibold text-slate-800 sm:block">
        {name}
      </span>
    </Link>
  );
}

function SearchTrigger({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Buka pencarian"
      className={
        compact
          ? "flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-violet-200 hover:text-violet-700"
          : "group flex h-10 w-full items-center gap-3 rounded-xl border border-slate-200/90 bg-slate-50 px-3 text-left text-sm text-slate-500 shadow-sm transition hover:border-violet-200 hover:bg-white hover:shadow-md"
      }
    >
      <Search className="size-4 shrink-0" />
      {!compact && (
        <>
          <span className="min-w-0 flex-1 truncate">Cari modul, dokumen, atau laporan...</span>
          <span className="hidden items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-400 shadow-xs sm:flex">
            <CommandIcon className="size-3" />K
          </span>
        </>
      )}
    </button>
  );
}

function DeskHeader({ user, onSearchOpen, onLogout }: DeskHeaderProps) {
  const initial = (user?.display_name || user?.username || user?.email || "A").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-17 w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-10">
        <BrandMark />
        <div className="mx-auto hidden w-full max-w-lg md:block">
          <SearchTrigger onClick={onSearchOpen} />
        </div>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <div className="md:hidden">
            <SearchTrigger onClick={onSearchOpen} compact />
          </div>
          <button type="button" aria-label="Notifikasi" className="relative flex size-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <Bell className="size-5" />
            <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>
          <div className="mx-1 h-7 w-px bg-slate-200" />
          <button
            type="button"
            onClick={onLogout}
            title="Keluar"
            aria-label="Keluar"
            className="group flex items-center gap-2 rounded-xl p-1.5 pr-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white shadow-sm">{initial}</span>
            <LogOut className="size-4 text-slate-400 transition group-hover:text-rose-500" />
          </button>
        </div>
      </div>
    </header>
  );
}

function collectNavigationItems(items: WorkspaceNavigationItem[]): WorkspaceNavigationItem[] {
  return items.flatMap((item) => [item, ...(item.items ? collectNavigationItems(item.items) : [])]);
}

function buildSearchResults(): SearchResult[] {
  const modules = deskModules.map((module) => ({
    type: "module" as const,
    name: module.name,
    href: module.slug === "hr" ? "/desk/hr" : `/desk/${module.slug}`,
    moduleName: module.name,
    moduleSlug: module.slug,
    icon: module.icon,
  }));

  const workspaceFeatures = Object.values(erpWorkspaces).flatMap((workspace) =>
    collectNavigationItems(workspace.navigation)
      .filter((item) => item.name !== "Home")
      .map((item) => ({
        type: "feature" as const,
        name: item.name,
        href: item.href,
        moduleName: workspace.name,
        moduleSlug: workspace.slug,
        icon: item.icon,
      })),
  );

  const hrFeatures = hrSubmodules.map((item) => ({
    type: "feature" as const,
    name: item.name,
    href: item.href,
    moduleName: "Human Resources (HR)",
    moduleSlug: "hr",
    icon: item.icon,
  }));

  const accountingFeatures = accountingMenus.map((item) => ({
    type: "feature" as const,
    name: item.name,
    href: item.href,
    moduleName: "Akuntansi & Keuangan",
    moduleSlug: "accounting",
    icon: item.icon,
  }));

  const deduped = new Map<string, SearchResult>();
  [...modules, ...workspaceFeatures, ...hrFeatures, ...accountingFeatures].forEach((item) => {
    const key = `${item.type}:${item.moduleSlug}:${item.href}:${item.name}`;
    if (!deduped.has(key)) deduped.set(key, item);
  });
  return [...deduped.values()];
}

function DeskCommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const searchResults = useMemo(() => buildSearchResults(), []);
  const term = normalize(query);

  const matches = (item: SearchResult) =>
    [item.name, item.moduleName, item.moduleSlug, item.type === "module" ? "modul workspace aplikasi" : "fitur menu laporan dokumen master data transaksi"]
      .map(normalize)
      .some((value) => value.includes(term));

  const visibleModules = searchResults.filter((item) => item.type === "module" && (!term || matches(item)));
  const visibleFeatures = searchResults
    .filter((item) => item.type === "feature" && (term ? matches(item) : false))
    .slice(0, 36);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  const goTo = (href: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(href);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <DialogContent className="!top-[12%] max-w-[calc(100%-1.5rem)] !translate-y-0 gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-2xl sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Pencarian cepat</DialogTitle>
          <DialogDescription>Cari dan buka modul atau fitur ERP.</DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false} className="rounded-2xl bg-white">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Ketik nama modul, dokumen, atau laporan..."
            className="h-14 text-[15px]"
          />
          <CommandList className="max-h-[min(58vh,520px)] p-2">
            <CommandEmpty className="py-14 text-center text-sm">
              <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Search className="size-5" />
              </div>
              <p className="font-medium text-slate-700">Tidak ada hasil ditemukan</p>
              <p className="mt-1 text-xs text-slate-400">Coba gunakan kata kunci yang lebih singkat.</p>
            </CommandEmpty>

            {visibleModules.length > 0 && (
              <CommandGroup heading={term ? "Modul" : "Semua modul"} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
                {visibleModules.map(({ name, href, icon: Icon }) => (
                  <CommandItem
                    key={`module-${href}`}
                    value={`module-${href}-${name}`}
                    onSelect={() => goTo(href)}
                    className="group rounded-xl px-3 py-3 data-[selected=true]:bg-violet-50 data-[selected=true]:text-violet-950"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-violet-600 shadow-xs group-data-[selected=true]:border-violet-200">
                      <Icon className="size-4.5" />
                    </span>
                    <span className="font-medium">{name}</span>
                    <CommandShortcut className="normal-case tracking-normal text-slate-400">Modul</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {visibleModules.length > 0 && visibleFeatures.length > 0 && <CommandSeparator className="my-2" />}

            {visibleFeatures.length > 0 && (
              <CommandGroup heading="Fitur & dokumen" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
                {visibleFeatures.map(({ name, href, icon: Icon, moduleName }, index) => (
                  <CommandItem
                    key={`feature-${href}-${name}-${index}`}
                    value={`feature-${href}-${name}-${moduleName}-${index}`}
                    onSelect={() => goTo(href)}
                    className="group rounded-xl px-3 py-3 data-[selected=true]:bg-violet-50 data-[selected=true]:text-violet-950"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-data-[selected=true]:bg-white group-data-[selected=true]:text-violet-600">
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{name}</span>
                      <span className="block truncate text-xs text-slate-400">{moduleName}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[11px] text-slate-400">
            <span>{term ? `${visibleModules.length + visibleFeatures.length} hasil` : "Ketik untuk mencari semua fitur"}</span>
            <span className="hidden items-center gap-3 sm:flex"><span>↑↓ navigasi</span><span>↵ buka</span><span>esc tutup</span></span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

const moduleDescriptions: Record<string, string> = {
  crm: "Kelola prospek, relasi, dan aktivitas pelanggan.",
  hr: "Karyawan, kehadiran, payroll, dan performa.",
  framework: "Fondasi sistem, data inti, dan utilitas platform.",
  organization: "Struktur perusahaan, cabang, pengguna, dan akses.",
  accounting: "Arus kas, penagihan, jurnal, dan laporan keuangan.",
  assets: "Pantau aset, nilai, lokasi, dan siklus penggunaannya.",
  buying: "Supplier, permintaan, pesanan, dan invoice pembelian.",
  manufacturing: "Produksi, material, work order, dan kapasitas.",
  projects: "Rencanakan proyek, tugas, waktu, dan biaya.",
  quality: "Inspeksi, standar kualitas, dan tindakan perbaikan.",
  selling: "Penawaran, order, invoice, POS, dan pelanggan.",
  stock: "Inventori, gudang, pengiriman, dan pergerakan stok.",
  subcontracting: "Kelola proses dan material kerja subkontrak.",
  communication: "Template email dan komunikasi operasional.",
  administration: "Audit, kontrol, dan administrasi sistem.",
  "erpnext-settings": "Konfigurasi preferensi dan perilaku sistem.",
};

const moduleStyles = [
  "bg-violet-50 text-violet-700 border-violet-100",
  "bg-cyan-50 text-cyan-700 border-cyan-100",
  "bg-amber-50 text-amber-700 border-amber-100",
  "bg-blue-50 text-blue-700 border-blue-100",
  "bg-emerald-50 text-emerald-700 border-emerald-100",
  "bg-rose-50 text-rose-700 border-rose-100",
];

const hrDescriptions: Record<string, string> = {
  expenses: "Pengajuan, persetujuan, dan pencatatan klaim biaya.",
  performance: "Siklus penilaian, target, dan evaluasi karyawan.",
  tenure: "Data karyawan, kontrak, dan riwayat masa kerja.",
  "hr-setup": "Struktur, kebijakan, dan konfigurasi dasar HR.",
  recruitment: "Lowongan, kandidat, interview, dan proses hiring.",
  leaves: "Permohonan cuti, izin, saldo, dan persetujuan.",
  "shift-and-attendance": "Jadwal shift, check-in, dan rekap kehadiran.",
  payroll: "Komponen gaji, slip, dan proses penggajian.",
  "tax-and-benefits": "Pajak karyawan, benefit, dan tunjangan.",
};

function ModuleLauncher({ user, onSearchOpen }: { user: DeskUser | null; onSearchOpen: () => void }) {
  const navigate = useNavigate();
  const [selectedModuleDialog, setSelectedModuleDialog] = useState<string | null>(null);
  const displayName = user?.display_name || user?.username || "Admin";

  return (
    <>
      <main className="min-h-[calc(100vh-4.25rem)] bg-[#f7f8fc]">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <section className="relative isolate overflow-hidden rounded-[28px] bg-[#15172f] px-6 py-8 text-white shadow-[0_24px_70px_-36px_rgba(30,27,75,0.8)] sm:px-9 sm:py-10 lg:px-12 lg:py-12">
            <div className="absolute -right-24 -top-32 -z-10 size-80 rounded-full bg-violet-500/30 blur-3xl" />
            <div className="absolute -bottom-40 left-1/3 -z-10 size-80 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="absolute right-10 top-10 -z-10 hidden size-40 rotate-12 rounded-[36px] border border-white/10 bg-white/[0.03] lg:block" />
            <div className="grid items-end gap-8 lg:grid-cols-[1fr_380px]">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-violet-100">
                  <Sparkles className="size-3.5" /> Workspace utama
                </span>
                <p className="mt-6 text-sm font-medium text-violet-200">Selamat datang, {displayName}</p>
                <h1 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.04em] text-white sm:text-4xl lg:text-[44px]">
                  Semua operasional bisnis,<br className="hidden sm:block" /> dalam satu tempat.
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                  Pilih modul untuk mulai bekerja atau gunakan pencarian cepat untuk menuju dokumen dan laporan secara langsung.
                </p>
              </div>
              <div>
                <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Akses cepat</p>
                <button
                  type="button"
                  onClick={onSearchOpen}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.09] p-3.5 text-left backdrop-blur transition hover:border-white/20 hover:bg-white/[0.14]"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-white text-slate-900 shadow-lg"><Search className="size-4.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">Cari apa saja</span>
                    <span className="block truncate text-xs text-slate-400">Modul, dokumen, laporan...</span>
                  </span>
                  <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-300"><CommandIcon className="size-3" />K</span>
                </button>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3">
                    <p className="text-xl font-bold">{deskModules.length}</p><p className="text-xs text-slate-400">Modul aktif</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3">
                    <p className="text-xl font-bold">⌘ K</p><p className="text-xs text-slate-400">Pencarian cepat</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="py-9 sm:py-11">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-violet-600"><LayoutGrid className="size-3.5" /> Workspace</div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950">Modul bisnis</h2>
                <p className="mt-1 text-sm text-slate-500">Buka area kerja sesuai kebutuhan operasional Anda.</p>
              </div>
              <span className="hidden text-sm text-slate-400 sm:block">{deskModules.length} modul tersedia</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {deskModules.map(({ name, slug, icon: Icon }, index) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => {
                    if (slug === "hr") {
                      setSelectedModuleDialog("hr");
                    } else {
                      navigate(`/desk/${slug}`);
                    }
                  }}
                  className="group flex min-h-36 min-w-0 items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_16px_35px_-20px_rgba(79,70,229,0.35)]"
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl border transition group-hover:scale-105 ${moduleStyles[index % moduleStyles.length]}`}
                  >
                    <Icon className="size-5.5" strokeWidth={2} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col self-stretch">
                    <span className="pr-5 text-[15px] font-bold leading-snug text-slate-900 transition group-hover:text-violet-700">{name}</span>
                    <span className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{moduleDescriptions[slug]}</span>
                    <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-semibold text-slate-400 transition group-hover:text-violet-600">Buka modul <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" /></span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Dialog open={selectedModuleDialog === "hr"} onOpenChange={(open) => !open && setSelectedModuleDialog(null)}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[28px] border-slate-200 bg-white p-0 shadow-2xl sm:max-w-3xl">
          <div className="relative overflow-hidden border-b border-slate-100 bg-[#f8f7ff] px-6 py-6 sm:px-8 sm:py-7">
            <div className="absolute -right-12 -top-16 size-44 rounded-full bg-violet-200/50 blur-3xl" />
            <DialogHeader className="relative pr-8">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-[0_10px_25px_-10px_rgba(124,58,237,0.8)]">
                  <Users className="size-5.5" />
                </span>
                <div className="pt-0.5">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Human Resources</DialogTitle>
                    <span className="rounded-full border border-violet-200 bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-600">HR</span>
                  </div>
                  <DialogDescription className="max-w-lg text-sm leading-6 text-slate-500">
                    Pilih area kerja untuk mengelola seluruh proses dan kebutuhan karyawan.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Pilih area kerja</p>
              <p className="text-xs text-slate-400">{hrSubmodules.length} area tersedia</p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {hrSubmodules.map(({ name, slug, href, icon: Icon }, index) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setSelectedModuleDialog(null);
                    navigate(href);
                  }}
                  className="group flex min-h-23 items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left transition duration-200 hover:-translate-y-px hover:border-violet-200 hover:bg-violet-50/40 hover:shadow-[0_12px_28px_-18px_rgba(79,70,229,0.45)] sm:p-4"
                >
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl border transition group-hover:scale-105 ${moduleStyles[index % moduleStyles.length]}`}>
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-snug text-slate-900 transition group-hover:text-violet-700">{name}</span>
                    <span className="mt-1 block text-[11px] leading-4.5 text-slate-500">{hrDescriptions[slug]}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-xs text-slate-500">Tidak yakin? Buka workspace HR untuk melihat semua menu.</p>
            <button
              type="button"
              onClick={() => {
                setSelectedModuleDialog(null);
                navigate("/desk/hr");
              }}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-violet-700"
            >
              Buka workspace HR <ArrowRight className="size-3.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HRLauncher() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
      <Link to="/desk" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600">
        <ChevronLeft className="size-4" /> All modules
      </Link>
      <div className="mb-10">
        <p className="text-sm font-medium text-blue-600">Module</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Human Resources (HR)</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hrSubmodules.map(({ name, href, icon: Icon }) => (
            <Link
              key={name}
              to={href}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-500 group-hover:text-white">
                <Icon className="size-6" />
              </span>
              <span className="font-semibold text-slate-800 group-hover:text-blue-600">{name}</span>
            </Link>
          ))}
      </div>
    </main>
  );
}

function AccountingLauncher() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
      <Link to="/desk" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600">
        <ChevronLeft className="size-4" /> All modules
      </Link>
      <div className="mb-10">
        <p className="text-sm font-medium text-blue-600">Module</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Accounting</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accountingMenus.map(({ name, href, icon: Icon }) => (
            <a key={name} href={href} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-500 group-hover:text-white">
                <Icon className="size-6" />
              </span>
              <span className="font-semibold text-slate-800 group-hover:text-blue-600">{name}</span>
            </a>
          ))}
      </div>
    </main>
  );
}

function ModulePlaceholder({ slug }: { slug: string }) {
  const module = deskModules.find((item) => item.slug === slug);
  if (!module) return <Navigate to="/desk" replace />;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14">
      <Link to="/desk" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600">
        <ChevronLeft className="size-4" /> All modules
      </Link>
      <h1 className="text-3xl font-bold text-slate-900">{module.name}</h1>
      <p className="mt-2 text-slate-500">This ERP module is ready to be configured.</p>
    </main>
  );
}

export default function DeskPage() {
  const { "*": slug = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  let user: DeskUser | null = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }

  if (!isAdminRole(user?.role)) return <Navigate to="/dashboard" replace />;

  const logout = () => {
    clearImpersonationStorage();
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    navigate("/");
  };

  const activeSlug = slug.split("/")[0];
  const isHR = activeSlug === "hr";
  const isAccounting = activeSlug === "accounting";
  const isRoot = location.pathname === "/desk" || location.pathname === "/desk/";

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <DeskHeader user={user} onSearchOpen={() => setSearchOpen(true)} onLogout={logout} />
      <DeskCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      {isRoot ? (
        <ModuleLauncher user={user} onSearchOpen={() => setSearchOpen(true)} />
      ) : isHR ? (
        <HRLauncher />
      ) : isAccounting ? (
        <AccountingLauncher />
      ) : (
        <ModulePlaceholder slug={activeSlug} />
      )}
    </div>
  );
}
