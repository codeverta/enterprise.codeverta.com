import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  Info,
  Plus,
  Receipt,
  Save,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import api from "@/lib/api";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { CompanySelect } from "@/components/CompanySelect";
import { warehouseApi, type CompanyOption } from "@/modules/stock/warehouseApi";
import { customerApi, type Customer } from "../customerApi";
import {
  salesInvoiceApi,
  type SalesInvoiceItemOption,
} from "../salesInvoiceApi";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { DocumentActionBar } from "@/components/doctype/document-action-bar";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";
import { docStatusFromLegacy } from "@/lib/doctype";

type Item = {
  item_code: string;
  item_name?: string;
  delivery_date?: string;
  quantity: number;
  rate: number;
  amount: number;
};
type Tax = {
  charge_type: string;
  account_head: string;
  rate: number;
  net_amount: number;
  amount: number;
};
type Order = {
  id?: string;
  order_number?: string;
  store_order_id?: string;
  status: string;
  payment_status?: string;
  payment_method?: string;
  payment_provider?: string;
  payment_reference?: string;
  shipping_address?: string;
  subtotal?: number;
  shipping_amount?: number;
  total_amount?: number;
  naming_series: string;
  company: string;
  customer: string;
  customer_email?: string;
  order_type: string;
  transaction_date: string;
  delivery_date: string;
  is_subcontracted: boolean;
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
  advance_paid: number;
  apply_discount_on: string;
  coupon_code: string;
  additional_discount_percentage: number;
  additional_discount_amount: number;
  items: Item[];
  taxes: Tax[];
};
type Tab = "details" | "terms" | "more";

const today = () => new Date().toISOString().slice(0, 10);
const dateForInput = (value?: string) =>
  value ? String(value).slice(0, 10) : "";
const key = "erp.sales-orders.details";
const blankItem = (): Item => ({
  item_code: "",
  delivery_date: today(),
  quantity: 1,
  rate: 0,
  amount: 0,
});
const empty = (): Order => ({
  status: "draft",
  naming_series: "SAL-ORD-.YYYY.-",
  company: "",
  customer: "",
  order_type: "Sales",
  transaction_date: today(),
  delivery_date: "",
  is_subcontracted: false,
  cost_center: "",
  project: "",
  currency: "IDR",
  selling_price_list: "Standard Selling",
  ignore_pricing_rule: false,
  set_warehouse: "",
  tax_category: "",
  taxes_and_charges: "",
  shipping_rule: "",
  incoterm: "",
  total_qty: 0,
  total: 0,
  base_total_taxes_and_charges: 0,
  total_taxes_and_charges: 0,
  grand_total: 0,
  rounding_adjustment: 0,
  rounded_total: 0,
  advance_paid: 0,
  apply_discount_on: "grand_total",
  coupon_code: "",
  additional_discount_percentage: 0,
  additional_discount_amount: 0,
  items: [blankItem()],
  taxes: [],
});
const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
const readCache = (): Record<string, Order> => {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
};
const saveCache = (id: string, value: Order) =>
  localStorage.setItem(key, JSON.stringify({ ...readCache(), [id]: value }));
const removeCache = (id: string) => {
  const cache = readCache();
  delete cache[id];
  localStorage.setItem(key, JSON.stringify(cache));
};
function calculate(o: Order): Order {
  const items = o.items.map((i) => ({
    ...i,
    amount: round(i.quantity * i.rate),
  }));
  const total = round(items.reduce((s, i) => s + i.amount, 0));
  const taxes = o.taxes.map((t) => ({
    ...t,
    net_amount: total,
    amount: round(
      t.charge_type === "Actual" ? t.amount : (total * t.rate) / 100,
    ),
  }));
  const taxTotal = round(taxes.reduce((s, t) => s + t.amount, 0));
  const discount = o.additional_discount_percentage
    ? round(((total + taxTotal) * o.additional_discount_percentage) / 100)
    : round(o.additional_discount_amount);
  const grand = round(Math.max(0, total + taxTotal - discount));
  const rounded = Math.round(grand);
  return {
    ...o,
    items,
    taxes,
    total_qty: items.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
    total,
    base_total_taxes_and_charges: taxTotal,
    total_taxes_and_charges: taxTotal,
    additional_discount_amount: discount,
    grand_total: grand,
    rounded_total: rounded,
    rounding_adjustment: round(rounded - grand),
  };
}
function hydrate(o: Order): Order {
  const calculated = calculate(o);
  if (o.total_amount == null) return calculated;
  const total = Number(o.total_amount) || 0;
  return {
    ...calculated,
    total: o.subtotal ?? calculated.total,
    grand_total: total,
    rounded_total: Math.round(total),
    rounding_adjustment: round(Math.round(total) - total),
  };
}
export function mergeServerOrder(server: Order, cached?: Order): Order {
  const transactionDate =
    dateForInput(server.transaction_date) ||
    dateForInput(cached?.transaction_date) ||
    today();
  const deliveryDate =
    dateForInput(server.delivery_date) || dateForInput(cached?.delivery_date);
  const sourceItems = server.items?.length ? server.items : cached?.items || [];
  const items = sourceItems.map((item) => ({
    ...item,
    item_code: item.item_code || "",
    item_name: item.item_name || "",
    delivery_date: dateForInput(item.delivery_date) || deliveryDate,
    quantity: Number(item.quantity) || 0,
    rate: Number(item.rate) || 0,
    amount: Number(item.amount) || 0,
  }));
  return hydrate({
    ...empty(),
    ...(cached || {}),
    ...server,
    transaction_date: transactionDate,
    delivery_date: deliveryDate,
    items,
    taxes: server.taxes?.length ? server.taxes : cached?.taxes || [],
  });
}

