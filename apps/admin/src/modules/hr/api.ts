import api from "@/lib/api";

export type PayrollEntryStatus = "Draft" | "Submitted" | "Cancelled";

export interface PayrollEntryEmployee {
  id: string;
  payroll_entry_id: string;
  user_id?: string;
  employee_name: string;
  employee_email?: string;
  department?: string;
  designation?: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  gross_pay: number;
  net_pay: number;
  status?: string;
}

export interface PayrollEntry {
  id: string;
  tenant_id?: string;
  posting_date: string;
  payroll_frequency: string;
  company: string;
  department?: string;
  branch?: string;
  designation?: string;
  start_date: string;
  end_date: string;
  currency: string;
  exchange_rate: number;
  status: PayrollEntryStatus;
  total_gross_pay: number;
  total_deductions: number;
  total_net_pay: number;
  total_employees: number;
  salary_slip_created: boolean;
  payment_account?: string;
  cost_center?: string;
  items?: PayrollEntryEmployee[];
  created_at?: string;
  updated_at?: string;
}

export interface PayrollEntryOptions {
  companies: string[];
  departments: string[];
  designations: string[];
  payroll_frequencies: string[];
  employees: Array<{
    id: string;
    name: string;
    email: string;
    username: string;
  }>;
}

export const payrollApi = {
  list: async (params?: { q?: string; status?: string }) => {
    const res = await api.get<{ data: PayrollEntry[] }>("/hr/payroll-entries", { params });
    return res.data?.data || [];
  },

  get: async (id: string) => {
    const res = await api.get<PayrollEntry>(`/hr/payroll-entries/${id}`);
    return res.data;
  },

  create: async (data: Partial<PayrollEntry>) => {
    const res = await api.post<PayrollEntry>("/hr/payroll-entries", data);
    return res.data;
  },

  update: async (id: string, data: Partial<PayrollEntry>) => {
    const res = await api.put<PayrollEntry>(`/hr/payroll-entries/${id}`, data);
    return res.data;
  },

  delete: async (id: string) => {
    const res = await api.delete<{ message: string }>(`/hr/payroll-entries/${id}`);
    return res.data;
  },

  getEmployees: async (id: string) => {
    const res = await api.post<PayrollEntry>(`/hr/payroll-entries/${id}/get-employees`);
    return res.data;
  },

  submit: async (id: string) => {
    const res = await api.post<{ message: string; data: PayrollEntry }>(`/hr/payroll-entries/${id}/submit`);
    return res.data;
  },

  options: async () => {
    const res = await api.get<PayrollEntryOptions>("/hr/payroll-entries/options");
    return res.data;
  },
};

export type AttendanceStatus = "Present" | "Absent" | "On Leave" | "Half Day";

export interface Attendance {
  id: string;
  tenant_id?: string;
  user_id: string;
  employee_name: string;
  employee_email?: string;
  department?: string;
  attendance_date: string;
  status: AttendanceStatus;
  shift?: string;
  in_time?: string;
  out_time?: string;
  working_hours?: number;
  late_entry?: boolean;
  early_exit?: boolean;
  device_id?: string;
  source?: string;
  docstatus?: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeCheckin {
  id: string;
  tenant_id?: string;
  user_id: string;
  employee_name: string;
  log_type: "IN" | "OUT";
  timestamp: string;
  device_id?: string;
  source?: string;
  location?: string;
  attendance_id?: string;
  created_at?: string;
}

export interface AttendanceStats {
  total_employees: number;
  present_today: number;
  half_day_today: number;
  on_leave_today: number;
  absent_today: number;
  date: string;
}

export interface AttendanceOptions {
  employees: Array<{
    id: string;
    name: string;
    email: string;
    username: string;
  }>;
  shifts: string[];
  statuses: AttendanceStatus[];
  departments: string[];
  devices: string[];
}

export const attendanceApi = {
  list: async (params?: {
    date?: string;
    month?: string;
    user_id?: string;
    status?: string;
    department?: string;
    shift?: string;
    q?: string;
  }) => {
    const res = await api.get<{ data: Attendance[] }>("/hr/attendances", { params });
    return res.data?.data || [];
  },

  get: async (id: string) => {
    const res = await api.get<Attendance>(`/hr/attendances/${id}`);
    return res.data;
  },

  create: async (data: Partial<Attendance>) => {
    const res = await api.post<Attendance>("/hr/attendances", data);
    return res.data;
  },

  update: async (id: string, data: Partial<Attendance>) => {
    const res = await api.put<Attendance>(`/hr/attendances/${id}`, data);
    return res.data;
  },

  delete: async (id: string) => {
    const res = await api.delete<{ message: string }>(`/hr/attendances/${id}`);
    return res.data;
  },

  markBulk: async (data: {
    user_ids: string[];
    dates: string[];
    status: AttendanceStatus;
    shift?: string;
    exclude_holidays?: boolean;
    remarks?: string;
  }) => {
    const res = await api.post<{ message: string; created: number; updated: number }>("/hr/attendances/mark-bulk", data);
    return res.data;
  },

  processScan: async (data: {
    identifier: string;
    source?: string;
    device_id?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    log_type?: string;
  }) => {
    const res = await api.post<{
      message: string;
      log_type: "IN" | "OUT";
      checkin: EmployeeCheckin;
      attendance: Attendance;
      employee: { id: string; name: string; email: string; username: string };
    }>("/hr/checkins/scan", data);
    return res.data;
  },

  checkins: async () => {
    const res = await api.get<{ data: EmployeeCheckin[] }>("/hr/checkins");
    return res.data?.data || [];
  },

  stats: async () => {
    const res = await api.get<AttendanceStats>("/hr/attendances/stats");
    return res.data;
  },

  options: async () => {
    const res = await api.get<AttendanceOptions>("/hr/attendances/options");
    return res.data;
  },
};

