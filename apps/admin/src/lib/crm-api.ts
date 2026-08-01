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

export type CRMAccount = {
  id: string;
  name: string;
  industry: string;
  company_size: "micro" | "small" | "medium" | "large" | "enterprise" | "";
  region: string;
  website: string;
  phone: string;
  address: string;
  parent_account_id?: string | null;
  parent_name: string;
  status: "prospect" | "customer" | "churned";
  contact_count: number;
  tags: string[] | null;
  created_at: string;
};

export type CRMContact = {
  id: string;
  account_id?: string | null;
  account_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  tags: string[] | null;
  created_at: string;
};

export type CRMInteraction = {
  id: string;
  type: "call" | "email" | "meeting" | "task";
  subject: string;
  description: string;
  related_to_type: "account" | "contact";
  related_to_id: string;
  due_date?: string | null;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
};

export type CRMPipelineStage = {
  id: string;
  name: string;
  stage_type: "open" | "won" | "lost";
  sort_order: number;
  default_probability: number;
};

export type CRMOpportunity = {
  id: string;
  name: string;
  account_id?: string | null;
  account_name: string;
  contact_id?: string | null;
  contact_name: string;
  stage_id: string;
  stage_name: string;
  amount: number;
  probability: number;
  weighted_amount: number;
  expected_close_date?: string | null;
  owner_id?: string | null;
  owner_name: string;
  source: string;
  status: "open" | "won" | "lost";
  lost_reason: string;
  created_at: string;
};

export type CRMSalesRep = { id: string; name: string };
export type CRMPipeline = {
  stages: CRMPipelineStage[];
  opportunities: CRMOpportunity[];
  accounts: Array<Pick<CRMAccount, "id" | "name">>;
  contacts: Array<Pick<CRMContact, "id" | "account_id" | "first_name" | "last_name">>;
  sales_reps: CRMSalesRep[];
};
export type CRMForecast = {
  from: string;
  to: string;
  periods: Array<{ period: string; pipeline: number; weighted: number; won: number; deals: number }>;
  by_rep: Array<{ owner_id: string; owner_name: string; pipeline: number; weighted: number; won: number; deals: number }>;
  lost_reasons: Array<{ reason: string; deals: number; amount: number }>;
};

export type CRMOpportunityInput = {
  name: string;
  account_id: string | null;
  contact_id: string | null;
  stage_id: string | null;
  amount: number;
  probability?: number;
  expected_close_date: string | null;
  owner_id: string | null;
  source: string;
  lost_reason: string;
};

type Page<T> = { data: T[]; meta: { page: number; page_size: number; total: number } };
export type CRMAccountInput = Omit<CRMAccount, "id" | "parent_name" | "contact_count" | "created_at">;
export type CRMContactInput = Omit<CRMContact, "id" | "account_name" | "created_at">;

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
  async accounts(params: Record<string, string | number | undefined> = {}) {
    return (await api.get<Page<CRMAccount>>("/crm/directory/accounts", { params })).data;
  },
  async createAccount(input: CRMAccountInput) {
    return (await api.post<CRMAccount>("/crm/directory/accounts", input)).data;
  },
  async updateAccount(id: string, input: CRMAccountInput) {
    return (await api.patch<CRMAccount>(`/crm/directory/accounts/${id}`, input)).data;
  },
  async deleteAccount(id: string) { await api.delete(`/crm/directory/accounts/${id}`); },
  async contacts(params: Record<string, string | number | undefined> = {}) {
    return (await api.get<Page<CRMContact>>("/crm/directory/contacts", { params })).data;
  },
  async createContact(input: CRMContactInput) {
    return (await api.post<CRMContact>("/crm/directory/contacts", input)).data;
  },
  async updateContact(id: string, input: CRMContactInput) {
    return (await api.patch<CRMContact>(`/crm/directory/contacts/${id}`, input)).data;
  },
  async deleteContact(id: string) { await api.delete(`/crm/directory/contacts/${id}`); },
  async interactions(kind: "accounts" | "contacts", id: string) {
    return (await api.get<CRMInteraction[]>(`/crm/directory/${kind}/${id}/interactions`)).data;
  },
  async createInteraction(kind: "accounts" | "contacts", id: string, input: Partial<CRMInteraction>) {
    return (await api.post<CRMInteraction>(`/crm/directory/${kind}/${id}/interactions`, input)).data;
  },
  async pipeline(params: { q?: string; owner_id?: string } = {}) {
    return (await api.get<CRMPipeline>("/crm/pipeline", { params })).data;
  },
  async createOpportunity(input: CRMOpportunityInput) {
    return (await api.post<CRMOpportunity>("/crm/pipeline/opportunities", input)).data;
  },
  async updateOpportunity(id: string, input: CRMOpportunityInput) {
    return (await api.patch<CRMOpportunity>(`/crm/pipeline/opportunities/${id}`, input)).data;
  },
  async deleteOpportunity(id: string) { await api.delete(`/crm/pipeline/opportunities/${id}`); },
  async moveOpportunity(id: string, stage_id: string, lost_reason = "") {
    return (await api.post<CRMOpportunity>(`/crm/pipeline/opportunities/${id}/move`, { stage_id, lost_reason })).data;
  },
  async createPipelineStage(input: Omit<CRMPipelineStage, "id">) {
    return (await api.post<CRMPipelineStage>("/crm/pipeline/stages", input)).data;
  },
  async updatePipelineStage(id: string, input: Omit<CRMPipelineStage, "id">) {
    return (await api.patch<CRMPipelineStage>(`/crm/pipeline/stages/${id}`, input)).data;
  },
  async deletePipelineStage(id: string) { await api.delete(`/crm/pipeline/stages/${id}`); },
  async forecast(params: { from?: string; to?: string; owner_id?: string } = {}) {
    return (await api.get<CRMForecast>("/crm/pipeline/forecast", { params })).data;
  },
};
