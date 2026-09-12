import api from "@/lib/api";

export type LoyaltyProgramType = "Single Tier Program" | "Multiple Tier Program";

export type CollectionRule = {
  id?: string;
  tier_name: string;
  min_spent: number;
  collection_factor: number;
};

export type LoyaltyProgram = {
  id?: string;
  loyalty_program_name: string;
  loyalty_program_type: LoyaltyProgramType;
  from_date?: string;
  to_date?: string;
  customer_group?: string;
  customer_territory?: string;
  auto_opt_in: boolean;
  collection_rules: CollectionRule[];
  conversion_factor: number;
  expiry_duration: number;
  expense_account: string;
  company: string;
  cost_center?: string;
  project?: string;
  created_at?: string;
  updated_at?: string;
};

export type LoyaltyPointEntry = {
  id: string;
  loyalty_program: string;
  customer: string;
  sales_invoice?: string;
  reference_type?: "POS Invoice" | "Sales Invoice" | "Sales Order";
  loyalty_points: number;
  purchase_amount: number;
  expiry_date?: string;
  posting_date: string;
  type: "Earned" | "Redeemed" | "Expired";
};

export type LoyaltyOptions = {
  customer_groups: string[];
  customer_territories: string[];
  expense_accounts: string[];
  companies: string[];
  cost_centers: string[];
  projects: string[];
};

const STORAGE_KEY = "erp_loyalty_programs";
const ENTRIES_STORAGE_KEY = "erp_loyalty_point_entries";

function cleanLegacyDummyData() {
  try {
    const raw = localStorage.getItem(ENTRIES_STORAGE_KEY);
    if (raw && (raw.includes("PT Sentosa Abadi") || raw.includes("LPE-2026-0001"))) {
      localStorage.removeItem(ENTRIES_STORAGE_KEY);
    }
  } catch {}
}
cleanLegacyDummyData();

