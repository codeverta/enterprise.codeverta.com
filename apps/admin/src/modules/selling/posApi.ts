import api from "@/lib/api";

export type PaymentBalance = {
  id?: string;
  mode_of_payment: string;
  opening_amount: number;
};

export type POSOpeningEntry = {
  id: string;
  period_start_date: string;
  posting_date: string;
  company: string;
  pos_profile: string;
  user: string;
  status: "Open" | "Closed";
  opening_balance_total: number;
  balance_details: PaymentBalance[];
  closed_at?: string;
};

export type POSReconciliation = {
  mode_of_payment: string;
  opening_amount: number;
  expected_amount: number;
  closing_amount: number;
  difference: number;
};

export type POSClosingInvoice = {
  id?: string;
  sales_invoice: string;
  customer?: string;
  posting_date: string;
  grand_total?: number;
};

export type POSClosingEntry = {
  id: string;
  pos_opening_entry: string;
  period_start_date?: string;
  period_end_date: string;
  posting_date: string;
  posting_time?: string;
  company: string;
  pos_profile?: string;
  user: string;
  total_quantity?: number;
  net_total: number;
  total_taxes_and_charges?: number;
  grand_total: number;
  status?: string;
  payment_reconciliation: POSReconciliation[];
  sales_invoices?: POSClosingInvoice[];
};

export type POSItem = {
  id: string;
  item_code: string;
  item_name: string;
  item_group: string;
  rate: number;
  stock: number;
  unit: string;
  image?: string;
  image_url?: string;
  is_stock_item: boolean;
  barcodes: string[];
  color: string;
  initials: string;
};

export type POSCartItem = POSItem & {
  quantity: number;
  discount_percentage?: number;
};

export type POSInvoice = {
  id?: string;
  invoice_number?: string;
  opening_entry_id: string;
  customer: string;
  company?: string;
  net_total?: number;
  tax_total: number;
  discount_amount?: number;
  grand_total?: number;
  mode_of_payment: string;
  paid_amount?: number;
  status?: string;
  created_at?: string;
  items: Array<{
    item_code: string;
    item_name: string;
    quantity: number;
    rate: number;
    discount_percentage?: number;
    discount_amount?: number;
    amount?: number;
  }>;
};

const OPENINGS_KEY = "erp_pos_opening_entries";
const CLOSINGS_KEY = "erp_pos_closing_entries";
const INVOICES_KEY = "erp_pos_invoices";

type POSItemPayload = Omit<POSItem, "color" | "initials">;

const itemColors = [
  "from-slate-100 to-slate-200",
  "from-indigo-50 to-slate-200",
  "from-amber-50 to-orange-100",
  "from-stone-50 to-amber-100",
  "from-rose-50 to-pink-100",
  "from-emerald-50 to-teal-100",
  "from-sky-50 to-cyan-100",
  "from-violet-50 to-purple-100",
];

function decoratePOSItem(item: POSItemPayload, index: number): POSItem {
  const initials =
    item.item_name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || item.item_code.slice(0, 2).toUpperCase();
  const image = item.image || item.image_url || "";
  return {
    ...item,
    image,
    image_url: image,
    barcodes: item.barcodes || [],
    color: itemColors[index % itemColors.length],
    initials,
  };
}

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function openingSeed(): POSOpeningEntry[] {
  const started = new Date(Date.now() - 14 * 60 * 60 * 1000);
  return [
    {
      id: `POS-OPEN-${started.toISOString().slice(0, 10).replaceAll("-", "")}-001`,
      period_start_date: started.toISOString(),
      posting_date: started.toISOString(),
      company: "",
      pos_profile: "Usaha Jualan Lilin",
      user: "Administrator",
      status: "Open",
      opening_balance_total: 0,
      balance_details: [
        { mode_of_payment: "Cash", opening_amount: 0 },
        { mode_of_payment: "QRIS", opening_amount: 0 },
      ],
    },
  ];
}

function localOpenings() {
  const existing = read<POSOpeningEntry[] | null>(OPENINGS_KEY, null);
  if (existing) return existing;
  const seeded = openingSeed();
  write(OPENINGS_KEY, seeded);
  return seeded;
}

