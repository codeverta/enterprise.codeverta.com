import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Expand,
  ImageOff,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

type AIImageStatus =
  | "reserved"
  | "generated"
  | "approved"
  | "rejected"
  | "provider_failed"
  | "storage_failed";

interface AIImageQuota {
  used: number;
  limit: number;
  remaining: number;
  resets_at: string;
}

interface AIImageGeneration {
  id: string;
  image_url: string;
  status: AIImageStatus;
  prompt: string;
  style: string;
  include_text: boolean;
  quota: AIImageQuota;
  style_suggestions?: string[];
}

interface CourseCoverContext {
  title: string;
  short_description: string;
  course_category_id: string;
  level: string;
  age_range: string;
}

interface AICourseCoverGeneratorProps {
  context: CourseCoverContext;
  disabled?: boolean;
  onNeedContext: () => void;
  onUseImage: (url: string) => void;
}

const emptyQuota: AIImageQuota = {
  used: 0,
  limit: 20,
  remaining: 20,
  resets_at: "",
};

export const aiCoverDraftStorageKey = "lms-ai-course-cover-review";

function currentAIActorScope() {
  let userID = "";
  try {
    userID = JSON.parse(localStorage.getItem("user") || "{}")?.id || "";
  } catch {
    userID = "";
  }
  return JSON.stringify({
    user_id: userID,
    tenant_id: import.meta.env.VITE_X_TENANT_ID || "",
  });
}

export function hasPendingAICourseCoverReview() {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(aiCoverDraftStorageKey) || "null"
    );
    return (
      value?.actor_scope === currentAIActorScope() &&
      value?.generation?.id &&
      value.generation.status !== "approved"
    );
  } catch {
    sessionStorage.removeItem(aiCoverDraftStorageKey);
    return false;
  }
}

const requiredContext: Array<{
  key: keyof CourseCoverContext;
  label: string;
}> = [
  { key: "title", label: "Judul" },
  { key: "short_description", label: "Deskripsi singkat" },
  { key: "course_category_id", label: "Kategori" },
  { key: "level", label: "Level" },
  { key: "age_range", label: "Rentang usia" },
];

const processingPhrases = [
  { text: "Menunggu proses…", language: "Bahasa Indonesia" },
  { text: "Processing…", language: "English" },
  { text: "処理中です…", language: "日本語" },
  { text: "Traitement en cours…", language: "Français" },
  { text: "Procesando…", language: "Español" },
  { text: "처리 중입니다…", language: "한국어" },
  { text: "جارٍ المعالجة…", language: "العربية" },
];

function getAPIMessage(error: any, fallback: string) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}

