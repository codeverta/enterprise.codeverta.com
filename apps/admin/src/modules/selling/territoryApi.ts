import api from "@/lib/api";

export interface TerritoryTarget {
  id?: string;
  territory_id?: string;
  item_group: string;
  fiscal_year: string;
  target_qty: number;
  target_amount: number;
  target_distribution?: string;
}

export interface Territory {
  id?: string;
  territory_name: string;
  parent_territory?: string;
  is_group: boolean;
  territory_manager?: string;
  disabled?: boolean;
  targets?: TerritoryTarget[];
  created_at?: string;
  updated_at?: string;
}

export interface TerritoryTreeNode {
  id: string;
  territory_name: string;
  parent_territory: string;
  is_group: boolean;
  territory_manager: string;
  disabled: boolean;
  target_count: number;
  children: TerritoryTreeNode[];
}

export interface TerritoryOptions {
  parent_territories: string[];
  territories: Territory[];
  item_groups: string[];
  fiscal_years: string[];
  distributions: string[];
  managers: string[];
}

export const territoryApi = {
  list: async (params?: { q?: string; parent_territory?: string; is_group?: boolean }): Promise<Territory[]> => {
    const res = await api.get("/selling/territories", { params });
    return res.data?.data || res.data || [];
  },

  tree: async (): Promise<TerritoryTreeNode[]> => {
    const res = await api.get("/selling/territories/tree");
    return res.data?.data || res.data || [];
  },

  get: async (id: string): Promise<Territory> => {
    const res = await api.get(`/selling/territories/${encodeURIComponent(id)}`);
    return res.data?.data || res.data;
  },

  create: async (data: Territory): Promise<Territory> => {
    const res = await api.post("/selling/territories", data);
    return res.data?.data || res.data;
  },

  update: async (id: string, data: Territory): Promise<Territory> => {
    const res = await api.put(`/selling/territories/${encodeURIComponent(id)}`, data);
    return res.data?.data || res.data;
  },

  remove: async (id: string): Promise<{ message: string; id: string }> => {
    const res = await api.delete(`/selling/territories/${encodeURIComponent(id)}`);
    return res.data?.data || res.data;
  },

  options: async (): Promise<TerritoryOptions> => {
    const res = await api.get("/selling/territories/options");
    return res.data?.data || res.data || {
      parent_territories: [],
      territories: [],
      item_groups: [],
      fiscal_years: [],
      distributions: [],
      managers: [],
    };
  },
};