function getStoredPrograms(): LoyaltyProgram[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveStoredPrograms(programs: LoyaltyProgram[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(programs));
}

function getStoredEntries(): LoyaltyPointEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveStoredEntries(entries: LoyaltyPointEntry[]) {
  localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
}

export const defaultOptions: LoyaltyOptions = {
  customer_groups: ["All Customer Groups", "Commercial", "Individual", "Non Profit", "Retail"],
  customer_territories: ["All Territories", "Indonesia", "Jakarta", "Surabaya", "Asia", "North America"],
  expense_accounts: [
    "5112 - Loyalty Program Expense",
    "5111 - Marketing & Promotional Expense",
    "5110 - Sales Expenses",
  ],
  companies: [],
  cost_centers: [
    "",
    "",
    "",
  ],
  projects: ["General Marketing 2026", "Customer Retention Q3"],
};

export const loyaltyApi = {
  async list(params?: { q?: string; type?: string }): Promise<LoyaltyProgram[]> {
    try {
      const res = await api.get<{ data: LoyaltyProgram[] }>("/selling/loyalty-programs", { params });
      if (res.data?.data) return res.data.data;
    } catch {
      // Fallback to local storage
    }
    let list = getStoredPrograms();
    if (params?.q) {
      const q = params.q.toLowerCase();
      list = list.filter(
        (p) =>
          p.loyalty_program_name.toLowerCase().includes(q) ||
          p.customer_group?.toLowerCase().includes(q)
      );
    }
    if (params?.type) {
      list = list.filter((p) => p.loyalty_program_type === params.type);
    }
    return list;
  },

  async get(id: string): Promise<LoyaltyProgram> {
    try {
      const res = await api.get<{ data?: LoyaltyProgram } | LoyaltyProgram>(`/selling/loyalty-programs/${id}`);
      const data = (res.data as any)?.data || res.data;
      if (data) return data;
    } catch {
      // Fallback
    }
    const list = getStoredPrograms();
    const found = list.find((p) => p.id === id);
    if (!found) throw new Error("Loyalty Program tidak ditemukan");
    return found;
  },

  async create(input: LoyaltyProgram): Promise<LoyaltyProgram> {
    const newDoc: LoyaltyProgram = {
      ...input,
      id: input.id || `lp-${Math.random().toString(36).slice(2, 10)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      const res = await api.post<{ data?: LoyaltyProgram } | LoyaltyProgram>("/selling/loyalty-programs", newDoc);
      const data = (res.data as any)?.data || res.data;
      if (data) return data;
    } catch {
      // Fallback
    }
    const list = getStoredPrograms();
    list.unshift(newDoc);
    saveStoredPrograms(list);
    return newDoc;
  },

  async update(id: string, input: LoyaltyProgram): Promise<LoyaltyProgram> {
    const updatedDoc: LoyaltyProgram = {
      ...input,
      id,
      updated_at: new Date().toISOString(),
    };
    try {
      const res = await api.put<{ data?: LoyaltyProgram } | LoyaltyProgram>(`/selling/loyalty-programs/${id}`, updatedDoc);
      const data = (res.data as any)?.data || res.data;
      if (data) return data;
    } catch {
      // Fallback
    }
    const list = getStoredPrograms();
    const index = list.findIndex((p) => p.id === id);
    if (index !== -1) {
      list[index] = updatedDoc;
      saveStoredPrograms(list);
    }
    return updatedDoc;
  },

  async remove(id: string): Promise<void> {
    try {
      await api.delete(`/selling/loyalty-programs/${id}`);
    } catch {
      // Fallback
    }
    const list = getStoredPrograms().filter((p) => p.id !== id);
    saveStoredPrograms(list);
  },

  async entriesList(params?: {
    q?: string;
    program?: string;
    customer?: string;
    type?: string;
  }): Promise<LoyaltyPointEntry[]> {
    try {
      const res = await api.get<{ data: LoyaltyPointEntry[] }>(
        "/selling/loyalty-point-entries",
        { params },
      );
      if (res.data?.data) return res.data.data;
    } catch {
      // Fallback
    }
    let list = getStoredEntries();
    if (params?.q) {
      const q = params.q.toLowerCase();
      list = list.filter(
        (e) =>
          e.customer.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.loyalty_program.toLowerCase().includes(q) ||
          e.sales_invoice?.toLowerCase().includes(q),
      );
    }
    if (params?.program) {
      list = list.filter((e) => e.loyalty_program === params.program);
    }
    if (params?.customer) {
      list = list.filter((e) => e.customer === params.customer);
    }
    if (params?.type) {
      list = list.filter((e) => e.type === params.type);
    }
    return list;
  },

  async createEntry(input: Partial<LoyaltyPointEntry>): Promise<LoyaltyPointEntry> {
    try {
      const res = await api.post<{ data: LoyaltyPointEntry }>("/selling/loyalty-point-entries", input);
      if (res.data?.data) return res.data.data;
    } catch {
      // Fallback
    }
    const created: LoyaltyPointEntry = {
      id: input.id || `LPE-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      loyalty_program: input.loyalty_program || "",
      customer: input.customer || "",
      sales_invoice: input.sales_invoice || "",
      reference_type: input.reference_type || "Manual Entry",
      loyalty_points: Number(input.loyalty_points || 0),
      purchase_amount: Number(input.purchase_amount || 0),
      posting_date: input.posting_date || new Date().toISOString().slice(0, 10),
      type: input.type || (Number(input.loyalty_points || 0) >= 0 ? "Earned" : "Redeemed"),
      expiry_date: input.expiry_date,
    };
    const entries = getStoredEntries();
    entries.unshift(created);
    saveStoredEntries(entries);
    return created;
  },

  async deleteEntry(id: string): Promise<void> {
    try {
      await api.delete(`/selling/loyalty-point-entries/${id}`);
    } catch {
      // Fallback
    }
    const entries = getStoredEntries().filter((e) => e.id !== id);
    saveStoredEntries(entries);
  },

  async options(): Promise<LoyaltyOptions> {
    try {
      const res = await api.get<LoyaltyOptions>("/selling/loyalty-programs/options");
      if (res.data) return res.data;
    } catch {}
    return defaultOptions;
  },
};
