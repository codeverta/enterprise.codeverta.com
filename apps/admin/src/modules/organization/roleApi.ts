import api from "@/lib/api";

export interface RoleItem {
  id: string;
  name: string;
  role_name?: string;
  description?: string;
  home_page?: string;
  restrict_to_domain?: string;
  disabled: boolean;
  enabled: boolean;
  is_custom: boolean;
  desk_access: boolean;
  two_factor_auth: boolean;
  legacy_level?: number | null;
  created_at?: string;
  updated_at?: string;
}

export const roleApi = {
  list: async (): Promise<RoleItem[]> => {
    const res = await api.get<{ data: RoleItem[] }>("/authorization/roles");
    return res.data?.data || [];
  },
  get: async (idOrName: string): Promise<RoleItem> => {
    const res = await api.get<RoleItem>(`/authorization/roles/${encodeURIComponent(idOrName)}`);
    return res.data;
  },
  create: async (data: Partial<RoleItem>): Promise<RoleItem> => {
    const res = await api.post<RoleItem>("/authorization/roles", data);
    return res.data;
  },
  update: async (idOrName: string, data: Partial<RoleItem>): Promise<RoleItem> => {
    const res = await api.put<RoleItem>(`/authorization/roles/${encodeURIComponent(idOrName)}`, data);
    return res.data;
  },
  delete: async (idOrName: string): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`/authorization/roles/${encodeURIComponent(idOrName)}`);
    return res.data;
  },
};
