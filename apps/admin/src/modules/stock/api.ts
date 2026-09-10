import api from "@/lib/api";

export type ShipmentStatus = "Draft" | "Submitted" | "In Transit" | "Delivered" | "Cancelled";

export type ShipmentParcel = {
  id?: string;
  idx?: number;
  length: number;
  width: number;
  height: number;
  weight: number;
  count: number;
  parcel_template: string;
};

export type ShipmentDeliveryNote = {
  id?: string;
  idx?: number;
  delivery_note: string;
  value: number;
};

export type Shipment = {
  id?: string;
  number?: string;
  status: ShipmentStatus;

  // Pickup From
  pickup_from_type: "Company" | "Customer" | "Supplier";
  pickup_company: string;
  pickup_address_name: string;
  pickup_address: string;
  pickup_contact_person: string;
  pickup_contact: string;

  // Delivery To
  delivery_to_type: "Company" | "Customer" | "Supplier";
  delivery_customer: string;
  delivery_address_name: string;
  delivery_address: string;
  delivery_contact_person: string;
  delivery_contact: string;

  // Parcels
  total_weight: number;
  parcels: ShipmentParcel[];

  // Delivery Notes
  delivery_notes: ShipmentDeliveryNote[];

  // Shipment Details
  pallets: boolean;
  value_of_goods: number;
  pickup_date?: string;
  pickup_from?: string;
  pickup_to?: string;
  shipment_type: "Goods" | "Documents";
  pickup_type: "Pickup" | "Self delivery";
  incoterm: string;
  description_of_content: string;

  // Shipment Information / Tracking
  service_provider: string;
  shipment_id?: string;
  shipment_amount: number;
  carrier: string;
  carrier_service: string;
  awb_number: string;
  tracking_status: string;

  created_at?: string;
  updated_at?: string;
};

export type StockMasterUser = {
  id: string;
  username: string;
  display_name: string;
  email: string;
};

export type StockMasterCustomer = {
  id: string;
  customer_name: string;
  customer_type?: string;
  email?: string;
  phone?: string;
};

export type StockMasterDeliveryNote = {
  number: string;
  customer?: string;
  total?: number;
  status?: string;
};

export type StockMasterOptions = {
  companies: string[];
  incoterms: string[];
  service_providers: string[];
  parcel_templates: string[];
  users?: StockMasterUser[];
  customers?: StockMasterCustomer[];
  delivery_notes?: StockMasterDeliveryNote[];
};

// Delivery Note Types
export type DeliveryNoteStatus = "Draft" | "Submitted" | "Cancelled";

export type DeliveryNoteItem = {
  id?: string;
  idx?: number;
  item_code: string;
  item_name?: string;
  quantity: number;
  uom: string;
  rate: number;
  amount: number;
  warehouse: string;
  against_item_id?: string;
};

export type DeliveryNoteTax = {
  id?: string;
  idx?: number;
  charge_type: string;
  account_head: string;
  rate: number;
  net_amount: number;
  tax_amount: number;
  total: number;
};

export type DeliveryNote = {
  id?: string;
  number?: string;
  naming_series: string;
  status: DeliveryNoteStatus;

  customer: string;
  posting_date: string;
  posting_time: string;
  set_posting_time: boolean;
  company: string;
  is_return: boolean;
  return_against_id?: string;
  return_reason?: string;
  replacement_for_id?: string;

  sales_order_id?: string;
  cost_center: string;
  project: string;
  currency: string;
  selling_price_list: string;
  ignore_pricing_rule: boolean;
  set_warehouse: string;
  tax_category: string;
  taxes_and_charges: string;
  shipping_rule: string;
  incoterm: string;

  total_qty: number;
  total: number;
  base_total_taxes_and_charges: number;
  total_taxes_and_charges: number;
  grand_total: number;
  rounding_adjustment: number;
  rounded_total: number;

  apply_discount_on: "grand_total" | "net_total";
  additional_discount_percentage: number;
  additional_discount_amount: number;

  items: DeliveryNoteItem[];
  taxes: DeliveryNoteTax[];

  created_at?: string;
  updated_at?: string;
};

