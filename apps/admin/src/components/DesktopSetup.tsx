import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArchiveRestore,
  Check,
  Cloud,
  Database,
  Globe2,
  Languages,
  Loader2,
  LockKeyhole,
  Server,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_APP_LOGO } from "@/lib/utils";
import {
  cacheDesktopConfig,
  configureDesktop,
  getDesktopRecoveryStatus,
  getDesktopConfig,
  restoreDesktopRecoveryBackup,
  waitForApi,
  type DesktopRecoveryStatus,
  type DesktopMode,
  type DesktopSetupInput,
} from "@/lib/desktop-runtime";

type BootstrapState = "loading" | "setup" | "ready" | "error";

const currencies = ["IDR", "USD", "SGD", "MYR", "EUR", "AUD"];

export function DesktopBootstrap({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BootstrapState>("loading");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [recovery, setRecovery] = useState<DesktopRecoveryStatus | null>(null);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      setState("loading");
      setError("");
      try {
        const config = await getDesktopConfig();
        if (cancelled) return;
        if (!config) {
          setState("setup");
          return;
        }
        const previous = localStorage.getItem("codeverta.desktop.runtime");
        cacheDesktopConfig(config);
        if (previous !== JSON.stringify(config)) {
          window.location.reload();
          return;
        }
        if (config.mode === "offline") {
          await waitForApi(config.apiUrl);
          const recoveryStatus = await getDesktopRecoveryStatus().catch(() => null);
          const recoveryID = recoveryStatus?.lastRecovery?.recoveredAt;
          if (recoveryID && sessionStorage.getItem("codeverta.desktop.recoveryNotice") !== String(recoveryID)) {
            sessionStorage.setItem("codeverta.desktop.recoveryNotice", String(recoveryID));
            toast.warning("Database lokal dipulihkan dari snapshot yang aman setelah migrasi terputus.");
          }
        }
        if (!cancelled) setState("ready");
      } catch (reason) {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setState("error");
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (state !== "error") return;
    let cancelled = false;
    void getDesktopRecoveryStatus()
      .then((status) => {
        if (cancelled) return;
        setRecovery(status);
        setSelectedBackup(status.backups[0]?.name || "");
      })
      .catch(() => {
        if (!cancelled) setRecovery(null);
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const restoreBackup = async () => {
    if (!selectedBackup) return;
    setRestoring(true);
    setError("");
    try {
      await restoreDesktopRecoveryBackup(selectedBackup);
      toast.success("Snapshot dipulihkan. Memeriksa database lokal…");
      setReloadKey((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRestoring(false);
    }
  };

  if (state === "ready") return children;
  if (state === "setup") return <DesktopOnboarding />;

  return (
    <div className="flex min-h-full items-center justify-center bg-[#f6f7fb] px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
        {state === "loading" ? (
          <>
            <span className="mx-auto flex size-13 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Loader2 className="size-6 animate-spin" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-slate-950">Menyiapkan workspace</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Memulai layanan dan database desktop Anda...</p>
          </>
        ) : (
          <>
            <span className="mx-auto flex size-13 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <WifiOff className="size-6" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-slate-950">Workspace belum dapat dimulai</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{error || "Layanan desktop tidak tersedia."}</p>
            <button onClick={() => setReloadKey((value) => value + 1)} className="mt-6 h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-violet-700">
              Coba lagi
            </button>
            {recovery && recovery.backups.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-5 text-left">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <ArchiveRestore className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Recovery database</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Pilih snapshot otomatis sebelum update atau migrasi. Database saat ini tetap dibuatkan safety copy.
                    </p>
                  </div>
                </div>
                <select
                  aria-label="Snapshot recovery"
                  value={selectedBackup}
                  onChange={(event) => setSelectedBackup(event.target.value)}
                  className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-400"
                >
                  {recovery.backups.map((backup) => (
                    <option key={backup.name} value={backup.name}>
                      {new Date(backup.createdAt * 1000).toLocaleString("id-ID")} · {(backup.size / 1024 / 1024).toFixed(1)} MB
                    </option>
                  ))}
                </select>
                <button
                  disabled={!selectedBackup || restoring}
                  onClick={() => void restoreBackup()}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                >
                  {restoring ? <Loader2 className="size-4 animate-spin" /> : <ArchiveRestore className="size-4" />}
                  Pulihkan snapshot
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DesktopOnboarding() {
  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [currency, setCurrency] = useState("IDR");
  const [workspaceName, setWorkspaceName] = useState("Perusahaan Saya");
  const [mode, setMode] = useState<DesktopMode>("offline");
  const [serverUrl, setServerUrl] = useState("https://erp-api.codeverta.com");
  const [adminName, setAdminName] = useState("Administrator");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const copy = useMemo(
    () =>
      language === "id"
        ? {
            eyebrow: "PENGATURAN DESKTOP",
            title: "Siapkan workspace Anda",
            subtitle: "Hanya perlu dilakukan sekali pada perangkat ini.",
            back: "Kembali",
            next: "Lanjutkan",
            finish: "Buat workspace",
          }
        : {
            eyebrow: "DESKTOP SETUP",
            title: "Set up your workspace",
            subtitle: "You only need to do this once on this device.",
            back: "Back",
            next: "Continue",
            finish: "Create workspace",
          },
    [language],
  );

  const validateStep = () => {
    setError("");
    if (step === 1 && !workspaceName.trim()) {
      setError(language === "id" ? "Nama workspace wajib diisi." : "Workspace name is required.");
      return false;
    }
    if (step === 2 && mode === "server" && !/^https?:\/\//i.test(serverUrl.trim())) {
      setError(language === "id" ? "Masukkan URL server yang valid." : "Enter a valid server URL.");
      return false;
    }
    if (step === 3 && mode === "offline") {
      if (adminPassword.length < 8) {
        setError(language === "id" ? "Password minimal 8 karakter." : "Password must be at least 8 characters.");
        return false;
      }
      if (adminPassword !== confirmPassword) {
        setError(language === "id" ? "Konfirmasi password tidak sama." : "Passwords do not match.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep((value) => Math.min(3, value + 1));
  };

  const handleFinish = async () => {
    if (!validateStep()) return;
    setIsSubmitting(true);
    setError("");
    try {
      if (mode === "server") await waitForApi(serverUrl.trim(), 12);
      const input: DesktopSetupInput = {
        mode,
        language,
        currency,
        workspaceName: workspaceName.trim(),
        serverUrl: mode === "server" ? serverUrl.trim() : null,
        adminName: mode === "offline" ? adminName.trim() : null,
        adminPassword: mode === "offline" ? adminPassword : null,
      };
      const config = await configureDesktop(input);
      if (mode === "offline") await waitForApi(config.apiUrl);
      cacheDesktopConfig(config);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-full overflow-y-auto bg-[#f6f7fb] px-5 py-8 sm:px-8 lg:py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.12),transparent_45%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.1),transparent_40%)]" />
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={DEFAULT_APP_LOGO} alt="Codeverta" className="size-10 rounded-xl object-contain shadow-sm" />
            <div><p className="text-sm font-bold text-slate-950">Codeverta Enterprise</p><p className="text-[11px] text-slate-500">Desktop Edition</p></div>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {(["id", "en"] as const).map((item) => (
              <button key={item} onClick={() => setLanguage(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${language === item ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_80px_-45px_rgba(15,23,42,0.45)] lg:grid-cols-[300px_1fr]">
          <aside className="relative overflow-hidden bg-[#17182f] p-7 text-white sm:p-9">
            <div className="absolute -left-20 bottom-0 size-60 rounded-full bg-violet-500/20 blur-3xl" />
            <p className="relative text-[11px] font-semibold tracking-[0.18em] text-violet-300">{copy.eyebrow}</p>
            <h1 className="relative mt-4 text-3xl font-bold leading-tight text-white">{copy.title}</h1>
            <p className="relative mt-3 text-sm leading-6 text-slate-400">{copy.subtitle}</p>
            <div className="relative mt-9 space-y-2">
              {[
                [Languages, language === "id" ? "Bahasa & regional" : "Language & region"],
                [Database, language === "id" ? "Pilih mode data" : "Choose data mode"],
                [ShieldCheck, language === "id" ? "Selesaikan setup" : "Finish setup"],
              ].map(([Icon, label], index) => {
                const number = index + 1;
                const active = number === step;
                const complete = number < step;
                const StepIcon = Icon as typeof Languages;
                return (
                  <div key={label as string} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active ? "bg-white/10 text-white" : "text-slate-400"}`}>
                    <span className={`flex size-8 items-center justify-center rounded-lg ${active ? "bg-violet-500 text-white" : complete ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5"}`}>
                      {complete ? <Check className="size-4" /> : <StepIcon className="size-4" />}
                    </span>
                    <span className="font-medium">{label as string}</span>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="flex min-h-[570px] flex-col p-6 sm:p-9 lg:p-11">
            <div className="flex-1">
              {step === 1 && (
                <div>
                  <StepHeading icon={Globe2} title={language === "id" ? "Bahasa & regional" : "Language & region"} description={language === "id" ? "Atur preferensi awal untuk workspace desktop." : "Set the initial preferences for your desktop workspace."} />
                  <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    <Field label={language === "id" ? "Bahasa aplikasi" : "App language"}>
                      <select value={language} onChange={(event) => setLanguage(event.target.value as "id" | "en")} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400 focus:ring-3 focus:ring-violet-100">
                        <option value="id">Bahasa Indonesia</option><option value="en">English</option>
                      </select>
                    </Field>
                    <Field label={language === "id" ? "Mata uang utama" : "Primary currency"}>
                      <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400 focus:ring-3 focus:ring-violet-100">
                        {currencies.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </Field>
                    <div className="sm:col-span-2"><Field label={language === "id" ? "Nama workspace / perusahaan" : "Workspace / company name"}>
                      <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="PT Contoh Indonesia" className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none placeholder:text-slate-300 focus:border-violet-400 focus:ring-3 focus:ring-violet-100" />
                    </Field></div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <StepHeading icon={Database} title={language === "id" ? "Di mana data disimpan?" : "Where should data be stored?"} description={language === "id" ? "Pilihan ini menentukan cara desktop bekerja sehari-hari." : "This determines how the desktop app works day to day."} />
                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <ModeCard selected={mode === "offline"} onClick={() => setMode("offline")} icon={WifiOff} title={language === "id" ? "Mandiri & Offline" : "Standalone & Offline"} badge={language === "id" ? "Disarankan" : "Recommended"} description={language === "id" ? "Database tersimpan di perangkat. Tidak memerlukan internet atau server." : "The database stays on this device. No internet or server required."} bullets={[language === "id" ? "Tetap berfungsi tanpa internet" : "Works without internet", language === "id" ? "Data tersimpan secara lokal" : "Data stored locally"]} />
                    <ModeCard selected={mode === "server"} onClick={() => setMode("server")} icon={Cloud} title={language === "id" ? "Terhubung ke Server" : "Connect to Server"} description={language === "id" ? "Gunakan database bersama dari server Codeverta atau server perusahaan." : "Use a shared database from Codeverta or your company server."} bullets={[language === "id" ? "Data lintas perangkat" : "Cross-device data", language === "id" ? "Memerlukan koneksi server" : "Requires server access"]} />
                  </div>
                  {mode === "server" && <div className="mt-5"><Field label="Server URL"><div className="relative"><Server className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 pl-11 pr-4 text-sm outline-none focus:border-violet-400 focus:ring-3 focus:ring-violet-100" /></div></Field></div>}
                </div>
              )}

              {step === 3 && (
                <div>
                  <StepHeading icon={mode === "offline" ? LockKeyhole : Cloud} title={mode === "offline" ? (language === "id" ? "Buat administrator lokal" : "Create local administrator") : (language === "id" ? "Siap terhubung" : "Ready to connect")} description={mode === "offline" ? (language === "id" ? "Akun ini hanya tersimpan dan digunakan pada database perangkat ini." : "This account is stored and used only in this device database.") : (language === "id" ? "Desktop akan menggunakan akun dan data dari server Anda." : "Desktop will use accounts and data from your server.")} />
                  {mode === "offline" ? (
                    <div className="mt-8 grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2"><Field label={language === "id" ? "Nama administrator" : "Administrator name"}><input value={adminName} onChange={(event) => setAdminName(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-violet-400 focus:ring-3 focus:ring-violet-100" /></Field></div>
                      <Field label="Password"><input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-violet-400 focus:ring-3 focus:ring-violet-100" /></Field>
                      <Field label={language === "id" ? "Ulangi password" : "Confirm password"}><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-violet-400 focus:ring-3 focus:ring-violet-100" /></Field>
                      <div className="sm:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-xs leading-5 text-emerald-800"><ShieldCheck className="mr-2 inline size-4" />{language === "id" ? "Database SQLite dan file upload akan disimpan di folder data aplikasi, terpisah dari installer." : "The SQLite database and uploads will be stored in the app data folder, separate from the installer."}</div>
                    </div>
                  ) : (
                    <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Server URL</p><p className="mt-2 break-all text-sm font-semibold text-slate-800">{serverUrl}</p><p className="mt-4 text-xs leading-5 text-slate-500">{language === "id" ? "Koneksi akan diperiksa sebelum konfigurasi disimpan." : "The connection will be checked before saving this configuration."}</p></div>
                  )}
                </div>
              )}
            </div>

            {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
              <button disabled={step === 1 || isSubmitting} onClick={() => { setError(""); setStep((value) => Math.max(1, value - 1)); }} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 disabled:invisible"><ArrowLeft className="size-4" />{copy.back}</button>
              {step < 3 ? <button onClick={handleNext} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-violet-700">{copy.next}<ArrowRight className="size-4" /></button> : <button disabled={isSubmitting} onClick={handleFinish} className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 disabled:opacity-60">{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{copy.finish}</button>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StepHeading({ icon: Icon, title, description }: { icon: typeof Languages; title: string; description: string }) {
  return <div className="flex items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Icon className="size-5" /></span><div><h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2><p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p></div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">{label}</span>{children}</label>;
}

function ModeCard({ selected, onClick, icon: Icon, title, description, badge, bullets }: { selected: boolean; onClick: () => void; icon: typeof Database; title: string; description: string; badge?: string; bullets: string[] }) {
  return <button type="button" onClick={onClick} className={`relative min-h-57 rounded-2xl border-2 p-5 text-left transition ${selected ? "border-violet-500 bg-violet-50/50 shadow-lg shadow-violet-600/8" : "border-slate-200 bg-white hover:border-slate-300"}`}><span className={`flex size-11 items-center justify-center rounded-xl ${selected ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500"}`}><Icon className="size-5" /></span>{badge && <span className="absolute right-4 top-4 rounded-full bg-violet-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-violet-700">{badge}</span>}<h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{description}</p><div className="mt-4 space-y-2">{bullets.map((item) => <span key={item} className="flex items-center gap-2 text-[11px] font-medium text-slate-600"><Check className="size-3.5 text-emerald-500" />{item}</span>)}</div></button>;
}
