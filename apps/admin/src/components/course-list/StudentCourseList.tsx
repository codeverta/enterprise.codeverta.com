import React, { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { toast } from "sonner";
import {
  BookOpen,
  Bold,
  Edit,
  Eye,
  FileAudio,
  FileImage,
  FileText,
  Heading2,
  Italic,
  Link,
  List,
  Loader2,
  PlusCircle,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  Trash2,
  Upload,
  Video,
  X,
  ChevronDown,
  Layers,
  LayoutGrid,
  Tag,
  Lock,
  GraduationCap,
  Sparkles,
  Clock,
  CheckCircle2,
  FileEdit,
  Film,
} from "lucide-react";
import { Link as RouterLink, useNavigate } from "react-router";
import { useLanguage } from "@/context/LanguageContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CategoryPanel from "./CategoryPanel";
import StatCard from "./StatCard";
import CourseFormDialog from "./CourseFormDialog";

/* ─── constants ─────────────────────────────────────────────── */

const emptyModuleForm = {
  id: "",
  title: "",
  description: "",
  sort_order: 0,
  is_published: false,
};

const emptyAssetForm = {
  title: "",
  type: "video",
  file_url: "",
  thumbnail_url: "",
  description: "",
  is_downloadable: false,
};

const assetTypes = [
  { value: "video", label: "Video", icon: Video },
  { value: "audiobook", label: "Audiobook", icon: FileAudio },
  { value: "image", label: "Gambar", icon: FileImage },
  { value: "ebook", label: "Ebook", icon: FileText },
  { value: "worksheet", label: "Worksheet", icon: FileText },
];

const acceptByAssetType = {
  video: "video/mp4,video/webm,video/quicktime,video/x-m4v",
  audiobook: "audio/*,.m4a,.mp3,.wav,.ogg,.flac",
  image: "image/*",
  ebook: ".pdf,.epub,.doc,.docx,application/pdf,application/epub+zip",
  worksheet: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip",
};

/* ─── design tokens ─────────────────────────────────────────────
   Palette:
   - ink       #1E1B3A  (headings)
   - slate     #5B5A72  (body / muted)
   - canvas    #F6F5FB  (page background, soft lavender-white)
   - primary   #5B5FEF  (violet-indigo — structure / modules)
   - primary-50 #EEF0FD
   - coral     #FF7A50  (content / creative — warm, kid-friendly)
   - teal      #12B3A0  (media / assets)
   - amber     #F5A524  (draft / warning)
   - rose      #F0475B  (archived / destructive)
------------------------------------------------------------------- */

/* ─── helpers ────────────────────────────────────────────────── */

const getResponseData = (r) => r.data?.data || r.data || [];

const statusMeta = {
  published: {
    label: "Published",
    cls: "bg-[#EAFBF3] text-[#0F9D66] border-[#BFEFD9]",
    dot: "bg-[#12B981]",
  },
  draft: {
    label: "Draft",
    cls: "bg-[#FFF6E8] text-[#B4790A] border-[#FBE4B8]",
    dot: "bg-[#F5A524]",
  },
  archived: {
    label: "Archived",
    cls: "bg-[#FFEDEF] text-[#D3283F] border-[#FAD0D6]",
    dot: "bg-[#F0475B]",
  },
};

const markdownPreview = (value) => {
  if (!value) return "";
  return value
    .replace(
      /^### (.*$)/gim,
      "<h3 class='text-base font-semibold mt-3 mb-1'>$1</h3>"
    )
    .replace(
      /^## (.*$)/gim,
      "<h2 class='text-lg font-semibold mt-4 mb-1'>$1</h2>"
    )
    .replace(/^# (.*$)/gim, "<h1 class='text-xl font-bold mt-4 mb-2'>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(
      /\[(.*?)\]\((.*?)\)/gim,
      '<a href="$2" target="_blank" rel="noreferrer" class="text-[#5B5FEF] underline">$1</a>'
    )
    .replace(/^\- (.*$)/gim, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/\n/g, "<br />");
};

/* ─── sub-components ─────────────────────────────────────────── */

/* ─── main page ──────────────────────────────────────────────── */

function StudentCourseList({ user }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [accessFilter, setAccessFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [categories, setCategories] = useState([]);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [sellingStatus, setSellingStatus] = useState(null);
  const [sellingStatusLoading, setSellingStatusLoading] = useState(false);
  const observerTargetRef = useRef(null);

  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [modulesByCourse, setModulesByCourse] = useState({});
  const [moduleForms, setModuleForms] = useState({});
  const [selectedModuleByCourse, setSelectedModuleByCourse] = useState({});
  const [lessonsByModule, setLessonsByModule] = useState({});
  const [assetsByLesson, setAssetsByLesson] = useState({});
  const [contentForms, setContentForms] = useState({});
  const [assetForms, setAssetForms] = useState({});
  const [busyKey, setBusyKey] = useState("");
  const role = Number(user?.role || 0);
  const isExternalSeller = role === 10 || role === 40;
  const canManageCourses =
    role >= 99 || role === 30 || (isExternalSeller && !!sellingStatus?.can_create_course);

  /* ── fetchers ── */

  const fetchCourses = async (pageToFetch = currentPage, isReset = false) => {
    setLoading(true);
    try {
      const res = await api.get("/lms/my-courses", {
        params: {
          page: pageToFetch,
          limit,
          search: searchTerm,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          course_category_id:
            categoryFilter !== "ALL" ? categoryFilter : undefined,
          include_drafts: canManageCourses ? true : undefined,
        },
      });
      const { data, pagination } = res.data || {};
      const rawData = data || res.data || [];
      const fetchedCourses = Array.isArray(rawData) ? rawData : [];
      if (pageToFetch === 1 || isReset) {
        setCourses(fetchedCourses);
      } else {
        setCourses((currentCourses) => {
          const safeCurrent = Array.isArray(currentCourses) ? currentCourses : [];
          const existingIds = new Set(safeCurrent.map((course) => course.id));
          return [
            ...safeCurrent,
            ...fetchedCourses.filter((course) => !existingIds.has(course.id)),
          ];
        });
      }
      if (pagination) setTotalPages(pagination.total_pages);
    } catch {
      toast.error("Gagal memuat data kursus");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/lms/course-categories", {
        params: { include_inactive: true, limit: 100 },
      });
      const raw = getResponseData(res);
      setCategories(Array.isArray(raw) ? raw : []);
    } catch {
      toast.error("Gagal memuat kategori kursus");
    }
  };

  const fetchSellingStatus = async () => {
    if (!isExternalSeller) return;
    setSellingStatusLoading(true);
    try {
      const res = await api.get("/lms/seller/selling-status");
      setSellingStatus(res.data?.data || null);
    } catch (error) {
      setSellingStatus(null);
      if (error.response?.status !== 403) {
        toast.error(
          error.response?.data?.message || "Gagal memuat requirement penjualan"
        );
      }
    } finally {
      setSellingStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchSellingStatus();
  }, [isExternalSeller]);

  useEffect(() => {
    setCurrentPage(1);
    const t = setTimeout(() => fetchCourses(1, true), 500);
    return () => clearTimeout(t);
  }, [searchTerm, statusFilter, categoryFilter, canManageCourses]);

  const filteredCourses = useMemo(() => {
    const safeCourses = Array.isArray(courses) ? courses : [];
    return safeCourses
      .filter((c) => {
        if (levelFilter !== "ALL") {
          const lvl = (c.level || "").toLowerCase();
          const targetLvl = levelFilter.toLowerCase();
          if (targetLvl.includes("early") && !lvl.includes("early") && !lvl.includes("paud")) return false;
          if (targetLvl.includes("sd") && !lvl.includes("sd") && !lvl.includes("elementar")) return false;
          if (targetLvl.includes("smp") && !lvl.includes("smp") && !lvl.includes("middle")) return false;
          if (targetLvl.includes("sma") && !lvl.includes("sma") && !lvl.includes("high")) return false;
        }
        if (accessFilter === "locked" && !c.is_locked) return false;
        if (accessFilter === "unlocked" && c.is_locked) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        if (sortBy === "oldest") return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        if (sortBy === "name_asc") return (a.title || "").localeCompare(b.title || "");
        if (sortBy === "name_desc") return (b.title || "").localeCompare(a.title || "");
        return 0;
      });
  }, [courses, levelFilter, accessFilter, sortBy]);

  useEffect(() => {
    if (currentPage > 1) {
      fetchCourses(currentPage, false);
    }
  }, [currentPage]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && currentPage < totalPages) {
          setCurrentPage((page) => page + 1);
        }
      },
      { rootMargin: "240px 0px", threshold: 0.01 }
    );

    const target = observerTargetRef.current;
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
      observer.disconnect();
    };
  }, [loading, currentPage, totalPages]);

  /* ── derived state ── */

  const visibleCourse = useMemo(
    () => (Array.isArray(courses) ? courses : []).find((c) => c.id === expandedCourseId),
    [courses, expandedCourseId]
  );

  const counts = useMemo(() => {
    const safe = Array.isArray(courses) ? courses : [];
    return {
      total: safe.length,
      published: safe.filter((c) => c.status === "published").length,
      draft: safe.filter((c) => c.status === "draft").length,
    };
  }, [courses]);

  const sellerGlobalRequirementsMet = !!sellingStatus?.unlocked_selling;
  const sellerHasSellableCourse = (Array.isArray(courses) ? courses : []).some((course) => {
    const ownedBySeller = Array.isArray(course.mentors) && course.mentors.some(
      (mentor) => mentor.id === user?.id
    );
    const meetsLessonMinimum =
      Number(course.lesson_count || 0) >=
      Number(sellingStatus?.min_lessons_required || 0);
    return ownedBySeller && sellerGlobalRequirementsMet && meetsLessonMinimum;
  });

  /* ── module / content helpers (unchanged logic) ── */

  const loadModules = async (courseId) => {
    setBusyKey(`modules-${courseId}`);
    try {
      const res = await api.get("/lms/modules", {
        params: { course_id: courseId, limit: 100 },
      });
      const modules = getResponseData(res).sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
      );
      setModulesByCourse((prev) => ({ ...prev, [courseId]: modules }));
      if (modules.length > 0) {
        const sel = selectedModuleByCourse[courseId] || modules[0].id;
        setSelectedModuleByCourse((prev) => ({ ...prev, [courseId]: sel }));
        await loadModuleContent(sel);
      }
    } catch {
      toast.error("Gagal memuat unit kursus");
    } finally {
      setBusyKey("");
    }
  };

  const loadModuleContent = async (moduleId) => {
    if (!moduleId) return;
    setBusyKey(`content-${moduleId}`);
    try {
      const lr = await api.get("/lms/lessons", {
        params: { module_id: moduleId, limit: 100 },
      });
      const lessons = getResponseData(lr).sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
      );
      const main = lessons[0] || null;
      setLessonsByModule((prev) => ({ ...prev, [moduleId]: lessons }));
      setContentForms((prev) => ({
        ...prev,
        [moduleId]: {
          id: main?.id || "",
          title: main?.title || "Konten Utama",
          summary: main?.summary || "",
          is_preview: main?.is_preview || false,
          is_published: main?.is_published || false,
        },
      }));
      if (main?.id) {
        const ar = await api.get("/lms/learning-assets", {
          params: { lesson_id: main.id, limit: 100 },
        });
        setAssetsByLesson((prev) => ({
          ...prev,
          [main.id]: getResponseData(ar),
        }));
        setAssetForms((prev) => ({
          ...prev,
          [main.id]: { ...emptyAssetForm },
        }));
      }
    } catch {
      toast.error("Gagal memuat konten unit");
    } finally {
      setBusyKey("");
    }
  };

  const toggleCourse = async (courseId) => {
    // const next = expandedCourseId === courseId ? null : courseId;
    // setExpandedCourseId(next);
    // if (next && !modulesByCourse[next]) await loadModules(next);
  };

  const saveModule = async (courseId) => {
    const form = moduleForms[courseId] || emptyModuleForm;
    if (!form.title.trim()) {
      toast.error("Judul unit wajib diisi");
      return;
    }
    setBusyKey(`save-module-${courseId}`);
    try {
      const payload = {
        course_id: courseId,
        title: form.title,
        description: form.description,
        sort_order: Number(form.sort_order || 0),
        is_published: !!form.is_published,
      };
      if (form.id) {
        await api.put(`/subscriptions/admin/resources/modules/${form.id}`, payload);
        toast.success("Unit diperbarui");
      } else {
        await api.post("/lms/admin/modules", payload);
        toast.success("Unit ditambahkan");
      }
      setModuleForms((prev) => ({
        ...prev,
        [courseId]: { ...emptyModuleForm },
      }));
      await loadModules(courseId);
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menyimpan unit");
    } finally {
      setBusyKey("");
    }
  };

  const editModule = (courseId, module) =>
    setModuleForms((prev) => ({ ...prev, [courseId]: { ...module } }));

  const deleteModule = async (courseId, moduleId) => {
    if (!confirm("Hapus unit ini beserta kontennya?")) return;
    setBusyKey(`delete-module-${moduleId}`);
    try {
      await api.delete(`/subscriptions/admin/resources/modules/${moduleId}`);
      toast.success("Unit dihapus");
      setSelectedModuleByCourse((prev) => ({ ...prev, [courseId]: "" }));
      await loadModules(courseId);
    } catch {
      toast.error("Gagal menghapus unit");
    } finally {
      setBusyKey("");
    }
  };

  const saveContent = async (moduleId) => {
    const form = contentForms[moduleId] || {};
    if (!form.title?.trim()) {
      toast.error("Judul konten wajib diisi");
      return;
    }
    setBusyKey(`save-content-${moduleId}`);
    try {
      const payload = {
        module_id: moduleId,
        title: form.title,
        summary: form.summary || "",
        sort_order: 0,
        duration_sec: 0,
        is_preview: !!form.is_preview,
        is_published: !!form.is_published,
      };
      if (form.id) {
        await api.put(`/subscriptions/admin/resources/lessons/${form.id}`, payload);
        toast.success("Konten module disimpan");
      } else {
        await api.post("/lms/admin/lessons", payload);
        toast.success("Konten module dibuat");
      }
      await loadModuleContent(moduleId);
      await fetchCourses();
      await fetchSellingStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menyimpan konten");
    } finally {
      setBusyKey("");
    }
  };

  const addAsset = async (lessonId) => {
    const form = assetForms[lessonId] || emptyAssetForm;
    if (!lessonId) {
      toast.error("Simpan konten module dulu sebelum menambah media");
      return;
    }
    if (!form.title.trim() || !form.file_url.trim()) {
      toast.error("Judul media dan upload media wajib diisi");
      return;
    }
    setBusyKey(`asset-${lessonId}`);
    try {
      await api.post("/lms/admin/learning-assets", {
        lesson_id: lessonId,
        title: form.title,
        type: form.type,
        file_url: form.file_url,
        thumbnail_url: form.thumbnail_url,
        description: form.description,
        is_downloadable: !!form.is_downloadable,
        sort_order: (assetsByLesson[lessonId]?.length || 0) + 1,
      });
      toast.success("Media ditambahkan");
      setAssetForms((prev) => ({ ...prev, [lessonId]: { ...emptyAssetForm } }));
      const ar = await api.get("/lms/learning-assets", {
        params: { lesson_id: lessonId, limit: 100 },
      });
      setAssetsByLesson((prev) => ({
        ...prev,
        [lessonId]: getResponseData(ar),
      }));
    } catch {
      toast.error("Gagal menambahkan media");
    } finally {
      setBusyKey("");
    }
  };

  const deleteAsset = async (lessonId, assetId) => {
    if (!confirm("Hapus media ini?")) return;
    try {
      await api.delete(`/subscriptions/admin/resources/learning-assets/${assetId}`);
      toast.success("Media dihapus");
      setAssetsByLesson((prev) => ({
        ...prev,
        [lessonId]: (prev[lessonId] || []).filter((a) => a.id !== assetId),
      }));
    } catch {
      toast.error("Gagal menghapus media");
    }
  };

  const uploadAssetFile = async (lessonId, file) => {
    if (!file) return;
    const mediaType = (assetForms[lessonId] || emptyAssetForm).type || "video";
    const toastId = toast.loading("Mengupload media...");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("type", mediaType);
      const res = await api.post("/admin/upload-media", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fileUrl = res.data?.data?.url || "";
      setAssetForms((prev) => ({
        ...prev,
        [lessonId]: {
          ...(prev[lessonId] || emptyAssetForm),
          title: prev[lessonId]?.title || file.name.replace(/\.[^.]+$/, ""),
          file_url: fileUrl || prev[lessonId]?.file_url || "",
        },
      }));
      toast.success(
        fileUrl
          ? "Media berhasil diupload"
          : "Media terupload, tapi URL belum diterima",
        { id: toastId }
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Gagal upload media", {
        id: toastId,
      });
    }
  };

  const uploadAssetThumbnail = async (lessonId, file) => {
    if (!file) return;
    const toastId = toast.loading("Mengupload thumbnail...");
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api.post("/admin/upload-image", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const thumbnailUrl = res.data?.data?.url || "";
      setAssetForms((prev) => ({
        ...prev,
        [lessonId]: {
          ...(prev[lessonId] || emptyAssetForm),
          thumbnail_url: thumbnailUrl || prev[lessonId]?.thumbnail_url || "",
        },
      }));
      toast.success(
        thumbnailUrl
          ? "Thumbnail berhasil diupload"
          : "Thumbnail terupload, tapi URL belum diterima",
        { id: toastId }
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Gagal upload thumbnail", {
        id: toastId,
      });
    }
  };

  const insertMarkdown = (moduleId, before) => {
    const form = contentForms[moduleId] || {};
    const current = form.summary || "";
    setContentForms((prev) => ({
      ...prev,
      [moduleId]: {
        ...form,
        summary: `${current}${current ? "\n" : ""}${before}`,
      },
    }));
  };
  /* ── derived module state ── */

  const selectedModules = visibleCourse
    ? modulesByCourse[visibleCourse.id] || []
    : [];
  const selectedModuleId = visibleCourse
    ? selectedModuleByCourse[visibleCourse.id]
    : "";
  const selectedModule = selectedModules.find((m) => m.id === selectedModuleId);
  const selectedContent = selectedModuleId
    ? contentForms[selectedModuleId] || {}
    : {};
  const selectedLessonId = selectedContent.id;
  const selectedAssets = selectedLessonId
    ? assetsByLesson[selectedLessonId] || []
    : [];
  const selectedAssetForm = selectedLessonId
    ? assetForms[selectedLessonId] || emptyAssetForm
    : emptyAssetForm;

  /* ─── render ──────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#F6F5FB] text-[#1E1B3A]">
      <CategoryPanel
        open={categoryPanelOpen}
        onClose={() => setCategoryPanelOpen(false)}
        categories={categories}
        onRefresh={fetchCategories}
      />

      <div className="px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
        {/* ── hero header ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5B5FEF] via-[#6D6FF2] to-[#8B7CF6] px-5 py-7 sm:px-8 sm:py-9 text-white shadow-lg shadow-[#5B5FEF]/20">
          {/* decorative blobs */}
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-[#FF7A50]/20 blur-2xl" />
          <Sparkles className="pointer-events-none absolute right-10 top-8 h-6 w-6 text-white/30" />
          <Sparkles className="pointer-events-none absolute right-24 bottom-10 h-4 w-4 text-white/20" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                  {canManageCourses
                    ? t("courses.title.admin")
                    : t("courses.title.student")}
                </h1>
                <p className="text-sm text-white/80 mt-1 max-w-md">
                  {canManageCourses
                    ? t("courses.subtitle.admin")
                    : t("courses.subtitle.student")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── stats strip ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Kursus"
            value={counts.total}
            icon={LayoutGrid}
          />
          <StatCard label="Kategori" value={categories.length} icon={Tag} />
        </div>

        {/* ── filter bar ── */}
        <div className="rounded-2xl border border-[#E7E7F5] bg-white p-4 shadow-sm space-y-3">
          {/* search + status */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9694B0]" />
              <Input
                placeholder="Cari judul kursus..."
                className="h-11 rounded-xl border-[#E7E7F5] bg-[#FAFAFE] pl-10 focus-visible:ring-[#5B5FEF]/40"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(canManageCourses
                ? ["ALL", "published", "draft", "archived"]
                : ["ALL"]
              ).map((s) => {
                const active = statusFilter === s;
                const dot = s !== "ALL" ? statusMeta[s]?.dot : null;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setStatusFilter(s);
                      setCurrentPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${
                      active
                        ? "bg-[#5B5FEF] text-white border-[#5B5FEF] shadow-sm shadow-[#5B5FEF]/30"
                        : "bg-white hover:bg-[#F6F5FB] border-[#E7E7F5] text-[#5B5A72]"
                    }`}
                  >
                    {dot && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${dot} ${
                          active ? "opacity-100" : "opacity-70"
                        }`}
                      />
                    )}
                    {s === "ALL"
                      ? "Semua"
                      : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Secondary Filters: Category, Level, Access, Sort */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#F0EFF9]">
            {/* Category Filter Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-[#5B5A72]">
              <span className="font-semibold text-[#1E1B3A]">Kategori:</span>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-[#E7E7F5] bg-[#FAFAFE] px-2.5 py-1 text-xs font-medium text-[#1E1B3A] focus:outline-none focus:ring-1 focus:ring-[#5B5FEF]"
              >
                <option value="ALL">Semua Kategori</option>
                {(Array.isArray(categories) ? categories : []).map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Level Filter Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-[#5B5A72]">
              <span className="font-semibold text-[#1E1B3A]">Jenjang:</span>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="h-8 rounded-lg border border-[#E7E7F5] bg-[#FAFAFE] px-2.5 py-1 text-xs font-medium text-[#1E1B3A] focus:outline-none focus:ring-1 focus:ring-[#5B5FEF]"
              >
                <option value="ALL">Semua Jenjang</option>
                <option value="Early Years">Early Years (PAUD/TK)</option>
                <option value="SD / Elementary">SD / Elementary</option>
                <option value="SMP / Middle School">SMP / Middle School</option>
                <option value="SMA / High School">SMA / High School</option>
              </select>
            </div>

            {/* Access Filter Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-[#5B5A72]">
              <span className="font-semibold text-[#1E1B3A]">Akses:</span>
              <select
                value={accessFilter}
                onChange={(e) => setAccessFilter(e.target.value)}
                className="h-8 rounded-lg border border-[#E7E7F5] bg-[#FAFAFE] px-2.5 py-1 text-xs font-medium text-[#1E1B3A] focus:outline-none focus:ring-1 focus:ring-[#5B5FEF]"
              >
                <option value="ALL">Semua Akses</option>
                <option value="unlocked">Terbuka / Dapat Diakses</option>
                <option value="locked">Tergembok / Terkunci</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-[#5B5A72] ml-auto">
              <span className="font-semibold text-[#1E1B3A]">Urutkan:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-8 rounded-lg border border-[#E7E7F5] bg-[#FAFAFE] px-2.5 py-1 text-xs font-medium text-[#1E1B3A] focus:outline-none focus:ring-1 focus:ring-[#5B5FEF]"
              >
                <option value="newest">Terbaru</option>
                <option value="oldest">Terlama</option>
                <option value="name_asc">Nama (A - Z)</option>
                <option value="name_desc">Nama (Z - A)</option>
              </select>
            </div>
          </div>
        </div>

        {isExternalSeller && (sellingStatusLoading || sellingStatus?.has_active_plan) && (
          <section
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
              sellerHasSellableCourse
                ? "border-emerald-200"
                : "border-amber-200"
            }`}
          >
            <div
              className={`flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                sellerHasSellableCourse
                  ? "bg-emerald-50/70"
                  : "bg-amber-50/70"
              }`}
            >
              {sellingStatusLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#5B5A72]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memeriksa requirement penjualan...
                </div>
              ) : (
                <>
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        sellerHasSellableCourse
                          ? "bg-emerald-500 text-white"
                          : "bg-amber-500 text-white"
                      }`}
                    >
                      {sellerHasSellableCourse ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Lock className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold">
                          {sellerHasSellableCourse
                            ? "Ada course yang siap dijual satuan"
                            : "Penjualan course masih terkunci"}
                        </h2>
                        <span className="rounded-full border border-white/80 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-[#5B5A72]">
                          {sellingStatus?.plan_name}
                        </span>
                      </div>
                      {!sellerHasSellableCourse && (
                        <p className="mt-1 text-xs leading-relaxed text-amber-800">
                          {!sellerGlobalRequirementsMet
                            ? sellingStatus?.unlock_reason
                            : `Setiap course harus memiliki minimal ${sellingStatus?.min_lessons_required || 0} lesson sebelum dapat dijual.`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                    {sellingStatus?.min_lessons_required > 0 && (
                      <span className="rounded-lg border border-white bg-white/85 px-2.5 py-1.5 text-[#5B5A72]">
                        Minimum {sellingStatus.min_lessons_required} lesson per course
                      </span>
                    )}
                    {sellingStatus?.require_modules_completion && (
                      <span className="rounded-lg border border-white bg-white/85 px-2.5 py-1.5 text-[#5B5A72]">
                        Modul {sellingStatus.bundle_completed_lessons}/
                        {sellingStatus.bundle_total_lessons}
                      </span>
                    )}
                    {(Array.isArray(sellingStatus?.required_courses) ? sellingStatus.required_courses : []).map((course) => (
                      <span
                        key={course.id}
                        className={`inline-flex items-center gap-1 rounded-lg border border-white bg-white/85 px-2.5 py-1.5 ${
                          course.completed ? "text-emerald-700" : "text-amber-800"
                        }`}
                      >
                        {course.completed ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                        {course.title}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* ── course grid ── */}
        {loading && (Array.isArray(courses) ? courses : []).length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#E7E7F5] bg-white/60 text-[#9694B0]">
            <Loader2 className="h-8 w-8 animate-spin text-[#5B5FEF]" />
            <span className="text-sm">Memuat data kursus...</span>
          </div>
        ) : (Array.isArray(filteredCourses) ? filteredCourses : []).length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#E7E7F5] bg-white text-[#9694B0]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF0FD]">
              <BookOpen className="h-7 w-7 text-[#5B5FEF]" />
            </div>
            <span className="text-sm">Tidak ada kursus yang sesuai filter.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(Array.isArray(filteredCourses) ? filteredCourses : []).map((course) => {
              const sm = statusMeta[course.status] || statusMeta.draft;
              const isExpanded = expandedCourseId === course.id;
              const isLocked = !!course.is_locked;
              const isOwnedBySeller = Array.isArray(course.mentors) && course.mentors.some(
                (mentor) => mentor.id === user?.id
              );
              const isSellingLocked =
                isExternalSeller &&
                isOwnedBySeller &&
                (!sellerGlobalRequirementsMet ||
                  Number(course.lesson_count || 0) <
                    Number(sellingStatus?.min_lessons_required || 0));
              return (
                <div
                  key={course.id}
                  role={isLocked ? undefined : "link"}
                  tabIndex={isLocked ? -1 : 0}
                  aria-label={isLocked ? undefined : `Buka kelas ${course.title}`}
                  onClick={(event) => {
                    if (
                      isLocked ||
                      (event.target as HTMLElement).closest(
                        "a, button, input, select, textarea"
                      )
                    ) {
                      return;
                    }
                    navigate(`/dashboard/courses/${course.id}`);
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (!isLocked && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      navigate(`/dashboard/courses/${course.id}`);
                    }
                  }}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#5B5FEF]/10 ${
                    isLocked
                      ? "cursor-not-allowed"
                      : "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5FEF] focus-visible:ring-offset-2"
                  } ${
                    isExpanded
                      ? "border-[#5B5FEF] ring-2 ring-[#5B5FEF]/20"
                      : "border-[#ECEBF7]"
                  }`}
                >
                  {/* thumbnail */}
                  <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-[#EEF0FD] to-[#F6F5FB]">
                    {course.cover_image_url ? (
                      <img
                        src={course.cover_image_url}
                        alt={course.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <BookOpen className="h-9 w-9 text-[#C7C6E8]" />
                      </div>
                    )}
                    <span
                      className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm ${sm.cls}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                      {sm.label}
                    </span>
                    {isSellingLocked && (
                      <span className="absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50/95 px-2.5 py-1 text-[10px] font-semibold text-amber-800 shadow-sm backdrop-blur-sm">
                        <Lock className="h-3 w-3" />
                        Belum dapat dijual
                      </span>
                    )}
                    {isLocked && (
                      <div className="absolute inset-0 bg-[#1E1B3A]/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-3 text-center z-10">
                        <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                          <Lock className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-[10px] font-semibold tracking-wide uppercase">
                          Terkunci
                        </span>
                        <span className="text-[9px] text-white/70 mt-0.5 leading-tight">
                          {course.locked_by_course
                            ? `Selesaikan "${course.locked_by_course}"`
                            : "Selesaikan course sebelumnya"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4 gap-2.5">
                    {/* title */}
                    <h2 className="line-clamp-2 text-sm font-semibold leading-snug">
                      {isLocked ? (
                        <span className="text-[#B3B2C8] cursor-not-allowed">
                          {course.title}
                        </span>
                      ) : (
                        <RouterLink
                          to={`/dashboard/courses/${course.id}`}
                          className="hover:text-[#5B5FEF] transition-colors"
                        >
                          {course.title}
                        </RouterLink>
                      )}
                    </h2>

                    {/* description */}
                    <p className="line-clamp-2 text-xs text-[#8B8AA0] leading-relaxed">
                      {course.short_description || "Tidak ada deskripsi"}
                    </p>

                    {/* tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {course.course_category?.name && (
                        <span className="rounded-md bg-[#E9FBF6] border border-[#C7F0E3] px-2 py-0.5 text-[11px] text-[#0F9D66] font-medium">
                          {course.course_category.name}
                        </span>
                      )}
                      {course.level && (
                        <span className="rounded-md bg-[#FFF1EA] border border-[#FBDBC7] px-2 py-0.5 text-[11px] font-mono text-[#C4622D]">
                          {course.level}
                        </span>
                      )}
                    </div>

                    {/* footer */}
                    <div className="mt-auto pt-2.5 flex items-center justify-between border-t border-[#F0EFF9]">
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#9694B0]">
                        <Clock className="h-3 w-3" />
                        {dayjs(course.created_at).format("DD MMM YYYY")}
                      </span>
                      <div className="flex gap-0.5">
                        {isLocked ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-not-allowed opacity-50"
                            disabled
                            title="Materi terkunci karena course sebelumnya belum diselesaikan"
                          >
                            <Lock className="h-4 w-4 text-[#B3B2C8]" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg hover:bg-[#EEF0FD]"
                              onClick={() => toggleCourse(course.id)}
                              title={
                                canManageCourses ? "Kelola modul" : "Lihat modul"
                              }
                            >
                              <RouterLink
                                to={`/dashboard/courses/${course.id}/modules`}
                              >
                                <BookOpen
                                  className={`h-4 w-4 ${
                                    isExpanded
                                      ? "text-[#5B5FEF]"
                                      : "text-[#0F9D66]"
                                  }`}
                                />
                              </RouterLink>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── module editor (expanded course) ── */}
        {visibleCourse && (
          <section className="rounded-2xl border border-[#ECEBF7] bg-white overflow-hidden shadow-sm">
            {/* section header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#ECEBF7] bg-[#FAFAFE] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF0FD]">
                  <BookOpen className="h-4.5 w-4.5 text-[#5B5FEF]" />
                </div>
                <div>
                  <h2 className="font-semibold">
                    {visibleCourse.title}
                  </h2>
                  <p className="text-xs text-[#9694B0]">
                    {canManageCourses
                      ? "Kelola modul & konten kursus"
                      : "Lihat modul & konten kursus"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadModules(visibleCourse.id)}
                  disabled={busyKey === `modules-${visibleCourse.id}`}
                  className="gap-2 rounded-lg border-[#E7E7F5]"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setExpandedCourseId(null)}
                  className="rounded-lg hover:bg-[#F0EFF9]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-5">
              <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
                {/* ── left: module list + form ── */}
                <div className="space-y-4">
                  {/* add/edit module form */}
                  {canManageCourses && (
                    <div className="rounded-2xl border border-[#E4E3F7] bg-[#F8F8FE] p-4 space-y-3 relative overflow-hidden">
                      <span className="absolute left-0 top-0 h-full w-1 bg-[#5B5FEF]" />
                      <p className="text-xs font-bold uppercase tracking-wider text-[#5B5FEF] flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5" />
                        {moduleForms[visibleCourse.id]?.id
                          ? "Edit Unit"
                          : "Tambah Unit"}
                      </p>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-[#5B5A72]">
                            Judul Unit
                          </Label>
                          <Input
                            className="rounded-lg border-[#E4E3F7] bg-white"
                            value={
                              (moduleForms[visibleCourse.id] || emptyModuleForm)
                                .title
                            }
                            onChange={(e) =>
                              setModuleForms((prev) => ({
                                ...prev,
                                [visibleCourse.id]: {
                                  ...(prev[visibleCourse.id] ||
                                    emptyModuleForm),
                                  title: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-[#5B5A72]">
                            Deskripsi
                          </Label>
                          <Textarea
                            rows={2}
                            className="rounded-lg border-[#E4E3F7] bg-white"
                            value={
                              (moduleForms[visibleCourse.id] || emptyModuleForm)
                                .description
                            }
                            onChange={(e) =>
                              setModuleForms((prev) => ({
                                ...prev,
                                [visibleCourse.id]: {
                                  ...(prev[visibleCourse.id] ||
                                    emptyModuleForm),
                                  description: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-[#5B5A72]">
                              Urutan
                            </Label>
                            <Input
                              type="number"
                              className="rounded-lg border-[#E4E3F7] bg-white"
                              value={
                                (
                                  moduleForms[visibleCourse.id] ||
                                  emptyModuleForm
                                ).sort_order
                              }
                              onChange={(e) =>
                                setModuleForms((prev) => ({
                                  ...prev,
                                  [visibleCourse.id]: {
                                    ...(prev[visibleCourse.id] ||
                                      emptyModuleForm),
                                    sort_order: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <label className="flex items-end gap-2 pb-2.5 text-sm cursor-pointer text-[#5B5A72]">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded accent-[#5B5FEF]"
                              checked={
                                !!(
                                  moduleForms[visibleCourse.id] ||
                                  emptyModuleForm
                                ).is_published
                              }
                              onChange={(e) =>
                                setModuleForms((prev) => ({
                                  ...prev,
                                  [visibleCourse.id]: {
                                    ...(prev[visibleCourse.id] ||
                                      emptyModuleForm),
                                    is_published: e.target.checked,
                                  },
                                }))
                              }
                            />
                            Published
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveModule(visibleCourse.id)}
                            disabled={busyKey.startsWith("save-module")}
                            className="rounded-lg bg-[#5B5FEF] hover:bg-[#4A4EDD]"
                          >
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            Simpan
                          </Button>
                          {moduleForms[visibleCourse.id]?.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg border-[#E4E3F7]"
                              onClick={() =>
                                setModuleForms((prev) => ({
                                  ...prev,
                                  [visibleCourse.id]: { ...emptyModuleForm },
                                }))
                              }
                            >
                              Batal
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* module list */}
                  <div className="rounded-2xl border border-[#ECEBF7] overflow-hidden">
                    <div className="border-b border-[#ECEBF7] bg-[#FAFAFE] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#9694B0]">
                      Daftar Unit
                    </div>
                    <div className="max-h-[480px] overflow-y-auto divide-y divide-[#F0EFF9]">
                      {busyKey === `modules-${visibleCourse.id}` ? (
                        <div className="flex h-24 items-center justify-center text-sm text-[#9694B0] gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-[#5B5FEF]" />
                          Memuat...
                        </div>
                      ) : selectedModules.length === 0 ? (
                        <div className="p-4 text-sm text-[#9694B0]">
                          Belum ada unit.
                        </div>
                      ) : (
                        selectedModules.map((mod) => (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => {
                              setSelectedModuleByCourse((prev) => ({
                                ...prev,
                                [visibleCourse.id]: mod.id,
                              }));
                              loadModuleContent(mod.id);
                            }}
                            className={`block w-full text-left px-4 py-3 hover:bg-[#F8F8FE] transition-colors ${
                              selectedModuleId === mod.id
                                ? "bg-[#EEF0FD] border-l-2 border-[#5B5FEF]"
                                : "border-l-2 border-transparent"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {mod.title}
                                </p>
                                <p className="text-xs text-[#9694B0] line-clamp-1 mt-0.5">
                                  {mod.description || "—"}
                                </p>
                              </div>
                              {canManageCourses && (
                                <div className="flex shrink-0 gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-md hover:bg-white"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      editModule(visibleCourse.id, mod);
                                    }}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-md hover:bg-white"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteModule(visibleCourse.id, mod.id);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-[#F0475B]" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* ── right: content + assets ── */}
                <div className="space-y-4">
                  {!selectedModule ? (
                    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#E7E7F5] bg-[#FAFAFE] text-sm text-[#9694B0]">
                      <Layers className="h-6 w-6 text-[#C7C6E8]" />
                      Pilih atau tambah unit untuk mengelola konten.
                    </div>
                  ) : (
                    <>
                      {/* content editor */}
                      <div className="rounded-2xl border border-[#ECEBF7] overflow-hidden relative">
                        <span className="absolute left-0 top-0 h-full w-1 bg-[#FF7A50]" />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#ECEBF7] bg-[#FAFAFE] px-4 py-3 pl-5">
                          <div>
                            <p className="text-sm font-semibold flex items-center gap-1.5">
                              <FileEdit className="h-3.5 w-3.5 text-[#FF7A50]" />
                              Konten Unit
                            </p>
                            <p className="text-xs text-[#9694B0]">
                              {selectedModule.title}
                            </p>
                          </div>
                          {canManageCourses && (
                            <div className="flex gap-1">
                              {[
                                {
                                  icon: Heading2,
                                  action: "## Subjudul",
                                  label: "H2",
                                },
                                {
                                  icon: Bold,
                                  action: "**Teks tebal**",
                                  label: "Bold",
                                },
                                {
                                  icon: Italic,
                                  action: "*Teks miring*",
                                  label: "Italic",
                                },
                                {
                                  icon: List,
                                  action: "- Poin materi",
                                  label: "List",
                                },
                                {
                                  icon: Link,
                                  action: "[Link](https://)",
                                  label: "Link",
                                },
                              ].map(({ icon: Icon, action, label }) => (
                                <Button
                                  key={label}
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg border-[#ECEBF7]"
                                  title={label}
                                  onClick={() =>
                                    insertMarkdown(selectedModule.id, action)
                                  }
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="p-4 pl-5">
                          <div
                            className={`grid gap-4 ${
                              canManageCourses ? "lg:grid-cols-2" : ""
                            }`}
                          >
                            {/* preview */}
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1.5 text-[#5B5A72]">
                                <Eye className="h-3.5 w-3.5" />
                                {canManageCourses
                                  ? "Preview"
                                  : selectedContent.title || "Materi"}
                              </Label>
                              <div
                                className="min-h-[340px] rounded-xl border border-[#ECEBF7] bg-[#FAFAFE] p-4 text-sm leading-7 overflow-y-auto"
                                dangerouslySetInnerHTML={{
                                  __html: markdownPreview(
                                    selectedContent.summary || ""
                                  ),
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* media assets */}
                      <div className="rounded-2xl border border-[#ECEBF7] overflow-hidden relative">
                        <span className="absolute left-0 top-0 h-full w-1 bg-[#12B3A0]" />
                        <div className="border-b border-[#ECEBF7] bg-[#FAFAFE] px-4 py-3 pl-5">
                          <p className="text-sm font-semibold flex items-center gap-1.5">
                            <Film className="h-3.5 w-3.5 text-[#12B3A0]" />
                            Media Modul
                          </p>
                          <p className="text-xs text-[#9694B0]">
                            Video, audiobook, gambar, ebook, worksheet
                          </p>
                        </div>
                        <div className="p-4 pl-5">
                          <div
                            className={`grid gap-4 ${
                              canManageCourses ? "lg:grid-cols-[1fr_300px]" : ""
                            }`}
                          >
                            {/* asset list */}
                            <div className="space-y-2">
                              {selectedAssets.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-[#E7E7F5] bg-[#FAFAFE] p-8 text-center text-sm text-[#9694B0]">
                                  {canManageCourses
                                    ? "Belum ada media. Tambahkan dari panel kanan."
                                    : "Belum ada media untuk modul ini."}
                                </div>
                              ) : (
                                selectedAssets.map((asset) => {
                                  const meta =
                                    assetTypes.find(
                                      (t) => t.value === asset.type
                                    ) || assetTypes[0];
                                  const Icon = meta.icon;
                                  return (
                                    <div
                                      key={asset.id}
                                      className="flex items-center justify-between gap-3 rounded-xl border border-[#ECEBF7] bg-white px-3 py-2.5 hover:border-[#12B3A0]/40 transition-colors"
                                    >
                                      <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E7FBF8]">
                                          <Icon className="h-4 w-4 text-[#12B3A0]" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium">
                                            {asset.title}
                                          </p>
                                          <p className="truncate text-xs text-[#9694B0]">
                                            {meta.label} · {asset.file_url}
                                          </p>
                                        </div>
                                      </div>
                                      {canManageCourses && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 shrink-0 rounded-lg hover:bg-[#FFEDEF]"
                                          onClick={() =>
                                            deleteAsset(
                                              selectedLessonId,
                                              asset.id
                                            )
                                          }
                                        >
                                          <Trash2 className="h-4 w-4 text-[#F0475B]" />
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── infinite scroll sentinel ── */}
        <div
          ref={observerTargetRef}
          className="flex min-h-14 flex-col items-center justify-center gap-2 py-3"
        >
          {loading && courses.length > 0 && (
            <div className="flex items-center gap-2 text-sm font-medium text-[#9694B0]">
              <Loader2 className="h-4 w-4 animate-spin text-[#5B5FEF]" />
              <span>Memuat kelas berikutnya...</span>
            </div>
          )}
          {!loading && currentPage >= totalPages && courses.length > 0 && (
            <span className="text-xs text-[#9694B0]">
              Semua kelas telah ditampilkan ({courses.length})
            </span>
          )}
        </div>
      </div>

      <CourseFormDialog
        isOpen={courseFormOpen}
        onOpenChange={setCourseFormOpen}
        data={editingCourse}
        categories={categories}
        organizations={[]}
        onSuccess={async () => {
          setCurrentPage(1);
          await fetchCourses(1, true);
          await fetchSellingStatus();
        }}
      />
    </div>
  );
}

export default StudentCourseList;
