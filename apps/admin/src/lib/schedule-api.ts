import api from "@/lib/api";

export type ScheduleResourceType = "" | "course" | "module" | "lesson" | "quiz";

export type ScheduleItemPayload = {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  color?: string;
  resource_type?: ScheduleResourceType;
  resource_id?: string | null;
};

export type ScheduleItem = ScheduleItemPayload & {
  id: string;
  student_schedule_id?: string;
  schedule_template_id?: string;
  student_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ScheduleTemplate = {
  id: string;
  title: string;
  description?: string;
  created_by?: string;
  items?: ScheduleItem[];
  created_at?: string;
  updated_at?: string;
};

export type StudentSchedule = {
  id: string;
  student_id: string;
  schedule_template_id?: string | null;
  title: string;
  items?: ScheduleItem[];
  created_at?: string;
  updated_at?: string;
};

export type ScheduleStudent = {
  id: string;
  email?: string;
  username?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
};

export type ScheduleResourceOption = {
  id: string;
  title: string;
  subtitle?: string;
};

const unwrap = (res: any) => res.data?.data || res.data || [];

export const scheduleApi = {
  async listTemplates(): Promise<ScheduleTemplate[]> {
    const res = await api.get("/lms/schedule-templates");
    return unwrap(res);
  },
  async getTemplate(id: string): Promise<ScheduleTemplate> {
    const res = await api.get(`/lms/schedule-templates/${id}`);
    return unwrap(res);
  },
  async createTemplate(payload: { title: string; description?: string }) {
    const res = await api.post("/lms/schedule-templates", payload);
    return unwrap(res);
  },
  async updateTemplate(id: string, payload: { title: string; description?: string }) {
    const res = await api.put(`/lms/schedule-templates/${id}`, payload);
    return unwrap(res);
  },
  async deleteTemplate(id: string) {
    await api.delete(`/lms/schedule-templates/${id}`);
  },
  async createTemplateItem(templateId: string, payload: ScheduleItemPayload) {
    const res = await api.post(`/lms/schedule-templates/${templateId}/items`, payload);
    return unwrap(res);
  },
  async updateTemplateItem(itemId: string, payload: ScheduleItemPayload) {
    const res = await api.put(`/lms/schedule-template-items/${itemId}`, payload);
    return unwrap(res);
  },
  async deleteTemplateItem(itemId: string) {
    await api.delete(`/lms/schedule-template-items/${itemId}`);
  },
  async assignTemplate(templateId: string, studentIds: string[]) {
    const res = await api.post(`/lms/schedule-templates/${templateId}/assign`, {
      student_ids: studentIds,
    });
    return unwrap(res);
  },
  async listStudents(): Promise<ScheduleStudent[]> {
    const res = await api.get("/lms/schedule-students");
    return unwrap(res);
  },
  async searchResourceOptions(
    resourceType: Exclude<ScheduleResourceType, "">,
    query = ""
  ): Promise<ScheduleResourceOption[]> {
    const params = new URLSearchParams({
      resource_type: resourceType,
      limit: "50",
    });
    if (query.trim()) params.set("q", query.trim());
    const res = await api.get(`/lms/schedule-resource-options?${params.toString()}`);
    return unwrap(res);
  },
  async getMySchedule(): Promise<StudentSchedule[]> {
    const res = await api.get("/lms/my-schedule");
    return unwrap(res);
  },
  async createMyItem(payload: ScheduleItemPayload) {
    const res = await api.post("/lms/my-schedule/items", payload);
    return unwrap(res);
  },
  async updateMyItem(itemId: string, payload: ScheduleItemPayload) {
    const res = await api.put(`/lms/my-schedule/items/${itemId}`, payload);
    return unwrap(res);
  },
  async deleteMyItem(itemId: string) {
    await api.delete(`/lms/my-schedule/items/${itemId}`);
  },
};
