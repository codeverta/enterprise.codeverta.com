import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  GripVertical,
  Loader2,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";

type Bundle = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  age_range?: string;
  grade_range?: string;
  pillar?: string;
  is_active?: boolean;
  require_sequential_completion?: boolean;
};

type BundleItem = {
  id: string;
  bundle_id: string;
  course_id: string;
  sort_order?: number;
  course?: Course;
};

type Course = {
  id: string;
  title: string;
  level?: string;
  age_range?: string;
  status?: string;
};

const emptyBundle = {
  name: "",
  slug: "",
  description: "",
  age_range: "",
  grade_range: "",
  pillar: "All",
  is_active: true,
  require_sequential_completion: false,
};

const dataOf = (res: any) => res.data?.data || [];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type BundleFormDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBundle: Bundle | null;
  onSuccess: () => void;
};

export default function BundleFormDialog({
  isOpen,
  onOpenChange,
  selectedBundle,
  onSuccess,
}: BundleFormDialogProps) {
  const { t } = useLanguage();
  const selectedId = selectedBundle?.id || "";
  const [courses, setCourses] = useState<Course[]>([]);
  const [detailItems, setDetailItems] = useState<BundleItem[]>([]);
  const [form, setForm] = useState<any>(emptyBundle);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingCourseId, setTogglingCourseId] = useState("");
  const [courseSearch, setCourseSearch] = useState("");

  const [coursesPage, setCoursesPage] = useState(1);
  const [coursesTotalPages, setCoursesTotalPages] = useState(1);
  const [coursesLoading, setCoursesLoading] = useState(false);

  const selectedCourseIDs = useMemo(
    () =>
      new Set(
        detailItems
          .filter((item) => item.bundle_id === selectedId)
          .map((item) => item.course_id)
      ),
    [detailItems, selectedId]
  );

  const bundleItems = useMemo(() => {
    return detailItems
      .filter((item) => item.bundle_id === selectedId)
      .map((item) => {
        const course =
          item.course || courses.find((c) => c.id === item.course_id);
        return {
          ...item,
          courseTitle: course?.title || "Unknown Course",
          courseLevel: course?.level,
          courseAgeRange: course?.age_range,
          courseStatus: course?.status,
        };
      })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [detailItems, selectedId, courses]);

  const fetchAvailableCourses = async (
    pageToFetch = 1,
    search = courseSearch,
    isReset = false
  ) => {
    setCoursesLoading(true);
    try {
      const res = await api.get("/lms/courses", {
        params: {
          page: pageToFetch,
          limit: 20,
          search: search.trim() || undefined,
        },
      });
      const { data, pagination } = res.data;
      const fetchedData = data || res.data?.data || [];
      if (pageToFetch === 1 || isReset) {
        setCourses(fetchedData);
      } else {
        setCourses((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const uniqueNew = fetchedData.filter(
            (c: Course) => !existingIds.has(c.id)
          );
          return [...prev, ...uniqueNew];
        });
      }
      if (pagination) {
        setCoursesTotalPages(pagination.total_pages || 1);
      }
    } catch {
      toast.error("Gagal memuat daftar course");
    } finally {
      setCoursesLoading(false);
    }
  };

  const loadBundleItems = async (bundleID?: string) => {
    if (!bundleID) {
      setDetailItems([]);
      return;
    }
    setDetailLoading(true);
    try {
      const res = await api.get(
        `/subscriptions/admin/resources/course-bundle-items?bundle_id=${bundleID}`
      );
      setDetailItems(dataOf(res));
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memuat item bundle");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setCourseSearch("");
    if (selectedBundle) {
      setForm({
        name: selectedBundle.name || "",
        slug: selectedBundle.slug || "",
        description: selectedBundle.description || "",
        age_range: selectedBundle.age_range || "",
        grade_range: selectedBundle.grade_range || "",
        pillar: selectedBundle.pillar || "All",
        is_active: selectedBundle.is_active !== false,
        require_sequential_completion:
          !!selectedBundle.require_sequential_completion,
      });
    } else {
      setForm(emptyBundle);
    }
    loadBundleItems(selectedId || undefined);
  }, [isOpen, selectedBundle]);

  useEffect(() => {
    if (!isOpen) return;
    setCoursesPage(1);
    const timer = setTimeout(() => {
      fetchAvailableCourses(1, courseSearch, true);
    }, 350);
    return () => clearTimeout(timer);
  }, [courseSearch, isOpen]);

  useEffect(() => {
    if (isOpen && coursesPage > 1) {
      fetchAvailableCourses(coursesPage, courseSearch, false);
    }
  }, [coursesPage]);

  const handleCoursesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (
      scrollHeight - scrollTop - clientHeight < 40 &&
      !coursesLoading &&
      coursesPage < coursesTotalPages
    ) {
      setCoursesPage((prev) => prev + 1);
    }
  };

  const updateForm = (key: string, value: any) => {
    setForm((prev: any) => ({
      ...prev,
      [key]: value,
      ...(key === "name" && !selectedId ? { slug: slugify(value) } : {}),
    }));
  };

  const closeDialog = () => {
    onOpenChange(false);
  };

  const saveBundle = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
      };
      if (selectedId) {
        await api.put(
          `/subscriptions/admin/resources/course-bundles/${selectedId}`,
          payload
        );
        toast.success(t("bundles.toast.saved"));
      } else {
        const res = await api.post(
          "/subscriptions/admin/resources/course-bundles",
          payload
        );
        const created = res.data?.data;
        if (created?.id) {
          onSuccess();
          onOpenChange(false);
        }
        toast.success(t("bundles.toast.created"));
        return;
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("bundles.toast.save_error"));
    } finally {
      setSaving(false);
    }
  };

  const deleteBundle = async () => {
    if (
      !selectedId ||
      !selectedBundle ||
      !confirm(
        t("bundles.confirm.delete").replace("{name}", selectedBundle.name)
      )
    )
      return;
    try {
      await api.delete(
        `/subscriptions/admin/resources/course-bundles/${selectedId}`
      );
      toast.success(t("bundles.toast.deleted"));
      closeDialog();
      onSuccess();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || t("bundles.toast.delete_error")
      );
    }
  };

  const toggleCourse = async (course: Course) => {};

  const reorderBundleItems = async (
    sourceIndex: number,
    destinationIndex: number
  ) => {
    if (!selectedId || sourceIndex === destinationIndex) return;
    const ordered = [...bundleItems];
    const [moved] = ordered.splice(sourceIndex, 1);
    ordered.splice(destinationIndex, 0, moved);
    const nextItems = ordered.map((item, index) => ({
      ...item,
      sort_order: index + 1,
    }));
    setDetailItems((prev) => [
      ...prev.filter((item) => item.bundle_id !== selectedId),
      ...nextItems,
    ]);
    try {
      await Promise.all(
        nextItems.map((item) =>
          api.put(`/subscriptions/admin/resources/course-bundle-items/${item.id}`, {
            bundle_id: item.bundle_id,
            course_id: item.course_id,
            sort_order: item.sort_order,
          })
        )
      );
      toast.success("Urutan course berhasil diperbarui");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengupdate urutan.");
      await loadBundleItems(selectedId);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl lg:max-w-7xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedId
              ? t("bundles.detail_title")
              : t("bundles.new_btn")}
          </DialogTitle>
          <DialogDescription>
            {t("bundles.detail_subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("bundles.form.name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="High School"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("bundles.form.age_range")}</Label>
              <Input
                value={form.age_range}
                onChange={(e) => updateForm("age_range", e.target.value)}
                placeholder="Ages 3-6"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("bundles.form.grade_range")}</Label>
              <Input
                value={form.grade_range}
                onChange={(e) => updateForm("grade_range", e.target.value)}
                placeholder="Grade 10-12"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t("bundles.form.description")}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3.5 shadow-xs md:col-span-2 mt-2 bg-slate-50/50">
              <div className="space-y-0.5">
                <Label
                  className="text-xs font-semibold"
                  htmlFor="require_sequential_completion"
                >
                  Wajib Berurutan (Sequential Courses)
                </Label>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Partner wajib menyelesaikan kuis & materi di course sebelumnya
                  sebelum dapat mendaftar/mengakses course berikutnya dalam
                  bundle.
                </p>
              </div>
              <Switch
                id="require_sequential_completion"
                checked={!!form.require_sequential_completion}
                onCheckedChange={(val) =>
                  updateForm("require_sequential_completion", val)
                }
              />
            </div>
          </div>

          <div>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  {t("bundles.courses_in_bundle")}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedId
                    ? t("bundles.courses_in_bundle_subtitle")
                    : "Simpan bundle terlebih dahulu untuk mengelola course."}
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Cari course..."
                  className="pl-8 h-9"
                />
              </div>
            </div>
            {detailLoading ? (
              <div className="flex h-44 items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat course bundle...
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-blue-900">
                        Course Dalam Bundle
                      </h4>
                      <p className="text-[11px] text-blue-700/80">
                        Drag untuk mengatur urutan pembelajaran.
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {bundleItems.length} course
                    </Badge>
                  </div>

                  {!selectedId ? (
                    <div className="rounded-lg border border-dashed border-blue-200 bg-white/70 p-5 text-center text-xs text-slate-500">
                      Simpan bundle terlebih dahulu untuk memilih dan
                      mengurutkan course.
                    </div>
                  ) : bundleItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-blue-200 bg-white/70 p-5 text-center text-xs text-slate-500">
                      Belum ada course di bundle ini. Pilih course dari daftar kanan.
                    </div>
                  ) : (
                    <DragDropContext
                      onDragEnd={(result) => {
                        if (!result.destination) return;
                        reorderBundleItems(
                          result.source.index,
                          result.destination.index
                        );
                      }}
                    >
                      <Droppable droppableId="bundle-course-order">
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="max-h-80 space-y-2 overflow-y-auto pr-1"
                          >
                            {bundleItems.map((item, index) => (
                              <Draggable
                                key={item.id}
                                draggableId={item.id}
                                index={index}
                              >
                                {(dragProvided, snapshot) => {
                                  const courseCard = (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      style={dragProvided.draggableProps.style}
                                      className={cn(
                                        "flex items-center gap-3 rounded-lg border bg-white p-3 shadow-xs transition",
                                        snapshot.isDragging
                                          ? "z-[9999] w-[min(520px,calc(100vw-48px))] border-blue-300 shadow-2xl"
                                          : "border-blue-100"
                                      )}
                                    >
                                      <button
                                        type="button"
                                        className="cursor-grab rounded-md p-1 text-slate-400 active:cursor-grabbing"
                                        {...dragProvided.dragHandleProps}
                                      >
                                        <GripVertical className="h-4 w-4" />
                                      </button>
                                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                                        {index + 1}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-900">
                                          {item.courseTitle}
                                        </p>
                                        <p className="truncate text-xs text-slate-500">
                                          {[
                                            item.courseLevel,
                                            item.courseAgeRange,
                                            item.courseStatus,
                                          ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                        </p>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={
                                          togglingCourseId === item.course_id
                                        }
                                        onClick={() => {
                                          const course = courses.find(
                                            (c) => c.id === item.course_id
                                          );
                                          toggleCourse(
                                            course || {
                                              id: item.course_id,
                                              title: item.courseTitle,
                                              level: item.courseLevel,
                                              age_range: item.courseAgeRange,
                                              status: item.courseStatus,
                                            }
                                          );
                                        }}
                                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  );

                                  if (
                                    snapshot.isDragging &&
                                    typeof document !== "undefined"
                                  ) {
                                    return createPortal(
                                      courseCard,
                                      document.body
                                    );
                                  }

                                  return courseCard;
                                }}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  )}
                </div>

                <div
                  onScroll={handleCoursesScroll}
                  className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 p-2"
                >
                  {courses.length === 0 && !coursesLoading ? (
                    <div className="py-8 text-center text-sm text-slate-400">
                      Tidak ada course ditemukan.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {courses.map((course) => {
                        const checked = selectedCourseIDs.has(course.id);
                        return (
                          <button
                            key={course.id}
                            type="button"
                            disabled={
                              togglingCourseId === course.id || !selectedId
                            }
                            onClick={() => toggleCourse(course)}
                            className={cn(
                              "flex items-start gap-3 rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                              checked
                                ? "border-blue-200 bg-blue-50"
                                : "border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            <div
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                                checked
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-slate-300"
                              )}
                            >
                              {checked && (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 text-sm">
                                {course.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                {[course.level, course.age_range, course.status]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                      {coursesLoading && (
                        <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500 font-medium">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                          <span>Memuat course lainnya...</span>
                        </div>
                      )}
                      {!coursesLoading &&
                        coursesPage >= coursesTotalPages &&
                        courses.length > 0 && (
                          <div className="py-2 text-center text-[11px] text-slate-400 italic">
                            Semua course telah ditampilkan ({courses.length})
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {selectedId && selectedBundle && (
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50"
                onClick={deleteBundle}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("bundles.delete_btn")}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={closeDialog}>
              Batal
            </Button>
            <Button
              onClick={saveBundle}
              disabled={saving || !form.name.trim()}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? t("bundles.saving") : t("bundles.save_btn")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
