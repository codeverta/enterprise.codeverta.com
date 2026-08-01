import React, { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  CircleDollarSign,
  FileText,
  ImageIcon,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import MarkdownView from "@/components/course-editor/MarkdownView";
import { Checkbox } from "@/components/ui/checkbox";
import AICourseCoverGenerator, {
  hasPendingAICourseCoverReview,
} from "./AICourseCoverGenerator";

export default function CourseFormDialog({
  isOpen,
  onOpenChange,
  data,
  onSuccess,
  categories = [],
  organizations = [],
}) {
  const isEdit = !!data;
  const [loading, setLoading] = useState(false);
  const [mentorsList, setMentorsList] = useState([]);
  const [openMentorPopover, setOpenMentorPopover] = useState(false);
  const [errors, setErrors] = useState({});
  const [descTab, setDescTab] = useState<"write" | "preview">("write");
  const [openOptionalSections, setOpenOptionalSections] = useState<string[]>(
    []
  );

  const insertMarkdown = (syntaxBefore: string, syntaxAfter: string = "", defaultText: string = "") => {
    const textarea = document.getElementById("description") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    const replacement = selectedText
      ? syntaxBefore + selectedText + syntaxAfter
      : syntaxBefore + defaultText + syntaxAfter;

    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newValue = before + replacement + after;
    setFormData((prev) => ({ ...prev, description: newValue }));

    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + replacement.length, start + replacement.length);
      } else {
        textarea.setSelectionRange(start + syntaxBefore.length, start + syntaxBefore.length + defaultText.length);
      }
    }, 0);
  };

  const MAX_TITLE_CHARS = 180;
  const MAX_SLUG_CHARS = 200;
  const MAX_DESC_CHARS = 5000;
  const MAX_SHORT_DESC_CHARS = 500;

  const sessionUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const isAdmin = Number(sessionUser?.role || 0) >= 99;

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (sessionUser?.role === 30) {
        api
          .get("/my-profile")
          .then((res) => {
            const profileData = res.data?.data || {};
            setCurrentUser({
              role: sessionUser.role,
              id: sessionUser.id,
              display_name: profileData.display_name || sessionUser.display_name || "",
              mentor_id: profileData.mentor_id || "",
            });
          })
          .catch((err) => {
            console.error("Gagal mengambil profile mentor", err);
            setCurrentUser({
              role: sessionUser.role,
              id: sessionUser.id,
              display_name: sessionUser.display_name || "",
              mentor_id: "",
            });
          });
      } else {
        setCurrentUser({
          role: sessionUser?.role || 0,
          id: sessionUser?.id || "",
          display_name: sessionUser?.display_name || "",
          mentor_id: "",
        });
      }
    }
  }, [isOpen, sessionUser]);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    short_description: "",
    description: "",
    course_category_id: "",
    level: "",
    age_range: "",
    status: "draft",
    cover_image_url: "",
    minimum_passing_grade: 0,
    allow_skip: false,
    price: 0,
    sell_individual: false,
    discount_percent: 0,
    promo_start_date: "",
    promo_end_date: "",
    owner_type: "external",
    organization_id: "",
    mentor_ids: !isAdmin && sessionUser?.id ? [sessionUser.id] : [],
    target_roles: [],
  });

  const selectedCategoryRoles = useMemo(() => {
    if (!formData.course_category_id) return [];
    const cat = categories.find((c) => c.id === formData.course_category_id);
    return cat?.target_roles && cat.target_roles.length > 0 ? cat.target_roles : ["student", "mentor", "parent"];
  }, [categories, formData.course_category_id]);

  const handleCategoryChange = (val) => {
    const selectedCat = categories.find((c) => c.id === val);
    const catRoles = selectedCat?.target_roles && selectedCat.target_roles.length > 0
      ? selectedCat.target_roles
      : ["student", "mentor", "parent"];

    const prevRoles = formData.target_roles || [];
    const filteredRoles = prevRoles.filter((r) => catRoles.includes(r));
    const nextRoles = filteredRoles.length > 0 ? filteredRoles : [...catRoles];

    if (formData.course_category_id && formData.course_category_id !== val && filteredRoles.length < prevRoles.length) {
      toast.info("Target role disesuaikan dengan role yang tersedia pada Course Category baru.");
    }

    setFormData((prev) => ({
      ...prev,
      course_category_id: val,
      target_roles: nextRoles,
    }));
    setErrors((prev) => ({ ...prev, course_category_id: "", target_roles: "" }));
  };

  const toggleCourseTargetRole = (roleKey) => {
    setFormData((prev) => {
      const current = prev.target_roles || [];
      const exists = current.includes(roleKey);
      const next = exists ? current.filter((r) => r !== roleKey) : [...current, roleKey];
      return { ...prev, target_roles: next };
    });
    setErrors((prev) => ({ ...prev, target_roles: "" }));
  };

  // 1. Fetch data master mentor saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      if (isEdit && Array.isArray(data?.mentors)) {
        setMentorsList(data.mentors);
      } else {
        setMentorsList([]);
      }
      const fetchMentors = async () => {
        try {
          const res = await api.get("/subscriptions/admin/resources/mentors?limit=100");
          const payload = res.data?.data || res.data || [];
          setMentorsList(Array.isArray(payload) ? payload : []);
        } catch (err) {
          console.error("Gagal memuat list mentor", err);
          setMentorsList([]);
        }
      };
      fetchMentors();
    } else {
      setMentorsList([]);
    }
  }, [isOpen, isEdit, data]);

  // 2. Populate data form saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      clearErrors();
      setOpenOptionalSections(
        isAdmin && hasPendingAICourseCoverReview()
          ? ["media-navigation"]
          : []
      );
      if (isEdit && data) {
        const activeMentorIds = Array.isArray(data.mentors)
          ? data.mentors.map((m) => m.id)
          : [];

        setFormData({
          title: data.title || "",
          slug: data.slug || "",
          short_description: data.short_description || "",
          description: data.description || "",
          course_category_id: data.course_category_id || "",
          level: data.level || "",
          age_range: data.age_range || "",
          status: data.status || "draft",
          cover_image_url: data.cover_image_url || "",
          minimum_passing_grade: data.minimum_passing_grade || 0,
          allow_skip: data.allow_skip || false,
          price: data.price || 0,
          sell_individual: data.sell_individual || false,
          discount_percent: data.discount_percent || 0,
          promo_start_date: data.promo_start_date || "",
          promo_end_date: data.promo_end_date || "",
          owner_type: data.owner_type || "external",
          organization_id: data.organization_id || "",
          mentor_ids: activeMentorIds,
          target_roles: data.target_roles && data.target_roles.length > 0 ? data.target_roles : (data.category_roles || ["student", "mentor", "parent"]),
        });
      } else {
        setFormData({
          title: "",
          slug: "",
          short_description: "",
          description: "",
          course_category_id: "",
          level: "",
          age_range: "",
          status: "draft",
          cover_image_url: "",
          minimum_passing_grade: 0,
          allow_skip: false,
          price: 0,
          sell_individual: false,
          discount_percent: 0,
          promo_start_date: "",
          promo_end_date: "",
          owner_type: "external",
          organization_id: "",
          mentor_ids: !isAdmin && sessionUser?.id ? [sessionUser.id] : [],
          target_roles: [],
        });
      }
    }
  }, [isOpen, data, isEdit, isAdmin]);

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    const err = validateField("title", newTitle);
    setErrors((prev) => ({ ...prev, title: err }));
    setFormData((prev) => {
      const newSlug = !isEdit
        ? newTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "")
        : prev.slug;
      return { ...prev, title: newTitle, slug: newSlug };
    });
  };

  // Handler toggle pilih mentor untuk Admin (Multi-select)
  const handleToggleMentor = (mentorId) => {
    setFormData((prev) => {
      const isExist = prev.mentor_ids.includes(mentorId);
      const updatedIds = isExist
        ? prev.mentor_ids.filter((id) => id !== mentorId)
        : [...prev.mentor_ids, mentorId];
      return { ...prev, mentor_ids: updatedIds };
    });
  };

  const clearErrors = () => setErrors({});

  const validateField = (field, value) => {
    const len = (value || "").length;
    const fieldMax = {
      title: MAX_TITLE_CHARS,
      slug: MAX_SLUG_CHARS,
      description: MAX_DESC_CHARS,
      short_description: MAX_SHORT_DESC_CHARS,
    }[field];
    if (fieldMax && len > fieldMax) return `Maksimal ${fieldMax.toLocaleString("id")} karakter`;
    return "";
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title?.trim()) newErrors.title = "Judul kursus wajib diisi";
    else if ((formData.title || "").length > MAX_TITLE_CHARS)
      newErrors.title = `Maksimal ${MAX_TITLE_CHARS.toLocaleString("id")} karakter`;
    if ((formData.slug || "").length > MAX_SLUG_CHARS)
      newErrors.slug = `Maksimal ${MAX_SLUG_CHARS.toLocaleString("id")} karakter`;
    if (!formData.course_category_id) newErrors.course_category_id = "Kategori wajib dipilih";
    if (formData.mentor_ids?.length === 0) newErrors.mentor_ids = "Minimal pilih satu mentor";
    if (!formData.target_roles || formData.target_roles.length === 0) newErrors.target_roles = "Minimal satu target role wajib dipilih untuk kursus ini";
    if (!formData.status) newErrors.status = "Status publikasi wajib dipilih";
    if (formData.sell_individual && Number(formData.price || 0) <= 0)
      newErrors.price = "Harga satuan wajib lebih dari Rp0";
    if ((formData.short_description || "").length > MAX_SHORT_DESC_CHARS)
      newErrors.short_description = `Maksimal ${MAX_SHORT_DESC_CHARS.toLocaleString("id")} karakter`;
    if ((formData.description || "").length > MAX_DESC_CHARS)
      newErrors.description = `Maksimal ${MAX_DESC_CHARS.toLocaleString("id")} karakter`;
    setErrors(newErrors);
    const sectionsWithErrors = [];
    if (newErrors.price) sectionsWithErrors.push("publishing-sales");
    if (newErrors.short_description || newErrors.description)
      sectionsWithErrors.push("course-description");
    if (sectionsWithErrors.length > 0) {
      setOpenOptionalSections((current) => [
        ...new Set([...current, ...sectionsWithErrors]),
      ]);
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e) => {
    const value = e.target?.value ?? e;
    const err = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: err }));
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Mohon perbaiki field yang bermasalah");
      return;
    }

    setLoading(true);
    const toastId = toast.loading(
      isEdit ? "Menyimpan perubahan..." : "Membuat kursus..."
    );

    try {
      const submitData = {
        ...formData,
        discount_percent: 0,
        promo_start_date: null,
        promo_end_date: null,
      };
      if (!submitData.sell_individual) {
        submitData.price = 0;
      }
      if (isEdit) {
        await api.put(`/lms/admin/courses/${data.id}`, submitData);
        toast.success("Kursus berhasil diperbarui", { id: toastId });
      } else {
        await api.post("/lms/admin/courses", submitData);
        toast.success("Kursus berhasil dibuat", { id: toastId });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const errData = error.response?.data || {};
      const errMsg = errData.message || errData.error?.message || "Terjadi kesalahan";
      const fieldErrs = errData.error?.field_errors || errData.field_errors || errData.errors;

      if (fieldErrs && typeof fieldErrs === "object") {
        const parsed = {};
        Object.entries(fieldErrs).forEach(([k, v]) => {
          parsed[k] = Array.isArray(v) ? v[0] : String(v);
        });
        setErrors(parsed);
        const sectionsWithErrors = [];
        if (parsed.price) sectionsWithErrors.push("publishing-sales");
        if (parsed.short_description || parsed.description)
          sectionsWithErrors.push("course-description");
        if (
          parsed.level ||
          parsed.age_range ||
          parsed.minimum_passing_grade
        )
          sectionsWithErrors.push("learning-details");
        if (parsed.cover_image_url || parsed.allow_skip)
          sectionsWithErrors.push("media-navigation");
        if (sectionsWithErrors.length > 0) {
          setOpenOptionalSections((current) => [
            ...new Set([...current, ...sectionsWithErrors]),
          ]);
        }
        toast.error("Mohon periksa kembali field yang bermasalah", { id: toastId });
      } else {
        toast.error(errMsg, { id: toastId });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCoverUpload = async (file) => {
    if (!file) return;
    const toastId = toast.loading("Mengupload cover...");
    setLoading(true);
    try {
      const payload = new FormData();
      payload.append("file", file);
      const response = await api.post("/admin/upload-image", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = response.data?.data?.url;
      if (!url) throw new Error("URL cover tidak ditemukan dari response upload");
      setFormData((prev) => ({ ...prev, cover_image_url: url }));
      toast.success("Cover berhasil diupload", { id: toastId });
    } catch (error) {
      const errMsg = error.message || "Gagal upload cover";
      toast.error(errMsg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b px-6 py-5">
          <DialogTitle>
            {isEdit ? "Edit Kursus" : "Buat Kursus Baru"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Lengkapi informasi wajib terlebih dahulu. Pengaturan tambahan dapat
            dibuka sesuai kebutuhan.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-5">
            {/* 1. Informasi Utama */}
            <section className="space-y-5 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Informasi wajib
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Course belum dapat disimpan sebelum semua bagian ini
                    dilengkapi.
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Wajib diisi
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Judul */}
                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="title">Judul Kursus *</Label>
                  <Input
                    id="title"
                    placeholder="Contoh: Belajar Emosi Dasar"
                    value={formData.title}
                    onChange={handleTitleChange}
                    disabled={loading}
                    maxLength={MAX_TITLE_CHARS}
                    className={errors.title ? "border-red-500" : ""}
                    required
                  />
                  <div className="flex justify-between text-xs">
                    <span className="text-red-500">{errors.title || ""}</span>
                    <span className="text-muted-foreground">
                      {formData.title?.length || 0}/{MAX_TITLE_CHARS}
                    </span>
                  </div>
                </div>

                {/* Mentor Kursus */}
                <div className="space-y-1.5">
                  <Label>Mentor Kursus *</Label>
                  {isAdmin ? (
                    <Popover
                      open={openMentorPopover}
                      onOpenChange={setOpenMentorPopover}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openMentorPopover}
                          disabled={loading}
                          className={cn(
                            "w-full justify-between h-auto min-h-[40px] text-left font-normal border-input",
                            errors.mentor_ids ? "border-red-500" : ""
                          )}
                        >
                          <div className="flex flex-wrap gap-1">
                            {(formData.mentor_ids || []).length > 0 ? (
                              (formData.mentor_ids || []).map((id) => {
                                const mentor = (Array.isArray(mentorsList) ? mentorsList : []).find(
                                  (m) => m.id === id
                                );
                                return (
                                  <Badge
                                    key={id}
                                    variant="secondary"
                                    className="mr-1 mb-1 text-xs"
                                  >
                                    {mentor
                                      ? mentor.name || mentor.display_name
                                      : "Loading..."}
                                    <span
                                      className="ml-1 rounded-full outline-none cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleMentor(id);
                                      }}
                                    >
                                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </span>
                                  </Badge>
                                );
                              })
                            ) : (
                              <span className="text-muted-foreground">
                                Pilih mentor (bisa &gt; 1)
                              </span>
                            )}
                          </div>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[270px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Cari nama mentor..." />
                          <CommandList>
                            <CommandEmpty>Mentor tidak ditemukan.</CommandEmpty>
                            <CommandGroup>
                              {(Array.isArray(mentorsList) ? mentorsList : []).map((mentor) => {
                                const isSelected = (formData.mentor_ids || []).includes(
                                  mentor.id
                                );
                                return (
                                  <CommandItem
                                    key={mentor.id}
                                    value={mentor.name || mentor.display_name}
                                    onSelect={() =>
                                      handleToggleMentor(mentor.id)
                                    }
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        isSelected ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {mentor.name || mentor.display_name}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Input
                      value={
                        currentUser?.display_name ||
                        sessionUser?.display_name ||
                        ""
                      }
                      disabled
                      className="bg-muted text-muted-foreground cursor-not-allowed"
                    />
                  )}
                  {errors.mentor_ids && (
                    <p className="text-xs text-red-500">{errors.mentor_ids}</p>
                  )}
                </div>

                {/* Kategori Kursus */}
                <div className="space-y-1.5">
                  <Label>Kategori Kursus *</Label>
                  <Select
                    value={formData.course_category_id}
                    onValueChange={handleCategoryChange}
                    disabled={loading}
                  >
                    <SelectTrigger
                      className={
                        errors.course_category_id ? "border-red-500" : ""
                      }
                    >
                      <SelectValue placeholder="Pilih kategori kursus" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(categories) ? categories : []).map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.course_category_id && (
                    <p className="text-xs text-red-500">
                      {errors.course_category_id}
                    </p>
                  )}
                </div>
              </div>

              {/* Target Roles Kursus */}
              <div className="space-y-1.5 rounded-xl border bg-muted/20 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <Label className="font-semibold text-xs">
                    Course ini dapat dilihat oleh *
                  </Label>
                  <span className="text-[11px] text-muted-foreground italic">
                    Pilihan target role mengikuti role yang tersedia pada Course
                    Category.
                  </span>
                </div>

                {!formData.course_category_id ? (
                  <p className="text-xs text-amber-600 font-medium pt-1">
                    Pilih Course Category terlebih dahulu untuk menentukan
                    target role.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-4 pt-1.5">
                    {[
                      { label: "Partner", value: "student" },
                      { label: "Guru/Mentor", value: "mentor" },
                      { label: "Merchant", value: "parent" },
                    ].map((role) => {
                      const roleKey = role.value;
                      const isAvailableInCat =
                        selectedCategoryRoles.includes(roleKey);
                      const isChecked = (formData.target_roles || []).includes(
                        roleKey
                      );

                      return (
                        <div
                          key={roleKey}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={roleKey}
                            checked={isChecked && isAvailableInCat}
                            disabled={!isAvailableInCat || loading}
                            onCheckedChange={() => {
                              if (isAvailableInCat)
                                toggleCourseTargetRole(roleKey);
                            }}
                          />
                          <Label
                            htmlFor={roleKey}
                            className={cn(
                              "text-xs font-medium capitalize",
                              !isAvailableInCat &&
                                "text-muted-foreground opacity-40 cursor-not-allowed"
                            )}
                          >
                            {role.label}
                            {!isAvailableInCat && (
                              <span className="ml-1 text-[10px]">
                                (Tidak ada di Kategori)
                              </span>
                            )}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
                {errors.target_roles && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.target_roles}
                  </p>
                )}
              </div>

              {/* Status Publikasi */}
              <div className="space-y-1.5">
                <Label>Status Publikasi *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => {
                    setFormData({ ...formData, status: val });
                    setErrors((prev) => ({ ...prev, status: "" }));
                  }}
                  disabled={loading}
                >
                  <SelectTrigger
                    className={errors.status ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                {errors.status && (
                  <p className="text-xs text-red-500">{errors.status}</p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Pengaturan opsional
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Buka hanya bagian yang ingin Anda atur. Semua bagian ini dapat
                  dilengkapi nanti.
                </p>
              </div>
              <Accordion
                type="multiple"
                value={openOptionalSections}
                onValueChange={setOpenOptionalSections}
                className="overflow-hidden rounded-xl border bg-card"
              >
                {/* 2. Detail Kursus */}
                <AccordionItem value="learning-details" className="px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-3 text-left">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <BookOpen className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">
                          Detail pembelajaran
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          Level, rentang usia, dan nilai kelulusan
                        </span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Level */}
                      <div className="space-y-1.5">
                        <Label htmlFor="level">Level</Label>
                        <Select
                          disabled={loading}
                          value={formData.level}
                          onValueChange={(value) =>
                            setFormData({ ...formData, level: value })
                          }
                        >
                          <SelectTrigger id="level">
                            <SelectValue placeholder="Pilih tingkat pendidikan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Early Years">
                              Early Years (3–6 tahun)
                            </SelectItem>
                            <SelectItem value="SD / Elementary">
                              SD / Elementary
                            </SelectItem>
                            <SelectItem value="SMP / Middle School">
                              SMP / Middle School
                            </SelectItem>
                            <SelectItem value="SMA / High School">
                              SMA / High School
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Usia */}
                      <div className="space-y-1.5">
                        <Label htmlFor="age_range">Rentang Usia</Label>
                        <Input
                          id="age_range"
                          placeholder="Contoh: 7-12 Tahun"
                          value={formData.age_range}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              age_range: e.target.value,
                            })
                          }
                          disabled={loading}
                        />
                      </div>

                      {/* Passing Grade */}
                      <div className="space-y-1.5">
                        <Label htmlFor="minimum_passing_grade">
                          Nilai Minimum Kelulusan
                        </Label>
                        <Input
                          id="minimum_passing_grade"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="Contoh: 70"
                          value={formData.minimum_passing_grade}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              minimum_passing_grade:
                                parseFloat(e.target.value) || 0,
                            })
                          }
                          disabled={loading}
                        />
                      </div>

                      {/* Lompat Lesson */}
                      <div className="flex items-center justify-between rounded-lg border p-3 bg-slate-50/50 col-span-3">
                        <div className="space-y-0.5">
                          <Label
                            className="text-xs font-semibold"
                            htmlFor="allow_skip"
                          >
                            Boleh Lompat Lesson
                          </Label>
                          <p className="text-[10px] text-muted-foreground leading-normal">
                            Izinkan partner melompati materi secara acak.
                          </p>
                        </div>
                        <Switch
                          id="allow_skip"
                          checked={formData.allow_skip}
                          onCheckedChange={(val) =>
                            setFormData({ ...formData, allow_skip: val })
                          }
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 3. Pengaturan Penjualan */}
                <AccordionItem value="publishing-sales" className="px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-3 text-left">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <CircleDollarSign className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">
                          Penjualan course
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          Atur ketersediaan dan harga pembelian satuan
                        </span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="rounded-xl border p-4 bg-slate-50/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label
                            className="text-sm font-semibold"
                            htmlFor="sell_individual"
                          >
                            Jual Course ini Satuan
                          </Label>
                          <p className="text-[11px] text-muted-foreground leading-normal">
                            Izinkan pengguna membeli course ini secara mandiri
                            tanpa langganan.
                          </p>
                        </div>
                        <Switch
                          id="sell_individual"
                          checked={formData.sell_individual || false}
                          onCheckedChange={(v) => {
                            setFormData({ ...formData, sell_individual: v });
                            if (!v)
                              setErrors((prev) => ({ ...prev, price: "" }));
                          }}
                          disabled={loading}
                        />
                      </div>

                      {formData.sell_individual && (
                        <div className="space-y-2 pt-3 border-t animate-in fade-in duration-200">
                          <Label htmlFor="price">Harga Satuan *</Label>
                          <div className="relative max-w-sm">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                              Rp
                            </span>
                            <Input
                              id="price"
                              type="number"
                              min="0"
                              placeholder="0"
                              value={formData.price || ""}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  price: parseFloat(e.target.value) || 0,
                                });
                                setErrors((prev) => ({ ...prev, price: "" }));
                              }}
                              disabled={loading}
                              className={cn(
                                "pl-10",
                                errors.price ? "border-red-500" : ""
                              )}
                            />
                          </div>
                          {errors.price && (
                            <p className="text-xs font-medium text-red-500">
                              {errors.price}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 4. Media & Pengaturan Tambahan */}
                <AccordionItem value="media-navigation" className="px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-3 text-left">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <ImageIcon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">
                          Media
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          Cover course
                        </span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* Cover Image */}
                      <div className="space-y-1.5">
                        <Label htmlFor="cover_image_file">
                          Upload cover manual
                        </Label>
                        <div className="flex items-center gap-3">
                          {formData.cover_image_url ? (
                            <img
                              src={formData.cover_image_url}
                              alt="Cover preview"
                              className="h-14 w-20 rounded-md border object-cover shrink-0"
                            />
                          ) : (
                            <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md border bg-muted">
                              <ImagePlus className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <Input
                            id="cover_image_file"
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleCoverUpload(e.target.files?.[0])
                            }
                            disabled={loading}
                            className="cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <AICourseCoverGenerator
                        context={{
                          title: formData.title,
                          short_description: formData.short_description,
                          course_category_id: formData.course_category_id,
                          level: formData.level,
                          age_range: formData.age_range,
                        }}
                        disabled={loading}
                        onNeedContext={() =>
                          setOpenOptionalSections((current) => [
                            ...new Set([
                              ...current,
                              "media-navigation",
                              "learning-details",
                              "course-description",
                            ]),
                          ])
                        }
                        onUseImage={(url) =>
                          setFormData((current) => ({
                            ...current,
                            cover_image_url: url,
                          }))
                        }
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* 5. Deskripsi */}
                <AccordionItem
                  value="course-description"
                  className="border-b-0 px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-3 text-left">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">
                          Deskripsi course
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          Ringkasan singkat dan penjelasan lengkap
                        </span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    {/* Short Description */}
                    <div className="space-y-1.5">
                      <Label htmlFor="short_description">
                        Deskripsi Singkat
                      </Label>
                      <Textarea
                        id="short_description"
                        placeholder="Tuliskan deskripsi singkat mengenai materi kursus ini..."
                        value={formData.short_description}
                        onChange={handleChange("short_description")}
                        disabled={loading}
                        rows={2}
                        maxLength={MAX_SHORT_DESC_CHARS}
                        className={
                          errors.short_description ? "border-red-500" : ""
                        }
                      />
                      <div className="flex justify-between text-xs">
                        <span className="text-red-500">
                          {errors.short_description || ""}
                        </span>
                        <span className="text-muted-foreground">
                          {formData.short_description?.length || 0}/
                          {MAX_SHORT_DESC_CHARS}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="description">Deskripsi Lengkap</Label>
                        <div className="flex rounded-md border border-zinc-200 p-0.5 bg-zinc-50/50">
                          <button
                            type="button"
                            onClick={() => setDescTab("write")}
                            className={cn(
                              "px-2.5 py-1 text-[11px] font-bold rounded-sm transition",
                              descTab === "write"
                                ? "bg-white shadow-xs text-indigo-600"
                                : "text-zinc-500 hover:text-zinc-800"
                            )}
                          >
                            Tulis
                          </button>
                          <button
                            type="button"
                            onClick={() => setDescTab("preview")}
                            className={cn(
                              "px-2.5 py-1 text-[11px] font-bold rounded-sm transition",
                              descTab === "preview"
                                ? "bg-white shadow-xs text-indigo-600"
                                : "text-zinc-500 hover:text-zinc-800"
                            )}
                          >
                            Pratinjau
                          </button>
                        </div>
                      </div>

                      {descTab === "write" ? (
                        <div className="space-y-1.5 animate-in fade-in duration-200">
                          {/* Toolbar */}
                          <div className="flex flex-wrap gap-1 items-center bg-zinc-50 p-1 border rounded-md">
                            <button
                              type="button"
                              onClick={() =>
                                insertMarkdown("**", "**", "Tebal")
                              }
                              className="px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200/60 rounded font-bold"
                              title="Bold"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => insertMarkdown("*", "*", "Miring")}
                              className="px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200/60 rounded italic"
                              title="Italic"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                insertMarkdown("### ", "", "Judul")
                              }
                              className="px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200/60 rounded font-mono font-semibold"
                              title="Heading"
                            >
                              H
                            </button>
                            <div className="w-px h-4 bg-zinc-200 mx-0.5" />
                            <button
                              type="button"
                              onClick={() => insertMarkdown("- ", "", "Poin")}
                              className="px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200/60 rounded"
                              title="List"
                            >
                              • List
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                insertMarkdown("- [ ] ", "", "Tugas")
                              }
                              className="px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200/60 rounded"
                              title="Task List"
                            >
                              ☑ Task
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                insertMarkdown("[", "](https://)", "Teks Link")
                              }
                              className="px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200/60 rounded font-mono text-indigo-600"
                              title="Link"
                            >
                              Link
                            </button>
                          </div>
                          <Textarea
                            id="description"
                            placeholder="Jelaskan detail kursus menggunakan format Markdown..."
                            value={formData.description}
                            onChange={handleChange("description")}
                            disabled={loading}
                            rows={5}
                            maxLength={MAX_DESC_CHARS}
                            className={cn(
                              "font-mono text-xs leading-relaxed",
                              errors.description ? "border-red-500" : ""
                            )}
                          />
                        </div>
                      ) : (
                        <div className="p-3.5 border rounded-md min-h-[145px] max-h-[220px] overflow-y-auto bg-zinc-50/50 animate-in fade-in duration-200">
                          <MarkdownView content={formData.description} />
                        </div>
                      )}

                      <div className="flex justify-between text-xs">
                        <span className="text-red-500">
                          {errors.description || ""}
                        </span>
                        <span className="text-muted-foreground">
                          {formData.description?.length || 0}/{MAX_DESC_CHARS}
                        </span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan Perubahan" : "Buat Kursus"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
