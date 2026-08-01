import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Award,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ReadinessResponse = {
  id: string;
  test_type: "parent" | "student";
  respondent_type: string;
  respondent_name: string;
  respondent_email: string;
  language: string;
  score: number;
  result_label: string;
  profile: Record<string, unknown>;
  answers: unknown;
  result: Record<string, unknown>;
  status: "draft" | "completed";
  current_question: number;
  created_at: string;
  updated_at: string;
};

type CountDatum = { label: string; count: number; percentage: number };
type DimensionDatum = { key: string; label: string; average: number; response_count: number };
type Analytics = {
  summary: {
    total_started: number;
    completed: number;
    drafts: number;
    completion_rate: number;
    average_parent_score: number;
  };
  readiness_distribution: CountDatum[];
  respondent_distribution: CountDatum[];
  dimension_scores: DimensionDatum[];
  trend: { date: string; completed: number; average_score: number }[];
  strongest_dimension?: DimensionDatum;
  weakest_dimension?: DimensionDatum;
};

type AIInterpretation = {
  headline: string;
  summary: string;
  key_findings: string[];
  actions: string[];
  data_caution: string;
  generated_by: string;
  generated_at: string;
  cache_expires_at: string;
  cached: boolean;
};

const CHART_COLORS = ["#4f46e5", "#0f766e", "#d97706", "#e11d48", "#7c3aed"];
const AI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AI_CACHE_PREFIX = "kita-readiness-ai-v1";
const pendingAIRequests = new Map<string, Promise<AIInterpretation | null>>();

const readinessDimensionLabels: Record<string, string> = {
  psikologis: "Kesiapan psikologis",
  pedagogis: "Pendampingan & Pedagogis",
  pengetahuan: "Pengetahuan Homeschool",
  fasilitas: "Fasilitas & Finansial",
  tujuan: "Tujuan Homeschool",
  sosialisasi: "Sosialisasi Anak",
  literasi_baca: "Literasi Membaca",
  literasi_uang: "Literasi Keuangan",
  ai_income: "Pengetahuan & Pengalaman AI",
  network: "Jejaring Network",
  waktu: "Ketersediaan Waktu",
  finansial: "Kesiapan Finansial",
  lingkungan: "Lingkungan Belajar",
  dukungan: "Dukungan Keluarga",
  komitmen: "Komitmen Merchant",
  pemahaman: "Pemahaman Homeschooling",
  teknologi: "Kesiapan Teknologi",
};

type CachedAIInterpretation = {
  analyticsSignature: string;
  expiresAt: number;
  value: AIInterpretation;
};

const aiCacheKey = (testType: string, respondentType: string) => {
  const tenantID = import.meta.env.VITE_X_TENANT_ID || "default";
  return `${AI_CACHE_PREFIX}:${tenantID}:${testType}:${respondentType}`;
};

