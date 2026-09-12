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

const initialPrograms: LoyaltyProgram[] = [
  {
    id: "lp-std-001",
    loyalty_program_name: "Standard VIP Loyalty Program",
    loyalty_program_type: "Single Tier Program",
    from_date: "2026-01-01",
    to_date: "2026-12-31",
    customer_group: "All Customer Groups",
    customer_territory: "All Territories",
    auto_opt_in: true,
    collection_rules: [
      { id: "cr-1", tier_name: "Tier 1", min_spent: 0, collection_factor: 10 },
    ],
    conversion_factor: 1,
    expiry_duration: 365,
    expense_account: "5112 - Loyalty Program Expense",
    company: "",
    cost_center: "",
    project: "Customer Retention Q3",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "lp-multi-002",
    loyalty_program_name: "Platinum Tiered Rewards",
    loyalty_program_type: "Multiple Tier Program",
    from_date: "2026-01-01",
    to_date: "",
    customer_group: "Commercial",
    customer_territory: "Indonesia",
    auto_opt_in: true,
    collection_rules: [
      { id: "cr-10", tier_name: "Silver", min_spent: 0, collection_factor: 20 },
      { id: "cr-11", tier_name: "Gold", min_spent: 5000000, collection_factor: 10 },
      { id: "cr-12", tier_name: "Platinum", min_spent: 20000000, collection_factor: 5 },
    ],
    conversion_factor: 5,
    expiry_duration: 180,
    expense_account: "5111 - Marketing & Promotional Expense",
    company: "",
    cost_center: "",
    project: "General Marketing 2026",
    created_at: "2026-02-15T00:00:00Z",
  },
];

const initialPointEntries: LoyaltyPointEntry[] = [
  {
    id: "LPE-2026-0001",
    loyalty_program: "Standard VIP Loyalty Program",
    customer: "PT Sentosa Abadi",
    sales_invoice: "ACC-SINV-2026-0012",
    loyalty_points: 500,
    purchase_amount: 5000000,
    expiry_date: "2027-01-01",
    posting_date: "2026-07-20",
    type: "Earned",
  },
  {
    id: "LPE-2026-0002",
    loyalty_program: "Platinum Tiered Rewards",
    customer: "CV Jaya Wijaya",
    sales_invoice: "ACC-SINV-2026-0015",
    loyalty_points: 1200,
    purchase_amount: 6000000,
    expiry_date: "2027-01-25",
    posting_date: "2026-07-25",
    type: "Earned",
  },
  {
    id: "LPE-2026-0003",
    loyalty_program: "Standard VIP Loyalty Program",
    customer: "PT Sentosa Abadi",
    sales_invoice: "ACC-SINV-2026-0018",
    loyalty_points: -200,
    purchase_amount: 0,
    expiry_date: "",
    posting_date: "2026-07-28",
    type: "Redeemed",
  },
];

function getStoredPrograms(): LoyaltyProgram[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialPrograms));
      return initialPrograms;
    }
    return JSON.parse(raw);
  } catch {
    return initialPrograms;
  }
}

function saveStoredPrograms(programs: LoyaltyProgram[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(programs));
}

function getStoredEntries(): LoyaltyPointEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(initialPointEntries));
      return initialPointEntries;
    }
    return JSON.parse(raw);
  } catch {
    return initialPointEntries;
  }
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
      const res = await api.get<LoyaltyProgram>(`/selling/loyalty-programs/${id}`);
      if (res.data) return res.data;
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
      const res = await api.post<LoyaltyProgram>("/selling/loyalty-programs", newDoc);
      if (res.data) return res.data;
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
      const res = await api.put<LoyaltyProgram>(`/selling/loyalty-programs/${id}`, updatedDoc);
      if (res.data) return res.data;
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

  async entriesList(): Promise<LoyaltyPointEntry[]> {
    try {
      const res = await api.get<{ data: LoyaltyPointEntry[] }>("/selling/loyalty-point-entries");
      if (res.data?.data) return res.data.data;
    } catch {
      // Fallback
    }
    return getStoredEntries();
  },

  async options(): Promise<LoyaltyOptions> {
    return defaultOptions;
  },
};