export default function AICourseCoverGenerator({
  context,
  disabled = false,
  onNeedContext,
  onUseImage,
}: AICourseCoverGeneratorProps) {
  const actorScope = currentAIActorScope();
  const contextFingerprint = JSON.stringify(context);
  const storedDraft = useMemo(() => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem(aiCoverDraftStorageKey) || "null"
      );
      if (
        value?.actor_scope === actorScope &&
        value?.generation?.id &&
        value.generation.status !== "approved"
      ) {
        return value as {
          actor_scope: string;
          context_fingerprint: string;
          generation: AIImageGeneration;
        };
      }
    } catch {
      sessionStorage.removeItem(aiCoverDraftStorageKey);
    }
    return null;
    // Read only when this proofing surface is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [generation, setGeneration] = useState<AIImageGeneration | null>(
    storedDraft?.generation || null
  );
  const [generationContextFingerprint, setGenerationContextFingerprint] =
    useState(storedDraft?.context_fingerprint || "");
  const [quota, setQuota] = useState<AIImageQuota>(
    storedDraft?.generation?.quota || emptyQuota
  );
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [style, setStyle] = useState(storedDraft?.generation?.style || "");
  const [includeText, setIncludeText] = useState(
    storedDraft?.generation?.include_text || false
  );
  const [generating, setGenerating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const missingFields = useMemo(
    () =>
      requiredContext
        .filter(({ key }) => !String(context[key] || "").trim())
        .map(({ label }) => label),
    [context]
  );

  const quotaPercentage = quota.limit
    ? Math.min(100, (quota.used / quota.limit) * 100)
    : 0;
  const isBusy = disabled || generating || updatingStatus;
  const isPending = generation?.status === "reserved";
  const isFailed =
    generation?.status === "provider_failed" ||
    generation?.status === "storage_failed";
  const quotaExhausted = !quotaLoading && quota.remaining <= 0;
  const contextChanged =
    Boolean(generationContextFingerprint) &&
    generationContextFingerprint !== contextFingerprint;

  useEffect(() => {
    let active = true;
    setQuotaLoading(true);
    api
      .get("/lms/admin/ai/course-cover/quota")
      .then((response) => {
        if (active && response.data?.data) {
          setQuota(response.data.data);
        }
      })
      .catch((error) => {
        if (active) {
          toast.error(getAPIMessage(error, "Gagal memuat quota gambar AI"));
        }
      })
      .finally(() => {
        if (active) setQuotaLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isPending) {
      setPhraseIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % processingPhrases.length);
    }, 2200);
    return () => window.clearInterval(interval);
  }, [isPending]);

  useEffect(() => {
    if (!generation?.id || generation.status !== "reserved") return;

    let stopped = false;
    let timer: number | undefined;
    let attempt = 0;
    let inFlight = false;

    const schedule = (delay: number) => {
      if (stopped) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(poll, delay);
    };

    const poll = async () => {
      if (stopped || inFlight) return;
      if (document.hidden) {
        schedule(5000);
        return;
      }
      inFlight = true;
      try {
        const response = await api.get(
          `/lms/admin/ai/course-cover/${generation.id}`
        );
        const updated = response.data?.data as AIImageGeneration;
        if (!updated?.id) throw new Error("Status generation tidak valid");

        const merged = {
          ...generation,
          ...updated,
          style_suggestions: generation.style_suggestions,
        };
        setGeneration(merged);
        if (updated.quota) setQuota(updated.quota);
        if (typeof updated.include_text === "boolean") {
          setIncludeText(updated.include_text);
        }
        sessionStorage.setItem(
          aiCoverDraftStorageKey,
          JSON.stringify({
            actor_scope: actorScope,
            context_fingerprint: generationContextFingerprint,
            generation: merged,
          })
        );

        if (updated.status === "reserved") {
          attempt += 1;
          schedule(Math.min(6000, 1800 + attempt * 700));
        } else if (updated.status === "generated") {
          setImageFailed(false);
          toast.success("Cover AI selesai dan siap ditinjau");
        } else if (
          updated.status === "provider_failed" ||
          updated.status === "storage_failed"
        ) {
          toast.error(
            updated.status === "storage_failed"
              ? "Gambar selesai dibuat, tetapi gagal disimpan"
              : "OpenAI gagal membuat gambar. Silakan coba lagi."
          );
        }
      } catch (error) {
        attempt += 1;
        if (error?.response?.status === 404) {
          sessionStorage.removeItem(aiCoverDraftStorageKey);
          setGeneration(null);
          toast.error("Proses gambar tidak ditemukan");
          return;
        }
        schedule(Math.min(10000, 3000 + attempt * 1000));
      } finally {
        inFlight = false;
      }
    };

    const handleVisibility = () => {
      if (!document.hidden && !inFlight) schedule(250);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    schedule(1200);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [
    actorScope,
    generation?.id,
    generation?.status,
    generationContextFingerprint,
  ]);

  const syncQuotaFromError = (error: any) => {
    const nextQuota = error?.response?.data?.error?.quota;
    if (nextQuota) setQuota(nextQuota);
  };

  const generateImage = async () => {
    if (missingFields.length > 0) {
      onNeedContext();
      toast.error(`Lengkapi dahulu: ${missingFields.join(", ")}`);
      return;
    }
    if (quotaExhausted) {
      toast.error("Quota generate gambar AI hari ini sudah habis");
      return;
    }

    setGenerating(true);
    setImageFailed(false);
    const toastId = toast.loading(
      generation ? "Membuat versi baru..." : "Membuat cover course..."
    );
    try {
      const response = await api.post("/lms/admin/ai/course-cover/generate", {
        ...context,
        style: style.trim(),
        include_text: includeText,
        replaces_generation_id:
          generation?.status !== "approved" ? generation?.id || "" : "",
      });
      const nextGeneration = response.data?.data as AIImageGeneration;
      if (!nextGeneration?.id) {
        throw new Error("ID proses gambar tidak ditemukan");
      }
      setGeneration(nextGeneration);
      setGenerationContextFingerprint(contextFingerprint);
      setQuota(nextGeneration.quota);
      setStyle(nextGeneration.style || style);
      setIncludeText(nextGeneration.include_text ?? includeText);
      sessionStorage.setItem(
        aiCoverDraftStorageKey,
        JSON.stringify({
          actor_scope: actorScope,
          context_fingerprint: contextFingerprint,
          generation: nextGeneration,
        })
      );
      toast.success("Proses generate dimulai", { id: toastId });
    } catch (error) {
      syncQuotaFromError(error);
      toast.error(getAPIMessage(error, "Gagal generate cover AI"), {
        id: toastId,
      });
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (target: "approve" | "reject") => {
    if (!generation) return;
    setUpdatingStatus(true);
    const approving = target === "approve";
    const toastId = toast.loading(
      approving ? "Menyetujui cover..." : "Menolak cover..."
    );
    try {
      const response = await api.post(
        `/lms/admin/ai/course-cover/${generation.id}/${target}`
      );
      const updated = response.data?.data as AIImageGeneration;
      setGeneration((current) =>
        current
          ? {
              ...current,
              ...updated,
              style_suggestions: current.style_suggestions,
            }
          : current
      );
      if (updated?.quota) setQuota(updated.quota);
      if (approving) {
        sessionStorage.removeItem(aiCoverDraftStorageKey);
        onUseImage(updated.image_url || generation.image_url);
        toast.success(
          "Cover disetujui dan dipakai. Simpan course untuk menerapkannya.",
          { id: toastId }
        );
      } else {
        sessionStorage.setItem(
          aiCoverDraftStorageKey,
          JSON.stringify({
            actor_scope: actorScope,
            context_fingerprint: generationContextFingerprint,
            generation: {
              ...generation,
              ...updated,
              style_suggestions: generation.style_suggestions,
            },
          })
        );
        toast.success("Cover ditolak. Pilih style lalu generate ulang.", {
          id: toastId,
        });
      }
    } catch (error) {
      syncQuotaFromError(error);
      toast.error(
        getAPIMessage(
          error,
          approving ? "Gagal menyetujui cover" : "Gagal menolak cover"
        ),
        { id: toastId }
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const resetAtLabel = quota.resets_at
    ? new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date(quota.resets_at))
    : "00.00 WIB";

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-violet-200 bg-violet-50/40">
        <div className="flex flex-col gap-3 border-b border-violet-100 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900">
                  Generate cover dengan AI
                </h4>
                <Badge
                  variant="outline"
                  className="border-violet-200 bg-violet-50 text-violet-700"
                >
                  Admin only
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Konteks course diringkas otomatis menjadi prompt pendek.
              </p>
            </div>
          </div>

          <div className="min-w-44 rounded-lg border bg-white px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">Quota hari ini</span>
              <span className="tabular-nums text-muted-foreground">
                {quotaLoading ? "Memuat..." : `${quota.used}/${quota.limit}`}
              </span>
            </div>
            <Progress
              value={quotaPercentage}
              className="h-1.5 bg-violet-100"
              indicatorClassName={cn(
                "bg-violet-600",
                quota.remaining <= 3 && "bg-amber-500",
                quota.remaining === 0 && "bg-red-500"
              )}
            />
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              Reset {resetAtLabel}
            </p>
          </div>
        </div>

        <div className="p-4">
          {!generation ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.7fr)_auto] lg:items-center">
              <div>
                {missingFields.length > 0 ? (
                  <>
                    <p className="text-xs font-semibold text-amber-700">
                      Konteks belum lengkap
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Isi {missingFields.join(", ")} agar gambar sesuai isi dan
                      usia peserta course.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-emerald-700">
                      Konteks siap
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Satu gambar memakai satu quota. Proses dapat berlangsung
                      hingga dua menit.
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-violet-100 bg-white px-3 py-2.5">
                <div>
                  <Label
                    htmlFor="ai-cover-include-text"
                    className="cursor-pointer text-xs font-semibold text-slate-800"
                  >
                    Tampilkan judul pada cover
                  </Label>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    AI akan menulis judul course di dalam gambar.
                  </p>
                </div>
                <Switch
                  id="ai-cover-include-text"
                  checked={includeText}
                  onCheckedChange={setIncludeText}
                  disabled={isBusy}
                  aria-label="Tampilkan judul course pada cover"
                />
              </div>
              <Button
                type="button"
                onClick={generateImage}
                disabled={
                  isBusy ||
                  quotaLoading ||
                  quotaExhausted
                }
                className="bg-violet-600 hover:bg-violet-700"
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {quotaExhausted
                  ? "Quota habis"
                  : missingFields.length > 0
                    ? "Lengkapi konteks"
                    : "Generate cover"}
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
              <div className="space-y-3">
                {isPending ? (
                  <div
                    className="relative aspect-[3/2] overflow-hidden rounded-xl border border-violet-200 bg-white"
                    aria-live="polite"
                    aria-label="Gambar AI sedang diproses"
                  >
                    <div className="absolute inset-0 animate-pulse space-y-4 p-5">
                      <div className="h-3 w-24 rounded-full bg-violet-100" />
                      <div className="h-[58%] rounded-xl bg-gradient-to-r from-slate-100 via-violet-100 to-slate-100" />
                      <div className="h-3 w-3/4 rounded-full bg-slate-100" />
                      <div className="h-3 w-1/2 rounded-full bg-slate-100" />
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/45 backdrop-blur-[1px]">
                      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-violet-200 bg-white text-violet-600 shadow-sm">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </span>
                      <p
                        key={phraseIndex}
                        className="animate-in fade-in slide-in-from-bottom-1 text-sm font-semibold text-slate-800 duration-300"
                        dir={
                          processingPhrases[phraseIndex].language === "العربية"
                            ? "rtl"
                            : "ltr"
                        }
                      >
                        {processingPhrases[phraseIndex].text}
                      </p>
                    </div>
                  </div>
                ) : !isFailed ? (
                  <button
                    type="button"
                    onClick={() => !imageFailed && setPreviewOpen(true)}
                    className="group relative block aspect-[3/2] w-full overflow-hidden rounded-xl border bg-slate-100 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                    aria-label="Buka preview cover AI"
                  >
                  {!imageFailed ? (
                    <img
                      src={generation.image_url}
                      alt="Preview cover course hasil AI"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                      onError={() => setImageFailed(true)}
                    />
                  ) : (
                    <span className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                      <ImageOff className="h-6 w-6" />
                      Preview gagal dimuat
                    </span>
                  )}

                  {generating && (
                    <span className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 text-white">
                      <Loader2 className="mb-2 h-6 w-6 animate-spin" />
                      <span className="text-xs font-semibold">
                        Membuat versi baru…
                      </span>
                    </span>
                  )}

                  {!generating && !imageFailed && (
                    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-slate-950/70 px-2 py-1 text-[10px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Expand className="h-3 w-3" />
                      Preview
                    </span>
                  )}
                  </button>
                ) : (
                  <div className="flex aspect-[3/2] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 text-center">
                    <ImageOff className="mb-3 h-7 w-7 text-red-500" />
                    <p className="text-sm font-semibold text-red-800">
                      Proses gambar gagal
                    </p>
                    <p className="mt-1 text-xs text-red-700/80">
                      {generation.status === "storage_failed"
                        ? "Gambar dibuat, tetapi storage tidak dapat menyimpannya."
                        : "Provider tidak menyelesaikan generation ini."}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      generation.status === "generated" &&
                        "border-amber-200 bg-amber-50 text-amber-700",
                      generation.status === "reserved" &&
                        "border-violet-200 bg-violet-50 text-violet-700",
                      generation.status === "approved" &&
                        "border-emerald-200 bg-emerald-50 text-emerald-700",
                      generation.status === "rejected" &&
                        "border-red-200 bg-red-50 text-red-700",
                      isFailed && "border-red-200 bg-red-50 text-red-700"
                    )}
                  >
                    {generation.status === "reserved" && "Sedang diproses"}
                    {generation.status === "generated" && "Menunggu keputusan"}
                    {generation.status === "approved" && "Disetujui & dipakai"}
                    {generation.status === "rejected" && "Ditolak"}
                    {isFailed && "Gagal"}
                  </Badge>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    Prompt {generation.prompt.length} karakter
                  </span>
                </div>
                {contextChanged && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                    Data course berubah setelah gambar ini dibuat. Generate
                    ulang untuk menyesuaikan konteks terbaru, atau approve jika
                    gambar ini tetap sesuai.
                  </p>
                )}
                <p className="rounded-lg border bg-white px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  {generation.prompt}
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {isPending && (
                  <div
                    className="space-y-4"
                    aria-hidden="true"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-36 bg-violet-100" />
                      <Skeleton className="h-2.5 w-full bg-slate-100" />
                      <Skeleton className="h-2.5 w-4/5 bg-slate-100" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-7 w-28 rounded-full bg-violet-100/80" />
                      <Skeleton className="h-7 w-36 rounded-full bg-slate-100" />
                      <Skeleton className="h-7 w-24 rounded-full bg-slate-100" />
                    </div>
                    <Skeleton className="h-10 w-full bg-slate-100" />
                  </div>
                )}

                {(generation.status === "generated" ||
                  generation.status === "rejected" ||
                  isFailed) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4 rounded-lg border bg-white px-3 py-2.5">
                      <div>
                        <Label
                          htmlFor="ai-cover-regenerate-include-text"
                          className="cursor-pointer text-xs font-semibold text-slate-800"
                        >
                          Tampilkan judul pada cover
                        </Label>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Berlaku untuk versi berikutnya.
                        </p>
                      </div>
                      <Switch
                        id="ai-cover-regenerate-include-text"
                        checked={includeText}
                        onCheckedChange={setIncludeText}
                        disabled={isBusy}
                        aria-label="Tampilkan judul course pada cover berikutnya"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Style untuk versi berikutnya</Label>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Pilih saran atau tulis singkat dengan kata-katamu sendiri.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(generation.style_suggestions || []).map((suggestion) => (
                        <button
                          type="button"
                          key={suggestion}
                          onClick={() => setStyle(suggestion)}
                          disabled={isBusy}
                          className={cn(
                            "rounded-full border bg-white px-2.5 py-1 text-left text-[10px] leading-snug text-slate-600 transition-colors hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                            style === suggestion &&
                              "border-violet-400 bg-violet-50 text-violet-700"
                          )}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <Input
                        value={style}
                        onChange={(event) => setStyle(event.target.value)}
                        maxLength={80}
                        placeholder="Contoh: watercolor lembut, warna pastel"
                        disabled={isBusy}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Kosongkan untuk style default</span>
                        <span>{style.length}/80</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-auto grid gap-2">
                  {isPending && (
                    <>
                      <div className="grid grid-cols-2 gap-2" aria-hidden="true">
                        <Skeleton className="h-10 w-full bg-violet-100" />
                        <Skeleton className="h-10 w-full bg-slate-100" />
                      </div>
                      <Skeleton
                        className="h-10 w-full bg-slate-100"
                        aria-hidden="true"
                      />
                    </>
                  )}

                  {generation.status === "generated" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        onClick={() => updateStatus("approve")}
                        disabled={isBusy}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {updatingStatus ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Approve & pakai
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => updateStatus("reject")}
                        disabled={isBusy}
                        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {(generation.status === "generated" ||
                    generation.status === "rejected" ||
                    isFailed) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generateImage}
                      disabled={isBusy || quotaExhausted}
                    >
                      {generating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      {quotaExhausted
                        ? "Quota habis"
                        : isFailed
                          ? "Coba generate lagi"
                          : "Generate ulang"}
                    </Button>
                  )}

                  {generation.status === "approved" && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                      Cover sudah masuk ke form. Klik{" "}
                      <span className="font-semibold">Simpan course</span> untuk
                      menerapkan perubahan.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>Preview cover AI</DialogTitle>
            <DialogDescription>
              Tampilan penuh sebelum gambar disetujui dan dipakai.
            </DialogDescription>
          </DialogHeader>
          {generation && (
            <div className="bg-slate-950 p-3 sm:p-6">
              <img
                src={generation.image_url}
                alt="Preview penuh cover course hasil AI"
                className="mx-auto max-h-[72vh] w-auto rounded-lg object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
