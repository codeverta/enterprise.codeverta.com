import api from "@/lib/api";

export type PickListItem = {
  id?: string;
  pick_list_id?: string;
  item_code: string;
  item_name?: string;
  description?: string;
  warehouse: string;
  qty: number;
  stock_qty: number;
  picked_qty: number;
  uom?: string;
  conversion_factor?: number;
  sales_order?: string;
  sales_order_item?: string;
  work_order?: string;
  material_request?: string;
  material_request_item?: string;
  batch_no?: string;
  serial_no?: string;
  idx?: number;
};

export type PickList = {
  id?: string;
  tenant_id?: string;
  naming_series: string;
  pick_list_number?: string;
  company: string;
  company_id?: string;
  purpose: "Delivery" | "Material Transfer for Manufacture" | "Material Transfer";
  status: "Draft" | "Submitted" | "Completed" | "Cancelled";
  parent_warehouse?: string;
  consider_rejected_warehouses?: boolean;
  pick_manually?: boolean;
  ignore_pricing_rule?: boolean;
  scan_barcode?: string;
  scan_mode?: boolean;
  prompt_qty?: boolean;
  total_qty: number;
  total_picked_qty: number;
  remarks?: string;
  locations: PickListItem[];
  created_at?: string;
  updated_at?: string;
};

export type PickListOptions = {
  naming_series: string[];
  purposes: string[];
  warehouses: string[];
  companies: { id: string; name: string }[];
  items: {
    item_code: string;
    item_name: string;
    uom: string;
    barcode: string;
    description: string;
  }[];
};

export type PendingReference = {
  document_type: string;
  document_no: string;
  customer?: string;
  date?: string;
  status?: string;
  items: PickListItem[];
};

export const pickListApi = {
  getOptions: async (): Promise<PickListOptions> => {
    const res = await api.get("/api/stock/pick-lists/options");
    return res.data;
  },

  getPendingReferences: async (purpose: string): Promise<PendingReference[]> => {
    const res = await api.get("/api/stock/pick-lists/pending-references", {
      params: { purpose },
    });
    return res.data;
  },

  getItemLocations: async (payload: {
    purpose: string;
    parent_warehouse?: string;
    consider_rejected_warehouses?: boolean;
    items: {
      item_code: string;
      item_name?: string;
      qty: number;
      uom?: string;
      warehouse?: string;
      sales_order?: string;
      sales_order_item?: string;
      work_order?: string;
      material_request?: string;
    }[];
  }): Promise<{ locations: PickListItem[] }> => {
    const res = await api.post("/api/stock/pick-lists/get-item-locations", payload);
    return res.data;
  },

  list: async (params?: {
    search?: string;
    status?: string;
    purpose?: string;
    company?: string;
  }): Promise<PickList[]> => {
    const res = await api.get("/api/stock/pick-lists", { params });
    return res.data;
  },

  get: async (id: string): Promise<PickList> => {
    const res = await api.get(`/api/stock/pick-lists/${id}`);
    return res.data;
  },

  create: async (data: Partial<PickList>): Promise<PickList> => {
    const res = await api.post("/api/stock/pick-lists", data);
    return res.data;
  },

  update: async (id: string, data: Partial<PickList>): Promise<PickList> => {
    const res = await api.put(`/api/stock/pick-lists/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/stock/pick-lists/${id}`);
  },

  submit: async (id: string): Promise<PickList> => {
    const res = await api.post(`/api/stock/pick-lists/${id}/submit`);
    return res.data;
  },

  cancel: async (id: string): Promise<PickList> => {
    const res = await api.post(`/api/stock/pick-lists/${id}/cancel`);
    return res.data;
  },
};
