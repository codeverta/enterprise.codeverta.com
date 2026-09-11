// Sales Order business logic and workflow engine inspired by ERPNext/Frappe

export interface SalesOrderItem {
  id?: string;
  item_code: string;
  item_name?: string;
  quantity: number;
  rate: number;
  amount: number;
  uom?: string;
  warehouse?: string;
  is_stock_item?: boolean;
  is_product_bundle?: boolean;
  bundle_items?: Array<{ item_code: string; quantity: number; is_stock_item?: boolean }>;
  delivered_qty?: number;
  billed_qty?: number;
  material_request_qty?: number;
}

export interface PaymentScheduleEntry {
  payment_term?: string;
  due_date: string;
  invoice_portion: number;
  payment_amount: number;
}

export interface SalesOrderSettings {
  allow_negative_rates?: boolean;
  allow_negative_grand_total?: boolean;
  skip_delivery_note_for_service_items?: boolean;
  default_warehouse?: string;
}

export interface SalesOrderWorkflowStep {
  state: string;
  role: string;
  allow_edit?: boolean;
}

export interface SalesOrderWorkflow {
  name: string;
  steps: SalesOrderWorkflowStep[];
}

export interface SalesOrderDoc {
  id?: string;
  order_number?: string;
  customer: string;
  company: string;
  order_type?: string; // "Sales" | "Maintenance" | "Shopping"
  transaction_date: string;
  delivery_date?: string;
  status: "draft" | "submitted" | "processing" | "completed" | "cancelled" | "closed";
  workflow_state?: string;
  currency?: string;
  selling_price_list?: string;
  items: SalesOrderItem[];
  taxes?: Array<{ charge_type: string; account_head: string; rate: number; amount: number }>;
  payment_schedule?: PaymentScheduleEntry[];
  settings?: SalesOrderSettings;
  per_delivered?: number;
  per_billed?: number;
  grand_total?: number;
}

export interface MaterialRequestDoc {
  id?: string;
  sales_order_id?: string;
  material_request_type: string; // "Purchase" | "Manufacture" | "Material Transfer"
  items: Array<{
    item_code: string;
    item_name?: string;
    quantity: number;
    uom?: string;
    warehouse?: string;
    sales_order_item_id?: string;
  }>;
}

export interface DeliveryNoteDoc {
  id?: string;
  sales_order_id?: string;
  customer: string;
  company: string;
  posting_date: string;
  status: string;
  is_return?: boolean;
  return_against_id?: string;
  items: Array<{
    item_code: string;
    item_name?: string;
    quantity: number;
    rate: number;
    amount: number;
    uom?: string;
    warehouse?: string;
    against_sales_order_item_id?: string;
  }>;
}

export interface SalesInvoiceDoc {
  id?: string;
  sales_order_id?: string;
  customer: string;
  company: string;
  update_stock?: boolean;
  posting_date: string;
  status: string;
  is_return?: boolean;
  items: Array<{
    item_code: string;
    item_name?: string;
    quantity: number;
    rate: number;
    amount: number;
    uom?: string;
  }>;
}

export interface ProductionPlanDoc {
  id?: string;
  sales_order_id?: string;
  company: string;
  posting_date: string;
  items: Array<{
    item_code: string;
    quantity: number;
    bom_no?: string;
  }>;
}

/**
 * Validate item quantities and rates in a Sales Order
 */