export type DeliveryNoteOptions = {
  naming_series: string[];
  companies: string[];
  currencies: string[];
  price_lists: string[];
  warehouses: string[];
  tax_categories: string[];
  taxes_templates: string[];
  shipping_rules: string[];
  incoterms: string[];
};

export const deliveryNotePayload = (input: DeliveryNote): DeliveryNote => ({
  ...input,
  posting_date: input.posting_date?.length === 10
    ? `${input.posting_date}T00:00:00Z`
    : input.posting_date,
});

export const stockApi = {
  async shipmentList(params?: { q?: string; status?: string }): Promise<Shipment[]> {
    const res = await api.get<{ data: Shipment[] }>("/stock/shipments", { params });
    return res.data.data || [];
  },

  async shipmentGet(id: string): Promise<Shipment> {
    const res = await api.get<Shipment>(`/stock/shipments/${id}`);
    return res.data;
  },

  async shipmentCreate(input: Shipment): Promise<Shipment> {
    const res = await api.post<Shipment>("/stock/shipments", input);
    return res.data;
  },

  async shipmentUpdate(id: string, input: Shipment): Promise<Shipment> {
    const res = await api.put<Shipment>(`/stock/shipments/${id}`, input);
    return res.data;
  },

  async shipmentSubmit(id: string): Promise<Shipment> {
    const res = await api.post<Shipment>(`/stock/shipments/${id}/submit`);
    return res.data;
  },

  async shipmentRemove(id: string): Promise<void> {
    await api.delete(`/stock/shipments/${id}`);
  },

  async masterOptions(): Promise<StockMasterOptions> {
    const res = await api.get<StockMasterOptions>("/stock/shipments/options");
    return res.data;
  },

  // Delivery Note API
  async deliveryNoteList(params?: { q?: string; status?: string }): Promise<DeliveryNote[]> {
    const res = await api.get<{ data: DeliveryNote[] }>("/stock/delivery-notes", { params });
    return res.data.data || [];
  },

  async deliveryNoteGet(id: string): Promise<DeliveryNote> {
    const res = await api.get<DeliveryNote>(`/stock/delivery-notes/${id}`);
    return res.data;
  },

  async deliveryNoteCreate(input: DeliveryNote): Promise<DeliveryNote> {
    const res = await api.post<DeliveryNote>("/stock/delivery-notes", deliveryNotePayload(input));
    return res.data;
  },

  async deliveryNoteUpdate(id: string, input: DeliveryNote): Promise<DeliveryNote> {
    const res = await api.put<DeliveryNote>(`/stock/delivery-notes/${id}`, deliveryNotePayload(input));
    return res.data;
  },

  async deliveryNoteSubmit(id: string): Promise<DeliveryNote> {
    const res = await api.post<DeliveryNote>(`/stock/delivery-notes/${id}/submit`);
    return res.data;
  },

  async deliveryNoteCreateReturn(id: string, input: { reason: string; items: Array<{ against_item_id: string; quantity: number }> }): Promise<DeliveryNote> {
    const res = await api.post<DeliveryNote>(`/stock/delivery-notes/${id}/return`, input);
    return res.data;
  },

  async deliveryNoteRemove(id: string): Promise<void> {
    await api.delete(`/stock/delivery-notes/${id}`);
  },

  async deliveryNoteOptions(): Promise<DeliveryNoteOptions> {
    const res = await api.get<DeliveryNoteOptions>("/stock/delivery-notes/options");
    return res.data;
  },
};

export type SerialNoStatus = "Available" | "Delivered" | "Expired" | "Inactive";

