import api from "@/lib/api";

export type OnboardingActivity = {
  id?: string;
  onboarding_id?: string;
  activity_name: string;
  role?: string;
  user?: string;
  begin_on: number;
  duration: number;
  required: boolean;
  status: "Pending" | "Completed" | string;
  completed_at?: string;
};

export type EmployeeOnboarding = {
  id?: string;
  onboarding_number?: string;
  job_applicant: string;
  applicant_name: string;
  applicant_email?: string;
  applicant_phone?: string;
  employee?: string;
  employee_name?: string;
  company: string;
  department?: string;
  designation?: string;
  employee_grade?: string;
  employee_onboarding_template?: string;
  date_of_joining: string;
  status: "Pending" | "In Progress" | "Completed" | string;
  project?: string;
  notes?: string;
  activities: OnboardingActivity[];
  created_at?: string;
  updated_at?: string;
};

export type OnboardingOptions = {
  job_applicants: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    designation: string;
    department: string;
  }>;
  employees: Array<{
    id: string;
    name: string;
    email: string;
    username: string;
  }>;
  companies: string[];
  departments: string[];
  designations: string[];
  employee_grades: string[];
  roles: string[];
  templates: Array<{
    template_name: string;
    department: string;
    designation: string;
    employee_grade: string;
    activities: Array<{
      activity_name: string;
      role: string;
      begin_on: number;
      duration: number;
      required: boolean;
    }>;
  }>;
};

export const onboardingApi = {
  list: async (params?: { q?: string; status?: string; department?: string }) => {
    const res = await api.get<{ data: EmployeeOnboarding[] }>("/hr/employee-onboardings", { params });
    return res.data?.data || [];
  },
  get: async (id: string) => {
    const res = await api.get<{ data: EmployeeOnboarding }>(`/hr/employee-onboardings/${id}`);
    return res.data?.data;
  },
  create: async (data: Partial<EmployeeOnboarding>) => {
    const res = await api.post<{ data: EmployeeOnboarding; message: string }>("/hr/employee-onboardings", data);
    return res.data;
  },
  update: async (id: string, data: Partial<EmployeeOnboarding>) => {
    const res = await api.put<{ data: EmployeeOnboarding; message: string }>(`/hr/employee-onboardings/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete<{ message: string }>(`/hr/employee-onboardings/${id}`);
    return res.data;
  },
  toggleActivity: async (onboardingId: string, activityId: string) => {
    const res = await api.post<{ data: EmployeeOnboarding; message: string }>(
      `/hr/employee-onboardings/${onboardingId}/activities/${activityId}/toggle`
    );
    return res.data;
  },
  createEmployee: async (onboardingId: string) => {
    const res = await api.post<{ data: EmployeeOnboarding; message: string }>(
      `/hr/employee-onboardings/${onboardingId}/create-employee`
    );
    return res.data;
  },
  options: async () => {
    const res = await api.get<OnboardingOptions>("/hr/employee-onboardings/options");
    return res.data;
  },
};
