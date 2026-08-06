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

export type StockMasterOptions = {
  companies: string[];
  incoterms: string[];
  service_providers: string[];
  parcel_templates: string[];
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
  warehouses: string[];
  tax_categories: string[];
  taxes_templates: string[];
  shipping_rules: string[];
  incoterms: string[];
};

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
    const res = await api.post<DeliveryNote>("/stock/delivery-notes", input);
    return res.data;
  },

  async deliveryNoteUpdate(id: string, input: DeliveryNote): Promise<DeliveryNote> {
    const res = await api.put<DeliveryNote>(`/stock/delivery-notes/${id}`, input);
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