function unwrapOrderResponse(payload: Order | { data: Order }): Order {
  return "data" in payload && payload.data && typeof payload.data === "object"
    ? payload.data
    : payload;
}
const fieldHelp: Record<string, string> = {
  Company: "Perusahaan yang menerbitkan dan membukukan Sales Order ini.",
  Series:
    "Pola penomoran yang dipakai untuk membuat nomor Sales Order secara otomatis.",
  Customer: "Pelanggan yang melakukan pemesanan dan akan ditagihkan.",
  "Order Type":
    "Jenis transaksi penjualan yang menentukan konteks pemrosesan pesanan.",
  Date: "Tanggal Sales Order dicatat dalam sistem.",
  "Delivery Date":
    "Target tanggal seluruh pesanan diserahkan kepada pelanggan.",
  "Payment Method":
    "Metode pembayaran yang dipilih pelanggan pada transaksi toko.",
  "Payment Provider":
    "Penyedia layanan yang memproses pembayaran transaksi ini.",
  "Payment Status": "Status terakhir proses pembayaran pesanan.",
  "Payment Reference":
    "Nomor referensi dari penyedia pembayaran untuk pelacakan transaksi.",
  "Shipping Address": "Alamat tujuan pengiriman barang pesanan pelanggan.",
  "Cost Center":
    "Pusat biaya yang menerima pencatatan pendapatan dan biaya transaksi ini.",
  Project:
    "Proyek yang dikaitkan dengan pendapatan, biaya, dan pelaporan pesanan.",
  Currency:
    "Mata uang yang dipakai untuk harga, pajak, diskon, dan total pesanan.",
  "Price List": "Daftar harga yang menjadi acuan penentuan harga item.",
  "Set Source Warehouse":
    "Gudang sumber default untuk pengambilan seluruh item pesanan.",
  "Tax Category":
    "Kategori pajak pelanggan atau transaksi yang menentukan aturan pajak yang berlaku.",
  "Sales Taxes and Charges Template":
    "Template pajak dan biaya yang akan diterapkan pada pesanan.",
  "Shipping Rule": "Aturan yang digunakan untuk menghitung biaya pengiriman.",
  Incoterm:
    "Ketentuan perdagangan yang membagi tanggung jawab biaya dan risiko pengiriman.",
  "Apply Additional Discount On":
    "Dasar nilai yang digunakan untuk menghitung diskon tambahan.",
  "Coupon Code": "Kode promo yang memberi potongan atau manfaat pada pesanan.",
  "Additional Discount Percentage":
    "Persentase diskon tambahan yang mengurangi nilai pesanan.",
  "Additional Discount Amount (IDR)":
    "Nominal hasil perhitungan diskon tambahan dalam rupiah.",
  "Advance Paid (IDR)":
    "Jumlah uang muka yang sudah diterima untuk pesanan ini.",
};
function Field({
  label,
  name,
  children,
}: {
  label: string;
  name?: string;
  children: React.ReactNode;
}) {
  const help = fieldHelp[label] || `Informasi untuk kolom ${label}.`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex rounded-full text-slate-400 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Info ${label}`}
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="max-w-xs">
            <p>{help}</p>
            {name && <p className="mt-1 text-[11px] opacity-75"></p>}
          </TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  );
}
export type ComboOption = { value: string; label?: string; sublabel?: string };

function Combo({
  value,
  onChange,
  options,
  placeholder = "Begin typing for results.",
}: {
  value: string;
  onChange: (v: string) => void;
  options: (string | ComboOption)[];
  placeholder?: string;
}) {
  const id = useMemo(() => `sales-${Math.random().toString(36).slice(2)}`, []);
  return (
    <>
      <Input
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <datalist id={id}>
        {options.map((opt, i) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const label =
            typeof opt === "string"
              ? opt
              : opt.label && opt.label !== opt.value
                ? `${opt.value} - ${opt.label}`
                : opt.value;
          return (
            <ERPSelectOption key={`${val}-${i}`} value={val}>
              {label}
            </ERPSelectOption>
          );
        })}
      </datalist>
    </>
  );
}

export function SalesOrderListPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Order[]>([]);
  const load = async () => {
    try {
      const response = await api.get<{ data: Order[] }>("/crm/sales-orders", {
        params: { page_size: 100 },
      });
      setRows(response.data.data || []);
    } catch {
      setRows(Object.values(readCache()));
    }
  };
  useEffect(() => {
    load();
  }, []);
  const remove = async (id?: string) => {
    if (!id || !window.confirm("Hapus Sales Order ini?")) return;
    try {
      await api.delete(`/crm/sales-orders/${id}`);
    } catch {
      /* cache still makes local CRUD usable when API is unavailable */
    }
    removeCache(id);
    toast.success("Sales Order dihapus");
    load();
  };
  const columns: ColumnDef<Order>[] = [
    {
      id: "order",
      header: "Sales Order",
      accessorFn: (row) => row.order_number || row.id || "",
      cell: ({ row }) => (
        <Link
          className="font-semibold text-blue-600 hover:underline"
          to={`/desk/sales-order/${row.original.id}`}
        >
          {row.original.order_number || row.original.id}
        </Link>
      ),
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => row.original.customer || "—",
    },
    {
      accessorKey: "transaction_date",
      header: "Date",
      cell: ({ row }) => row.original.transaction_date?.slice(0, 10) || "—",
    },
    {
      id: "total",
      header: "Total",
      accessorFn: (row) => row.total_amount ?? row.grand_total ?? 0,
      cell: ({ row }) =>
        money(row.original.total_amount ?? row.original.grand_total),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.status || "draft"}</Badge>
      ),
    },
    {
      id: "actions",
      header: "Action",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div
          className="flex justify-end"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => remove(row.original.id)}
          >
            <Trash2 className="size-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];
  return <ERPPage><ERPPageHeader title="Sales Order" description="Kelola pesanan penjualan dan detail item." breadcrumbs={[{ label: "Selling", href: "/desk/selling" }, { label: "Sales Order" }]} actions={<Button onClick={() => nav("/desk/sales-order/new")}><Plus className="size-4" />New Sales Order</Button>} /><DataTable columns={columns} data={rows} getRowId={(row) => row.id || row.order_number || "sales-order"} onRowClick={(row) => nav(`/desk/sales-order/${row.id}`)} searchPlaceholder="Cari nomor order atau customer..." emptyMessage="Belum ada Sales Order." /></ERPPage>;
}

export default function SalesOrderFormPage() {
  const params = useParams();
  const id = params.id || params["*"]?.split("/").filter(Boolean)[0];
  const nav = useNavigate();
  const isNew = !id || id === "new";
  const [tab, setTab] = useState<Tab>("details");
  const [order, setOrder] = useState<Order>(empty);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof Order>(k: K, v: Order[K]) =>
    setOrder((o) => calculate({ ...o, [k]: v }));
  const updateItem = (i: number, p: Partial<Item>) =>
    setOrder((o) =>
      calculate({
        ...o,
        items: o.items.map((x, n) => (n === i ? { ...x, ...p } : x)),
      }),
    );
  const updateTax = (i: number, p: Partial<Tax>) =>
    setOrder((o) =>
      calculate({
        ...o,
        taxes: o.taxes.map((x, n) => (n === i ? { ...x, ...p } : x)),
      }),
    );

  const [companyList, setCompanyList] = useState<CompanyOption[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [itemOptions, setItemOptions] = useState<SalesInvoiceItemOption[]>([]);

  useEffect(() => {
    let active = true;
    if (isNew || !id) {
      setOrder(empty());
      setLoadError("");
      setLoading(false);
      return () => {
        active = false;
      };
    }
    const cached = readCache()[id];
    setLoading(true);
    setLoadError("");
    Promise.resolve(api.get<Order | { data: Order }>(`/crm/sales-orders/${id}`))
      .then((response) => {
        if (!active || !response) return;
        const serverOrder = unwrapOrderResponse(response.data);
        setOrder(
          mergeServerOrder(
            { ...serverOrder, id: serverOrder.id || id },
            cached,
          ),
        );
      })
      .catch((error: any) => {
        if (!active) return;
        if (cached) {
          setOrder(mergeServerOrder({ ...cached, id }, cached));
          toast.warning(
            "API detail Sales Order tidak dapat diakses. Menampilkan data tersimpan.",
          );
          return;
        }
        setLoadError(
          error?.response?.data?.error || "Gagal mengambil detail Sales Order",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, isNew]);

  useEffect(() => {
    let active = true;

    const fetchCompanies = async () => {
      try {
        const res = await Promise.resolve(warehouseApi.listCompanies());
        return res || [];
      } catch {
        return [];
      }
    };

    const fetchCustomers = async () => {
      try {
        const res = await Promise.resolve(customerApi.list());
        return res || [];
      } catch {
        return [];
      }
    };

    const fetchInvoiceOptions = async () => {
      try {
        const res = await Promise.resolve(salesInvoiceApi.options());
        return res || null;
      } catch {
        return null;
      }
    };

    const fetchItems = async () => {
      try {
        const res = await Promise.resolve(api.get?.("/buying/items"));
        return res?.data?.data || [];
      } catch {
        return [];
      }
    };

    Promise.all([
      fetchCompanies(),
      fetchCustomers(),
      fetchInvoiceOptions(),
      fetchItems(),
    ]).then(([companies, customers, invoiceOpts, buyingItems]) => {
      if (!active) return;
      if (companies && companies.length > 0) {
        setCompanyList(companies);
      }
      if (customers && customers.length > 0) {
        setCustomerList(customers);
      } else if (invoiceOpts?.customers) {
        setCustomerList(
          invoiceOpts.customers.map((c) => ({
            customer_name: c,
            customer_type: "Company",
            customer_group: "All Customer Groups",
            territory: "All Territories",
            tax_id: "",
            email: "",
            phone: "",
            mobile_no: "",
            website: "",
            address: "",
            default_currency: "IDR",
            default_price_list: "Standard Selling",
            payment_terms: "",
            credit_limit: 0,
            notes: "",
            disabled: false,
          })),
        );
      }

      const map = new Map<string, SalesInvoiceItemOption>();
      if (invoiceOpts?.items) {
        for (const it of invoiceOpts.items) {
          if (it.item_code) {
            map.set(it.item_code.toLowerCase(), it);
          }
        }
      }
      for (const it of buyingItems || []) {
        const code = it.item_code;
        if (code && !map.has(code.toLowerCase())) {
          map.set(code.toLowerCase(), {
            item_code: code,
            item_name: it.item_name || code,
            uom: it.stock_uom || "Nos",
            rate: it.standard_selling_rate || it.valuation_rate || 0,
            barcode: it.barcode,
            description: it.description,
          });
        }
      }
      setItemOptions(Array.from(map.values()));
    });

    return () => {
      active = false;
    };
  }, []);

  const companyOptions = useMemo<SearchableSelectOption[]>(() => {
    if (companyList.length > 0) {
      return companyList.map((c) => ({
        value: c.name || (c as any).company_name,
        label: c.name || (c as any).company_name,
        badge: c.abbreviation || undefined,
      }));
    }
    return [];
  }, [companyList]);

  const customerOptions = useMemo<SearchableSelectOption[]>(() => {
    if (customerList.length > 0) {
      return customerList.map((c) => ({
        value: c.customer_name,
        label: c.customer_name,
        sublabel: c.email || c.phone || c.territory || undefined,
        badge: c.customer_group || undefined,
      }));
    }
    return [
      { value: "Customer A", label: "Customer A" },
      { value: "Customer B", label: "Customer B" },
    ];
  }, [customerList]);

  const itemSelectOptions = useMemo<SearchableSelectOption[]>(() => {
    return itemOptions.map((opt) => ({
      value: opt.item_code,
      label: opt.item_code,
      sublabel: opt.item_name,
      badge: opt.rate > 0 ? money(opt.rate) : undefined,
    }));
  }, [itemOptions]);

  const handleCustomerChange = (val: string) => {
    const found = customerList.find(
      (c) => c.customer_name.toLowerCase() === val.toLowerCase(),
    );
    setOrder((prev) => {
      const updated: Order = {
        ...prev,
        customer: val,
      };
      if (found) {
        if (found.address && !prev.shipping_address) {
          updated.shipping_address = found.address;
        }
        if (found.email && !prev.customer_email) {
          updated.customer_email = found.email;
        }
      }
      return calculate(updated);
    });
  };
  const save = async () => {
    if (!order.company.trim() || !order.customer.trim())
      return toast.error("Company dan Customer wajib diisi");
    if (order.items.some((i) => !i.item_code.trim() || i.quantity <= 0))
      return toast.error("Lengkapi Item Code dan Quantity");
    setSaving(true);
    const payload = calculate(order);
    const orderNumber =
      order.order_number ||
      `${order.naming_series.replace(".YYYY.", new Date().getFullYear().toString())}${Date.now().toString().slice(-5)}`;
    try {
      const request = {
        order_number: orderNumber,
        company: payload.company,
        customer: payload.customer,
        customer_email: payload.customer_email,
        shipping_address: payload.shipping_address,
        transaction_date: payload.transaction_date,
        currency: payload.currency,
        subtotal: payload.total,
        shipping_amount: payload.shipping_amount || 0,
        total_amount: payload.grand_total,
        payment_status: payload.payment_status,
        status: isNew ? "processing" : payload.status,
        items: payload.items.map((item) => ({
          item_code: item.item_code,
          item_name: item.item_name || item.item_code,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        })),
      };
      const { items: _items, ...updateRequest } = request;
      const res = isNew
        ? await api.post<Order>("/crm/sales-orders", request)
        : await api.patch<Order>(`/crm/sales-orders/${id}`, updateRequest);
      const savedId = id || res.data.id || crypto.randomUUID();
      const full = mergeServerOrder({
        ...payload,
        ...res.data,
        id: savedId,
        order_number: res.data.order_number || orderNumber,
      });
      saveCache(savedId, full);
      setOrder(full);
      toast.success(
        "Sales Order berhasil disimpan dan loyalty points diproses",
      );
      nav(`/desk/sales-order/${savedId}`, { replace: true });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menyimpan Sales Order");
    } finally {
      setSaving(false);
    }
  };
  const submit = async () => {
    if (!id) return;
    try {
      const response = await api.patch<Order>(`/crm/sales-orders/${id}`, {
        status: "confirmed",
      });
      const next = mergeServerOrder({
        ...order,
        ...response.data,
        status: "confirmed",
      });
      setOrder(next);
      saveCache(id, next);
      toast.success("Sales Order berhasil disubmit");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal submit Sales Order");
    }
  };
  const cancel = async () => {
    if (!id || !window.confirm("Cancel Sales Order ini?")) return;
    try {
      const response = await api.patch<Order>(`/crm/sales-orders/${id}`, {
        status: "cancelled",
      });
      const next = mergeServerOrder({
        ...order,
        ...response.data,
        status: "cancelled",
      });
      setOrder(next);
      saveCache(id, next);
      toast.success("Sales Order berhasil dibatalkan");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal cancel Sales Order");
    }
  };
  const amend = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const currentNumber = order.order_number || "SAL-ORD";
      const revisionMatch = currentNumber.match(/-(\d+)$/);
      const base = currentNumber.replace(/-\d+$/, "");
      const nextRevision = revisionMatch ? Number(revisionMatch[1]) + 1 : 1;
      const request = {
        order_number: `${base}-${nextRevision}`,
        company: order.company,
        customer: order.customer,
        customer_email: order.customer_email,
        shipping_address: order.shipping_address,
        transaction_date: order.transaction_date,
        currency: order.currency,
        subtotal: order.total,
        shipping_amount: order.shipping_amount || 0,
        total_amount: order.grand_total,
        payment_status: order.payment_status,
        status: "processing",
        items: order.items.map((item) => ({
          item_code: item.item_code,
          item_name: item.item_name || item.item_code,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        })),
      };
      const response = await api.post<Order>("/crm/sales-orders", request);
      const next = mergeServerOrder({
        ...order,
        ...response.data,
        id: response.data.id,
        status: "processing",
      });
      if (next.id) saveCache(next.id, next);
      toast.success("Amendment Sales Order dibuat sebagai Draft");
      nav(`/desk/sales-order/${next.id}`, { replace: true });
      setOrder(next);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal membuat amendment");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!id || !window.confirm("Hapus Sales Order ini?")) return;
    try {
      await api.delete(`/crm/sales-orders/${id}`);
    } catch {}
    removeCache(id);
    toast.success("Sales Order dihapus");
    nav("/desk/sales-order");
  };
  const options = [
    "",
    "Standard Selling",
    "Main Warehouse",
    "Jakarta Warehouse",
    "Customer A",
    "Customer B",
  ];
  const editable =
    isNew || order.status === "draft" || order.status === "processing";
  if (loading)
    return (
      <div className="p-12 text-center text-slate-500">
        Memuat detail Sales Order...
      </div>
    );
  if (loadError)
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <p className="font-semibold text-red-600">{loadError}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => nav("/desk/sales-order")}>
            Kembali ke daftar
          </Button>
          <Button onClick={() => window.location.reload()}>Coba Lagi</Button>
        </div>
      </div>
    );
  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7">
      <header className="mb-5 flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/desk/sales-order">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <p className="text-sm text-slate-500">Selling / Sales Order</p>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {isNew ? "New Sales Order" : order.order_number}
              </h1>
              <Badge variant="secondary">
                {isNew ? "Not Saved" : order.status}
              </Badge>
              {!isNew && order.payment_status && (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  {order.payment_status}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  nav(
                    `/desk/delivery-note/new?sales_order_id=${encodeURIComponent(order.id || "")}`,
                  )
                }
                className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-slate-900"
              >
                <Truck className="mr-1 size-4" /> Create Delivery Note
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  nav(
                    `/desk/sales-invoice/new?sales_order_id=${encodeURIComponent(order.id || "")}`,
                  )
                }
                className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-slate-900"
              >
                <Receipt className="mr-1 size-4" /> Create Sales Invoice
              </Button>
            </>
          )}
          {!isNew && (
            <Button variant="outline" onClick={remove}>
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
          {false && editable && (
            <Button
              onClick={save}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="size-4" /> {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </header>
      <DocumentActionBar
        document={{
          id: id || "",
          document_no: order.order_number || "",
          doc_status: docStatusFromLegacy(order.status),
          version: 1,
        }}
        action={saving ? "save" : null}
        onSave={save}
        onSubmit={submit}
        onCancel={cancel}
        onAmend={amend}
      />
      <div className="rounded-2xl border bg-white shadow-sm">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="details" className="rounded-none px-5 py-3">
              Details
            </TabsTrigger>
            <TabsTrigger value="terms" className="rounded-none px-5 py-3">
              Terms
            </TabsTrigger>
            <TabsTrigger value="more" className="rounded-none px-5 py-3">
              More Info
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="space-y-8 p-5 lg:p-7">
          {tab === "details" && (
            <>
              <section className="space-y-4">
                <h2 className="text-sm font-bold">Details</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Company" name="company">
                    <CompanySelect
                      value={order.company}
                      onChange={(val) => update("company", val)}
                      placeholder="Pilih Company..."
                    />
                  </Field>
                  <Field label="Series" name="naming_series">
                    <Input
                      value={order.naming_series}
                      onChange={(e) => update("naming_series", e.target.value)}
                    />
                  </Field>
                  <Field label="Customer" name="customer">
                    <SearchableSelect
                      value={order.customer}
                      options={customerOptions}
                      onChange={handleCustomerChange}
                      placeholder="Pilih Customer..."
                      searchPlaceholder="Cari customer..."
                      addNewLabel="Tambah Customer"
                      addNewHref="/desk/customer/new"
                    />
                  </Field>
                  <Field label="Order Type" name="order_type">
                    <ERPSelect
                      className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                      value={order.order_type}
                      onChange={(e) => update("order_type", e.target.value)}
                    >
                      <ERPSelectOption>Sales</ERPSelectOption>
                      <ERPSelectOption>Shopping</ERPSelectOption>
                    </ERPSelect>
                  </Field>
                  <Field label="Date" name="transaction_date">
                    <Input
                      type="date"
                      value={order.transaction_date}
                      onChange={(e) =>
                        update("transaction_date", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Delivery Date" name="delivery_date">
                    <Input
                      type="date"
                      value={order.delivery_date}
                      onChange={(e) => update("delivery_date", e.target.value)}
                    />
                  </Field>
                </div>
                {order.store_order_id && (
                  <div className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:grid-cols-4">
                    <Field label="Payment Method">
                      <Input readOnly value={order.payment_method || "—"} />
                    </Field>
                    <Field label="Payment Provider">
                      <Input readOnly value={order.payment_provider || "—"} />
                    </Field>
                    <Field label="Payment Status">
                      <Input readOnly value={order.payment_status || "—"} />
                    </Field>
                    <Field label="Payment Reference">
                      <Input readOnly value={order.payment_reference || "—"} />
                    </Field>
                    {order.shipping_address && (
                      <div className="md:col-span-4">
                        <Field label="Shipping Address">
                          <Input readOnly value={order.shipping_address} />
                        </Field>
                      </div>
                    )}
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={order.is_subcontracted}
                    onCheckedChange={(v) =>
                      update("is_subcontracted", Boolean(v))
                    }
                  />{" "}
                  Is Subcontracted
                </label>
              </section>
              <details className="group border-t pt-6">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold [&::-webkit-details-marker]:hidden">
                  <span>Accounting Dimensions</span>
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Cost Center" name="cost_center">
                    <Combo
                      value={order.cost_center}
                      onChange={(v) => update("cost_center", v)}
                      options={options}
                    />
                  </Field>
                  <Field label="Project" name="project">
                    <Combo
                      value={order.project}
                      onChange={(v) => update("project", v)}
                      options={options}
                    />
                  </Field>
                </div>
              </details>
              <details className="group border-t pt-6">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold [&::-webkit-details-marker]:hidden">
                  <span>Currency and Price List</span>
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Currency">
                      <Input
                        value={order.currency}
                        onChange={(e) => update("currency", e.target.value)}
                      />
                    </Field>
                    <Field label="Price List" name="selling_price_list">
                      <Combo
                        value={order.selling_price_list}
                        onChange={(v) => update("selling_price_list", v)}
                        options={[...new Set(["Standard Selling", ...options])]}
                      />
                    </Field>
                    <Field label="Set Source Warehouse" name="set_warehouse">
                      <Combo
                        value={order.set_warehouse}
                        onChange={(v) => update("set_warehouse", v)}
                        options={options}
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={order.ignore_pricing_rule}
                      onCheckedChange={(v) =>
                        update("ignore_pricing_rule", Boolean(v))
                      }
                    />{" "}
                    Ignore Pricing Rule
                  </label>
                </div>
              </details>
              <section className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Items</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      update("items", [...order.items, blankItem()])
                    }
                  >
                    <Plus className="size-4" /> Add Row
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[850px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr>
                        <th className="p-3">No.</th>
                        <th className="p-3">Item Code</th>
                        <th className="p-3">Delivery Date</th>
                        <th className="p-3">Quantity</th>
                        <th className="p-3">Rate (IDR)</th>
                        <th className="p-3">Amount (IDR)</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-3">{i + 1}</td>
                          <td className="p-3">
                            <div className="space-y-1 min-w-[220px]">
                              <SearchableSelect
                                value={item.item_code}
                                options={itemSelectOptions}
                                onChange={(val) => {
                                  const matched = itemOptions.find(
                                    (opt) =>
                                      opt.item_code.toLowerCase() ===
                                      val.toLowerCase(),
                                  );
                                  if (matched) {
                                    const qty = Number(item.quantity) || 1;
                                    const rate = matched.rate || 0;
                                    updateItem(i, {
                                      item_code: matched.item_code,
                                      item_name: matched.item_name,
                                      rate: rate,
                                      amount: round(qty * rate),
                                    });
                                  } else {
                                    updateItem(i, { item_code: val });
                                  }
                                }}
                                placeholder="Pilih Item Code..."
                                searchPlaceholder="Cari kode atau nama item..."
                                addNewLabel="Tambah Item Baru"
                                addNewHref="/desk/item/new"
                              />
                              {item.item_name && (
                                <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                                  {item.item_name}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <Input
                              type="date"
                              value={item.delivery_date || ""}
                              onChange={(e) =>
                                updateItem(i, { delivery_date: e.target.value })
                              }
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => {
                                const qty = Number(e.target.value);
                                updateItem(i, {
                                  quantity: qty,
                                  amount: round(qty * (item.rate || 0)),
                                });
                              }}
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="0"
                              value={item.rate}
                              onChange={(e) => {
                                const r = Number(e.target.value);
                                updateItem(i, {
                                  rate: r,
                                  amount: round((item.quantity || 0) * r),
                                });
                              }}
                            />
                          </td>
                          <td className="p-3 font-medium">
                            {money(item.amount)}
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={order.items.length === 1}
                              onClick={() =>
                                update(
                                  "items",
                                  order.items.filter((_, n) => n !== i),
                                )
                              }
                            >
                              <Trash2 className="size-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {order.items.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="p-8 text-center text-slate-500"
                          >
                            Item Sales Order belum tersedia.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    Total Quantity <strong>{order.total_qty}</strong>
                  </div>
                  <div className="text-right">
                    Total <strong>{money(order.total)}</strong>
                  </div>
                </div>
              </section>
              <section className="space-y-4 border-t pt-6">
                <h2 className="text-sm font-bold">Taxes and Charges</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Tax Category" name="tax_category">
                    <Input
                      value={order.tax_category}
                      onChange={(e) => update("tax_category", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Sales Taxes and Charges Template"
                    name="taxes_and_charges"
                  >
                    <Input
                      value={order.taxes_and_charges}
                      onChange={(e) =>
                        update("taxes_and_charges", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Shipping Rule" name="shipping_rule">
                    <Input
                      value={order.shipping_rule}
                      onChange={(e) => update("shipping_rule", e.target.value)}
                    />
                  </Field>
                  <Field label="Incoterm" name="incoterm">
                    <Input
                      value={order.incoterm}
                      onChange={(e) => update("incoterm", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Sales Taxes and Charges
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      update("taxes", [
                        ...order.taxes,
                        {
                          charge_type: "On Net Total",
                          account_head: "",
                          rate: 0,
                          net_amount: 0,
                          amount: 0,
                        },
                      ])
                    }
                  >
                    <Plus className="size-4" /> Add Tax
                  </Button>
                </div>
                {order.taxes.map((tax, i) => (
                  <div
                    className="grid gap-3 rounded-lg border p-3 md:grid-cols-5"
                    key={i}
                  >
                    <Input
                      value={tax.charge_type}
                      onChange={(e) =>
                        updateTax(i, { charge_type: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Account Head"
                      value={tax.account_head}
                      onChange={(e) =>
                        updateTax(i, { account_head: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Tax Rate %"
                      value={tax.rate}
                      onChange={(e) =>
                        updateTax(i, { rate: Number(e.target.value) })
                      }
                    />
                    <Input readOnly value={money(tax.amount)} />
                    <Button
                      variant="ghost"
                      onClick={() =>
                        update(
                          "taxes",
                          order.taxes.filter((_, n) => n !== i),
                        )
                      }
                    >
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  </div>
                ))}
                <div className="grid gap-2 text-right text-sm">
                  <div>
                    Total Taxes and Charges{" "}
                    <strong>{money(order.total_taxes_and_charges)}</strong>
                  </div>
                  <div className="text-base">
                    Grand Total <strong>{money(order.grand_total)}</strong>
                  </div>
                  <div>
                    Rounding Adjustment{" "}
                    <strong>{money(order.rounding_adjustment)}</strong>
                  </div>
                  <div>
                    Rounded Total <strong>{money(order.rounded_total)}</strong>
                  </div>
                </div>
              </section>
            </>
          )}
          {tab === "terms" && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold [&::-webkit-details-marker]:hidden">
                <span>Additional Discount</span>
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Apply Additional Discount On">
                    <ERPSelect
                      className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                      value={order.apply_discount_on}
                      onChange={(e) =>
                        update("apply_discount_on", e.target.value)
                      }
                    >
                      <ERPSelectOption value="grand_total">
                        Grand Total
                      </ERPSelectOption>
                      <ERPSelectOption value="net_total">
                        Net Total
                      </ERPSelectOption>
                    </ERPSelect>
                  </Field>
                  <Field label="Coupon Code" name="coupon_code">
                    <Input
                      value={order.coupon_code}
                      onChange={(e) => update("coupon_code", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Additional Discount Percentage"
                    name="additional_discount_percentage"
                  >
                    <Input
                      type="number"
                      min="0"
                      value={order.additional_discount_percentage}
                      onChange={(e) =>
                        update(
                          "additional_discount_percentage",
                          Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                </div>
                <Field label="Additional Discount Amount (IDR)">
                  <Input
                    type="number"
                    min="0"
                    value={order.additional_discount_amount}
                    onChange={(e) =>
                      update(
                        "additional_discount_amount",
                        Number(e.target.value),
                      )
                    }
                  />
                </Field>
              </div>
            </details>
          )}
          {tab === "more" && (
            <section className="space-y-4">
              <h2 className="text-sm font-bold">More Info</h2>
              <p className="text-sm text-slate-500">
                Sales Order dibuat pada {order.transaction_date || today()}{" "}
                dengan mata uang {order.currency}.
              </p>
              <Field label="Advance Paid (IDR)">
                <Input
                  type="number"
                  value={order.advance_paid}
                  onChange={(e) =>
                    update("advance_paid", Number(e.target.value))
                  }
                />
              </Field>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
