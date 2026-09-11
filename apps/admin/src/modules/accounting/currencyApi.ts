import api from "@/lib/api";

export type Currency = {
  id: string;
  currency_name: string;
  enabled: boolean;
  fraction: string;
  fraction_units: number;
  smallest_currency_fraction_value: number;
  symbol: string;
  symbol_on_right: boolean;
  number_format: string;
  created_at?: string;
  updated_at?: string;
};

export type Country = {
  id: string;
  country_name: string;
  code: string;
  date_format?: string;
  time_format?: string;
  time_zones?: string[];
};

export const currencyApi = {
  async list(params?: { enabled?: boolean; q?: string }): Promise<Currency[]> {
    const res = await api.get<{ data: Currency[] }>("/currencies", { params });
    return res.data?.data || [];
  },

  async get(id: string): Promise<Currency> {
    const res = await api.get<Currency>(`/currencies/${encodeURIComponent(id)}`);
    return res.data;
  },

  async create(input: Currency): Promise<Currency> {
    const res = await api.post<Currency>("/currencies", input);
    return res.data;
  },

  async update(id: string, input: Currency): Promise<Currency> {
    const res = await api.put<Currency>(`/currencies/${encodeURIComponent(id)}`, input);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/currencies/${encodeURIComponent(id)}`);
  },
};

export const countryApi = {
  async list(q?: string): Promise<Country[]> {
    const res = await api.get<{ data: Country[] }>("/countries", { params: { q } });
    return res.data?.data || [];
  },

  async get(id: string): Promise<Country> {
    const res = await api.get<Country>(`/countries/${encodeURIComponent(id)}`);
    return res.data;
  },
};
