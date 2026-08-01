import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { CalendarClock, CopyCheck, Edit3, Plus, Send, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import DashboardLayout from "@/layout/DashboardLayout";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ScheduleCalendar, { ScheduleView } from "@/components/schedule/ScheduleCalendar";
import ScheduleItemForm from "@/components/schedule/ScheduleItemForm";
import ScheduleTemplateForm from "@/components/schedule/ScheduleTemplateForm";
import AssignScheduleModal from "@/components/schedule/AssignScheduleModal";
import {
  scheduleApi,
  ScheduleItem,
  ScheduleItemPayload,
  ScheduleStudent,
  ScheduleTemplate,
  StudentSchedule,
} from "@/lib/schedule-api";

function flattenSchedules(schedules: StudentSchedule[]) {
  return schedules.flatMap((schedule) =>
    (schedule.items || []).map((item) => ({
      ...item,
      student_schedule_id: schedule.id,
    }))
  );
}

function openResource(navigate: ReturnType<typeof useNavigate>, item: ScheduleItem) {
  if (!item.resource_type || !item.resource_id) return false;
  const pathMap: Record<string, string> = {
    course: `/dashboard/courses/${item.resource_id}`,
    module: `/dashboard/modules/${item.resource_id}`,
    lesson: `/dashboard/lessons/${item.resource_id}`,
    quiz: `/dashboard/quizzes/${item.resource_id}`,
  };
  const path = pathMap[item.resource_type];
  if (!path) return false;
  navigate(path);
  return true;
}

function TemplateManager({
  templates,
  selectedTemplate,
  loading,
  onRefresh,
  onSelectTemplate,
}: {
  templates: ScheduleTemplate[];
  selectedTemplate: ScheduleTemplate | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onSelectTemplate: (template: ScheduleTemplate | null) => void;
}) {
  const { t } = useLanguage();
  const [templateForm, setTemplateForm] = useState<ScheduleTemplate | null | "new">(null);
  const [itemForm, setItemForm] = useState<ScheduleItem | null | "new">(null);
  const [assigningTemplate, setAssigningTemplate] = useState<ScheduleTemplate | null>(null);
  const [students, setStudents] = useState<ScheduleStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedItems = selectedTemplate?.items || [];

  const saveTemplate = async (payload: { title: string; description?: string }) => {
    setSaving(true);
    try {
      if (templateForm && templateForm !== "new") {
        await scheduleApi.updateTemplate(templateForm.id, payload);
        toast.success(t("schedule.toast.template_updated"));
      } else {
        const created = await scheduleApi.createTemplate(payload);
        onSelectTemplate(created);
        toast.success(t("schedule.toast.template_created"));
      }
      setTemplateForm(null);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("schedule.toast.template_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const saveTemplateItem = async (payload: ScheduleItemPayload) => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      if (itemForm && itemForm !== "new") {
        await scheduleApi.updateTemplateItem(itemForm.id, payload);
        toast.success(t("schedule.toast.item_updated"));
      } else {
        await scheduleApi.createTemplateItem(selectedTemplate.id, payload);
        toast.success(t("schedule.toast.item_added"));
      }
      setItemForm(null);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("schedule.toast.item_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (template: ScheduleTemplate) => {
    if (!confirm(t("schedule.confirm.delete_template").replace("{title}", template.title))) return;
    try {
      await scheduleApi.deleteTemplate(template.id);
      if (selectedTemplate?.id === template.id) onSelectTemplate(null);
      await onRefresh();
      toast.success(t("schedule.toast.template_deleted"));
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("schedule.toast.template_delete_failed"));
    }
  };

  const deleteTemplateItem = async () => {
    if (!itemForm || itemForm === "new") return;
    try {
      await scheduleApi.deleteTemplateItem(itemForm.id);
      setItemForm(null);
      await onRefresh();
      toast.success(t("schedule.toast.item_deleted"));
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("schedule.toast.item_delete_failed"));
    }
  };

  const openAssign = async (template: ScheduleTemplate) => {
    setAssigningTemplate(template);
    setStudentsLoading(true);
    try {
      setStudents(await scheduleApi.listStudents());
    } catch {
      toast.error(t("schedule.toast.load_students_failed"));
    } finally {
      setStudentsLoading(false);
    }
  };

  const assignTemplate = async (studentIds: string[]) => {
    if (!assigningTemplate) return;
    setSaving(true);
    try {
      await scheduleApi.assignTemplate(assigningTemplate.id, studentIds);
      toast.success(t("schedule.toast.assign_success"));
      setAssigningTemplate(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("schedule.toast.assign_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-semibold text-slate-950">{t("schedule.template.title")}</h2>
            <p className="text-xs text-slate-500">
              {t("schedule.template.subtitle")}
            </p>
          </div>
          <Button size="sm" onClick={() => setTemplateForm("new")}>
            <Plus className="mr-2 h-4 w-4" />
            {t("schedule.template.new_btn")}
          </Button>
        </div>
        <div className="max-h-[620px] overflow-y-auto p-2">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              {t("schedule.template.loading")}
            </div>
          ) : templates.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              {t("schedule.template.empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onSelectTemplate(template)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition",
                    selectedTemplate?.id === template.id
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {template.title}
                      </p>
                      <p className="line-clamp-2 text-xs text-slate-500">
                        {template.description || t("schedule.template.no_description")}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {template.items?.length || 0}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setTemplateForm(template);
                      }}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        openAssign(template);
                      }}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteTemplate(template);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {selectedTemplate ? (
          <>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {selectedTemplate.title}
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedTemplate.description || t("schedule.template.no_description")}
                </p>
              </div>
              <Button onClick={() => setItemForm("new")}>
                <Plus className="mr-2 h-4 w-4" />
                {t("schedule.template.add_item_btn")}
              </Button>
            </div>
            <div className="space-y-2">
              {selectedItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 py-14 text-center text-sm text-slate-500">
                  {t("schedule.template.items_empty")}
                </div>
              ) : (
                selectedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setItemForm(item)}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
                  >
                    <span
                      className="h-10 w-1.5 rounded-full"
                      style={{ backgroundColor: item.color || "#2563eb" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {dayjs(item.start_time).format("D MMM YYYY, HH:mm")} -{" "}
                        {dayjs(item.end_time).format("HH:mm")}
                      </p>
                    </div>
                    {item.resource_type && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                        {item.resource_type}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-slate-500">
            <CopyCheck className="mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-700">
              {t("schedule.template.select_placeholder")}
            </p>
          </div>
        )}
      </div>

      {templateForm && (
        <ScheduleTemplateForm
          template={templateForm === "new" ? null : templateForm}
          onClose={() => setTemplateForm(null)}
          onSubmit={saveTemplate}
          saving={saving}
        />
      )}
      {itemForm && (
        <ScheduleItemForm
          item={itemForm === "new" ? null : itemForm}
          title={
            itemForm === "new" ? t("schedule.template.add_item_title") : t("schedule.template.edit_item_title")
          }
          onClose={() => setItemForm(null)}
          onSubmit={saveTemplateItem}
          onDelete={itemForm === "new" ? undefined : deleteTemplateItem}
          saving={saving}
        />
      )}
      {assigningTemplate && (
        <AssignScheduleModal
          template={assigningTemplate}
          students={students}
          loading={studentsLoading}
          saving={saving}
          onClose={() => setAssigningTemplate(null)}
          onAssign={assignTemplate}
        />
      )}
    </div>
  );
}

function validScheduleView(value: string | null): ScheduleView {
  return value === "month" || value === "week" || value === "day" || value === "list" ? value : "week";
}

function parseScheduleDate(value: string | null) {
  const parsed = value ? dayjs(value) : dayjs();
  return parsed.isValid() ? parsed.toDate() : new Date();
}

function PersonalSchedule({
  view,
  date,
  onViewChange,
  onDateChange,
}: {
  view: ScheduleView;
  date: Date;
  onViewChange: (view: ScheduleView) => void;
  onDateChange: (date: Date) => void;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<StudentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<ScheduleItem | null | "new">(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  const items = useMemo(() => flattenSchedules(schedules), [schedules]);

  const load = async () => {
    setLoading(true);
    try {
      setSchedules(await scheduleApi.getMySchedule());
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("schedule.toast.load_schedule_failed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateItem = async (item: ScheduleItem, payload: ScheduleItemPayload) => {
    const previous = schedules;
    setSchedules((prev) =>
      prev.map((schedule) => ({
        ...schedule,
        items: (schedule.items || []).map((row) => (row.id === item.id ? { ...row, ...payload } : row)),
      }))
    );
    try {
      await scheduleApi.updateMyItem(item.id, payload);
      toast.success(t("schedule.toast.schedule_updated"));
      await load();
    } catch (err: any) {
      setSchedules(previous);
      toast.error(err.response?.data?.message || t("schedule.toast.schedule_update_failed"));
    }
  };

  const saveItem = async (payload: ScheduleItemPayload) => {
    setSaving(true);
    try {
      if (activeItem && activeItem !== "new") {
        await scheduleApi.updateMyItem(activeItem.id, payload);
        toast.success(t("schedule.toast.schedule_updated"));
      } else {
        await scheduleApi.createMyItem(payload);
        toast.success(t("schedule.toast.schedule_added"));
      }
      setActiveItem(null);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("schedule.toast.schedule_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async () => {
    if (!activeItem || activeItem === "new") return;
    try {
      await scheduleApi.deleteMyItem(activeItem.id);
      setActiveItem(null);
      await load();
      toast.success(t("schedule.toast.schedule_deleted"));
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("schedule.toast.schedule_delete_failed"));
    }
  };

  const formItem =
    activeItem === "new"
      ? {
          start_time: (defaultDate ? dayjs(defaultDate) : dayjs()).hour(9).minute(0).second(0).toISOString(),
          end_time: (defaultDate ? dayjs(defaultDate) : dayjs()).hour(10).minute(0).second(0).toISOString(),
        }
      : activeItem;

  return (
    <>
      {items.length === 0 && !loading && (
        <div className="mb-4 rounded-lg border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {t("schedule.personal.empty")}
        </div>
      )}
      <ScheduleCalendar
        items={items}
        view={view}
        currentDate={date}
        editable
        loading={loading}
        onViewChange={onViewChange}
        onDateChange={onDateChange}
        onCreateItem={(targetDate) => {
          setDefaultDate(targetDate);
          setActiveItem("new");
        }}
        onItemClick={(item) => {
          setActiveItem(item);
        }}
        onItemMove={updateItem}
      />
      {activeItem && (
        <ScheduleItemForm
          item={formItem}
          title={activeItem === "new" ? t("schedule.personal.add_title") : t("schedule.personal.edit_title")}
          onClose={() => setActiveItem(null)}
          onSubmit={saveItem}
          onDelete={activeItem === "new" ? undefined : deleteItem}
          onOpenResource={
            activeItem !== "new" && activeItem?.resource_type && activeItem?.resource_id
              ? () => openResource(navigate, activeItem)
              : undefined
          }
          saving={saving}
        />
      )}
    </>
  );
}

function SchedulePage() {
  const { t } = useLanguage();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
	const canManageTemplates = user?.role >= 99 || user?.role === 30;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = canManageTemplates && tabParam === "templates" ? "templates" : "personal";
  const view = validScheduleView(searchParams.get("view"));
  const date = parseScheduleDate(searchParams.get("date"));
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    if (!tabParam) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", canManageTemplates ? "templates" : "personal");
      next.set("view", view);
      next.set("date", dayjs(date).format("YYYY-MM-DD"));
      setSearchParams(next, { replace: true });
    }
  }, [canManageTemplates, date, searchParams, setSearchParams, tabParam, view]);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => next.set(key, value));
    if (!next.get("view")) next.set("view", view);
    if (!next.get("date")) next.set("date", dayjs(date).format("YYYY-MM-DD"));
    setSearchParams(next);
  };

  const loadTemplates = async () => {
    if (!canManageTemplates) return;
    setTemplatesLoading(true);
    try {
      const rows = await scheduleApi.listTemplates();
      setTemplates(rows);
      setSelectedTemplate((current) => {
        if (!current) return rows[0] || null;
        return rows.find((row) => row.id === current.id) || rows[0] || null;
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("schedule.toast.load_templates_failed"));
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [canManageTemplates]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-600">
            <CalendarClock className="h-4 w-4" />
            LMS Schedule
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">{t("schedule.page.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {t("schedule.page.subtitle")}
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {canManageTemplates && (
            <button
              type="button"
              onClick={() => updateParams({ tab: "templates" })}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-semibold",
                tab === "templates" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {t("schedule.page.admin_tab")}
            </button>
          )}
          <button
            type="button"
            onClick={() => updateParams({ tab: "personal" })}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold",
              tab === "personal" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {t("schedule.page.personal_tab")}
          </button>
        </div>
      </div>

      {tab === "templates" && canManageTemplates ? (
        <TemplateManager
          templates={templates}
          selectedTemplate={selectedTemplate}
          loading={templatesLoading}
          onRefresh={loadTemplates}
          onSelectTemplate={setSelectedTemplate}
        />
      ) : (
        <PersonalSchedule
          view={view}
          date={date}
          onViewChange={(nextView) => updateParams({ tab: "personal", view: nextView })}
          onDateChange={(nextDate) =>
            updateParams({
              tab: "personal",
              date: dayjs(nextDate).format("YYYY-MM-DD"),
            })
          }
        />
      )}
    </div>
  );
}

export default DashboardLayout(SchedulePage);
