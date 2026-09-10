import api from "@/lib/api";

export interface ItemGroup {
  id?: string;
  item_group_name: string;
  parent_item_group?: string;
  is_group: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ItemGroupTreeNode {
  id: string;
  item_group_name: string;
  parent_item_group: string;
  is_group: boolean;
  children: ItemGroupTreeNode[];
}

export const itemGroupApi = {
  list: async (params?: { q?: string; parent_item_group?: string; is_group?: boolean }): Promise<ItemGroup[]> => {
    const res = await api.get("/selling/item-groups", { params });
    return res.data?.data || res.data || [];
  },

  tree: async (): Promise<ItemGroupTreeNode[]> => {
    const res = await api.get("/selling/item-groups/tree");
    return res.data?.data || res.data || [];
  },

  get: async (id: string): Promise<ItemGroup> => {
    const res = await api.get(`/selling/item-groups/${encodeURIComponent(id)}`);
    return res.data?.data || res.data;
  },

  create: async (data: ItemGroup): Promise<ItemGroup> => {
    const res = await api.post("/selling/item-groups", data);
    return res.data?.data || res.data;
  },

  update: async (id: string, data: ItemGroup): Promise<ItemGroup> => {
    const res = await api.put(`/selling/item-groups/${encodeURIComponent(id)}`, data);
    return res.data?.data || res.data;
  },

  remove: async (id: string): Promise<{ message: string; id: string }> => {
    const res = await api.delete(`/selling/item-groups/${encodeURIComponent(id)}`);
    return res.data?.data || res.data;
  },
};
