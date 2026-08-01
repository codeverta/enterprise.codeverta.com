import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import dayjs from "dayjs";
import { useLanguage } from "@/context/LanguageContext";
import {
  Loader2,
  Search,
  RefreshCw,
  GraduationCap,
  BookOpen,
  FileCheck,
  Calendar,
  Award,
  ChevronRight,
  TrendingUp,
  Download,
  Printer,
} from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/layout/DashboardLayout";
import { toast } from "sonner";
import { cn } from "@/lib/utils"

const getData = (response: any) => response.data?.data || response.data || {};
const formatDate = (value?: string | null) =>
  value ? dayjs(value).format("DD MMM YYYY") : "-";
const formatDateTime = (value?: string | null) =>
  value ? dayjs(value).format("DD MMM YYYY, HH:mm") : "Belum ada aktivitas";

function initials(name?: string) {
  return String(name || "Student")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StatCard({ label, value, icon: Icon, description }: any) {
  return (
    <Card className="shadow-xs border border-zinc-200">
      <CardContent className="p-5 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-zinc-900">{value}</p>
          {description && <p className="text-[10px] text-zinc-400">{description}</p>}
        </div>
        <div className="h-10 w-10 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-600 shrink-0">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function StudentProgressPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [onlineFilter, setOnlineFilter] = useState("all");
  const [progressMin, setProgressMin] = useState("");
  const [progressMax, setProgressMax] = useState("");
  const [debouncedProgressMin, setDebouncedProgressMin] = useState("");
  const [debouncedProgressMax, setDebouncedProgressMax] = useState("");
  const [lastActiveFrom, setLastActiveFrom] = useState("");
  const [lastActiveTo, setLastActiveTo] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const nextOffsetRef = useRef(0);
  const filterKeyRef = useRef("");
  const requestedMoreRef = useRef<Set<string>>(new Set());
  const loadMoreCallbackRef = useRef<(force?: boolean) => void>(() => undefined);

  useEffect(() => {
    dayjs.locale(language);
  }, [language]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProgressMin(progressMin);
      setDebouncedProgressMax(progressMax);
    }, 450);
    return () => clearTimeout(handler);
  }, [progressMin, progressMax]);

  const activeFilterKey = useMemo(() => JSON.stringify({
    search: debouncedSearch,
    status: statusFilter,
    plan: planFilter,
    online: onlineFilter,
    progressMin: debouncedProgressMin,
    progressMax: debouncedProgressMax,
    lastActiveFrom,
    lastActiveTo,
    sortBy,
    sortOrder,
  }), [
    debouncedSearch,
    statusFilter,
    planFilter,
    onlineFilter,
    debouncedProgressMin,
    debouncedProgressMax,
    lastActiveFrom,
    lastActiveTo,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    loadingRef.current = loading;
    loadingMoreRef.current = loadingMore;
    hasMoreRef.current = hasMore;
    nextOffsetRef.current = nextOffset;
    filterKeyRef.current = activeFilterKey;
  }, [loading, loadingMore, hasMore, nextOffset, activeFilterKey]);

  const load = useCallback(async (isNew = true, offsetValue = 0, force = false) => {
    const requestFilterKey = activeFilterKey;
    const requestKey = `${requestFilterKey}:${offsetValue}`;

    if (!isNew) {
      if (loadingRef.current || loadingMoreRef.current || !hasMoreRef.current || (!force && requestedMoreRef.current.has(requestKey))) {
        return;
      }
      requestedMoreRef.current.add(requestKey);
    }

    if (isNew) {
      loadingRef.current = true;
      requestedMoreRef.current.clear();
      setLoading(true);
      setStudents([]);
      hasMoreRef.current = false;
      nextOffsetRef.current = 0;
      setHasMore(false);
      setNextOffset(0);
    } else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    try {
      const params: any = {
        limit: 10,
        offset: isNew ? 0 : offsetValue,
        search: debouncedSearch,
        status: statusFilter,
        plan_id: planFilter,
        online: onlineFilter,
        progress_min: debouncedProgressMin,
        progress_max: debouncedProgressMax,
        last_active_from: lastActiveFrom,
        last_active_to: lastActiveTo,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      const res = await api.get("/lms/mentor/students-progress", { params });
      const data = getData(res);

      if (filterKeyRef.current !== requestFilterKey) {
        return;
      }

      if (isNew) {
        setStudents(data.students || []);
      } else {
        setStudents((prev) => {
          const seen = new Set(prev.map((student) => student.id));
          const next = (data.students || []).filter((student: any) => !seen.has(student.id));
          return [...prev, ...next];
        });
      }

      setDbCategories(data.categories || []);
      setPlans(data.plans || []);
      setTotal(data.total || 0);
      const nextHasMore = Boolean(data.has_more);
      const nextOffsetValue = Number(data.next_offset || 0);
      hasMoreRef.current = nextHasMore;
      nextOffsetRef.current = nextOffsetValue;
      setHasMore(nextHasMore);
      setNextOffset(nextOffsetValue);
    } catch (err) {
      console.error(err);
    } finally {
      if (filterKeyRef.current === requestFilterKey) {
        if (isNew) {
          loadingRef.current = false;
        } else {
          loadingMoreRef.current = false;
        }
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [
    activeFilterKey,
    debouncedSearch,
    statusFilter,
    planFilter,
    onlineFilter,
    debouncedProgressMin,
    debouncedProgressMax,
    lastActiveFrom,
    lastActiveTo,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    load(true);
  }, [load]);

  const handleLoadMore = useCallback((force = false) => {
    const offset = nextOffsetRef.current;
    const requestKey = `${filterKeyRef.current}:${offset}`;
    if (!loadingRef.current && !loadingMoreRef.current && hasMoreRef.current && (force || !requestedMoreRef.current.has(requestKey))) {
      load(false, offset, force);
    }
  }, [load]);

  useEffect(() => {
    loadMoreCallbackRef.current = handleLoadMore;
  }, [handleLoadMore]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreCallbackRef.current(false);
        }
      },
      { rootMargin: "80px", threshold: 0.1 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

  const categories = useMemo(() => {
    if (dbCategories.length > 0) {
      return dbCategories.map((c) => c.name);
    }
    const set = new Set<string>();
    students.forEach((s) => {
      s.course_progress_details?.forEach((d: any) => {
        if (d.category_name) set.add(d.category_name);
      });
    });
    const defaultList = ["Science", "Math", "Language", "Social Studies", "Future-Readiness", "Elective"];
    const list = Array.from(set);
    if (list.length === 0) return defaultList;
    list.sort((a, b) => {
      const idxA = defaultList.indexOf(a);
      const idxB = defaultList.indexOf(b);
      if (idxA === -1 && idxB === -1) return a.localeCompare(b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
    return list;
  }, [students, dbCategories]);

  const displayCategories = useMemo(() => {
    return categories.slice(0, 5);
  }, [categories]);

  const summary = useMemo(() => {
    if (students.length === 0) return { avgProgress: 0, completedCourses: 0, activeSubs: 0 };
    const progressSum = students.reduce((sum, s) => sum + (s.average_progress_percentage || 0), 0);
    const completedCoursesSum = students.reduce((sum, s) => sum + (s.courses_completed || 0), 0);
    const activeSubsCount = students.filter((s) => String(s.subscription_status).toLowerCase() === "active").length;
    return {
      avgProgress: progressSum / students.length,
      completedCourses: completedCoursesSum,
      activeSubs: activeSubsCount,
    };
  }, [students]);

  // --- Fetch all student data for export ---
  const fetchAllStudents = async () => {
    try {
      const params = {
        limit: 1000,
        offset: 0,
        search: debouncedSearch,
        status: statusFilter,
        plan_id: planFilter,
        online: onlineFilter,
        progress_min: debouncedProgressMin,
        progress_max: debouncedProgressMax,
        last_active_from: lastActiveFrom,
        last_active_to: lastActiveTo,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      const res = await api.get("/lms/mentor/students-progress", { params });
      const data = getData(res);
      return data.students || [];
    } catch (err) {
      console.error("Gagal memuat data lengkap partner:", err);
      toast.error("Gagal memuat seluruh data partner");
      return [];
    }
  };

  // --- Print PDF Laporan (Semua Partner + UI Rapi) ---
  const handlePrintPDF = async () => {
    const loadingToast = toast.loading("Menyiapkan data PDF laporan...");
    const allData = await fetchAllStudents();
    toast.dismiss(loadingToast);

    if (allData.length === 0) {
      toast.error("Tidak ada data partner untuk dicetak");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Gagal membuka jendela cetak. Harap perbolehkan pop-up.");
      return;
    }

    const rowsHtml = allData.map(student => {
      const categoryCells = displayCategories.map(cat => {
        const detail = student.course_progress_details?.find((d: any) => d.category_name === cat);
        const score = detail && detail.average_score !== null ? `${detail.average_score.toFixed(1)}%` : "-";
        const progress = detail ? `${Math.round(detail.progress_percent)}%` : "-";
        return `
          <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-weight: 700; color: #4f46e5; font-size: 11px;">${score}</div>
            <div style="color: #64748b; font-size: 9px; margin-top: 2px;">Prog: ${progress}</div>
          </td>
        `;
      }).join("");

      return `
        <tr style="page-break-inside: avoid;">
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 700; font-size: 11px; color: #0f172a;">${student.name || student.full_name}</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 10px; color: #64748b;">${student.email}</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 10px; color: #475569;">${student.subscription_plan || "-"}<br/>${student.subscription_status || "none"}</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 10px; color: #475569;">${student.is_online ? "Online" : "Offline"}<br/>${formatDateTime(student.last_online_at)}</td>
          ${categoryCells}
        </tr>
      `;
    }).join("");

    const headersHtml = `
      <th style="padding: 12px 10px; border: 1px solid #cbd5e1; background-color: #f8fafc; text-align: left; font-size: 11px; font-weight: 700; color: #1e293b;">Nama Partner</th>
      <th style="padding: 12px 10px; border: 1px solid #cbd5e1; background-color: #f8fafc; text-align: left; font-size: 11px; font-weight: 700; color: #1e293b;">Email</th>
      <th style="padding: 12px 10px; border: 1px solid #cbd5e1; background-color: #f8fafc; text-align: left; font-size: 11px; font-weight: 700; color: #1e293b;">Subscription</th>
      <th style="padding: 12px 10px; border: 1px solid #cbd5e1; background-color: #f8fafc; text-align: left; font-size: 11px; font-weight: 700; color: #1e293b;">Last Active</th>
      ${displayCategories.map(cat => `<th style="padding: 12px 10px; border: 1px solid #cbd5e1; background-color: #f8fafc; text-align: center; font-size: 11px; font-weight: 700; color: #1e293b; min-width: 90px;">${cat}</th>`).join("")}
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Laporan Evaluasi Akademik Partner</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; background-color: #fff; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
            .header h1 { font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; }
            .header p { font-size: 12px; color: #64748b; margin: 5px 0 0 0; font-weight: 500; }
            .summary-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
            .summary-card { border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; background-color: #f8fafc; text-align: center; }
            .summary-card .label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            .summary-card .value { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; font-size: 11px; color: #475569; page-break-inside: avoid; }
            .signature-col { width: 180px; text-align: center; }
            .signature-line { border-top: 1px solid #cbd5e1; margin-top: 55px; padding-top: 5px; font-weight: 700; color: #0f172a; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Laporan Evaluasi & Akademik Partner</h1>
            <p>KITA Future Homeschooling &middot; Dicetak pada: ${new Date().toLocaleString("id-ID")}</p>
          </div>
          <div class="summary-box">
            <div class="summary-card">
              <div class="label">Total Partner</div>
              <div class="value">${allData.length}</div>
            </div>
            <div class="summary-card">
              <div class="label">Rata-rata Progress</div>
              <div class="value">${summary.avgProgress.toFixed(1)}%</div>
            </div>
            <div class="summary-card">
              <div class="label">Kursus Selesai</div>
              <div class="value">${summary.completedCourses}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>${headersHtml}</tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="signatures">
            <div class="signature-col">
              <p>Dicetak Oleh:</p>
              <div class="signature-line">Sistem LMS Mentor</div>
            </div>
            <div class="signature-col">
              <p>Mengetahui,</p>
              <div class="signature-line">Administrator LMS</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- Export Excel / CSV ---
  const handleExportCSV = async () => {
    const loadingToast = toast.loading("Menyiapkan ekspor file...");
    const allData = await fetchAllStudents();
    toast.dismiss(loadingToast);

    if (allData.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const headers = [
      "Nama Partner",
      "Email",
      "Subscription Plan",
      "Subscription Status",
      "Online Status",
      "Last Active Online",
      ...displayCategories.map(cat => `${cat} (Nilai)`),
      ...displayCategories.map(cat => `${cat} (Progress)`)
    ];

    const csvRows = [];
    // UTF-8 BOM so Excel opens it with correct encoding
    csvRows.push("\uFEFF" + headers.join(","));

    for (const student of allData) {
      const rowValues = [
        student.name || student.full_name || "",
        student.email || "",
        student.subscription_plan || "",
        student.subscription_status || "none",
        student.is_online ? "Online" : "Offline",
        formatDateTime(student.last_online_at),
      ];

      // Add scores
      for (const cat of displayCategories) {
        const detail = student.course_progress_details?.find((d: any) => d.category_name === cat);
        const score = detail && detail.average_score !== null ? `${detail.average_score.toFixed(1)}%` : "-";
        rowValues.push(score);
      }

      // Add progress percent
      for (const cat of displayCategories) {
        const detail = student.course_progress_details?.find((d: any) => d.category_name === cat);
        const progress = detail ? `${Math.round(detail.progress_percent)}%` : "-";
        rowValues.push(progress);
      }

      const escapedValues = rowValues.map(val => {
        const stringVal = String(val);
        if (stringVal.includes(",") || stringVal.includes('"') || stringVal.includes("\n")) {
          return `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      });
      csvRows.push(escapedValues.join(","));
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan_progress_partner_${dayjs().format("YYYY-MM-DD")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Laporan berhasil diekspor ke CSV / Excel");
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Title Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-zinc-150 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-indigo-600" />
            {t("progress.page.title")}
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            {t("progress.page.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start shrink-0">
          <Button
            onClick={handlePrintPDF}
            className="text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white h-9"
            size="sm"
          >
            <Printer className="h-3.5 w-3.5" />
            Cetak PDF Laporan
          </Button>
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="text-xs flex items-center gap-1.5 border-zinc-200 h-9"
            size="sm"
          >
            <Download className="h-3.5 w-3.5" />
            Ekspor CSV / Excel
          </Button>
          <Button
            onClick={() => load(true)}
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5 border-zinc-200 h-9"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("progress.refresh")}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("progress.stat.total_students")}
          value={total || students.length}
          icon={GraduationCap}
          description={t("progress.stat.total_students_desc")}
        />
        <StatCard
          label={t("progress.stat.avg_progress")}
          value={`${summary.avgProgress.toFixed(1)}%`}
          icon={TrendingUp}
          description={t("progress.stat.avg_progress_desc")}
        />
        <StatCard
          label={t("progress.stat.completed_courses")}
          value={summary.completedCourses}
          icon={BookOpen}
          description={t("progress.stat.completed_courses_desc")}
        />
        <StatCard
          label={t("progress.stat.active_subs")}
          value={summary.activeSubs}
          icon={FileCheck}
          description={t("progress.stat.inactive_subs_desc").replace("{count}", String(students.length - summary.activeSubs))}
        />
      </div>

      {/* Filtering Toolbar */}
      <div className="space-y-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(150px,180px))]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              placeholder={t("progress.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-zinc-200 text-xs h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-white border-zinc-200 text-xs h-9">
              <SelectValue placeholder={t("progress.status.all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t("progress.status.all")}</SelectItem>
              <SelectItem value="active" className="text-xs">{t("progress.status.active")}</SelectItem>
              <SelectItem value="inactive" className="text-xs">{t("progress.status.inactive")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="bg-white border-zinc-200 text-xs h-9">
              <SelectValue placeholder="Semua paket" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Semua paket</SelectItem>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id} className="text-xs">
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={onlineFilter} onValueChange={setOnlineFilter}>
            <SelectTrigger className="bg-white border-zinc-200 text-xs h-9">
              <SelectValue placeholder="Status online" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Semua aktivitas</SelectItem>
              <SelectItem value="online" className="text-xs">Sedang online</SelectItem>
              <SelectItem value="offline" className="text-xs">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <Input
            type="number"
            min="0"
            max="100"
            value={progressMin}
            onChange={(e) => setProgressMin(e.target.value)}
            placeholder="Progress min %"
            className="bg-white border-zinc-200 text-xs h-9"
          />
          <Input
            type="number"
            min="0"
            max="100"
            value={progressMax}
            onChange={(e) => setProgressMax(e.target.value)}
            placeholder="Progress max %"
            className="bg-white border-zinc-200 text-xs h-9"
          />
          <Input
            type="date"
            value={lastActiveFrom}
            onChange={(e) => setLastActiveFrom(e.target.value)}
            className="bg-white border-zinc-200 text-xs h-9"
          />
          <Input
            type="date"
            value={lastActiveTo}
            onChange={(e) => setLastActiveTo(e.target.value)}
            className="bg-white border-zinc-200 text-xs h-9"
          />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="bg-white border-zinc-200 text-xs h-9">
              <SelectValue placeholder="Urutkan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name" className="text-xs">Nama</SelectItem>
              <SelectItem value="email" className="text-xs">Email</SelectItem>
              <SelectItem value="progress" className="text-xs">Progress</SelectItem>
              <SelectItem value="subscription_plan" className="text-xs">Paket</SelectItem>
              <SelectItem value="subscription_status" className="text-xs">Status subscription</SelectItem>
              <SelectItem value="last_active_at" className="text-xs">Last active</SelectItem>
              <SelectItem value="created_at" className="text-xs">Tanggal dibuat</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="bg-white border-zinc-200 text-xs h-9">
                <SelectValue placeholder="Arah" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc" className="text-xs">Ascending</SelectItem>
                <SelectItem value="desc" className="text-xs">Descending</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 text-xs"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setPlanFilter("all");
                setOnlineFilter("all");
                setProgressMin("");
                setProgressMax("");
                setLastActiveFrom("");
                setLastActiveTo("");
                setSortBy("name");
                setSortOrder("asc");
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>{students.length} dari {total || students.length} partner ditampilkan</span>
          <span>Last active berdasarkan heartbeat/aktivitas online, bukan login terakhir.</span>
        </div>
      </div>

      {/* Table & Report View Area */}
      {students.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl border-zinc-200 text-zinc-400 bg-white">
          <p className="text-sm font-semibold">{t("progress.empty")}</p>
        </div>
      ) : (
        <div className="w-full bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="p-4 min-w-[200px]">Student Name</th>
                  <th className="p-4 min-w-[160px]">Subscription</th>
                  <th className="p-4 min-w-[170px]">Last Active</th>
                  {displayCategories.map((cat) => (
                    <th key={cat} className="p-4 text-center min-w-[120px]">{cat}</th>
                  ))}
                  <th className="p-4 text-right min-w-[100px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 font-medium text-zinc-700">
                {students.map((student) => {
                  return (
                    <tr key={student.id} className="hover:bg-zinc-50/50 transition-colors">
                      {/* Student Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-zinc-200 shrink-0">
                            <AvatarImage src={student.avatar_url} />
                            <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold text-xs">
                              {initials(student.name || student.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-zinc-900 truncate">{student.name || student.full_name}</p>
                            <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-mono">{student.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="space-y-1">
                          <Badge
                            variant={String(student.subscription_status).toLowerCase() === "active" ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {student.subscription_status || "none"}
                          </Badge>
                          <p className="max-w-[150px] truncate text-[10px] text-zinc-500">
                            {student.subscription_plan || "Tanpa paket"}
                          </p>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="space-y-1">
                          <Badge
                            variant={student.is_online ? "default" : "secondary"}
                            className={cn(
                              "text-[10px]",
                              student.is_online && "bg-emerald-600 hover:bg-emerald-600"
                            )}
                          >
                            {student.is_online ? "Online sekarang" : "Offline"}
                          </Badge>
                          <p className="text-[10px] text-zinc-500">
                            {formatDateTime(student.last_online_at)}
                          </p>
                        </div>
                      </td>

                      {/* Course Category Columns */}
                      {displayCategories.map((cat) => {
                        const detail = student.course_progress_details?.find(
                          (d: any) => d.category_name === cat
                        );
                        const score = detail ? detail.average_score : null;
                        const progress = detail ? detail.progress_percent : 0;
                        const hasProgress = progress > 0 || score !== null;

                        return (
                          <td key={cat} className="p-4 text-center">
                            {hasProgress ? (
                              <div className="flex flex-col items-center justify-center space-y-0.5">
                                <span className="text-[11px] font-bold text-indigo-600">
                                  {score !== null ? `${score.toFixed(1)}%` : "Not graded"}
                                </span>
                                <span className="text-[9px] text-zinc-400 font-medium">
                                  Progress: {Math.round(progress)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-300">N/A</span>
                            )}

                          </td>
                        );
                      })}

                      {/* Action */}
                      <td className="p-4 text-right">
                        <Button
                          onClick={() => navigate(`/dashboard/parent/students/${student.id}`)}
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-indigo-600 hover:text-indigo-700 font-bold p-0 flex items-center gap-0.5 ml-auto hover:bg-transparent"
                        >
                          Detail
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center p-4 border-t bg-zinc-50/50">
              <Button
                onClick={() => handleLoadMore(true)}
                disabled={loadingMore}
                variant="outline"
                size="sm"
                className="text-xs flex items-center gap-1.5 border-zinc-200"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Memuat...
                  </>
                ) : (
                  "Tampilkan Lebih Banyak"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DashboardLayout(StudentProgressPage);