export type SerialNo = {
  id?: string;
  tenant_id?: string;
  serial_no: string;
  item_code: string;
  item_name?: string;
  description?: string;
  warehouse?: string;
  company?: string;
  status: SerialNoStatus;
  batch_no?: string;

  // Purchase Details
  purchase_document_type?: string;
  purchase_document_no?: string;
  purchase_date?: string;
  purchase_rate?: number;
  supplier?: string;
  supplier_name?: string;

  // Delivery Details
  delivery_document_type?: string;
  delivery_document_no?: string;
  delivery_date?: string;
  customer?: string;
  customer_name?: string;

  // Warranty Details
  warranty_period?: number;
  warranty_expiry_date?: string;
  amc_expiry_date?: string;
  maintenance_status?: string;

  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type SerialNoStats = {
  total: number;
  available: number;
  delivered: number;
  expired: number;
  inactive: number;
};

export type SerialNoOptions = {
  items: Array<{
    item_code: string;
    item_name: string;
    stock_uom: string;
    has_serial_no: boolean;
    has_batch_no: boolean;
  }>;
  warehouses: Array<{
    id: string;
    warehouse_name: string;
    company: string;
    is_group: boolean;
  }>;
  companies: Array<{
    id: string;
    name: string;
  }>;
  batches: Array<{
    batch_id: string;
    item_code: string;
    batch_qty: number;
  }>;
  suppliers: Array<{
    id: string;
    supplier_name: string;
  }>;
  customers: Array<{
    id: string;
    customer_name: string;
  }>;
};

export const serialNoApi = {
  async list(params?: {
    q?: string;
    status?: string;
    item_code?: string;
    warehouse?: string;
    batch_no?: string;
  }): Promise<{ data: SerialNo[]; stats: SerialNoStats }> {
    const res = await api.get<{ data: SerialNo[]; stats: SerialNoStats }>("/stock/serial-nos", { params });
    return res.data;
  },

  async get(id: string): Promise<SerialNo> {
    const res = await api.get<SerialNo>(`/stock/serial-nos/${id}`);
    return res.data;
  },

  async create(data: Partial<SerialNo> & { serial_nos?: string[] }): Promise<any> {
    const res = await api.post("/stock/serial-nos", data);
    return res.data;
  },

  async update(id: string, data: Partial<SerialNo>): Promise<SerialNo> {
    const res = await api.put<SerialNo>(`/stock/serial-nos/${id}`, data);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/stock/serial-nos/${id}`);
  },

  async options(): Promise<SerialNoOptions> {
    const res = await api.get<SerialNoOptions>("/stock/serial-nos/options");
    return res.data;
  },
};

export type Batch = {
  id?: string;
  tenant_id?: string;
  batch_id: string;
  item_code: string;
  item_name?: string;
  batch_qty: number;
  manufacturing_date?: string;
  expiry_date?: string;
  shelf_life_in_days?: number;
  reference_doctype?: string;
  reference_name?: string;
  supplier?: string;
  disabled: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

export type BatchStats = {
  total: number;
  active: number;
  expiring_soon: number;
  expired: number;
};

export type BatchOptions = {
  items: Array<{
    item_code: string;
    item_name: string;
    stock_uom: string;
    has_batch_no: boolean;
    shelf_life_in_days: number;
  }>;
  suppliers: Array<{
    id: string;
    supplier_name: string;
  }>;
};

export const batchApi = {
  async list(params?: {
    q?: string;
    item_code?: string;
    status?: string;
  }): Promise<{ data: Batch[]; stats: BatchStats }> {
    const res = await api.get<{ data: Batch[]; stats: BatchStats }>("/stock/batches", { params });
    return res.data;
  },

  async get(id: string): Promise<Batch> {
    const res = await api.get<Batch>(`/stock/batches/${id}`);
    return res.data;
  },

  async create(data: Partial<Batch>): Promise<Batch> {
    const res = await api.post<Batch>("/stock/batches", data);
    return res.data;
  },

  async update(id: string, data: Partial<Batch>): Promise<Batch> {
    const res = await api.put<Batch>(`/stock/batches/${id}`, data);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/stock/batches/${id}`);
  },

  async options(): Promise<BatchOptions> {
    const res = await api.get<BatchOptions>("/stock/batches/options");
    return res.data;
  },
};