export function validate_sales_order(order: SalesOrderDoc): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const settings = order.settings || {};

  if (!order.items || order.items.length === 0) {
    errors.push("Sales Order harus memiliki minimal 1 item");
    return { valid: false, errors };
  }

  let grandTotal = 0;
  for (let idx = 0; idx < order.items.length; idx++) {
    const item = order.items[idx];
    if (!item.item_code) {
      errors.push(`Baris ${idx + 1}: Item Code wajib diisi`);
    }
    if (item.quantity === 0) {
      errors.push(`Baris ${idx + 1}: Kuantitas tidak boleh 0`);
    } else if (item.quantity < 0) {
      errors.push(`Baris ${idx + 1}: Kuantitas tidak boleh negatif`);
    }

    if (item.rate < 0 && !settings.allow_negative_rates) {
      errors.push(`Baris ${idx + 1}: Harga rate negatif tidak diizinkan`);
    }

    grandTotal += (item.quantity || 0) * (item.rate || 0);
  }

  if (grandTotal < 0 && !settings.allow_negative_grand_total) {
    errors.push("Grand Total negatif tidak diizinkan tanpa pengaturan allow_negative_grand_total");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if a Sales Order or item requires Delivery Note.
 * Service items (is_stock_item === false) can be skipped if setting skip_delivery_note_for_service_items is enabled.
 * Product bundles with stock items still require delivery.
 */
export function check_delivery_note_required(order: SalesOrderDoc): boolean {
  const settings = order.settings || {};

  // Maintenance orders with purely service items do not need delivery note
  if (order.order_type === "Maintenance") {
    const hasPhysicalStock = order.items.some((i) => i.is_stock_item !== false);
    if (!hasPhysicalStock) return false;
  }

  // If setting is disabled, even service items need delivery note
  if (!settings.skip_delivery_note_for_service_items) {
    return order.items.length > 0;
  }

  // Setting enabled: check if any item is a stock item OR a bundle containing stock items
  return order.items.some((item) => {
    if (item.is_product_bundle && item.bundle_items?.length) {
      return item.bundle_items.some((bi) => bi.is_stock_item !== false);
    }
    return item.is_stock_item !== false;
  });
}

/**
 * Determine if Sales Order can complete automatically without Delivery Note
 */
export function check_sales_order_auto_complete(order: SalesOrderDoc): boolean {
  if (!check_delivery_note_required(order)) {
    // If all items are service items and order type is maintenance or skip setting is active
    return true;
  }
  // If delivery is required, check if all items are 100% delivered
  return (order.per_delivered ?? 0) >= 100;
}

/**
 * Create Material Request from Sales Order
 */
export function make_material_request(order: SalesOrderDoc): MaterialRequestDoc {
  const mrItems: MaterialRequestDoc["items"] = [];

  for (const item of order.items) {
    const requiredQty = item.quantity;
    const requestedQty = item.material_request_qty || 0;
    const pendingQty = requiredQty - requestedQty;

    if (pendingQty <= 0) continue;

    if (item.is_product_bundle && item.bundle_items?.length) {
      for (const bItem of item.bundle_items) {
        const bundleReq = bItem.quantity * pendingQty;
        mrItems.push({
          item_code: bItem.item_code,
          quantity: bundleReq,
          sales_order_item_id: item.id,
        });
      }
    } else {
      mrItems.push({
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: pendingQty,
        uom: item.uom || "Nos",
        warehouse: item.warehouse || order.settings?.default_warehouse,
        sales_order_item_id: item.id,
      });
    }
  }

  if (mrItems.length === 0) {
    throw new Error("Seluruh kebutuhan Material Request untuk Sales Order ini sudah terpenuhi.");
  }

  return {
    sales_order_id: order.id,
    material_request_type: "Purchase",
    items: mrItems,
  };
}

/**
 * Create Delivery Note from Sales Order
 */
export function make_delivery_note(order: SalesOrderDoc): DeliveryNoteDoc {
  const dnItems: DeliveryNoteDoc["items"] = [];

  for (const item of order.items) {
    // If skip_delivery_note_for_service_items is true and item is not a stock item, skip
    if (order.settings?.skip_delivery_note_for_service_items && item.is_stock_item === false) {
      continue;
    }

    const pendingQty = (item.quantity || 0) - (item.delivered_qty || 0);
    if (pendingQty > 0) {
      dnItems.push({
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: pendingQty,
        rate: item.rate,
        amount: pendingQty * item.rate,
        uom: item.uom || "Nos",
        warehouse: item.warehouse,
        against_sales_order_item_id: item.id,
      });
    }
  }

  return {
    sales_order_id: order.id,
    customer: order.customer,
    company: order.company,
    posting_date: new Date().toISOString().slice(0, 10),
    status: "Draft",
    items: dnItems,
  };
}

/**
 * Create Sales Invoice from Sales Order
 */
export function make_sales_invoice(order: SalesOrderDoc): SalesInvoiceDoc {
  const invoiceItems = order.items.map((item) => ({
    item_code: item.item_code,
    item_name: item.item_name,
    quantity: item.quantity,
    rate: item.rate,
    amount: item.quantity * item.rate,
    uom: item.uom,
  }));

  return {
    sales_order_id: order.id,
    customer: order.customer,
    company: order.company,
    posting_date: new Date().toISOString().slice(0, 10),
    status: "Draft",
    items: invoiceItems,
  };
}

/**
 * Create Production Plan from Sales Order
 */
export function make_production_plan(order: SalesOrderDoc): ProductionPlanDoc {
  return {
    sales_order_id: order.id,
    company: order.company,
    posting_date: new Date().toISOString().slice(0, 10),
    items: order.items.map((item) => ({
      item_code: item.item_code,
      quantity: item.quantity,
    })),
  };
}

/**
 * Updates Sales Order quantities and statuses based on delivery or invoice returns
 */
export function update_sales_order_delivered_qty(
  order: SalesOrderDoc,
  deliveryItems: Array<{ item_code: string; quantity: number; is_return?: boolean }>
): SalesOrderDoc {
  const updatedItems = order.items.map((item) => {
    let delivered = item.delivered_qty || 0;
    for (const d of deliveryItems) {
      if (d.item_code === item.item_code) {
        if (d.is_return) {
          delivered = Math.max(0, delivered - Math.abs(d.quantity));
        } else {
          delivered += d.quantity;
        }
      }
    }
    return { ...item, delivered_qty: delivered };
  });

  const totalOrdered = updatedItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalDelivered = updatedItems.reduce((sum, i) => sum + (i.delivered_qty || 0), 0);
  const perDelivered = totalOrdered > 0 ? Math.min(100, (totalDelivered / totalOrdered) * 100) : 0;

  return {
    ...order,
    items: updatedItems,
    per_delivered: perDelivered,
    status: perDelivered >= 100 ? "completed" : "processing",
  };
}

/**
 * Calculate reserved stock quantity for a Sales Order item
 */
export function get_reserved_qty(item_code: string, salesOrders: SalesOrderDoc[]): number {
  let reserved = 0;
  for (const so of salesOrders) {
    if (so.status === "cancelled" || so.status === "closed") continue;
    for (const item of so.items) {
      if (item.item_code === item_code && item.is_stock_item !== false) {
        const remaining = (item.quantity || 0) - (item.delivered_qty || 0);
        if (remaining > 0) {
          reserved += remaining;
        }
      }
    }
  }
  return reserved;
}

/**
 * Child item update API (update_child_qty_rate)
 */
export function update_child_qty_rate(
  order: SalesOrderDoc,
  updatedItem: {
    item_code: string;
    quantity?: number;
    rate?: number;
    is_new?: boolean;
    remove?: boolean;
  },
  userRole: string = "Sales User",
  workflow?: SalesOrderWorkflow
): SalesOrderDoc {
  // Check workflow permissions if active
  if (workflow && order.workflow_state) {
    const currentStep = workflow.steps.find((s) => s.state === order.workflow_state);
    if (currentStep) {
      const isManager = userRole === "System Manager" || (currentStep.role === userRole && currentStep.allow_edit);
      if (!currentStep.allow_edit && userRole !== "System Manager") {
        throw new Error(`Tidak memiliki izin untuk mengubah item pada status ${order.workflow_state}`);
      }
      if (currentStep.role !== userRole && userRole !== "System Manager") {
        throw new Error(`Role ${userRole} tidak memiliki izin pada status ${order.workflow_state}`);
      }
    }
  }

  let items = [...order.items];

  if (updatedItem.remove) {
    const existing = items.find((i) => i.item_code === updatedItem.item_code);
    if (existing && (existing.delivered_qty || 0) > 0) {
      throw new Error(`Item ${updatedItem.item_code} sudah memiliki pengiriman, tidak dapat dihapus.`);
    }
    items = items.filter((i) => i.item_code !== updatedItem.item_code);
  } else if (updatedItem.is_new) {
    items.push({
      item_code: updatedItem.item_code,
      quantity: updatedItem.quantity || 1,
      rate: updatedItem.rate || 0,
      amount: (updatedItem.quantity || 1) * (updatedItem.rate || 0),
    });
  } else {
    items = items.map((i) => {
      if (i.item_code === updatedItem.item_code) {
        const qty = updatedItem.quantity !== undefined ? updatedItem.quantity : i.quantity;
        const rate = updatedItem.rate !== undefined ? updatedItem.rate : i.rate;
        if ((i.delivered_qty || 0) > qty) {
          throw new Error(`Kuantitas baru (${qty}) tidak boleh lebih kecil dari kuantitas yang sudah dikirim (${i.delivered_qty}).`);
        }
        return {
          ...i,
          quantity: qty,
          rate: rate,
          amount: qty * rate,
        };
      }
      return i;
    });
  }

  const grandTotal = items.reduce((s, i) => s + i.amount, 0);

  return {
    ...order,
    items,
    grand_total: grandTotal,
  };
}

/**
 * Helper: compare payment schedules
 */
export function compare_payment_schedules(
  scheduleA: PaymentScheduleEntry[],
  scheduleB: PaymentScheduleEntry[]
): boolean {
  if (scheduleA.length !== scheduleB.length) return false;
  for (let i = 0; i < scheduleA.length; i++) {
    const a = scheduleA[i];
    const b = scheduleB[i];
    if (
      a.due_date !== b.due_date ||
      a.invoice_portion !== b.invoice_portion ||
      a.payment_amount !== b.payment_amount
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Helper: make_sales_order
 */
export function make_sales_order(args: Partial<SalesOrderDoc> = {}): SalesOrderDoc {
  const { settings: customSettings, ...rest } = args;
  return {
    id: args.id || `SO-${Math.random().toString(36).slice(2, 8)}`,
    order_number: args.order_number || `SAL-ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    customer: args.customer || "PT Pelanggan Default",
    company: args.company || "PT Default Company",
    order_type: args.order_type || "Sales",
    transaction_date: args.transaction_date || new Date().toISOString().slice(0, 10),
    delivery_date: args.delivery_date || new Date().toISOString().slice(0, 10),
    status: args.status || "draft",
    currency: args.currency || "IDR",
    selling_price_list: args.selling_price_list || "Standard Selling",
    items: args.items || [
      {
        item_code: "ITEM-DEFAULT",
        item_name: "Item Default",
        quantity: 1,
        rate: 10000,
        amount: 10000,
        is_stock_item: true,
      },
    ],
    settings: {
      allow_negative_rates: false,
      allow_negative_grand_total: false,
      skip_delivery_note_for_service_items: true,
      ...customSettings,
    },
    ...rest,
  };
}

/**
 * Helper: create_dn_against_so
 */
export function create_dn_against_so(
  so: SalesOrderDoc,
  deliveredQty?: number
): DeliveryNoteDoc {
  const dn = make_delivery_note(so);
  if (deliveredQty !== undefined && dn.items.length > 0) {
    dn.items[0].quantity = deliveredQty;
    dn.items[0].amount = deliveredQty * dn.items[0].rate;
  }
  return dn;
}

/**
 * Helper: make_sales_order_workflow
 */
export function make_sales_order_workflow(): SalesOrderWorkflow {
  return {
    name: "Sales Order Workflow",
    steps: [
      { state: "Draft", role: "Sales User", allow_edit: true },
      { state: "Approved", role: "Sales Manager", allow_edit: false },
      { state: "Closed", role: "System Manager", allow_edit: false },
    ],
  };
}

/**
 * Helper: make_sales_order_edit_perm_workflow
 */
export function make_sales_order_edit_perm_workflow(): SalesOrderWorkflow {
  return {
    name: "Sales Order Edit Perm Workflow",
    steps: [
      { state: "Pending Approval", role: "Sales User", allow_edit: false },
      { state: "Authorized For Edit", role: "Sales Manager", allow_edit: true },
    ],
  };
}
