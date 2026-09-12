import api from "@/lib/api";

export type NamedMaster = { id: string; name: string };
export type Workstation = { id: string; workstation_name: string; workstation_type_id: string; job_capacity: number };
export type ItemOption = { item_code: string; item_name: string; stock_uom?: string; standard_rate?: number };
export type BOMItem = { id?: string; item_code: string; item_name: string; qty: number; uom: string; rate: number; amount?: number };
export type BOMOperation = { id?: string; operation_id: string; sequence_id: number; fg_item: string; qty_to_produce: number; bom_no: string; workstation_type_id: string; workstation_id: string; operation_time: number };
export type BOM = { id?: string; bom_no?: string; company: string; item_code: string; item_name: string; uom: string; quantity: number; is_active: boolean; is_default: boolean; allow_alternative_item: boolean; set_rate_of_sub_assembly_item_based_on_bom: boolean; is_phantom_bom: boolean; rm_cost_as_per: string; buying_price_list: string; currency: string; with_operations: boolean; track_semi_finished_goods: boolean; transfer_material_against: string; routing: string; process_loss_percentage: number; quality_inspection_required: boolean; default_source_warehouse: string; default_target_warehouse: string; project: string; website_description: string; raw_material_cost?: number; total_cost?: number; items: BOMItem[]; scrap_items: BOMItem[]; operations: BOMOperation[] };
export type ManufacturingOptions = { items: ItemOption[]; price_lists: Array<{ price_list_name: string }>; warehouses: Array<{ id: string; warehouse_name: string }>; operations: NamedMaster[]; workstation_types: NamedMaster[]; workstations: Workstation[]; companies: Array<{ id: string; name: string }>; currencies: string[] };
export type WorkOrderItem = { id?: string; item_code: string; item_name: string; source_warehouse: string; required_qty: number; transferred_qty: number; consumed_qty: number; returned_qty: number };
export type WorkOrder = { id?: string; work_order_no?: string; status?: string; company: string; naming_series: string; production_item: string; item_name: string; bom_no: string; qty: number; sales_order: string; track_semi_finished_goods: boolean; source_warehouse: string; wip_warehouse: string; fg_warehouse: string; scrap_warehouse: string; allow_alternative_item: boolean; use_multi_level_bom: boolean; skip_transfer: boolean; update_consumed_material_cost_in_project: boolean; planned_start_date?: string; planned_end_date?: string; expected_delivery_date?: string; actual_start_date?: string; actual_end_date?: string; lead_time: number; project: string; required_items: WorkOrderItem[] };

const data = <T>(response: { data: { data: T } }) => response.data.data;
export const manufacturingApi = {
  options: () => api.get<ManufacturingOptions>("/manufacturing/options").then((r) => r.data),
  listBOM: () => api.get<{ data: BOM[] }>("/manufacturing/boms").then(data),
  getBOM: (id: string) => api.get<BOM>(`/manufacturing/boms/${id}`).then((r) => r.data),
  createBOM: (value: BOM) => api.post<BOM>("/manufacturing/boms", value).then((r) => r.data),
  updateBOM: (id: string, value: BOM) => api.put<BOM>(`/manufacturing/boms/${id}`, value).then((r) => r.data),
  deleteBOM: (id: string) => api.delete(`/manufacturing/boms/${id}`),
  listWorkOrders: () => api.get<{ data: WorkOrder[] }>("/manufacturing/work-orders").then(data),
  getWorkOrder: (id: string) => api.get<WorkOrder>(`/manufacturing/work-orders/${id}`).then((r) => r.data),
  createWorkOrder: (value: WorkOrder) => api.post<WorkOrder>("/manufacturing/work-orders", value).then((r) => r.data),
  updateWorkOrder: (id: string, value: WorkOrder) => api.put<WorkOrder>(`/manufacturing/work-orders/${id}`, value).then((r) => r.data),
  submitWorkOrder: (id: string) => api.post<WorkOrder>(`/manufacturing/work-orders/${id}/submit`).then((r) => r.data),
  deleteWorkOrder: (id: string) => api.delete(`/manufacturing/work-orders/${id}`),
  listMaster: <T>(path: string) => api.get<{ data: T[] }>(`/manufacturing/${path}`).then(data),
  createMaster: <T>(path: string, value: Partial<T>) => api.post<T>(`/manufacturing/${path}`, value).then((r) => r.data),
  updateMaster: <T>(path: string, id: string, value: Partial<T>) => api.put<T>(`/manufacturing/${path}/${id}`, value).then((r) => r.data),
  deleteMaster: (path: string, id: string) => api.delete(`/manufacturing/${path}/${id}`),
};
