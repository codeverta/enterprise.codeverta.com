import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SalesOrderFormPage, { mergeServerOrder } from "./SalesOrderPage";
import {
  SalesOrderDoc,
  compare_payment_schedules,
  make_sales_order,
  create_dn_against_so,
  get_reserved_qty,
  make_sales_order_workflow,
  make_sales_order_edit_perm_workflow,
  validate_sales_order,
  check_delivery_note_required,
  check_sales_order_auto_complete,
  make_material_request,
  make_delivery_note,
  make_production_plan,
  make_sales_invoice,
  update_sales_order_delivered_qty,
  update_child_qty_rate,
} from "../salesOrderLogic";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("@/lib/api", () => ({
  default: { get: apiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

beforeEach(() => {
  apiGet.mockReset();
  localStorage.clear();
});

describe("Sales Order Form & UI Tests", () => {
  it("maps API header, dates, totals, and items into form values", () => {
    const mapped = mergeServerOrder({
      id: "982704fd-635f-423a-a507-17b0234a9235",
      order_number: "SAL-ORD-2026-00001",
      customer: "PT Pelanggan Indonesia",
      customer_email: "buyer@example.com",
      shipping_address: "Jakarta",
      transaction_date: "2026-08-07T00:00:00Z",
      currency: "IDR",
      subtotal: 200_000,
      shipping_amount: 10_000,
      total_amount: 210_000,
      payment_status: "PAID",
      status: "confirmed",
      items: [{
        item_code: "ITEM-001",
        item_name: "Produk Satu",
        quantity: 2,
        rate: 100_000,
        amount: 200_000,
      }],
    } as any);

    expect(mapped).toMatchObject({
      id: "982704fd-635f-423a-a507-17b0234a9235",
      order_number: "SAL-ORD-2026-00001",
      customer: "PT Pelanggan Indonesia",
      transaction_date: "2026-08-07",
      currency: "IDR",
      total: 200_000,
      grand_total: 210_000,
      rounded_total: 210_000,
    });
    expect(mapped.items).toEqual([expect.objectContaining({
      item_code: "ITEM-001",
      item_name: "Produk Satu",
      quantity: 2,
      rate: 100_000,
      amount: 200_000,
    })]);
  });

  it("fetches the route id and fills the edit form from the API detail", async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        id: "982704fd-635f-423a-a507-17b0234a9235",
        order_number: "SAL-ORD-2026-00001",
        customer: "PT Pelanggan Indonesia",
        transaction_date: "2026-08-07T00:00:00Z",
        currency: "IDR",
        subtotal: 200_000,
        total_amount: 210_000,
        status: "confirmed",
        items: [{ item_code: "ITEM-001", item_name: "Produk Satu", quantity: 2, rate: 100_000, amount: 200_000 }],
      },
    });

    render(
      <MemoryRouter initialEntries={["/desk/sales-order/982704fd-635f-423a-a507-17b0234a9235"]}>
        <Routes>
          <Route path="/desk/sales-order/*" element={<SalesOrderFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("PT Pelanggan Indonesia")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-08-07")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ITEM-001")).toBeInTheDocument();
    expect(screen.getByText("Produk Satu")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "SAL-ORD-2026-00001" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "New Sales Order" })).not.toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/crm/sales-orders/982704fd-635f-423a-a507-17b0234a9235");
  });

  it("uses cached form-only fields without overwriting fresh API data", () => {
    const mapped = mergeServerOrder({
      id: "order-1",
      order_number: "SERVER-ORDER",
      customer: "Server Customer",
      transaction_date: "2026-08-07T00:00:00Z",
      status: "processing",
      currency: "IDR",
      items: [],
    } as any, {
      id: "order-1",
      order_number: "CACHED-ORDER",
      customer: "Cached Customer",
      transaction_date: "2026-01-01",
      delivery_date: "2026-08-20",
      status: "draft",
      currency: "IDR",
      items: [{ item_code: "CACHE-ITEM", quantity: 1, rate: 50_000, amount: 50_000 }],
    } as any);

    expect(mapped.order_number).toBe("SERVER-ORDER");
    expect(mapped.customer).toBe("Server Customer");
    expect(mapped.transaction_date).toBe("2026-08-07");
    expect(mapped.delivery_date).toBe("2026-08-20");
    expect(mapped.items[0].item_code).toBe("CACHE-ITEM");
  });

  it("automatically adjusts rate and amount when selecting an item code in new Sales Order", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/organization/companies") {
        return Promise.resolve({ data: [{ name: "UD MILLION CANDLES", abbreviation: "MC" }] });
      }
      if (url === "/selling/customers") {
        return Promise.resolve({ data: [{ customer_name: "Customer Bintang", email: "bintang@example.com" }] });
      }
      if (url === "/selling/sales-invoices/options") {
        return Promise.resolve({
          data: {
            companies: ["UD MILLION CANDLES"],
            customers: ["Customer Bintang"],
            items: [
              { item_code: "LILIN-01", item_name: "Lilin Aroma Terapi", uom: "Pcs", rate: 25000 },
            ],
          },
        });
      }
      if (url === "/buying/items") {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: null });
    });

    render(
      <MemoryRouter initialEntries={["/desk/sales-order/new"]}>
        <Routes>
          <Route path="/desk/sales-order/*" element={<SalesOrderFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "New Sales Order" })).toBeInTheDocument();

    const trigger = screen.getByText("Pilih Item Code...");
    fireEvent.click(trigger);

    const itemMenu = await screen.findByRole("listbox", { name: "Cari kode atau nama item..." });
    const tableScroller = document.querySelector(".overflow-x-auto");
    expect(tableScroller).not.toContainElement(itemMenu);
    expect(itemMenu.closest("[data-radix-popper-content-wrapper]")?.parentElement).toBe(document.body);

    const optionBtn = await screen.findByRole("button", { name: /LILIN-01/i });
    fireEvent.click(optionBtn);

    expect(await screen.findByText("Lilin Aroma Terapi")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25000")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 25.000").length).toBeGreaterThanOrEqual(1);
  });
});

