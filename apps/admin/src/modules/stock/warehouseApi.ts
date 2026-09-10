import api from "@/lib/api";

export type Warehouse = {
  id?: string;
  warehouse_name: string;
  is_group: boolean;
  parent_warehouse?: string;
  company: string;
  warehouse_type?: string;
  account?: string;
  address_line_1?: string;
  city?: string;
  phone_no?: string;
  disabled: boolean;
  created_at?: string;
  updated_at?: string;
};

export type WarehouseTreeNode = Warehouse & {
  children?: WarehouseTreeNode[];
};

export type CompanyOption = {
  id?: string;
  name: string;
  abbreviation?: string;
};

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export const warehouseApi = {
  list: async (params?: { company?: string; q?: string; is_group?: boolean | string }) =>
    unwrap(await api.get("/stock/warehouses", { params })) as Warehouse[],
  tree: async (params?: { company?: string }) =>
    unwrap(await api.get("/stock/warehouses/tree", { params })) as WarehouseTreeNode[],
  get: async (id: string) =>
    unwrap(await api.get(`/stock/warehouses/${id}`)) as Warehouse,
  create: async (data: Partial<Warehouse>) =>
    unwrap(await api.post("/stock/warehouses", data)) as Warehouse,
  update: async (id: string, data: Partial<Warehouse>) =>
    unwrap(await api.put(`/stock/warehouses/${id}`, data)) as Warehouse,
  remove: async (id: string) =>
    api.delete(`/stock/warehouses/${id}`),
  seed: async () =>
    unwrap(await api.post("/stock/warehouses/seed")),
  listCompanies: async () => {
    try {
      const res = await api.get("/organization/companies");
      return (unwrap(res) || []) as CompanyOption[];
    } catch {
      return [
        { name: "PT ZENIT TECHNOLOGY SOLUTION", abbreviation: "PZTS" },
        { name: "PT Codeverta Utama", abbreviation: "PZTS" },
        { name: "PT Codeverta Mandiri", abbreviation: "MC" },
      ];
    }
  },
};