function unwrap<T>(payload: unknown): T {
  const value = payload as { data?: T };
  return value?.data ?? (payload as T);
}

export const isOpeningOutdated = (entry?: POSOpeningEntry | null) =>
  Boolean(
    entry &&
    Date.now() - new Date(entry.period_start_date).getTime() >
      12 * 60 * 60 * 1000,
  );

export const posApi = {
  async listItems(): Promise<POSItem[]> {
    const items = unwrap<POSItemPayload[]>(
      (await api.get("/selling/pos/items")).data,
    );
    return items.map(decoratePOSItem);
  },

  async listOpenings(params?: { status?: string; company?: string; pos_profile?: string }): Promise<POSOpeningEntry[]> {
    try {
      return unwrap<POSOpeningEntry[]>(
        (await api.get("/selling/pos/opening-entries", { params })).data,
      );
    } catch {
      let data = localOpenings();
      if (params?.status) data = data.filter((d) => d.status === params.status);
      if (params?.company) data = data.filter((d) => d.company === params.company);
      if (params?.pos_profile) data = data.filter((d) => d.pos_profile === params.pos_profile);
      return data;
    }
  },

  async getOpening(id: string): Promise<POSOpeningEntry> {
    try {
      return unwrap<POSOpeningEntry>(
        (await api.get(`/selling/pos/opening-entries/${id}`)).data,
      );
    } catch {
      const found = localOpenings().find((o) => o.id === id);
      if (!found) throw new Error("POS Opening Entry tidak ditemukan");
      return found;
    }
  },

  async listClosings(params?: { company?: string; pos_profile?: string }): Promise<POSClosingEntry[]> {
    try {
      return unwrap<POSClosingEntry[]>(
        (await api.get("/selling/pos/closing-entries", { params })).data,
      );
    } catch {
      let data = read<POSClosingEntry[]>(CLOSINGS_KEY, []);
      if (params?.company) data = data.filter((d) => d.company === params.company);
      if (params?.pos_profile) data = data.filter((d) => d.pos_profile === params.pos_profile);
      return data;
    }
  },

  async getClosing(id: string): Promise<POSClosingEntry> {
    try {
      return unwrap<POSClosingEntry>(
        (await api.get(`/selling/pos/closing-entries/${id}`)).data,
      );
    } catch {
      const found = read<POSClosingEntry[]>(CLOSINGS_KEY, []).find((c) => c.id === id);
      if (!found) throw new Error("POS Closing Entry tidak ditemukan");
      return found;
    }
  },

  async currentOpening(): Promise<{
    data: POSOpeningEntry | null;
    is_outdated: boolean;
  }> {
    try {
      const response = await api.get("/selling/pos/opening-entries/current");
      return response.data;
    } catch {
      const current =
        localOpenings().find((entry) => entry.status === "Open") || null;
      return { data: current, is_outdated: isOpeningOutdated(current) };
    }
  },

  async createOpening(
    input: Omit<POSOpeningEntry, "id" | "status" | "opening_balance_total">,
  ) {
    try {
      return unwrap<POSOpeningEntry>(
        (await api.post("/selling/pos/opening-entries", input)).data,
      );
    } catch (error: any) {
      const openings = localOpenings();
      if (
        openings.some(
          (entry) =>
            entry.status === "Open" && entry.pos_profile === input.pos_profile,
        )
      ) {
        throw new Error(
          error?.response?.data?.error ||
            "Masih ada opening aktif. Tutup shift lama terlebih dahulu.",
        );
      }
      const created: POSOpeningEntry = {
        ...input,
        id: `POS-OPEN-${Date.now()}`,
        status: "Open",
        opening_balance_total: input.balance_details.reduce(
          (sum, row) => sum + Number(row.opening_amount || 0),
          0,
        ),
      };
      write(OPENINGS_KEY, [created, ...openings]);
      return created;
    }
  },

  async closeOpening(id: string, closingAmounts: Record<string, number>) {
    try {
      return unwrap<POSClosingEntry>(
        (
          await api.post(`/selling/pos/opening-entries/${id}/close`, {
            closing_amounts: closingAmounts,
          })
        ).data,
      );
    } catch {
      const openings = localOpenings();
      const index = openings.findIndex(
        (entry) => entry.id === id && entry.status === "Open",
      );
      if (index < 0) throw new Error("Opening aktif tidak ditemukan");
      const opening = openings[index];
      const invoices = read<POSInvoice[]>(INVOICES_KEY, []).filter(
        (invoice) => invoice.opening_entry_id === id,
      );
      const salesByMode = invoices.reduce<Record<string, number>>(
        (totals, invoice) => {
          totals[invoice.mode_of_payment] =
            (totals[invoice.mode_of_payment] || 0) +
            Number(invoice.paid_amount || invoice.grand_total || 0);
          return totals;
        },
        {},
      );
      const modes = new Set([
        ...opening.balance_details.map((row) => row.mode_of_payment),
        ...Object.keys(salesByMode),
      ]);
      const payment_reconciliation = [...modes].map((mode) => {
        const openingAmount =
          opening.balance_details.find((row) => row.mode_of_payment === mode)
            ?.opening_amount || 0;
        const expected = openingAmount + (salesByMode[mode] || 0);
        const closing = closingAmounts[mode] ?? expected;
        return {
          mode_of_payment: mode,
          opening_amount: openingAmount,
          expected_amount: expected,
          closing_amount: closing,
          difference: closing - expected,
        };
      });
      const now = new Date().toISOString();
      const closing: POSClosingEntry = {
        id: `POS-CLOSE-${Date.now()}`,
        pos_opening_entry: id,
        period_end_date: now,
        posting_date: now,
        company: opening.company,
        user: opening.user,
        net_total: invoices.reduce(
          (sum, invoice) => sum + Number(invoice.net_total || 0),
          0,
        ),
        grand_total: invoices.reduce(
          (sum, invoice) => sum + Number(invoice.grand_total || 0),
          0,
        ),
        payment_reconciliation,
        sales_invoices: invoices.map((inv) => ({
          id: inv.id,
          sales_invoice: inv.invoice_number || inv.id || "",
          customer: inv.customer,
          posting_date: inv.created_at || now,
          grand_total: inv.grand_total || 0,
        })),
      };
      openings[index] = { ...opening, status: "Closed", closed_at: now };
      write(OPENINGS_KEY, openings);
      write(CLOSINGS_KEY, [
        closing,
        ...read<POSClosingEntry[]>(CLOSINGS_KEY, []),
      ]);
      return closing;
    }
  },


  async createInvoice(input: POSInvoice): Promise<POSInvoice> {
    try {
      return unwrap<POSInvoice>(
        (await api.post("/selling/pos/invoices", input)).data,
      );
    } catch {
      const net = input.items.reduce(
        (sum, item) => sum + item.quantity * item.rate,
        0,
      );
      const invoice: POSInvoice = {
        ...input,
        id: `posi-${Date.now()}`,
        invoice_number: `POS-INV-${new Date()
          .toISOString()
          .replaceAll(/[-:TZ.]/g, "")
          .slice(0, 14)}`,
        net_total: net,
        discount_amount: Math.min(
          Math.max(0, Number(input.discount_amount || 0)),
          net + Number(input.tax_total || 0),
        ),
        grand_total: Math.max(
          0,
          net + Number(input.tax_total || 0) - Number(input.discount_amount || 0),
        ),
        paid_amount: Math.max(
          0,
          net + Number(input.tax_total || 0) - Number(input.discount_amount || 0),
        ),
        status: "Paid",
        created_at: new Date().toISOString(),
      };
      write(INVOICES_KEY, [invoice, ...read<POSInvoice[]>(INVOICES_KEY, [])]);
      return invoice;
    }
  },

  async listInvoices(openingEntryId?: string): Promise<POSInvoice[]> {
    try {
      return unwrap<POSInvoice[]>(
        (
          await api.get("/selling/pos/invoices", {
            params: { opening_entry_id: openingEntryId },
          })
        ).data,
      );
    } catch {
      const invoices = read<POSInvoice[]>(INVOICES_KEY, []);
      return openingEntryId
        ? invoices.filter(
            (invoice) => invoice.opening_entry_id === openingEntryId,
          )
        : invoices;
    }
  },
};