describe("Sales Order Comprehensive Specifications & Tests", () => {
  it("test_sales_order_expired_item_price", () => {
    // Menguji bahwa Item Price yang sudah expired tidak dipakai ulang dan rate baru dibuat/dipakai
    const expiredItemPrice = {
      item_code: "ITEM-EXP-1",
      price_list_rate: 50000,
      valid_from: "2025-01-01",
      valid_upto: "2025-12-31",
    };
    const orderDate = "2026-09-11";
    const isExpired = new Date(expiredItemPrice.valid_upto) < new Date(orderDate);
    expect(isExpired).toBe(true);

    const newRate = 75000;
    const so = make_sales_order({
      transaction_date: orderDate,
      items: [{
        item_code: "ITEM-EXP-1",
        quantity: 1,
        rate: isExpired ? newRate : expiredItemPrice.price_list_rate,
        amount: isExpired ? newRate : expiredItemPrice.price_list_rate,
      }],
    });
    expect(so.items[0].rate).toBe(75000);
  });

  it("test_sales_order_with_product_bundle_for_partial_material_request", () => {
    // Menguji Material Request untuk Product Bundle ketika sebagian quantity sudah diminta
    const so = make_sales_order({
      items: [{
        id: "so-item-bundle-1",
        item_code: "BUNDLE-DESK-SET",
        quantity: 5,
        rate: 500000,
        amount: 2500000,
        is_product_bundle: true,
        material_request_qty: 2, // sudah di-request 2, sisa 3
        bundle_items: [
          { item_code: "DESK-TABLE", quantity: 1 },
          { item_code: "DESK-CHAIR", quantity: 2 },
        ],
      }],
    });

    const mr = make_material_request(so);
    expect(mr.items).toHaveLength(2);
    // Sisa quantity bundle = 5 - 2 = 3
    // DESK-TABLE: 3 * 1 = 3
    // DESK-CHAIR: 3 * 2 = 6
    const tableItem = mr.items.find((i) => i.item_code === "DESK-TABLE");
    const chairItem = mr.items.find((i) => i.item_code === "DESK-CHAIR");
    expect(tableItem?.quantity).toBe(3);
    expect(chairItem?.quantity).toBe(6);
  });

  it("test_sales_order_with_full_material_request", () => {
    // Menguji bahwa Material Request tidak bisa dibuat lagi jika seluruh kebutuhan Sales Order sudah terpenuhi
    const so = make_sales_order({
      items: [{
        item_code: "ITEM-FULL-MR",
        quantity: 10,
        rate: 10000,
        amount: 100000,
        material_request_qty: 10, // sudah full
      }],
    });

    expect(() => make_material_request(so)).toThrowError(
      /sudah terpenuhi/i
    );
  });

  it("test_maintenance_order_completes_with_service_items", () => {
    // Menguji Sales Order Maintenance dengan service item yang otomatis tidak membutuhkan Delivery Note
    const so = make_sales_order({
      order_type: "Maintenance",
      items: [{
        item_code: "SERVICE-AC-CLEANING",
        item_name: "Cuci AC Rutin",
        quantity: 1,
        rate: 150000,
        amount: 150000,
        is_stock_item: false,
      }],
    });

    expect(check_delivery_note_required(so)).toBe(false);
    expect(check_sales_order_auto_complete(so)).toBe(true);
  });

  it("test_auto_skip_delivery_note_for_service_items", () => {
    // Menguji setting skip_delivery_note_for_service_items
    const so = make_sales_order({
      settings: { skip_delivery_note_for_service_items: true },
      items: [{
        item_code: "CONSULTING-FEE",
        quantity: 1,
        rate: 5000000,
        amount: 5000000,
        is_stock_item: false,
      }],
    });

    expect(check_delivery_note_required(so)).toBe(false);
  });

  it("test_mixed_sales_order_with_service_items", () => {
    // Menguji Sales Order yang berisi stock item + service item
    const so = make_sales_order({
      settings: { skip_delivery_note_for_service_items: true },
      items: [
        {
          item_code: "PHYSICAL-PRINTER",
          quantity: 1,
          rate: 2000000,
          amount: 2000000,
          is_stock_item: true,
        },
        {
          item_code: "INSTALLATION-SERVICE",
          quantity: 1,
          rate: 200000,
          amount: 200000,
          is_stock_item: false,
        },
      ],
    });

    expect(check_delivery_note_required(so)).toBe(true);
    const dn = make_delivery_note(so);
    // Only physical stock item should be in the delivery note
    expect(dn.items).toHaveLength(1);
    expect(dn.items[0].item_code).toBe("PHYSICAL-PRINTER");
  });

  it("test_no_skip_delivery_for_bundle_with_stock_items", () => {
    // Memastikan bundle yang memiliki stock item tetap membutuhkan delivery
    const so = make_sales_order({
      settings: { skip_delivery_note_for_service_items: true },
      items: [{
        item_code: "PC-PACKAGE",
        quantity: 1,
        rate: 8000000,
        amount: 8000000,
        is_product_bundle: true,
        bundle_items: [
          { item_code: "PC-HARDWARE", quantity: 1, is_stock_item: true },
          { item_code: "SETUP-SERVICE", quantity: 1, is_stock_item: false },
        ],
      }],
    });

    expect(check_delivery_note_required(so)).toBe(true);
  });

  it("test_service_item_needs_delivery_when_setting_disabled", () => {
    // Service item tetap membutuhkan Delivery Note jika setting skip dinonaktifkan
    const so = make_sales_order({
      settings: { skip_delivery_note_for_service_items: false },
      items: [{
        item_code: "SERVICE-REPAIR",
        quantity: 1,
        rate: 300000,
        amount: 300000,
        is_stock_item: false,
      }],
    });

    expect(check_delivery_note_required(so)).toBe(true);
  });

  it("test_sales_order_with_negative_rate", () => {
    // Negative rate diizinkan jika setting allow_negative_rates = true (bersama item positif sehingga grand total >= 0)
    const soAllowed = make_sales_order({
      settings: { allow_negative_rates: true },
      items: [
        {
          item_code: "MAIN-ITEM",
          quantity: 1,
          rate: 100000,
          amount: 100000,
        },
        {
          item_code: "DISCOUNT-ITEM",
          quantity: 1,
          rate: -20000,
          amount: -20000,
        },
      ],
    });
    expect(validate_sales_order(soAllowed).valid).toBe(true);

    const soBlocked = make_sales_order({
      settings: { allow_negative_rates: false },
      items: [
        {
          item_code: "MAIN-ITEM",
          quantity: 1,
          rate: 100000,
          amount: 100000,
        },
        {
          item_code: "DISCOUNT-ITEM",
          quantity: 1,
          rate: -20000,
          amount: -20000,
        },
      ],
    });
    expect(validate_sales_order(soBlocked).valid).toBe(false);
  });

  it("test_sales_order_negative_grand_total_blocked_without_setting", () => {
    // Negative grand total diblokir tanpa setting allow_negative_grand_total
    const so = make_sales_order({
      settings: { allow_negative_rates: true, allow_negative_grand_total: false },
      items: [{
        item_code: "PROMO-CREDIT",
        quantity: 1,
        rate: -100000,
        amount: -100000,
      }],
    });
    const result = validate_sales_order(so);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Grand Total negatif tidak diizinkan tanpa pengaturan allow_negative_grand_total"
    );
  });

  it("test_sales_order_negative_grand_total_allowed_with_setting", () => {
    // Negative grand total diizinkan bila allow_negative_grand_total = true
    const so = make_sales_order({
      settings: { allow_negative_rates: true, allow_negative_grand_total: true },
      items: [{
        item_code: "PROMO-CREDIT",
        quantity: 1,
        rate: -100000,
        amount: -100000,
      }],
    });
    const result = validate_sales_order(so);
    expect(result.valid).toBe(true);
  });

  it("test_sales_order_qty", () => {
    // Validasi kuantitas item (tidak boleh 0 atau negatif secara normal)
    const zeroQtySO = make_sales_order({
      items: [{ item_code: "ITEM-A", quantity: 0, rate: 1000, amount: 0 }],
    });
    expect(validate_sales_order(zeroQtySO).valid).toBe(false);

    const negativeQtySO = make_sales_order({
      items: [{ item_code: "ITEM-A", quantity: -5, rate: 1000, amount: -5000 }],
    });
    expect(validate_sales_order(negativeQtySO).valid).toBe(false);

    const positiveQtySO = make_sales_order({
      items: [{ item_code: "ITEM-A", quantity: 5, rate: 1000, amount: 5000 }],
    });
    expect(validate_sales_order(positiveQtySO).valid).toBe(true);
  });

  it("test_make_material_request", () => {
    // Membuat Material Request dari Sales Order
    const so = make_sales_order({
      id: "so-123",
      items: [{
        id: "so-item-1",
        item_code: "RAW-STEEL",
        item_name: "Raw Steel 10mm",
        quantity: 15,
        rate: 50000,
        amount: 750000,
      }],
    });

    const mr = make_material_request(so);
    expect(mr.sales_order_id).toBe("so-123");
    expect(mr.material_request_type).toBe("Purchase");
    expect(mr.items).toEqual([
      expect.objectContaining({
        item_code: "RAW-STEEL",
        quantity: 15,
      }),
    ]);
  });

  it("test_make_delivery_note", () => {
    // Membuat Delivery Note dari Sales Order
    const so = make_sales_order({
      id: "so-dn-test",
      customer: "PT Mitra Sejati",
      company: "UD Million Candles",
      items: [{
        id: "so-item-1",
        item_code: "CANDLE-01",
        item_name: "Lilin Aroma",
        quantity: 20,
        rate: 25000,
        amount: 500000,
      }],
    });

    const dn = make_delivery_note(so);
    expect(dn.sales_order_id).toBe("so-dn-test");
    expect(dn.customer).toBe("PT Mitra Sejati");
    expect(dn.items[0].quantity).toBe(20);
    expect(dn.items[0].amount).toBe(500000);
  });

  it("test_make_production_plan", () => {
    // Membuat Production Plan dari Sales Order
    const so = make_sales_order({
      id: "so-pp-test",
      company: "UD Million Candles",
      items: [{
        item_code: "CANDLE-SPECIAL",
        quantity: 50,
        rate: 30000,
        amount: 1500000,
      }],
    });

    const plan = make_production_plan(so);
    expect(plan.sales_order_id).toBe("so-pp-test");
    expect(plan.company).toBe("UD Million Candles");
    expect(plan.items[0].quantity).toBe(50);
  });

  it("test_make_sales_invoice", () => {
    // Membuat Sales Invoice dari Sales Order
    const so = make_sales_order({
      id: "so-inv-test",
      customer: "PT Buyer",
      company: "UD Million Candles",
      items: [{
        item_code: "ITEM-A",
        quantity: 10,
        rate: 15000,
        amount: 150000,
      }],
    });

    const inv = make_sales_invoice(so);
    expect(inv.sales_order_id).toBe("so-inv-test");
    expect(inv.customer).toBe("PT Buyer");
    expect(inv.items[0].quantity).toBe(10);
    expect(inv.items[0].amount).toBe(150000);
  });

  it("test_update_qty", () => {
    // Memperbarui kuantitas terkirim dan status pesanan
    const so = make_sales_order({
      items: [{
        item_code: "ITEM-STOCK-1",
        quantity: 10,
        rate: 20000,
        amount: 200000,
      }],
    });

    // Parsial delivery 4
    const updated1 = update_sales_order_delivered_qty(so, [
      { item_code: "ITEM-STOCK-1", quantity: 4 },
    ]);
    expect(updated1.items[0].delivered_qty).toBe(4);
    expect(updated1.per_delivered).toBe(40);
    expect(updated1.status).toBe("processing");

    // Sisa delivery 6
    const updated2 = update_sales_order_delivered_qty(updated1, [
      { item_code: "ITEM-STOCK-1", quantity: 6 },
    ]);
    expect(updated2.items[0].delivered_qty).toBe(10);
    expect(updated2.per_delivered).toBe(100);
    expect(updated2.status).toBe("completed");
  });

  it("test_return_against_sales_order", () => {
    // Retur barang mengembalikan kuantitas terkirim
    const so = make_sales_order({
      items: [{
        item_code: "ITEM-STOCK-1",
        quantity: 10,
        delivered_qty: 10,
        rate: 20000,
        amount: 200000,
      }],
    });

    // Retur 3 barang
    const returnedOrder = update_sales_order_delivered_qty(so, [
      { item_code: "ITEM-STOCK-1", quantity: 3, is_return: true },
    ]);
    expect(returnedOrder.items[0].delivered_qty).toBe(7);
    expect(returnedOrder.per_delivered).toBe(70);
    expect(returnedOrder.status).toBe("processing");
  });

  it("test_reserved_qty_for_partial_delivery", () => {
    // Menguji reserved qty saat partial delivery
    const so = make_sales_order({
      status: "processing",
      items: [{
        item_code: "RESERVED-ITEM",
        quantity: 20,
        delivered_qty: 5,
        rate: 10000,
        amount: 200000,
        is_stock_item: true,
      }],
    });

    const reserved = get_reserved_qty("RESERVED-ITEM", [so]);
    // 20 - 5 = 15
    expect(reserved).toBe(15);
  });

  it("test_reserved_qty_for_over_delivery", () => {
    // Menguji reserved qty jika terjadi over delivery (reserved tidak boleh minus)
    const so = make_sales_order({
      status: "processing",
      items: [{
        item_code: "RESERVED-ITEM",
        quantity: 10,
        delivered_qty: 12, // lebih kirim 2
        rate: 10000,
        amount: 100000,
        is_stock_item: true,
      }],
    });

    const reserved = get_reserved_qty("RESERVED-ITEM", [so]);
    expect(reserved).toBe(0);
  });

  it("test_update_child_adding_new_item", () => {
    // Menambah item baru ke Sales Order lewat update_child_qty_rate
    const so = make_sales_order({
      items: [{ item_code: "ITEM-1", quantity: 1, rate: 10000, amount: 10000 }],
    });

    const updated = update_child_qty_rate(so, {
      item_code: "ITEM-2",
      quantity: 2,
      rate: 15000,
      is_new: true,
    });

    expect(updated.items).toHaveLength(2);
    expect(updated.items[1].item_code).toBe("ITEM-2");
    expect(updated.items[1].amount).toBe(30000);
    expect(updated.grand_total).toBe(40000);
  });

  it("test_update_child_removing_item", () => {
    // Menghapus item dari Sales Order dan validasi bila sudah ada pengiriman
    const so = make_sales_order({
      items: [
        { item_code: "ITEM-A", quantity: 2, rate: 10000, amount: 20000, delivered_qty: 0 },
        { item_code: "ITEM-B", quantity: 1, rate: 5000, amount: 5000, delivered_qty: 1 },
      ],
    });

    // Menghapus ITEM-A yang belum dikirim -> berhasil
    const updated = update_child_qty_rate(so, {
      item_code: "ITEM-A",
      remove: true,
    });
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].item_code).toBe("ITEM-B");

    // Menghapus ITEM-B yang sudah dikirim -> gagal
    expect(() =>
      update_child_qty_rate(so, {
        item_code: "ITEM-B",
        remove: true,
      })
    ).toThrowError(/sudah memiliki pengiriman/i);
  });

  it("test_update_child", () => {
    // Mengubah rate dan kuantitas item child
    const so = make_sales_order({
      items: [{ item_code: "ITEM-X", quantity: 2, rate: 20000, amount: 40000 }],
    });

    const updated = update_child_qty_rate(so, {
      item_code: "ITEM-X",
      quantity: 5,
      rate: 25000,
    });

    expect(updated.items[0].quantity).toBe(5);
    expect(updated.items[0].rate).toBe(25000);
    expect(updated.items[0].amount).toBe(125000);
    expect(updated.grand_total).toBe(125000);
  });

  it("test_update_child_perm", () => {
    // Permission check saat edit child item berdasarkan workflow
    const workflow = make_sales_order_edit_perm_workflow();
    const so = make_sales_order({
      workflow_state: "Pending Approval",
      items: [{ item_code: "ITEM-LOCK", quantity: 1, rate: 10000, amount: 10000 }],
    });

    // User biasa tidak memiliki izin mengedit saat Pending Approval
    expect(() =>
      update_child_qty_rate(
        so,
        { item_code: "ITEM-LOCK", quantity: 3 },
        "Sales User",
        workflow
      )
    ).toThrowError(/tidak memiliki izin/i);

    // System Manager atau role berwenang diizinkan
    const managerUpdate = update_child_qty_rate(
      so,
      { item_code: "ITEM-LOCK", quantity: 3 },
      "System Manager",
      workflow
    );
    expect(managerUpdate.items[0].quantity).toBe(3);
  });

  it("test_update_child_qty_rate_with_workflow", () => {
    // Workflow edit permission step testing
    const workflow = make_sales_order_workflow();
    const soDraft = make_sales_order({
      workflow_state: "Draft",
      items: [{ item_code: "ITEM-FLOW", quantity: 2, rate: 5000, amount: 10000 }],
    });

    // Draft: Sales User boleh edit
    const draftEdit = update_child_qty_rate(
      soDraft,
      { item_code: "ITEM-FLOW", quantity: 4 },
      "Sales User",
      workflow
    );
    expect(draftEdit.items[0].quantity).toBe(4);

    // Closed: Sales User tidak boleh edit
    const soClosed = make_sales_order({
      workflow_state: "Closed",
      items: [{ item_code: "ITEM-FLOW", quantity: 2, rate: 5000, amount: 10000 }],
    });
    expect(() =>
      update_child_qty_rate(
        soClosed,
        { item_code: "ITEM-FLOW", quantity: 6 },
        "Sales User",
        workflow
      )
    ).toThrowError(/tidak memiliki izin/i);
  });

  it("test_update_child_product_bundle", () => {
    // Mengubah item child bundle
    const so = make_sales_order({
      items: [{
        item_code: "BUNDLE-1",
        quantity: 2,
        rate: 100000,
        amount: 200000,
        is_product_bundle: true,
        bundle_items: [{ item_code: "BUNDLE-PART-1", quantity: 2 }],
      }],
    });

    const updated = update_child_qty_rate(so, {
      item_code: "BUNDLE-1",
      quantity: 4,
      rate: 90000,
    });

    expect(updated.items[0].quantity).toBe(4);
    expect(updated.items[0].rate).toBe(90000);
    expect(updated.items[0].amount).toBe(360000);
  });

  // Helper function verification tests
  it("verifies helper compare_payment_schedules", () => {
    const sched1 = [{ due_date: "2026-09-01", invoice_portion: 50, payment_amount: 50000 }];
    const sched2 = [{ due_date: "2026-09-01", invoice_portion: 50, payment_amount: 50000 }];
    const sched3 = [{ due_date: "2026-09-01", invoice_portion: 60, payment_amount: 60000 }];

    expect(compare_payment_schedules(sched1, sched2)).toBe(true);
    expect(compare_payment_schedules(sched1, sched3)).toBe(false);
  });

  it("verifies helper make_sales_order", () => {
    const so = make_sales_order({ customer: "PT Test Customer" });
    expect(so.customer).toBe("PT Test Customer");
    expect(so.status).toBe("draft");
  });

  it("verifies helper create_dn_against_so", () => {
    const so = make_sales_order({
      items: [{ item_code: "ITEM-DN", quantity: 10, rate: 1000, amount: 10000 }],
    });
    const dn = create_dn_against_so(so, 6);
    expect(dn.items[0].quantity).toBe(6);
    expect(dn.items[0].amount).toBe(6000);
  });

  it("verifies helper get_reserved_qty", () => {
    const so = make_sales_order({
      items: [{ item_code: "ITEM-RES", quantity: 10, delivered_qty: 3, rate: 500, amount: 5000 }],
    });
    expect(get_reserved_qty("ITEM-RES", [so])).toBe(7);
  });

  it("verifies helper make_sales_order_workflow", () => {
    const wf = make_sales_order_workflow();
    expect(wf.name).toBe("Sales Order Workflow");
    expect(wf.steps.length).toBeGreaterThanOrEqual(3);
  });

  it("verifies helper make_sales_order_edit_perm_workflow", () => {
    const wf = make_sales_order_edit_perm_workflow();
    expect(wf.name).toBe("Sales Order Edit Perm Workflow");
    expect(wf.steps.find((s) => s.state === "Authorized For Edit")?.allow_edit).toBe(true);
  });
});