export type StockLedgerEntry = {
  id: string;
  date: string;
  posting_date: string;
  item_code: string;
  item_name: string;
  stock_uom: string;
  in_qty: number;
  out_qty: number;
  balance_qty: number;
  warehouse: string;
  item_group: string;
  brand: string;
  description: string;
  incoming_rate: number;
  valuation_rate: number;
  balance_value: number;
  voucher_type: string;
  voucher_number: string;
  voucher_id: string;
  voucher_detail_id: string;
  batch_no: string;
  serial_no: string;
  company: string;
  project: string;
};

export type StockLedgerStats = {
  total_entries: number;
  total_in_qty: number;
  total_out_qty: number;
  net_balance: number;
};

export type StockLedgerOptions = {
  companies: string[];
  warehouses: string[];
  items: Array<{
    item_code: string;
    item_name: string;
    stock_uom: string;
    item_group: string;
    brand: string;
  }>;
  item_groups: string[];
  brands: string[];
  batches: string[];
};

export const stockLedgerApi = {
  async list(params?: {
    company?: string;
    from_date?: string;
    to_date?: string;
    warehouse?: string;
    item_code?: string;
    item_group?: string;
    batch_no?: string;
    brand?: string;
    voucher_no?: string;
    project?: string;
    include_uom?: boolean | string;
    segregate_serial_batch_bundle?: boolean | string;
    q?: string;
  }): Promise<{ data: StockLedgerEntry[]; stats: StockLedgerStats }> {
    const res = await api.get<{ data: StockLedgerEntry[]; stats: StockLedgerStats }>("/stock/stock-ledger", { params });
    return res.data;
  },

  async options(): Promise<StockLedgerOptions> {
    const res = await api.get<StockLedgerOptions>("/stock/stock-ledger/options");
    return res.data;
  },
};

export type StockEntryType = {
  id?: string;
  tenant_id?: string;
  name: string;
  purpose: string;
  is_standard: boolean;
  disabled: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

export const STANDARD_STOCK_ENTRY_PURPOSES = [
  "Material Issue",
  "Material Receipt",
  "Material Transfer",
  "Material Transfer for Manufacture",
  "Material Consumption for Manufacture",
  "Manufacture",
  "Repack",
  "Send to Subcontractor",
  "Disassemble",
  "Receive from Customer",
  "Return Raw Material to Customer",
  "Subcontracting Delivery",
  "Subcontracting Return",
] as const;

export const stockEntryTypeApi = {
  async list(params?: {
    q?: string;
    purpose?: string;
    disabled?: boolean | string;
  }): Promise<{ data: StockEntryType[]; count: number }> {
    const res = await api.get<{ data: StockEntryType[]; count: number }>("/stock/stock-entry-types", { params });
    return res.data;
  },

  async get(id: string): Promise<StockEntryType> {
    const res = await api.get<StockEntryType>(`/stock/stock-entry-types/${id}`);
    return res.data;
  },

  async create(data: Partial<StockEntryType>): Promise<StockEntryType> {
    const res = await api.post<StockEntryType>("/stock/stock-entry-types", data);
    return res.data;
  },

  async update(id: string, data: Partial<StockEntryType>): Promise<StockEntryType> {
    const res = await api.put<StockEntryType>(`/stock/stock-entry-types/${id}`, data);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/stock/stock-entry-types/${id}`);
  },

  async seed(): Promise<{ message: string }> {
    const res = await api.post<{ message: string }>("/stock/stock-entry-types/seed");
    return res.data;
  },

  async purposes(): Promise<{ purposes: string[] }> {
    const res = await api.get<{ purposes: string[] }>("/stock/stock-entry-types/purposes");
    return res.data;
  },
};



