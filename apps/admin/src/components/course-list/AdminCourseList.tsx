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
  Cog,
  Settings2Icon,
  Settings,
  Edit3,
  SlidersHorizontal,
  RotateCcw as ResetIcon,
} from "lucide-react";
import { Link as RouterLink, useNavigate } from "react-router";
import { useLanguage } from "@/context/LanguageContext";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import CourseFormDialog from "./CourseFormDialog";
import CategoryPanel from "./CategoryPanel";
import StatCard from "./StatCard";
import { ROLES } from "../../lib/constants";

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

/* ─── helpers ────────────────────────────────────────────────── */

const getResponseData = (r) => r.data?.data || r.data || [];

const statusMeta = {
  published: {
    label: "Published",
    cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  draft: {
    label: "Draft",
    cls: "bg-slate-100 text-slate-600 border-slate-200",
  },
  archived: {
    label: "Archived",
    cls: "bg-red-100 text-red-600 border-red-200",
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
      '<a href="$2" target="_blank" rel="noreferrer" class="text-blue-600 underline">$1</a>'
    )
    .replace(/^\- (.*$)/gim, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/\n/g, "<br />");
};

/* ─── sub-components ─────────────────────────────────────────── */

/* ─── main page ──────────────────────────────────────────────── */

function AdminCourseList({ user }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [targetRoleFilter, setTargetRoleFilter] = useState("ALL");
  const [orderFilter, setOrderFilter] = useState("default");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(12);
  const [totalPages, setTotalPages] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [categories, setCategories] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);

  const [mentors, setMentors] = useState([]);
  const [mentorFilter, setMentorFilter] = useState("ALL");
  const [openMentorDropdown, setOpenMentorDropdown] = useState(false);
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0, categories: 0 });

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
  const canManageCourseCategory =
    role >= 99;
  const canManageCourses =
    canManageCourseCategory ||
    role === ROLES.INSTRUCTOR ||
    role === ROLES.MENTOR_EXTERNAL ||
    role === ROLES.MERCHANT;
  const creatorScope = role >= 99 ? "internal_mentors" : undefined;
  /* ── fetchers ── */

  const fetchStats = async () => {
    try {
      const res = await api.get("/lms/courses/stats", {
        params: {
          search: searchTerm,
          course_category_id:
            categoryFilter !== "ALL" ? categoryFilter : undefined,
          mentor_id:
            mentorFilter !== "ALL" ? mentorFilter : undefined,
          include_drafts: canManageCourses ? true : undefined,
          creator_scope: creatorScope,
          level: levelFilter !== "ALL" ? levelFilter : undefined,
          availability:
            availabilityFilter !== "ALL" ? availabilityFilter : undefined,
          owner_type: ownerFilter !== "ALL" ? ownerFilter : undefined,
          target_role:
            targetRoleFilter !== "ALL" ? targetRoleFilter : undefined,
          min_price: minPriceFilter || undefined,
          max_price: maxPriceFilter || undefined,
        },
      });
      if (res.data?.data) {
        setStats(res.data.data);
      }
    } catch {
      // silent
    }
  };

  const observerTargetRef = useRef(null);

  const fetchCourses = async (pageToFetch = currentPage, isReset = false) => {
    setLoading(true);
    try {
      const res = await api.get("/lms/courses", {
        params: {
          page: pageToFetch,
          limit,
          search: searchTerm,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          course_category_id:
            categoryFilter !== "ALL" ? categoryFilter : undefined,
          mentor_id:
            mentorFilter !== "ALL" ? mentorFilter : undefined,
          include_drafts: canManageCourses ? true : undefined,
          creator_scope: creatorScope,
          level: levelFilter !== "ALL" ? levelFilter : undefined,
          availability:
            availabilityFilter !== "ALL" ? availabilityFilter : undefined,
          owner_type: ownerFilter !== "ALL" ? ownerFilter : undefined,
          target_role:
            targetRoleFilter !== "ALL" ? targetRoleFilter : undefined,
          order: orderFilter !== "default" ? orderFilter : undefined,
          min_price: minPriceFilter || undefined,
          max_price: maxPriceFilter || undefined,
        },
      });
      const { data, pagination } = res.data;
      const rawData = data || res.data || [];
      const fetchedData = Array.isArray(rawData) ? rawData : [];
      if (pageToFetch === 1 || isReset) {
        setCourses(fetchedData);
      } else {
        setCourses((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const existingIds = new Set(safePrev.map((c) => c.id));
          const uniqueNew = fetchedData.filter((c) => !existingIds.has(c.id));
          return [...safePrev, ...uniqueNew];
        });
      }
      if (pagination) setTotalPages(pagination.total_pages);
      fetchStats();
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

  const fetchMentors = async () => {
    try {
      const res = await api.get("/subscriptions/admin/resources/mentors", {
        params: { limit: 100 },
      });
      const raw = getResponseData(res);
      setMentors(Array.isArray(raw) ? raw : []);
    } catch {
      setMentors([]);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    const t = setTimeout(() => {
      fetchCourses(1, true);
    }, 400);
    return () => clearTimeout(t);
  }, [
    searchTerm,
    statusFilter,
    categoryFilter,
    mentorFilter,
    levelFilter,
    availabilityFilter,
    ownerFilter,
    targetRoleFilter,
    orderFilter,
    minPriceFilter,
    maxPriceFilter,
    canManageCourses,
  ]);

  useEffect(() => {
    if (currentPage > 1) {
      fetchCourses(currentPage, false);
    }
  }, [currentPage]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && currentPage < totalPages) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 0.2 }
    );

    const target = observerTargetRef.current;
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [loading, currentPage, totalPages]);

  useEffect(() => {
    fetchCategories();
    if (Number(user?.role || 0) >= 99) {
      fetchMentors();
    }
  }, []);

  /* ── derived state ── */

  const visibleCourse = useMemo(
    () => courses.find((c) => c.id === expandedCourseId),
    [courses, expandedCourseId]
  );

  const counts = stats;
  const isInitialLoading = loading && courses.length === 0;
  const activeAdvancedFilterCount = [
    levelFilter,
    availabilityFilter,
    ownerFilter,
    targetRoleFilter,
  ].filter((value) => value !== "ALL").length +
    (orderFilter !== "default" ? 1 : 0) +
    (minPriceFilter ? 1 : 0) +
    (maxPriceFilter ? 1 : 0);

  const resetAdvancedFilters = () => {
    setLevelFilter("ALL");
    setAvailabilityFilter("ALL");
    setOwnerFilter("ALL");
    setTargetRoleFilter("ALL");
    setOrderFilter("default");
    setMinPriceFilter("");
    setMaxPriceFilter("");
    setCurrentPage(1);
  };

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

  const handleDelete = async (id) => {
    if (
      !confirm(
        "Hapus kursus ini? Data modul & materi di dalamnya akan ikut terhapus."
      )
    )
      return;
    const toastId = toast.loading("Menghapus kursus...");
    try {
      await api.delete(`/lms/admin/courses/${id}`);
      toast.success("Kursus berhasil dihapus.", { id: toastId });
      fetchCourses();
    } catch {
      toast.error("Gagal menghapus kursus.", { id: toastId });
    }
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
    <div className="min-h-screen bg-background text-foreground">
      <CategoryPanel
        open={categoryPanelOpen}
        onClose={() => setCategoryPanelOpen(false)}
        categories={categories}
        onRefresh={fetchCategories}
      />

      <div className="px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
        {/* ── header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {canManageCourses ? t("courses.title.admin") : t("courses.title.student")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {canManageCourses
                ? t("courses.subtitle.admin")
                : t("courses.subtitle.student")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManageCourseCategory && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCategoryPanelOpen(true)}
                className="gap-2"
              >
                <Tag className="h-3.5 w-3.5" />
                Kategori
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={fetchCourses}
              title="Refresh"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
            {canManageCourses && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingCourse(null);
                  setIsFormOpen(true);
                }}
                className="gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                Buat Kursus
              </Button>
            )}
          </div>
        </div>

        {/* ── stats strip ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Kursus"
            value={counts.total}
            icon={LayoutGrid}
          />
          <StatCard
            label="Published"
            value={counts.published}
            icon={BookOpen}
          />
          {canManageCourses && (
            <StatCard label="Draft" value={counts.draft} icon={Layers} />
          )}
          <StatCard label="Kategori" value={stats.categories} icon={Tag} />
        </div>

        {/* ── filter bar ── */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari judul kursus..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Category Searchable Dropdown */}
            <div className="w-full sm:w-[240px]">
              <Popover open={openCategoryDropdown} onOpenChange={setOpenCategoryDropdown}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCategoryDropdown}
                    className="w-full justify-between font-normal text-muted-foreground"
                  >
                    <span className="truncate text-slate-900">
                      {categoryFilter === "ALL"
                        ? "Semua Kategori"
                        : categories.find((cat) => cat.id === categoryFilter)?.name || "Pilih Kategori"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Cari kategori..." />
                    <CommandList>
                      <CommandEmpty>Kategori tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="ALL"
                          onSelect={() => {
                            setCategoryFilter("ALL");
                            setCurrentPage(1);
                            setOpenCategoryDropdown(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              categoryFilter === "ALL" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Semua Kategori
                        </CommandItem>
                        {(Array.isArray(categories) ? categories : []).map((cat) => (
                          <CommandItem
                            key={cat.id}
                            value={cat.name}
                            onSelect={() => {
                              setCategoryFilter(cat.id);
                              setCurrentPage(1);
                              setOpenCategoryDropdown(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                categoryFilter === cat.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {cat.name}
                            {!cat.is_active && " (nonaktif)"}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Mentor Searchable Dropdown (Admin only) */}
            {Number(user?.role || 0) >= 99 && (
              <div className="w-full sm:w-[240px]">
                <Popover open={openMentorDropdown} onOpenChange={setOpenMentorDropdown}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openMentorDropdown}
                      className="w-full justify-between font-normal text-muted-foreground"
                    >
                      <span className="truncate text-slate-900 font-medium">
                        {mentorFilter === "ALL"
                          ? "Semua Mentor"
                          : (Array.isArray(mentors) ? mentors : []).find((m) => m.id === mentorFilter)?.name || "Pilih Mentor"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Cari nama mentor..." />
                      <CommandList>
                        <CommandEmpty>Mentor tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="ALL"
                            onSelect={() => {
                              setMentorFilter("ALL");
                              setCurrentPage(1);
                              setOpenMentorDropdown(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                mentorFilter === "ALL" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Semua Mentor
                          </CommandItem>
                          {(Array.isArray(mentors) ? mentors : []).map((m) => (
                            <CommandItem
                              key={m.id}
                              value={m.name || m.display_name}
                              onSelect={() => {
                                setMentorFilter(m.id);
                                setCurrentPage(1);
                                setOpenMentorDropdown(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  mentorFilter === m.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {m.name || m.display_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Status Dropdown */}
            <div className="w-full sm:w-[180px]">
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  {canManageCourses && (
                    <>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Collapsible
            open={advancedFiltersOpen}
            onOpenChange={setAdvancedFiltersOpen}
            className="border-t pt-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 px-2 text-slate-600"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter lanjutan
                  {activeAdvancedFilterCount > 0 && (
                    <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                      {activeAdvancedFilterCount}
                    </Badge>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      advancedFiltersOpen && "rotate-180"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              {activeAdvancedFilterCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetAdvancedFilters}
                  className="gap-1.5 text-xs text-muted-foreground"
                >
                  <ResetIcon className="h-3.5 w-3.5" />
                  Reset filter
                </Button>
              )}
            </div>

            <CollapsibleContent className="pt-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua jenjang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua jenjang</SelectItem>
                    <SelectItem value="Early Years">Early Years</SelectItem>
                    <SelectItem value="SD / Elementary">SD / Elementary</SelectItem>
                    <SelectItem value="SMP / Middle School">SMP / Middle School</SelectItem>
                    <SelectItem value="SMA / High School">SMA / High School</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={availabilityFilter}
                  onValueChange={setAvailabilityFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Model akses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua model akses</SelectItem>
                    <SelectItem value="individual">Dijual satuan</SelectItem>
                    <SelectItem value="subscription">Langganan saja</SelectItem>
                    <SelectItem value="free">Gratis</SelectItem>
                    <SelectItem value="paid">Berbayar</SelectItem>
                    <SelectItem value="discounted">Sedang diskon</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pemilik course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua pemilik</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={targetRoleFilter}
                  onValueChange={setTargetRoleFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Target pengguna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua target</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="mentor">Mentor</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={minPriceFilter}
                  onChange={(event) => setMinPriceFilter(event.target.value)}
                  placeholder="Harga minimum"
                />
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={maxPriceFilter}
                  onChange={(event) => setMaxPriceFilter(event.target.value)}
                  placeholder="Harga maksimum"
                />
              </div>

              <div className="mt-3 max-w-xs">
                <Select value={orderFilter} onValueChange={setOrderFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Urutkan course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Urutan kurikulum</SelectItem>
                    <SelectItem value="newest">Terbaru</SelectItem>
                    <SelectItem value="oldest">Terlama</SelectItem>
                    <SelectItem value="popular">Paling populer</SelectItem>
                    <SelectItem value="title_asc">Judul A–Z</SelectItem>
                    <SelectItem value="title_desc">Judul Z–A</SelectItem>
                    <SelectItem value="price_asc">Harga terendah</SelectItem>
                    <SelectItem value="price_desc">Harga tertinggi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* ── course grid ── */}
        {isInitialLoading ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Memuat data kursus...</span>
          </div>
        ) : !Array.isArray(courses) || courses.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border bg-card text-muted-foreground">
            <BookOpen className="h-10 w-10 opacity-30" />
            <span className="text-sm">Tidak ada kursus ditemukan.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(Array.isArray(courses) ? courses : []).map((course) => {
              const sm = statusMeta[course.status] || statusMeta.draft;
              const isExpanded = expandedCourseId === course.id;
              return (
                <div
                  key={course.id}
                  className={`group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md ${
                    isExpanded ? "ring-2 ring-foreground/20" : ""
                  }`}
                >
                  {/* thumbnail */}
                  {course.cover_image_url ? (
                    <img
                      src={course.cover_image_url}
                      alt={course.title}
                      className="h-36 w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center bg-muted">
                      <BookOpen className="h-8 w-8 opacity-20" />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-4 gap-3">
                    {/* title + status */}
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-2 flex-1 text-sm font-semibold leading-snug">
                        <RouterLink
                          to={
                            canManageCourses
                              ? `/dashboard/courses/${course.id}`
                              : `/dashboard/courses/${course.id}`
                          }
                          className="hover:underline"
                        >
                          {course.title}
                        </RouterLink>
                      </h2>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sm.cls}`}
                      >
                        {sm.label}
                      </span>
                    </div>

                    {/* description */}
                    <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                      {course.short_description || "Tidak ada deskripsi"}
                    </p>

                    {/* mentors */}
                    {Array.isArray(course.mentors) && course.mentors.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                        <span className="font-semibold">Mentor:</span>
                        <span className="truncate">
                          {course.mentors
                            .map((m) => m.name || m.display_name || m.username)
                            .join(", ")}
                        </span>
                      </div>
                    )}

                    {/* tags & price */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {course.course_category?.name && (
                          <span className="rounded-md bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 font-medium">
                            {course.course_category.name}
                          </span>
                        )}
                        {course.level && (
                          <span className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                            {course.level}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Target Roles Badges */}
                    <div className="flex flex-col gap-1 text-[11px]">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-semibold text-slate-500">Course Roles:</span>
                        {(course.target_roles || []).length > 0 ? (
                          (course.target_roles || []).map((role) => (
                            <span key={role} className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 capitalize">
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-[10px] italic">Semua</span>
                        )}
                      </div>
                      {(course.category_roles || []).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                          <span>Cat Roles: {(course.category_roles || []).join(", ")}</span>
                        </div>
                      )}
                    </div>

                    {/* footer */}
                    <div className="mt-auto pt-2 flex items-center justify-between border-t border-border/60">
                      <span className="text-[11px] text-muted-foreground">
                        {dayjs(course.created_at).format("DD MMM YYYY")}
                      </span>
                      <div className="flex gap-0.5">
                        {canManageCourses && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleCourse(course.id)}
                              title={
                                canManageCourses ? "Kelola unit" : "Lihat unit"
                              }
                            >
                              <RouterLink
                                to={`/dashboard/courses/${course.id}/modules?view=true`}
                              >
                                <Eye
                                  className={`h-4 w-4 ${
                                    isExpanded
                                      ? "text-foreground"
                                      : "text-emerald-600"
                                  }`}
                                />
                              </RouterLink>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleCourse(course.id)}
                              title={
                                canManageCourses ? "Kelola unit" : "Lihat unit"
                              }
                            >
                              <RouterLink
                                to={`/dashboard/courses/${course.id}/modules`}
                              >
                                <Edit3
                                  className={`h-4 w-4 ${
                                    isExpanded
                                      ? "text-foreground"
                                      : "text-emerald-600"
                                  }`}
                                />
                              </RouterLink>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingCourse(course);
                                setIsFormOpen(true);
                              }}
                              title="Edit kursus"
                            >
                              <Settings className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDelete(course.id)}
                              title="Hapus kursus"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
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
          <section className="rounded-xl border bg-card overflow-hidden">
            {/* section header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border bg-muted p-2">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-semibold">{visibleCourse.title}</h2>
                  <p className="text-xs text-muted-foreground">
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
                  className="gap-2"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setExpandedCourseId(null)}
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
                    <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {moduleForms[visibleCourse.id]?.id
                          ? "Edit Unit"
                          : "Tambah Unit"}
                      </p>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Judul Unit</Label>
                          <Input
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
                          <Label className="text-xs">Deskripsi</Label>
                          <Textarea
                            rows={2}
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
                            <Label className="text-xs">Urutan</Label>
                            <Input
                              type="number"
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
                          <label className="flex items-end gap-2 pb-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
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
                          >
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            Simpan
                          </Button>
                          {moduleForms[visibleCourse.id]?.id && (
                            <Button
                              size="sm"
                              variant="outline"
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
                  <div className="rounded-xl border overflow-hidden">
                    <div className="border-b bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Daftar Unit
                    </div>
                    <div className="max-h-[480px] overflow-y-auto divide-y">
                      {busyKey === `modules-${visibleCourse.id}` ? (
                        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Memuat...
                        </div>
                      ) : selectedModules.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
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
                            className={`block w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                              selectedModuleId === mod.id ? "bg-muted" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {mod.title}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                  {mod.description || "—"}
                                </p>
                              </div>
                              {canManageCourses && (
                                <div className="flex shrink-0 gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
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
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteModule(visibleCourse.id, mod.id);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
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
                    <div className="flex h-64 items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
                      Pilih atau tambah unit untuk mengelola konten.
                    </div>
                  ) : (
                    <>
                      {/* content editor */}
                      <div className="rounded-xl border overflow-hidden">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b bg-muted/30 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold">
                              Konten Unit
                            </p>
                            <p className="text-xs text-muted-foreground">
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
                                  className="h-8 w-8"
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
                        <div className="p-4">
                          <div
                            className={`grid gap-4 ${
                              canManageCourses ? "lg:grid-cols-2" : ""
                            }`}
                          >
                            {canManageCourses && (
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    Judul Konten
                                  </Label>
                                  <Input
                                    value={selectedContent.title || ""}
                                    onChange={(e) =>
                                      setContentForms((prev) => ({
                                        ...prev,
                                        [selectedModule.id]: {
                                          ...selectedContent,
                                          title: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    Markdown / Rich Text
                                  </Label>
                                  <Textarea
                                    rows={14}
                                    className="font-mono text-xs"
                                    value={selectedContent.summary || ""}
                                    onChange={(e) =>
                                      setContentForms((prev) => ({
                                        ...prev,
                                        [selectedModule.id]: {
                                          ...selectedContent,
                                          summary: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div className="flex flex-wrap items-center gap-4 pt-1">
                                  {[
                                    { key: "is_preview", label: "Preview" },
                                    { key: "is_published", label: "Published" },
                                  ].map(({ key, label }) => (
                                    <label
                                      key={key}
                                      className="flex items-center gap-2 text-sm cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={!!selectedContent[key]}
                                        onChange={(e) =>
                                          setContentForms((prev) => ({
                                            ...prev,
                                            [selectedModule.id]: {
                                              ...selectedContent,
                                              [key]: e.target.checked,
                                            },
                                          }))
                                        }
                                      />
                                      {label}
                                    </label>
                                  ))}
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      saveContent(selectedModule.id)
                                    }
                                    disabled={
                                      busyKey ===
                                      `save-content-${selectedModule.id}`
                                    }
                                  >
                                    <Save className="mr-1.5 h-3.5 w-3.5" />
                                    Simpan Konten
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* preview */}
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1.5">
                                <Eye className="h-3.5 w-3.5" />
                                {canManageCourses
                                  ? "Preview"
                                  : selectedContent.title || "Materi"}
                              </Label>
                              <div
                                className="min-h-[340px] rounded-lg border bg-muted/20 p-4 text-sm leading-7 overflow-y-auto"
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
                      <div className="rounded-xl border overflow-hidden">
                        <div className="border-b bg-muted/30 px-4 py-3">
                          <p className="text-sm font-semibold">Media Modul</p>
                          <p className="text-xs text-muted-foreground">
                            Video, audiobook, gambar, ebook, worksheet
                          </p>
                        </div>
                        <div className="p-4">
                          <div
                            className={`grid gap-4 ${
                              canManageCourses ? "lg:grid-cols-[1fr_300px]" : ""
                            }`}
                          >
                            {/* asset list */}
                            <div className="space-y-2">
                              {selectedAssets.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
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
                                      className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5"
                                    >
                                      <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                          <Icon className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium">
                                            {asset.title}
                                          </p>
                                          <p className="truncate text-xs text-muted-foreground">
                                            {meta.label} · {asset.file_url}
                                          </p>
                                        </div>
                                      </div>
                                      {canManageCourses && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 shrink-0"
                                          onClick={() =>
                                            deleteAsset(
                                              selectedLessonId,
                                              asset.id
                                            )
                                          }
                                        >
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* asset form */}
                            {canManageCourses && (
                              <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Tambah Media
                                </p>
                                <div className="space-y-1">
                                  <Label className="text-xs">Tipe Media</Label>
                                  <select
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    value={selectedAssetForm.type}
                                    onChange={(e) =>
                                      setAssetForms((prev) => ({
                                        ...prev,
                                        [selectedLessonId]: {
                                          ...selectedAssetForm,
                                          type: e.target.value,
                                          file_url: "",
                                        },
                                      }))
                                    }
                                  >
                                    {assetTypes.map((t) => (
                                      <option key={t.value} value={t.value}>
                                        {t.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Judul Media</Label>
                                  <Input
                                    value={selectedAssetForm.title}
                                    onChange={(e) =>
                                      setAssetForms((prev) => ({
                                        ...prev,
                                        [selectedLessonId]: {
                                          ...selectedAssetForm,
                                          title: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    Upload Media
                                  </Label>
                                  <Input
                                    type="file"
                                    accept={
                                      acceptByAssetType[
                                        selectedAssetForm.type
                                      ] || undefined
                                    }
                                    onChange={(e) =>
                                      uploadAssetFile(
                                        selectedLessonId,
                                        e.target.files?.[0]
                                      )
                                    }
                                  />
                                  {selectedAssetForm.file_url ? (
                                    <p className="truncate text-xs text-emerald-700">
                                      Media siap: {selectedAssetForm.file_url}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      File akan otomatis diupload ke Tencent
                                      COS.
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    Upload Thumbnail
                                  </Label>
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                      uploadAssetThumbnail(
                                        selectedLessonId,
                                        e.target.files?.[0]
                                      )
                                    }
                                  />
                                  {selectedAssetForm.thumbnail_url ? (
                                    <div className="mt-2 overflow-hidden rounded-lg border bg-background">
                                      <img
                                        src={selectedAssetForm.thumbnail_url}
                                        alt="Thumbnail media"
                                        className="h-28 w-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      Opsional, upload gambar jika media butuh
                                      thumbnail.
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Deskripsi</Label>
                                  <Textarea
                                    rows={2}
                                    value={selectedAssetForm.description}
                                    onChange={(e) =>
                                      setAssetForms((prev) => ({
                                        ...prev,
                                        [selectedLessonId]: {
                                          ...selectedAssetForm,
                                          description: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={
                                      !!selectedAssetForm.is_downloadable
                                    }
                                    onChange={(e) =>
                                      setAssetForms((prev) => ({
                                        ...prev,
                                        [selectedLessonId]: {
                                          ...selectedAssetForm,
                                          is_downloadable: e.target.checked,
                                        },
                                      }))
                                    }
                                  />
                                  Bisa diunduh
                                </label>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => addAsset(selectedLessonId)}
                                  disabled={
                                    !selectedLessonId ||
                                    busyKey === `asset-${selectedLessonId}`
                                  }
                                >
                                  <Upload className="mr-2 h-3.5 w-3.5" />
                                  Tambah Media
                                </Button>
                              </div>
                            )}
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

        {/* ── infinite scroll loader & sentinel ── */}
        <div ref={observerTargetRef} className="py-6 flex flex-col items-center justify-center gap-2">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Memuat lebih banyak kursus...</span>
            </div>
          )}
          {!loading && currentPage >= totalPages && courses.length > 0 && (
            <span className="text-xs text-muted-foreground italic">
              Semua kursus telah ditampilkan ({courses.length})
            </span>
          )}
        </div>
      </div>

      <CourseFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        data={editingCourse}
        categories={categories}
        organizations={organizations}
        onSuccess={fetchCourses}
      />
    </div>
  );
}

export default AdminCourseList;
