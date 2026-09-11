import api from "@/lib/api";

export type ProjectStatus = "Open" | "Completed" | "Cancelled";

export type PercentCompleteMethod =
  | "Manual"
  | "Task Completion"
  | "Task Progress"
  | "Task Weight";

export type TaskStatus =
  | "Open"
  | "Working"
  | "Pending Review"
  | "Overdue"
  | "Template"
  | "Completed"
  | "Cancelled";

export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export interface Project {
  id: string;
  tenant_id?: string;
  naming_series: string;
  project_name: string;
  status: ProjectStatus;
  project_type?: string;
  percent_complete_method: PercentCompleteMethod;
  percent_complete: number;
  project_template?: string;
  priority: string;
  department?: string;
  customer?: string;
  is_active: boolean;
  expected_start_date?: string | null;
  expected_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  estimated_cost: number;
  total_costing_amount: number;
  total_expense_claim: number;
  notes?: string;
  tasks?: Task[];
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  tenant_id?: string;
  task_code: string;
  subject: string;
  project_id?: string | null;
  project_name?: string;
  issue?: string;
  type?: string;
  color?: string;
  is_group?: boolean;
  status: TaskStatus;
  priority: TaskPriority;
  task_weight: number;
  parent_task_id?: string | null;
  parent_task_name?: string;
  is_template?: boolean;
  exp_start_date?: string | null;
  expected_time: number;
  exp_end_date?: string | null;
  act_start_date?: string | null;
  act_end_date?: string | null;
  actual_time: number;
  progress: number;
  is_milestone?: boolean;
  description?: string;
  depends_on_tasks?: string;
  assigned_to?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectOptions {
  project_types: string[];
  project_templates: string[];
  percent_complete_methods: string[];
  statuses: string[];
  priorities: string[];
  departments: string[];
  customers: string[];
}

export interface TaskOptions {
  projects: { id: string; project_name: string; status: string }[];
  parent_tasks: { id: string; task_code: string; subject: string }[];
  activity_types: string[];
  types: string[];
  statuses: string[];
  priorities: string[];
}

export const projectsApi = {
  listProjects: (params?: { status?: string; priority?: string; project_type?: string; q?: string }) =>
    api.get<{ data: Project[] }>("/projects", { params }),

  getProject: (id: string) =>
    api.get<{ data: Project }>(`/projects/${encodeURIComponent(id)}`),

  createProject: (payload: Partial<Project>) =>
    api.post<{ data: Project; message: string }>("/projects", payload),

  updateProject: (id: string, payload: Partial<Project>) =>
    api.put<{ data: Project; message: string }>(`/projects/${encodeURIComponent(id)}`, payload),

  deleteProject: (id: string) =>
    api.delete<{ message: string }>(`/projects/${encodeURIComponent(id)}`),

  getProjectOptions: () =>
    api.get<ProjectOptions>("/projects/options"),

  // Tasks API
  listTasks: (params?: { project_id?: string; status?: string; priority?: string; q?: string }) =>
    api.get<{ data: Task[] }>("/tasks", { params }),

  getTask: (id: string) =>
    api.get<{ data: Task }>(`/tasks/${encodeURIComponent(id)}`),

  createTask: (payload: Partial<Task>) =>
    api.post<{ data: Task; message: string }>("/tasks", payload),

  updateTask: (id: string, payload: Partial<Task>) =>
    api.put<{ data: Task; message: string }>(`/tasks/${encodeURIComponent(id)}`, payload),

  deleteTask: (id: string) =>
    api.delete<{ message: string }>(`/tasks/${encodeURIComponent(id)}`),

  getTaskOptions: () =>
    api.get<TaskOptions>("/tasks/options"),
};

export type TimesheetStatus = "Draft" | "Submitted" | "Billed" | "Payslip" | "Cancelled";

export interface TimesheetDetail {
  id?: string;
  idx?: number;
  activity_type: string;
  from_time: string;
  to_time?: string;
  hours: number;
  project_id?: string | null;
  project_name?: string;
  task_id?: string | null;
  task_name?: string;
  is_billable: boolean;
  billing_rate: number;
  billing_amount: number;
  costing_rate: number;
  costing_amount: number;
  description?: string;
}

export interface Timesheet {
  id: string;
  tenant_id?: string;
  series: string;
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  company: string;
  customer?: string;
  currency: string;
  exchange_rate: number;
  status: TimesheetStatus;
  project_id?: string | null;
  project_name?: string;
  start_date?: string | null;
  end_date?: string | null;
  total_working_hours: number;
  total_billable_hours: number;
  total_billed_hours: number;
  total_billable_amount: number;
  total_costing_amount: number;
  sales_invoice?: string;
  notes?: string;
  time_logs?: TimesheetDetail[];
  created_at?: string;
  updated_at?: string;
}

export interface TimesheetOptions {
  employees: { id: string; name: string; email: string; username: string }[];
  projects: { id: string; project_name: string; customer?: string }[];
  tasks: { id: string; task_code: string; subject: string; project_id?: string }[];
  activity_types: string[];
  companies: string[];
  customers: string[];
  statuses: string[];
}

export const timesheetApi = {
  listTimesheets: (params?: { status?: string; employee_id?: string; project_id?: string; q?: string }) =>
    api.get<{ data: Timesheet[] }>("/timesheets", { params }),

  getTimesheet: (id: string) =>
    api.get<{ data: Timesheet }>(`/timesheets/${encodeURIComponent(id)}`),

  createTimesheet: (payload: Partial<Timesheet>) =>
    api.post<{ data: Timesheet; message: string }>("/timesheets", payload),

  updateTimesheet: (id: string, payload: Partial<Timesheet>) =>
    api.put<{ data: Timesheet; message: string }>(`/timesheets/${encodeURIComponent(id)}`, payload),

  submitTimesheet: (id: string) =>
    api.post<{ data: Timesheet; message: string }>(`/timesheets/${encodeURIComponent(id)}/submit`),

  cancelTimesheet: (id: string) =>
    api.post<{ data: Timesheet; message: string }>(`/timesheets/${encodeURIComponent(id)}/cancel`),

  deleteTimesheet: (id: string) =>
    api.delete<{ message: string }>(`/timesheets/${encodeURIComponent(id)}`),

  getTimesheetOptions: () =>
    api.get<TimesheetOptions>("/timesheets/options"),
};
