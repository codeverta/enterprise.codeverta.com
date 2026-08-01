import api from "@/lib/api";

export type LeadStatus = "new" | "contacted" | "qualified" | "unqualified" | "converted";

export type CRMLead = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  source?: string;
  source_detail?: string;
  region?: string;
  product_interest?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  analytics_client_id?: string;
  status: LeadStatus;
  score: number;
  assigned_to?: string | null;
  notes?: string;
  created_at: string;
};

export type LeadInput = Omit<CRMLead, "id" | "score" | "created_at">;

export type CRMDashboard = {
  total: number;
  unassigned: number;
  high_score: number;
  by_status: Array<{ status: LeadStatus; count: number }>;
};

export type CRMAutomation = {
  assignment_method: "round_robin" | "territory" | "product" | "manual";
  sales_rep_ids: string[] | null;
  territory_rules: Record<string, string> | null;
  product_rules: Record<string, string> | null;
  scoring_rules: Record<string, number> | null;
  capture_enabled: boolean;
};

export type CRMIntegration = {
  id?: string;
  provider: "google_analytics" | "meta_ads" | "tiktok_ads";
  enabled: boolean;
  config: Record<string, string>;
  has_secrets: boolean;
  last_sync_at?: string;
  last_error?: string;
};

export const crmApi = {
  async dashboard() {
    return (await api.get<CRMDashboard>("/crm/dashboard")).data;
  },
  async leads(params: { page?: number; page_size?: number; q?: string; status?: string }) {
    return (await api.get<{ data: CRMLead[]; meta: { page: number; page_size: number; total: number } }>("/crm/leads", { params })).data;
  },
  async createLead(input: Partial<LeadInput>) {
    return (await api.post<CRMLead>("/crm/leads", input)).data;
  },
  async updateLead(id: string, input: Partial<LeadInput>) {
    return (await api.patch<CRMLead>(`/crm/leads/${id}`, input)).data;
  },
  async deleteLead(id: string) {
    await api.delete(`/crm/leads/${id}`);
  },
  async importLeads(file: File) {
    const form = new FormData();
    form.append("file", file);
    return (await api.post<{ created: number; failed: number; errors: string[] }>("/crm/leads/import", form)).data;
  },
  async automation() {
    return (await api.get<CRMAutomation>("/crm/automation")).data;
  },
  async saveAutomation(input: CRMAutomation) {
    return (await api.put<CRMAutomation>("/crm/automation", input)).data;
  },
  async integrations() {
    return (await api.get<CRMIntegration[]>("/crm/integrations")).data;
  },
  async saveIntegration(provider: CRMIntegration["provider"], input: {
    enabled: boolean;
    config: Record<string, string>;
    secrets?: Record<string, string>;
  }) {
    return (await api.put<CRMIntegration>(`/crm/integrations/${provider}`, input)).data;
  },
};