const readCachedInterpretation = (
  testType: string,
  respondentType: string,
  analyticsSnapshot: Analytics,
) => {
  try {
    const key = aiCacheKey(testType, respondentType);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedAIInterpretation;
    if (
      cached.expiresAt <= Date.now() ||
      cached.analyticsSignature !== JSON.stringify(analyticsSnapshot)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    return { ...cached.value, cached: true };
  } catch {
    return null;
  }
};

const writeCachedInterpretation = (
  testType: string,
  respondentType: string,
  analyticsSnapshot: Analytics,
  value: AIInterpretation,
) => {
  try {
    const backendExpiry = Date.parse(value.cache_expires_at);
    const expiresAt = Number.isFinite(backendExpiry)
      ? Math.min(backendExpiry, Date.now() + AI_CACHE_TTL_MS)
      : Date.now() + AI_CACHE_TTL_MS;
    const cached: CachedAIInterpretation = {
      analyticsSignature: JSON.stringify(analyticsSnapshot),
      expiresAt,
      value,
    };
    window.localStorage.setItem(
      aiCacheKey(testType, respondentType),
      JSON.stringify(cached),
    );
  } catch {
    // Storage may be disabled; the backend cache still prevents DeepSeek calls.
  }
};

function ReadinessResponsesPage() {
  const [rows, setRows] = useState<ReadinessResponse[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [interpretation, setInterpretation] = useState<AIInterpretation | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState("");
  const [search, setSearch] = useState("");
  const [testType, setTestType] = useState("all");
  const [respondentType, setRespondentType] = useState("all");
  const [selected, setSelected] = useState<ReadinessResponse | null>(null);
  const [total, setTotal] = useState(0);

  const filterParams = () => ({
    test_type: testType === "all" ? undefined : testType,
    respondent_type: respondentType === "all" ? undefined : respondentType,
  });

  const loadInterpretation = async (
    force = false,
    analyticsSnapshot: Analytics | null = analytics,
  ) => {
    if (!analyticsSnapshot?.summary?.total_started) return;
    if (!force) {
      const cached = readCachedInterpretation(
        testType,
        respondentType,
        analyticsSnapshot,
      );
      if (cached) {
        setInterpretation(cached);
        setAIError("");
        return;
      }
    }

    setAILoading(true);
    setAIError("");
    const requestKey = aiCacheKey(testType, respondentType);
    let request = !force ? pendingAIRequests.get(requestKey) : undefined;
    if (!request) {
      request = api
        .post(
          "/lms/admin/readiness-responses/interpretation",
          null,
          { params: filterParams() },
        )
        .then((response) => response.data?.data || null);
      if (!force) pendingAIRequests.set(requestKey, request);
    }
    try {
      const nextInterpretation = await request;
      setInterpretation(nextInterpretation);
      if (nextInterpretation) {
        writeCachedInterpretation(
          testType,
          respondentType,
          analyticsSnapshot,
          nextInterpretation,
        );
      }
    } catch (error: any) {
      setInterpretation(null);
      setAIError(error?.response?.data?.message || "Interpretasi AI belum dapat dibuat.");
    } finally {
      if (!force && pendingAIRequests.get(requestKey) === request) {
        pendingAIRequests.delete(requestKey);
      }
      setAILoading(false);
    }
  };

  const load = async (withAI = false) => {
    setLoading(true);
    try {
      const [listResponse, analyticsResponse] = await Promise.all([
        api.get("/lms/admin/readiness-responses", {
          params: {
            limit: 100,
            search: search || undefined,
            ...filterParams(),
          },
        }),
        api.get("/lms/admin/readiness-responses/analytics", { params: filterParams() }),
      ]);
      setRows(listResponse.data?.data || []);
      setTotal(listResponse.data?.pagination?.total || 0);
      const nextAnalytics = analyticsResponse.data?.data || null;
      if (nextAnalytics) {
        nextAnalytics.readiness_distribution = nextAnalytics.readiness_distribution || [];
        nextAnalytics.respondent_distribution = nextAnalytics.respondent_distribution || [];
        nextAnalytics.dimension_scores = nextAnalytics.dimension_scores || [];
        nextAnalytics.trend = nextAnalytics.trend || [];
      }
      setAnalytics(nextAnalytics);
      if (withAI && nextAnalytics?.summary?.total_started > 0) {
        void loadInterpretation(false, nextAnalytics);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setInterpretation(null);
    void load(true);
  }, [testType, respondentType]);

  const summary = analytics?.summary;
  const completedWidth = summary?.total_started
    ? (summary.completed / summary.total_started) * 100
    : 0;
  const trendData = (analytics?.trend || []).map((item) => ({
    ...item,
    label: item?.date ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(new Date(`${item.date}T00:00:00`)) : "",
  }));

  return (
    <div className="min-h-screen bg-[#f5f7fb] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2 text-indigo-600">
              <ClipboardList className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-[0.14em]">Readiness intelligence</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Data Tes Kesiapan</h1>
            <p className="mt-1 text-sm text-slate-500">
              Memahami kesiapan keluarga, titik hambatan, dan tindak lanjut yang paling relevan.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load(true)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Perbarui analisis
          </Button>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            label="Tes dimulai"
            value={summary?.total_started ?? 0}
            note={`${summary?.drafts ?? 0} masih berjalan`}
          />
          <MetricCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Completion rate"
            value={`${summary?.completion_rate ?? 0}%`}
            note={`${summary?.completed ?? 0} tes selesai`}
          />
          <MetricCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Rata-rata kesiapan"
            value={`${summary?.average_parent_score ?? 0}%`}
            note="Tes merchant yang selesai"
          />
          <MetricCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Prioritas dukungan"
            value={analytics?.weakest_dimension?.label || "Belum cukup data"}
            note={analytics?.weakest_dimension ? `${analytics.weakest_dimension.average}% rata-rata` : "Menunggu respons selesai"}
            compact
          />
        </div>

        {analytics && (
          <div className="mb-5 grid gap-5 xl:grid-cols-[1.05fr_1.6fr]">
            <Card className="overflow-hidden border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Perjalanan penyelesaian</CardTitle>
                <CardDescription>
                  Mengukur apakah responden berhasil menyelesaikan tes, bukan hanya membukanya.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl bg-slate-950 p-5 text-white">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Kesimpulan funnel</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {summary?.completion_rate ?? 0}% responden sampai ke hasil
                  </p>
                  <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-emerald-400 transition-all" style={{ width: `${completedWidth}%` }} />
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-slate-400">
                    <span>{summary?.completed ?? 0} selesai</span>
                    <span>{summary?.drafts ?? 0} belum selesai</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <SignalTile label="Dimensi terkuat" datum={analytics.strongest_dimension} tone="emerald" />
                  <SignalTile label="Perlu perhatian" datum={analytics.weakest_dimension} tone="amber" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Profil kesiapan per dimensi</CardTitle>
                <CardDescription>
                  Rata-rata skor tiap aspek. Batang terpendek menunjukkan area program yang perlu diperkuat.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[360px]">
                {analytics.dimension_scores?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...(analytics.dimension_scores || [])].reverse()} layout="vertical" margin={{ left: 18, right: 22 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis dataKey="label" type="category" width={142} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [`${value}%`, "Rata-rata"]} />
                      <Bar dataKey="average" fill="#4f46e5" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart text="Dimensi akan terlihat setelah tes merchant selesai." />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {analytics && (
          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Distribusi hasil kesiapan</CardTitle>
                <CardDescription>
                  Menunjukkan proporsi keluarga di setiap tingkat kesiapan untuk menentukan intensitas pendampingan.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[310px]">
                {analytics.readiness_distribution?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.readiness_distribution || []}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={62}
                        outerRadius={96}
                        paddingAngle={3}
                      >
                        {(analytics.readiness_distribution || []).map((item, index) => (
                          <Cell key={item.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, _name, item) => [`${value} respons (${item.payload.percentage}%)`, item.payload.label]} />
                      <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart text="Belum ada hasil selesai untuk didistribusikan." />
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Tren respons 30 hari aktif terakhir</CardTitle>
                <CardDescription>
                  Volume selesai dan rata-rata skor membantu membedakan pertumbuhan partisipasi dari perubahan kesiapan.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[310px]">
                {trendData?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ left: 0, right: 12, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="score" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line yAxisId="score" type="monotone" dataKey="average_score" name="Rata-rata skor" stroke="#4f46e5" strokeWidth={3} dot={{ r: 3 }} />
                      <Line yAxisId="count" type="monotone" dataKey="completed" name="Tes selesai" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart text="Tren akan terbentuk setelah ada tes selesai." />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mb-5 overflow-hidden border-indigo-200 bg-gradient-to-br from-indigo-950 to-slate-950 text-white">
          <CardHeader className="border-b border-white/10">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2 text-indigo-300">
                  <BrainCircuit className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-[0.14em]">DeepSeek interpretation</span>
                </div>
                <CardTitle className="mt-3 text-2xl text-white">
                  {interpretation?.headline || "Interpretasi analitik"}
                </CardTitle>
                <CardDescription className="mt-2 max-w-3xl text-slate-300">
                  {interpretation?.summary || "AI membaca agregat anonim dari grafik untuk menyusun temuan dan tindakan yang dapat dipertanggungjawabkan."}
                </CardDescription>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={aiLoading || !summary?.total_started}
                onClick={() => void loadInterpretation(true)}
              >
                {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {interpretation ? "Interpretasi ulang" : "Buat interpretasi"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {aiLoading ? (
              <div className="flex h-32 items-center justify-center text-sm text-indigo-200">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> DeepSeek sedang membaca pola data…
              </div>
            ) : aiError ? (
              <div className="flex items-start rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
                <AlertTriangle className="mr-3 mt-0.5 h-4 w-4 shrink-0" /> {aiError}
              </div>
            ) : interpretation ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <InterpretationList title="Temuan berbasis data" items={interpretation.key_findings} />
                <InterpretationList title="Tindakan yang disarankan" items={interpretation.actions} ordered />
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100 lg:col-span-2">
                  <p className="font-semibold">Batas interpretasi</p>
                  <p className="mt-1 leading-6 text-amber-100/80">{interpretation.data_caution}</p>
                </div>
                <p className="text-xs text-slate-500 lg:col-span-2">
                  {interpretation.cached ? "Menggunakan cache" : "Interpretasi baru"} · tersimpan sampai{" "}
                  {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(interpretation.cache_expires_at))}
                </p>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">Belum ada interpretasi AI untuk filter ini.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Respons terbaru</CardTitle>
            <CardDescription>
              {total} respons sesuai filter, termasuk draft yang tersimpan otomatis. Buka detail untuk melihat progres dan jawaban yang sudah masuk.
            </CardDescription>
            <div className="grid gap-3 pt-3 md:grid-cols-[1fr_220px_220px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Cari nama, email, atau hasil…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void load(false)}
                />
              </div>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua tes</SelectItem>
                  <SelectItem value="parent">Orang tua</SelectItem>
                  <SelectItem value="student">Anak</SelectItem>
                </SelectContent>
              </Select>
              <Select value={respondentType} onValueChange={setRespondentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua responden</SelectItem>
                  <SelectItem value="internal">Parent internal</SelectItem>
                  <SelectItem value="external">Parent external</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => void load(false)}>Cari</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-52 items-center justify-center text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat respons…
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Terakhir aktif</TableHead>
                      <TableHead>Responden</TableHead>
                      <TableHead>Tes</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Hasil</TableHead>
                      <TableHead>Skor</TableHead>
                      <TableHead className="text-right">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">
                          {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.updated_at || row.created_at))}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{row.respondent_name || "Tanpa nama"}</p>
                          <p className="text-xs text-slate-500">{row.respondent_email || "—"}</p>
                        </TableCell>
                        <TableCell><Badge variant="outline">{row.test_type === "parent" ? "Orang tua" : "Anak"}</Badge></TableCell>
                        <TableCell>
                          {row.status === "draft" ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                              Draft · {Math.min(row.current_question + 1, 23)}/23
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Selesai</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate font-medium">{row.result_label || "Belum selesai"}</TableCell>
                        <TableCell>{row.status === "completed" && row.test_type === "parent" ? `${row.score}%` : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => setSelected(row)}>
                            <Eye className="mr-2 h-4 w-4" /> Lihat
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!rows.length && (
                      <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-500">Belum ada respons yang sesuai filter.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] w-full w-screen max-w-6xl overflow-y-auto p-6 md:p-8">
          <DialogHeader className="no-print">
            <DialogTitle>Detail Hasil Tes Kesiapan</DialogTitle>
            <DialogDescription>
              Informasi lengkap profil responden, skor kesiapan, breakdown per dimensi, dan jawaban tersimpan.
            </DialogDescription>
          </DialogHeader>
          {selected && <HumanReadableReadinessDetail response={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HumanReadableReadinessDetail({ response }: { response: ReadinessResponse }) {
  const [showRawJson, setShowRawJson] = useState(false);

  const profile = (response.profile || {}) as Record<string, any>;
  const result = (response.result || {}) as Record<string, any>;
  
  const score = response.score ?? result.score ?? 0;
  const resultLabel = response.result_label || result.result_label || result.tier || "Belum diklasifikasikan";
  
  const dimensionScores: Record<string, number> = result.dimension_scores || {};
  const dimensionEntries = Object.entries(dimensionScores);

  const answersList = Array.isArray(response.answers) ? response.answers : [];

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const text = `Detail Hasil Tes Kesiapan Homeschooling: ${response.respondent_name || "Tanpa Nama"} (${score}% - ${resultLabel}).`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Hasil Tes Kesiapan Homeschooling",
          text,
          url: window.location.href,
        });
      } catch {
        // Share canceled
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Ringkasan hasil tes disalin ke clipboard!");
    }
  };

  return (
    <div id="printable-readiness-detail" className="space-y-6">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-readiness-detail, #printable-readiness-detail * {
            visibility: visible;
          }
          #printable-readiness-detail {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Banner & Action Buttons */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-400/30">
              {response.test_type === "parent" ? "Tes Merchant" : "Tes Anak"}
            </Badge>
            <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30">
              {response.respondent_type === "internal" ? "Merchant KITA" : "Eksternal / Umum"}
            </Badge>
            <Badge variant="outline" className={response.status === "completed" ? "border-emerald-400 text-emerald-300" : "border-amber-400 text-amber-300"}>
              {response.status === "completed" ? "Selesai" : "Draft (Dalam Proses)"}
            </Badge>
          </div>
          <h2 className="mt-3 text-2xl font-bold text-white">
            {response.respondent_name || profile.name || "Tanpa Nama"}
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            {response.respondent_email || profile.email || "Tanpa Email"} · Disubmit: {new Date(response.created_at).toLocaleString("id-ID")}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 no-print">
          <Button
            size="sm"
            variant="secondary"
            className="gap-2 bg-white/10 text-white hover:bg-white/20 border-white/10 cursor-pointer"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" /> Cetak / PDF
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="gap-2 bg-indigo-600 text-white hover:bg-indigo-500 border-transparent cursor-pointer"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" /> Bagikan
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Score Card */}
        <Card className="border-indigo-100 bg-indigo-50/50">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Skor Kesiapan Total</span>
            <div className="my-3 flex h-24 w-24 items-center justify-center rounded-full border-4 border-indigo-500 bg-white text-3xl font-extrabold text-indigo-950 shadow-sm">
              {score}%
            </div>
            <Badge className="bg-indigo-600 text-white text-xs px-3 py-1">
              {resultLabel}
            </Badge>
          </CardContent>
        </Card>

        {/* Profile Card */}
        <Card className="md:col-span-2 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-indigo-600" /> Profil Responden
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-xs leading-5">
            <div>
              <span className="block font-medium text-slate-400">Nama Lengkap</span>
              <span className="font-semibold text-slate-900">{profile.name || response.respondent_name || "-"}</span>
            </div>
            <div>
              <span className="block font-medium text-slate-400">Alamat Email</span>
              <span className="font-semibold text-slate-900">{profile.email || response.respondent_email || "-"}</span>
            </div>
            <div>
              <span className="block font-medium text-slate-400">Peran Pendamping</span>
              <span className="font-semibold text-slate-900">{profile.caregiver || profile.peran || "-"}</span>
            </div>
            <div>
              <span className="block font-medium text-slate-400">Pekerjaan</span>
              <span className="font-semibold text-slate-900">{profile.job || profile.pekerjaan || "-"}</span>
            </div>
            <div>
              <span className="block font-medium text-slate-400">Usia Anak</span>
              <span className="font-semibold text-slate-900">{profile.childAge || profile.usia_anak || "-"}</span>
            </div>
            <div>
              <span className="block font-medium text-slate-400">Bahasa</span>
              <span className="font-semibold uppercase text-slate-900">{response.language || "ID"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dimension Breakdown */}
      {dimensionEntries.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Award className="h-4 w-4 text-indigo-600" /> Breakdown Skor Per Dimensi
            </CardTitle>
            <CardDescription className="text-xs">
              Nilai persentase kesiapan pada masing-masing kriteria evaluasi
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {dimensionEntries.map(([dimKey, dimVal]) => {
              const label = readinessDimensionLabels[dimKey] || dimKey;
              const valNum = typeof dimVal === "number" ? dimVal : Number(dimVal) || 0;
              return (
                <div key={dimKey} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span>{label}</span>
                    <span className="text-indigo-600">{valNum}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full transition-all duration-300 ${
                        valNum >= 75 ? "bg-emerald-500" : valNum >= 50 ? "bg-indigo-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, valNum))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Stored Answers Section */}
      {answersList.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-600" /> Jawaban Kuisioner (Total {answersList.length} Soal)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 max-h-[30rem] overflow-y-auto">
              {answersList.map((ansItem: any, idx: number) => {
                const questionText = ansItem?.question_text || ansItem?.question || `Pertanyaan #${idx + 1}`;
                const chosenOption = ansItem?.selected_option || ansItem?.answer || ansItem?.option || (typeof ansItem === "object" ? JSON.stringify(ansItem) : String(ansItem));
                const itemScore = ansItem?.score ?? ansItem?.value;
                const dimensionName = ansItem?.dimension || ansItem?.dim;

                return (
                  <div key={idx} className="p-4 hover:bg-slate-50/80 transition-colors text-xs leading-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="font-semibold text-slate-900">
                          {idx + 1}. {questionText}
                        </span>
                        {dimensionName && (
                          <Badge variant="outline" className="ml-2 text-[10px] text-slate-500">
                            {readinessDimensionLabels[dimensionName] || dimensionName}
                          </Badge>
                        )}
                        <p className="mt-1 font-medium text-indigo-700 bg-indigo-50/80 rounded px-2 py-1 inline-block">
                          Jawaban: {chosenOption}
                        </p>
                      </div>
                      {itemScore !== undefined && (
                        <Badge className="shrink-0 bg-slate-900 text-white font-mono text-[11px]">
                          Skor: +{itemScore}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw JSON Debugging Accordion */}
      <div className="no-print border-t pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-slate-500 hover:text-slate-900 gap-2 cursor-pointer"
          onClick={() => setShowRawJson(!showRawJson)}
        >
          <FileText className="h-3.5 w-3.5" />
          {showRawJson ? "Sembunyikan Raw JSON" : "Lihat Raw JSON Data (Objek Mentah)"}
          {showRawJson ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
        {showRawJson && (
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <JsonSection title="Profil JSON" value={response.profile} />
            <JsonSection title="Result JSON" value={response.result} />
            <JsonSection title="Answers JSON" value={response.answers} />
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note,
  compact = false,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  note: string;
  compact?: boolean;
}) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
          <span className="text-indigo-600">{icon}</span> {label}
        </div>
        <p className={`mt-3 font-bold tracking-tight text-slate-950 ${compact ? "line-clamp-2 text-lg leading-6" : "text-3xl"}`}>{value}</p>
        <p className="mt-1 text-xs text-slate-500">{note}</p>
      </CardContent>
    </Card>
  );
}

function SignalTile({ label, datum, tone }: { label: string; datum?: DimensionDatum; tone: "emerald" | "amber" }) {
  const toneClass = tone === "emerald" ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950";
  return (
    <div className={`rounded-xl p-4 ${toneClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-60">{label}</p>
      <p className="mt-1 text-sm font-semibold">{datum?.label || "Belum cukup data"}</p>
      {datum && <p className="mt-1 text-xs opacity-70">{datum.average}% rata-rata</p>}
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">{text}</div>;
}

function InterpretationList({ title, items, ordered = false }: { title: string; items?: string[]; ordered?: boolean }) {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <section>
      <h3 className="text-sm font-semibold text-indigo-200">{title}</h3>
      <div className="mt-3 space-y-3">
        {safeItems.map((item, index) => (
          <div key={`${title}-${index}`} className="flex gap-3 text-sm leading-6 text-slate-200">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
              {ordered ? index + 1 : "•"}
            </span>
            <p>{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      <pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

export default DashboardLayout(ReadinessResponsesPage);
