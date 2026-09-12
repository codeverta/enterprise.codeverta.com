import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Warehouse,
  FileText,
  Search,
  ScanBarcode,
  Calendar,
  CreditCard,
  Building2,
  MapPin,
  Clock,
  ShieldCheck,
  Tag,
  DollarSign,
  Info,
  ChevronDown,
  ExternalLink,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CompanySelect } from "@/components/CompanySelect";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { DocumentActionBar } from "@/components/doctype/document-action-bar";
import { docStatusFromLegacy } from "@/lib/doctype";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchableSelect, SearchableWarehouseSelect } from "@/components/ui/searchable-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { warehouseApi, type CompanyOption } from "@/modules/stock/warehouseApi";
import { stockApi } from "@/modules/stock/api";
import { customerApi, type Customer } from "../customerApi";
import {
  salesInvoiceApi,
  type SalesInvoice,
  type SalesInvoiceItem,
  type SalesInvoiceOptions,
  type SalesInvoiceItemOption,
} from "../salesInvoiceApi";

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 8);
const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr || new Date());
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const money = (value?: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const emptyItem = (): SalesInvoiceItem => ({
  item_code: "",
  item_name: "",
  warehouse: "",
  quantity: 1,
  uom: "Nos",
  rate: 0,
  amount: 0,
});

const emptyInvoice = (): SalesInvoice => ({
  status: "Draft",
  naming_series: "ACC-SINV-.YYYY.-",
  customer: "",
  company: "",
  posting_date: today(),
  posting_time: nowTime(),
  set_posting_time: false,
  due_date: addDays(today(), 7),
  is_pos: false,
  is_return: false,
  is_debit_note: false,
  apply_tds: false,
  cost_center: "",
  project: "",
  scan_barcode: "",
  update_stock: false,
  currency: "IDR",
  total_qty: 0,
  net_total: 0,
  tax_category: "",
  taxes_and_charges: "",
  shipping_rule: "",
  incoterm: "",
  tax_rate: 0,
  tax_amount: 0,
  total_taxes_and_charges: 0,
  use_company_roundoff_cost_center: false,
  grand_total: 0,
  rounding_adjustment: 0,
  rounded_total: 0,
  total_advance: 0,
  outstanding_amount: 0,
  apply_discount_on: "Grand Total",
  coupon_code: "",
  additional_discount_percentage: 0,
  discount_amount: 0,
  is_cash_or_non_trade_discount: false,
  allocate_advances_automatically: false,
  redeem_loyalty_points: false,
  loyalty_program: "",
  customer_address: "",
  contact_person: "",
  territory: "",
  shipping_address_name: "",
  dispatch_address_name: "",
  company_address: "",
  payment_terms_template: "",
  tc_name: "",
  terms_and_conditions: "",
  po_no: "",
  debit_to: "",
  sales_partner: "",
  amount_eligible_for_commission: 0,
  commission_rate: 0,
  total_commission: 0,
  letter_head: "",
  group_same_items: false,
  select_print_heading: "Invoice",
  language: "English",
  subscription: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_content: "",
  is_paid: false,
  refund_status: "Not Applicable",
  items: [emptyItem()],
});

const calculateTotals = (invoice: SalesInvoice): SalesInvoice => {
  const sign = invoice.is_return ? -1 : 1;
  let totalQty = 0;
  const items = (invoice?.items || []).map((item) => {
    const quantity = sign * Math.abs(Number(item.quantity) || 0);
    const amount = quantity * Math.abs(Number(item.rate) || 0);
    totalQty += Math.abs(quantity);
    return { ...item, quantity, amount };
  });

  const net = items.reduce((sum, item) => sum + item.amount, 0);

  // Additional Discount
  let discount = Math.abs(Number(invoice.discount_amount) || 0);
  if (invoice.additional_discount_percentage && invoice.additional_discount_percentage > 0) {
    discount = (net * invoice.additional_discount_percentage) / 100;
  }
  const discountedNet = Math.max(0, net - discount);

  // Tax
  const tax = (discountedNet * Math.abs(Number(invoice.tax_rate) || 0)) / 100;
  const rawGrand = discountedNet + tax;

  const rounded = invoice.use_company_roundoff_cost_center ? rawGrand : Math.round(rawGrand);
  const roundingAdj = rounded - rawGrand;

  let outstanding = 0;
  if (invoice.is_return) {
    outstanding = 0;
  } else if (!invoice.is_paid) {
    outstanding = Math.max(0, rounded - Math.abs(Number(invoice.total_advance) || 0));
  }

  return {
    ...invoice,
    items,
    total_qty: totalQty,
    net_total: net,
    discount_amount: discount,
    tax_amount: tax,
    total_taxes_and_charges: tax,
    grand_total: rawGrand,
    rounding_adjustment: roundingAdj,
    rounded_total: rounded,
    outstanding_amount: outstanding,
  };
};

/* =========================================================================
   LIST PAGE
   ========================================================================= */
export function SalesInvoiceListPage() {
  const [rows, setRows] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    salesInvoiceApi
      .list()
      .then(setRows)
      .catch(() => toast.error("Gagal memuat Sales Invoice"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const invoiceColumns = useMemo<ColumnDef<SalesInvoice>[]>(() => [
    { accessorKey: "number", header: "Document", cell: ({ row }) => <div className="flex items-center gap-2"><Link className="font-semibold text-blue-600 hover:underline" to={`/desk/sales-invoice/${row.original.id}`}>{row.original.number}</Link>{row.original.is_pos && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">POS</span>}</div>, meta: { label: "Document" } },
    { accessorKey: "customer", header: "Customer", meta: { label: "Customer", cellClassName: "font-medium" } },
    { accessorKey: "posting_date", header: "Posting Date", cell: ({ row }) => row.original.posting_date?.slice(0, 10) || "-", meta: { label: "Posting Date", cellClassName: "text-xs text-slate-600" } },
    { id: "items", header: "Items", accessorFn: (row) => (row.items || []).length, cell: ({ row }) => <div><span className="font-medium">{(row.original.items || []).length} item</span>{(row.original.items || []).length > 0 && <span className="block max-w-[160px] truncate text-[11px] text-slate-500">{(row.original.items || []).map((i) => i.item_name || i.item_code).slice(0, 2).join(", ")}{(row.original.items || []).length > 2 ? "..." : ""}</span>}</div>, meta: { label: "Items" } },
    { accessorKey: "grand_total", header: "Grand Total", cell: ({ row }) => money(row.original.grand_total), meta: { label: "Grand Total", cellClassName: "text-right font-bold" } },
    { accessorKey: "outstanding_amount", header: "Outstanding", cell: ({ row }) => money(row.original.outstanding_amount), meta: { label: "Outstanding", cellClassName: "text-right font-semibold" } },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={row.original.status === "Submitted" ? "default" : "secondary"}>{row.original.status}</Badge>, meta: { label: "Status", cellClassName: "text-center" } },
    { id: "settlement", header: "Settlement", accessorFn: (row) => row.is_return ? row.refund_status : row.is_paid ? "Paid" : "Outstanding", cell: ({ row }) => row.original.is_return ? <span className="font-medium text-amber-600">{row.original.refund_status}</span> : row.original.is_paid ? <span className="font-medium text-emerald-600">Paid</span> : <span className="text-slate-500">Outstanding</span>, meta: { label: "Settlement", cellClassName: "text-xs" } },
    { id: "actions", header: "Aksi", enableSorting: false, enableColumnFilter: false, cell: ({ row }) => <Button asChild size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs" onClick={(event) => event.stopPropagation()}><Link to={`/desk/sales-invoice/${row.original.id}`}><Eye className="size-3.5 text-blue-600" /><span>Detail</span></Link></Button>, meta: { label: "Aksi", cellClassName: "text-center" } },
  ], []);

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">Selling</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">Sales Invoice</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Invoice</h1>
          <p className="mt-1 text-sm text-slate-500">
            Faktur penjualan, kredit nota (Credit Note), dan penyesuaian piutang pelanggan.
          </p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to="/desk/sales-invoice/new">
            <Plus className="mr-2 size-4" /> New Sales Invoice
          </Link>
        </Button>
      </header>

      <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
        <DataTable columns={invoiceColumns} data={rows} getRowId={(row) => row.id || row.number} onRowClick={(row) => row.id && navigate(`/desk/sales-invoice/${row.id}`)} searchPlaceholder="Cari invoice, customer, item..." emptyMessage={loading ? "Memuat data Sales Invoice..." : "Belum ada Sales Invoice."} />
        {/* The editable item grid below remains intentionally form-specific. */}
        {/*
        <div className="hidden">
          <table>
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="p-4">Document</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Posting Date</th>
                <th className="p-4">Items</th>
                <th className="p-4 text-right">Grand Total</th>
                <th className="p-4 text-right">Outstanding</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Settlement</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    Memuat data Sales Invoice...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    Belum ada Sales Invoice.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                    <td className="p-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <Link
                          className="text-blue-600 hover:underline"
                          to={`/desk/sales-invoice/${row.id}`}
                        >
                          {row.number}
                        </Link>
                        {row.is_pos && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                            POS
                          </span>
                        )}
                      </div>
                      {row.is_return && (
                        <div className="mt-1 text-xs text-amber-600">
                          Credit Note · against {row.return_against_id}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-medium">{row.customer}</td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                      {row.posting_date?.slice(0, 10)}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {(row.items || []).length} item
                        </span>
                        {(row.items || []).length > 0 && (
                          <span
                            className="text-[11px] text-slate-500 truncate max-w-[160px]"
                            title={(row.items || []).map((i) => `${i.item_code} (${i.quantity} ${i.uom || "Nos"})`).join(", ")}
                          >
                            {(row.items || []).map((i) => i.item_name || i.item_code).slice(0, 2).join(", ")}
                            {(row.items || []).length > 2 ? "..." : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`p-4 text-right font-bold ${
                        row.is_return ? "text-red-600" : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {money(row.grand_total)}
                    </td>
                    <td className="p-4 text-right font-semibold text-slate-700 dark:text-slate-300">
                      {money(row.outstanding_amount)}
                    </td>
                    <td className="p-4 text-center">
                      <Badge variant={row.status === "Submitted" ? "default" : "secondary"}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-xs">
                      {row.is_return ? (
                        <span className="text-amber-600 font-medium">{row.refund_status}</span>
                      ) : row.is_paid ? (
                        <span className="text-emerald-600 font-medium">Paid</span>
                      ) : (
                        <span className="text-slate-500">Outstanding</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <Button asChild size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1">
                        <Link to={`/desk/sales-invoice/${row.id}`}>
                          <Eye className="size-3.5 text-blue-600" />
                          <span>Detail</span>
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        */}
      </div>
    </div>
  );
}

export function SearchableItemSelect({
  value,
  itemOptions,
  onChange,
  disabled,
  placeholder = "Pilih item...",
}: {
  value: string;
  itemOptions: SalesInvoiceItemOption[];
  onChange: (item: SalesInvoiceItemOption) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedItem = itemOptions.find((x) => x.item_code === value);

  const filtered = itemOptions.filter((it) => {
    const q = search.toLowerCase();
    return (
      it.item_code.toLowerCase().includes(q) ||
      it.item_name.toLowerCase().includes(q) ||
      (it.barcode && it.barcode.toLowerCase().includes(q))
    );
  });

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled) return setOpen(false);
        setOpen(nextOpen);
        if (nextOpen) setSearch("");
      }}
    >
      <div className="w-full">
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-expanded={open}
            aria-haspopup="listbox"
            className={`flex h-8 w-full items-center justify-between rounded border border-slate-200 bg-white px-2 py-1 text-left text-xs font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 ${
              open ? "ring-1 ring-blue-500 border-blue-500" : ""
            }`}
          >
            <div className="truncate">
              {value ? (
                <span>
                  <span className="font-semibold">{value}</span>
                  {selectedItem?.item_name && (
                    <span className="ml-1 text-slate-500 truncate">- {selectedItem.item_name}</span>
                  )}
                </span>
              ) : (
                <span className="text-slate-400 font-normal">{placeholder}</span>
              )}
            </div>
            <ChevronDown className="ml-1.5 size-3 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          role="listbox"
          aria-label="Ketik kode, nama, atau barcode item..."
          className="z-[100] max-h-64 w-[340px] max-w-[calc(100vw-24px)] rounded-lg border-slate-200 p-1 shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ketik kode, nama, atau barcode item..."
              className="w-full bg-transparent pl-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />
          </div>

          <div className="max-h-44 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400">Tidak ada item ditemukan</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.item_code}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={`flex w-full flex-col rounded px-2.5 py-1.5 text-left hover:bg-blue-50 dark:hover:bg-slate-800 ${
                    value === opt.item_code ? "bg-blue-50 text-blue-600 dark:bg-slate-800 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-xs">
                    <span>{opt.item_code}</span>
                    <span className="text-[11px] font-normal text-slate-500">{opt.uom || "Nos"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate max-w-[200px]">{opt.item_name}</span>
                    {opt.rate > 0 && (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {money(opt.rate)}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
            <a
              href="/desk/item/new"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800"
            >
              <Plus className="size-3.5" />
              <span>+ Tambah Item Baru</span>
              <ExternalLink className="ml-auto size-3 opacity-60" />
            </a>
          </div>
        </PopoverContent>
      </div>
    </Popover>
  );
}

/* =========================================================================
   FORM PAGE
   ========================================================================= */
export default function SalesInvoiceFormPage() {
  // This page is mounted through `sales-invoice/*`; React Router stores the
  // document id in the wildcard param rather than `params.id`.
  const routeParams = useParams<{ id?: string; "*"?: string }>();
  const id = routeParams.id || routeParams["*"]?.split("/").filter(Boolean).pop();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-sales-invoice");
  const deliveryNoteID = params.get("delivery_note_id") || "";
  const salesOrderID = params.get("sales_order_id") || "";
  const returnAgainst = params.get("return_against") || "";

  const [tab, setTab] = useState<string>("details");
  const [row, setRow] = useState<SalesInvoice>(emptyInvoice());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([
    "",
    "",
    "Stores - MC",
  ]);

  const [options, setOptions] = useState<SalesInvoiceOptions>({
    naming_series: ["ACC-SINV-.YYYY.-", "ACC-SINV-RET-.YYYY.-"],
    companies: [],
    warehouses: [""],
    customers: [""],
    currencies: ["IDR", "USD", "SGD", "EUR"],
    tax_categories: ["In State", "Out of State", "Export"],
    taxes_templates: ["PPN 11%", "PPN 12%", "Exempt Tax"],
    shipping_rules: ["Standard Delivery", "Express Delivery", "Free Shipping"],
    incoterms: ["EXW", "FOB", "CIF", "DDP"],
    apply_discount_on: ["Grand Total", "Net Total"],
    cost_centers: ["Main - PZTS", "Sales - PZTS"],
    projects: ["Internal Project", "Customer Delivery"],
  });

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [opts, compList, whList, custList] = await Promise.all([
          salesInvoiceApi.options(),
          warehouseApi.listCompanies(),
          warehouseApi.list(),
          customerApi.list().catch(() => [] as Customer[]),
        ]);
        if (opts) setOptions(opts);
        if (compList && compList.length > 0) setCompanies(compList);
        
        const whOptions: string[] = [];
        if (whList && whList.length > 0) {
          whOptions.push(...whList.map((w) => w.warehouse_name));
        }
        if (opts?.warehouses && opts.warehouses.length > 0) {
          opts.warehouses.forEach((w) => {
            if (!whOptions.includes(w)) whOptions.push(w);
          });
        }
        if (whOptions.length > 0) {
          setWarehouses(whOptions);
        }
        if (custList && custList.length > 0) setCustomers(custList);

        if (!isNew && id) {
          const loaded = await salesInvoiceApi.get(id);
          setRow(calculateTotals(loaded));
        } else if (returnAgainst) {
          const source = await salesInvoiceApi.get(returnAgainst);
          setRow(
            calculateTotals({
              ...source,
              id: undefined,
              number: undefined,
              status: "Draft",
              is_return: true,
              naming_series: "ACC-SINV-RET-.YYYY.-",
              return_against_id: source.id,
              return_reason: "",
              is_paid: false,
              refund_status: source.is_paid ? "Pending Refund" : "Credit Available",
              posting_date: today(),
              posting_time: nowTime(),
              items: source.items.map((item) => ({
                ...item,
                id: undefined,
                against_item_id: item.id,
                quantity: Math.min(1, Math.abs(item.quantity)),
              })),
            })
          );
        } else if (deliveryNoteID) {
          const delivery = await stockApi.deliveryNoteGet(deliveryNoteID);
          setRow(
            calculateTotals({
              ...emptyInvoice(),
              customer: delivery.customer,
              company: delivery.company,
              delivery_note_id: delivery.id,
              sales_order_id: delivery.sales_order_id,
              items: delivery.items.map((item) => ({
                item_code: item.item_code,
                item_name: item.item_name,
                warehouse: item.warehouse || "",
                quantity: item.quantity,
                uom: item.uom,
                rate: item.rate,
                amount: item.amount,
              })),
            })
          );
        } else if (salesOrderID) {
          const soRes = await api.get<{ data: any } | any>(`/crm/sales-orders/${salesOrderID}`);
          const soData = soRes?.data?.data || soRes?.data || {};
          setRow(
            calculateTotals({
              ...emptyInvoice(),
              customer: soData.customer || "",
              company: soData.company || "",
              sales_order_id: soData.id || salesOrderID,
              currency: soData.currency || "IDR",
              items: (soData.items || []).map((item: any) => ({
                item_code: item.item_code,
                item_name: item.item_name || "",
                warehouse: item.warehouse || "",
                quantity: item.quantity || 1,
                uom: item.uom || "Nos",
                rate: item.rate || 0,
                amount: item.amount || (item.quantity || 1) * (item.rate || 0),
              })),
            })
          );
        }
      } catch {
        toast.error("Gagal memuat form Sales Invoice");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isNew, deliveryNoteID, salesOrderID, returnAgainst]);

  const update = <K extends keyof SalesInvoice>(key: K, value: SalesInvoice[K]) =>
    setRow((previous) => calculateTotals({ ...previous, [key]: value }));

  const updateItem = (index: number, patch: Partial<SalesInvoiceItem>) =>
    update(
      "items",
      row.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );

  const addItem = () => update("items", [...row.items, emptyItem()]);
  const removeItem = (index: number) => {
    if (row.items.length <= 1) return toast.error("Minimal harus ada 1 item");
    update("items", row.items.filter((_, i) => i !== index));
  };

  const handleCustomerSelect = (customerName: string) => {
    const cust = customers.find((c) => c.customer_name.toLowerCase() === customerName.toLowerCase());
    setRow((prev) => {
      const updated: SalesInvoice = {
        ...prev,
        customer: customerName,
      };
      if (cust) {
        if (cust.address && !prev.customer_address) updated.customer_address = cust.address;
        if (cust.territory && (!prev.territory || prev.territory === "Indonesia")) updated.territory = cust.territory;
        if ((cust.phone || cust.email) && !prev.contact_person) updated.contact_person = cust.phone || cust.email;
      }
      return calculateTotals(updated);
    });
  };

  const handlePostingDateChange = (dateVal: string) => {
    setRow((prev) => {
      const updated: SalesInvoice = {
        ...prev,
        posting_date: dateVal,
        due_date: addDays(dateVal, 7),
      };
      return calculateTotals(updated);
    });
  };

  const isReadonly = row.status !== "Draft";

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = (row.scan_barcode || "").trim();
      if (!code) return;

      const foundOpt = (options.items || []).find(
        (it) =>
          it.item_code.toLowerCase() === code.toLowerCase() ||
          (it.barcode && it.barcode.toLowerCase() === code.toLowerCase())
      );

      const itemCodeToMatch = foundOpt ? foundOpt.item_code : code;
      const matchIdx = row.items.findIndex(
        (it) => it.item_code.toLowerCase() === itemCodeToMatch.toLowerCase()
      );

      if (matchIdx >= 0) {
        updateItem(matchIdx, { quantity: (row.items[matchIdx].quantity || 0) + 1 });
        toast.success(`Item ${itemCodeToMatch} quantity +1`);
      } else {
        update("items", [
          ...row.items,
          {
            item_code: itemCodeToMatch,
            item_name: foundOpt ? foundOpt.item_name : code,
            warehouse: warehouses[0] || "",
            quantity: 1,
            uom: foundOpt?.uom || "Nos",
            rate: foundOpt?.rate || 0,
            amount: foundOpt?.rate || 0,
          },
        ]);
        toast.success(`Item ${foundOpt ? foundOpt.item_name : itemCodeToMatch} ditambahkan`);
      }
      update("scan_barcode", "");
    }
  };

  const save = async () => {
    if (!row.customer.trim()) return toast.error("Customer wajib diisi");
    if (!row.company.trim()) return toast.error("Company wajib diisi");
    if (row.items.some((it) => !it.item_code.trim() || Math.abs(it.quantity) <= 0)) {
      return toast.error("Item code dan quantity wajib valid");
    }

    setSaving(true);
    try {
      const payload = calculateTotals(row);
      if (!payload.due_date) {
        payload.due_date = addDays(payload.posting_date || today(), 7);
      }
      const saved =
        isNew && returnAgainst
          ? await salesInvoiceApi.createReturn(returnAgainst, {
              reason: row.return_reason || "",
              items: row.items.map((item) => ({
                against_item_id: item.against_item_id || "",
                quantity: Math.abs(item.quantity),
              })),
            })
          : isNew
          ? await salesInvoiceApi.create(payload)
          : await salesInvoiceApi.update(id!, payload);

      setRow(calculateTotals(saved));
      toast.success(saved.is_return ? "Credit Note berhasil dibuat" : "Sales Invoice berhasil disimpan");
      if (isNew && saved.id) navigate(`/desk/sales-invoice/${saved.id}`, { replace: true });
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal menyimpan Sales Invoice");
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!id) return;
    try {
      setRow(calculateTotals(await salesInvoiceApi.submit(id)));
      toast.success("Sales Invoice Submitted");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal submit dokumen");
    }
  };

  const cancel = async () => {
    if (!id || !window.confirm("Cancel Sales Invoice ini?")) return;
    try { setRow(calculateTotals(await salesInvoiceApi.cancel(id))); toast.success("Sales Invoice Cancelled"); }
    catch (error: any) { toast.error(error?.response?.data?.error || "Gagal cancel dokumen"); }
  };

  const amend = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const amended = await salesInvoiceApi.create({ ...row, id: undefined, number: undefined, status: "Draft", amended_from: id, amendment_no: (row.amendment_no || 0) + 1 });
      toast.success("Amendment Sales Invoice dibuat sebagai Draft");
      navigate(`/desk/sales-invoice/${amended.id}`, { replace: true });
      setRow(calculateTotals(amended));
    } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal membuat amendment"); }
    finally { setSaving(false); }
  };

  const markPaid = async () => {
    if (!id) return;
    try {
      setRow(calculateTotals(await salesInvoiceApi.markPaid(id)));
      toast.success("Payment Entry dicatat sebagai lunas");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal mencatat pembayaran");
    }
  };

  const refund = async () => {
    if (!id) return;
    const reference = window.prompt("Referensi refund bank/payment gateway:", row.refund_reference || "");
    if (reference == null) return;
    try {
      setRow(calculateTotals(await salesInvoiceApi.refund(id, reference)));
      toast.success("Refund berhasil dicatat");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal mencatat refund");
    }
  };

  const remove = async () => {
    if (!id || !window.confirm("Hapus draft ini?")) return;
    try {
      await salesInvoiceApi.remove(id);
      navigate("/desk/sales-invoice");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal menghapus draft");
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Memuat data Sales Invoice...</div>;
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Top Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">Selling</Link>
            <span>/</span>
            <Link to="/desk/sales-invoice" className="hover:text-blue-600">Sales Invoice</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? (row.is_return ? "New Credit Note" : "New Sales Invoice") : row.number}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? (row.is_return ? "New Credit Note" : "New Sales Invoice") : row.number}
            </h1>
            <Badge variant={row.status === "Submitted" ? "default" : "secondary"}>
              {isNew ? "Not Saved" : row.status}
            </Badge>
            {row.is_return && (
              <Badge className="bg-amber-100 text-amber-700">{row.refund_status}</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/desk/sales-invoice">
              <ArrowLeft className="mr-2 size-4" /> Kembali
            </Link>
          </Button>

          {!isNew && row.status === "Submitted" && !row.is_return && (
            <>
              <Button
                variant="outline"
                onClick={() => navigate(`/desk/sales-invoice/new?return_against=${row.id}`)}
              >
                <RotateCcw className="mr-2 size-4" /> Create Return
              </Button>
              {row.delivery_note_id && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(`/desk/delivery-note/new?return_against=${row.delivery_note_id}`)
                  }
                >
                  <Warehouse className="mr-2 size-4" /> Return Stock
                </Button>
              )}
              {!row.is_paid && (
                <Button variant="outline" onClick={markPaid}>
                  <Banknote className="mr-2 size-4" /> Mark Paid
                </Button>
              )}
            </>
          )}

          {!isNew && row.status === "Submitted" && row.is_return && row.refund_status === "Pending Refund" && (
            <Button variant="outline" onClick={refund}>
              <Banknote className="mr-2 size-4" /> Record Refund
            </Button>
          )}

          {false && !isNew && row.status === "Draft" && (
            <>
              <Button variant="outline" onClick={submit}>
                <CheckCircle2 className="mr-2 size-4" /> Submit
              </Button>
              <Button variant="outline" onClick={remove}>
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </>
          )}

          {false && (isNew || (row.status === "Draft" && !row.is_return)) && (
            <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              <Save className="mr-2 size-4" /> {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </header>

      <DocumentActionBar document={{ id: id || "", document_no: row.number || "", doc_status: docStatusFromLegacy(row.status), version: (row.amendment_no || 0) + 1 }} action={saving ? "save" : null} onSave={save} onSubmit={submit} onCancel={cancel} onAmend={amend} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <div className="border-b bg-white px-5 rounded-2xl shadow-sm dark:bg-slate-950">
          <TabsList className="bg-transparent h-12 gap-6 p-0">
            <TabsTrigger
              value="details"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Payments
            </TabsTrigger>
            <TabsTrigger
              value="address"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Address & Contact
            </TabsTrigger>
            <TabsTrigger
              value="terms"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Terms
            </TabsTrigger>
            <TabsTrigger
              value="more_info"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              More Info
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Details */}
        <TabsContent value="details" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Company <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <CompanySelect
                    value={row.company}
                    disabled={isReadonly}
                    onChange={(val) => update("company", val)}
                    placeholder="Pilih Company..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Series
                </label>
                <select
                  value={row.naming_series}
                  disabled={isReadonly}
                  onChange={(e) => update("naming_series", e.target.value)}
                  className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                >
                  {options.naming_series.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={row.customer}
                    disabled={isReadonly}
                    options={(customers.length > 0
                      ? customers.map((c) => ({
                          value: c.customer_name,
                          label: c.customer_name,
                          sublabel: c.email || c.phone || c.territory || undefined,
                          badge: c.customer_group || undefined,
                        }))
                      : options.customers.map((name) => ({ value: name, label: name }))
                    )}
                    onSearch={async (query) => {
                      try {
                        const searchResult = await customerApi.list(query);
                        return searchResult.map((c) => ({
                          value: c.customer_name,
                          label: c.customer_name,
                          sublabel: c.email || c.phone || c.territory || undefined,
                          badge: c.customer_group || undefined,
                        }));
                      } catch {
                        return [];
                      }
                    }}
                    onChange={(val) => handleCustomerSelect(val)}
                    placeholder="Pilih Customer..."
                    searchPlaceholder="Cari customer dari database..."
                    addNewLabel="Buat Customer Baru"
                    addNewHref="/desk/customer/new"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Posting Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={row.posting_date?.slice(0, 10)}
                  disabled={isReadonly}
                  onChange={(e) => handlePostingDateChange(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Posting Time
                </label>
                <Input
                  type="time"
                  value={row.posting_time || nowTime()}
                  disabled={isReadonly || !row.set_posting_time}
                  onChange={(e) => update("posting_time", e.target.value)}
                  className="mt-1"
                />
                <label className="flex items-center gap-1.5 mt-1 text-xs cursor-pointer text-slate-500">
                  <Checkbox
                    checked={row.set_posting_time}
                    disabled={isReadonly}
                    onCheckedChange={(c) => update("set_posting_time", !!c)}
                  />
                  Edit Posting Date and Time
                </label>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Payment Due Date
                </label>
                <Input
                  type="date"
                  value={row.due_date ? row.due_date.slice(0, 10) : ""}
                  disabled={isReadonly}
                  onChange={(e) => update("due_date", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="grid gap-3 pt-3 sm:grid-cols-4 border-t">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.is_pos}
                  disabled={isReadonly}
                  onCheckedChange={(c) => update("is_pos", !!c)}
                />
                Include Payment (POS)
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.is_return}
                  disabled={isReadonly}
                  onCheckedChange={(c) => update("is_return", !!c)}
                />
                Is Return (Credit Note)
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.is_debit_note}
                  disabled={isReadonly}
                  onCheckedChange={(c) => update("is_debit_note", !!c)}
                />
                Is Rate Adjustment Entry (Debit Note)
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.apply_tds}
                  disabled={isReadonly}
                  onCheckedChange={(c) => update("apply_tds", !!c)}
                />
                Consider for Tax Withholding
              </label>
            </div>

            {/* Accounting Dimensions */}
            <div className="pt-3 border-t grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cost Center
                </label>
                <select
                  value={row.cost_center || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("cost_center", e.target.value)}
                  className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                >
                  <option value="">Pilih Cost Center...</option>
                  {options.cost_centers.map((cc) => (
                    <option key={cc} value={cc}>
                      {cc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Project
                </label>
                <select
                  value={row.project || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("project", e.target.value)}
                  className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                >
                  <option value="">Pilih Project...</option>
                  {options.projects.map((pr) => (
                    <option key={pr} value={pr}>
                      {pr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="min-w-0 max-w-full rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
                  Items
                </h3>
                <p className="text-xs text-slate-500">
                  Barang atau jasa yang ditagihkan kepada customer.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                  <Checkbox
                    checked={row.update_stock}
                    disabled={isReadonly}
                    onCheckedChange={(c) => update("update_stock", !!c)}
                  />
                  Update Stock
                </label>
                {!isReadonly && (
                  <Button size="sm" onClick={addItem} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-1.5 size-3.5" /> Add Row
                  </Button>
                )}
              </div>
            </div>

            {/* Barcode scanner */}
            {!isReadonly && (
              <div className="flex items-center gap-2 max-w-md">
                <ScanBarcode className="size-4 text-blue-600" />
                <Input
                  value={row.scan_barcode || ""}
                  onChange={(e) => update("scan_barcode", e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  placeholder="Scan Barcode / ketik kode item lalu Enter..."
                  className="text-xs h-8"
                />
              </div>
            )}

            <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No.</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Item Code & Name</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Warehouse</th>
                    <th className="py-2.5 px-3 w-24 text-right">Quantity</th>
                    <th className="py-2.5 px-3 w-20">Unit</th>
                    <th className="py-2.5 px-3 w-32 text-right">Rate (IDR)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Amount (IDR)</th>
                    {!isReadonly && <th className="py-2.5 px-3 w-12 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {row.items.length === 0 ? (
                    <tr>
                      <td colSpan={isReadonly ? 7 : 8} className="py-8 text-center text-slate-400">
                        Tidak ada detail item yang tercatat pada Sales Invoice ini.
                      </td>
                    </tr>
                  ) : (
                    row.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          {isReadonly ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">{it.item_code}</div>
                              {it.item_name && (
                                <div className="text-[11px] text-slate-500 truncate max-w-[280px]">
                                  {it.item_name}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <SearchableItemSelect
                                value={it.item_code}
                                itemOptions={options.items || []}
                                disabled={isReadonly}
                                onChange={(opt) => {
                                  const qty = Math.abs(it.quantity) || 1;
                                  updateItem(idx, {
                                    item_code: opt.item_code,
                                    item_name: opt.item_name,
                                    uom: opt.uom || it.uom || "Nos",
                                    rate: opt.rate,
                                    amount: qty * opt.rate,
                                  });
                                }}
                              />
                              <Input
                                value={it.item_name || ""}
                                disabled={isReadonly}
                                onChange={(e) => updateItem(idx, { item_name: e.target.value })}
                                placeholder="Deskripsi/nama item..."
                                className="h-7 text-[11px] text-slate-500"
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {isReadonly ? (
                            <span className="text-slate-700 dark:text-slate-300">{it.warehouse || "-"}</span>
                          ) : (
                            <SearchableWarehouseSelect
                              value={it.warehouse || ""}
                              warehouses={warehouses}
                              disabled={isReadonly}
                              onChange={(wh) => updateItem(idx, { warehouse: wh })}
                            />
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {isReadonly ? (
                            <div className="text-right font-semibold text-slate-900 dark:text-slate-100 font-mono">
                              {Math.abs(it.quantity)}
                            </div>
                          ) : (
                            <Input
                              type="number"
                              step="any"
                              value={Math.abs(it.quantity)}
                              disabled={isReadonly}
                              onChange={(e) =>
                                updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })
                              }
                              className="h-8 text-xs text-right font-medium"
                            />
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {isReadonly ? (
                            <span className="text-slate-600 dark:text-slate-400">{it.uom || "Nos"}</span>
                          ) : (
                            <Input
                              value={it.uom}
                              disabled={isReadonly}
                              onChange={(e) => updateItem(idx, { uom: e.target.value })}
                              className="h-8 text-xs"
                            />
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {isReadonly ? (
                            <div className="text-right text-slate-700 dark:text-slate-300 font-mono">
                              {money(it.rate)}
                            </div>
                          ) : (
                            <Input
                              type="number"
                              step="any"
                              value={it.rate}
                              disabled={isReadonly}
                              onChange={(e) =>
                                updateItem(idx, { rate: parseFloat(e.target.value) || 0 })
                              }
                              className="h-8 text-xs text-right font-medium"
                            />
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {money(it.amount)}
                        </td>
                        {!isReadonly && (
                          <td className="py-2.5 px-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-rose-500 hover:bg-rose-50"
                              disabled={row.items.length === 1}
                              onClick={() => removeItem(idx)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-slate-50 font-semibold dark:bg-slate-900/50">
                    <td colSpan={3} className="py-2.5 px-3 text-right">
                      Total Quantity: {row.total_qty}
                    </td>
                    <td colSpan={3} className="py-2.5 px-3 text-right">
                      Total Net:
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-blue-600">
                      {money(row.net_total)}
                    </td>
                    {!isReadonly && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Taxes and Charges & Additional Discount */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Taxes and Charges */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
                Taxes and Charges
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tax Category
                  </label>
                  <select
                    value={row.tax_category || ""}
                    disabled={isReadonly}
                    onChange={(e) => update("tax_category", e.target.value)}
                    className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                  >
                    <option value="">Pilih Tax Category...</option>
                    {options.tax_categories.map((tc) => (
                      <option key={tc} value={tc}>
                        {tc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tax Template
                  </label>
                  <select
                    value={row.taxes_and_charges || ""}
                    disabled={isReadonly}
                    onChange={(e) => {
                      const val = e.target.value;
                      const rate = val.includes("11") ? 11 : val.includes("12") ? 12 : 0;
                      setRow((prev) =>
                        calculateTotals({
                          ...prev,
                          taxes_and_charges: val,
                          tax_rate: rate,
                        })
                      );
                    }}
                    className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                  >
                    <option value="">Pilih Template Pajak...</option>
                    {options.taxes_templates.map((tt) => (
                      <option key={tt} value={tt}>
                        {tt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tax Rate (%)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={row.tax_rate}
                    disabled={isReadonly}
                    onChange={(e) => update("tax_rate", parseFloat(e.target.value) || 0)}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Total Taxes and Charges (IDR)
                  </label>
                  <div className="mt-1 p-2 border rounded-md font-semibold text-xs bg-slate-50 dark:bg-slate-900">
                    {money(row.tax_amount)}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Shipping Rule
                  </label>
                  <select
                    value={row.shipping_rule || ""}
                    disabled={isReadonly}
                    onChange={(e) => update("shipping_rule", e.target.value)}
                    className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                  >
                    <option value="">Pilih Shipping Rule...</option>
                    {options.shipping_rules.map((sr) => (
                      <option key={sr} value={sr}>
                        {sr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Incoterm
                  </label>
                  <select
                    value={row.incoterm || ""}
                    disabled={isReadonly}
                    onChange={(e) => update("incoterm", e.target.value)}
                    className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                  >
                    <option value="">Pilih Incoterm...</option>
                    {options.incoterms.map((inc) => (
                      <option key={inc} value={inc}>
                        {inc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Discount & Totals */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
                Additional Discount & Totals
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Apply Discount On
                  </label>
                  <select
                    value={row.apply_discount_on || "Grand Total"}
                    disabled={isReadonly}
                    onChange={(e) => update("apply_discount_on", e.target.value)}
                    className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                  >
                    <option value="Grand Total">Grand Total</option>
                    <option value="Net Total">Net Total</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Coupon Code
                  </label>
                  <Input
                    value={row.coupon_code || ""}
                    disabled={isReadonly}
                    onChange={(e) => update("coupon_code", e.target.value)}
                    placeholder="e.g. PROMO2026"
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Discount Percentage (%)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={row.additional_discount_percentage || 0}
                    disabled={isReadonly}
                    onChange={(e) =>
                      update("additional_discount_percentage", parseFloat(e.target.value) || 0)
                    }
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Discount Amount (IDR)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={row.discount_amount || 0}
                    disabled={isReadonly}
                    onChange={(e) =>
                      update("discount_amount", parseFloat(e.target.value) || 0)
                    }
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              {/* Final Totals summary */}
              <div className="mt-4 rounded-xl bg-slate-50 p-4 space-y-2 border dark:bg-slate-900 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Net Total:</span>
                  <span className="font-semibold">{money(row.net_total)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Taxes and Charges:</span>
                  <span className="font-semibold">{money(row.tax_amount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Rounding Adjustment:</span>
                  <span className="font-semibold">{money(row.rounding_adjustment)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-blue-600 border-t pt-2">
                  <span>Grand Total:</span>
                  <span>{money(row.grand_total)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm border-t pt-2 text-slate-900 dark:text-slate-100">
                  <span>Outstanding Amount:</span>
                  <span className={row.outstanding_amount > 0 ? "text-rose-600" : "text-emerald-600"}>
                    {money(row.outstanding_amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Payments */}
        <TabsContent value="payments" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Advance Payments
            </h3>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={row.allocate_advances_automatically}
                disabled={isReadonly}
                onCheckedChange={(c) => update("allocate_advances_automatically", !!c)}
              />
              <span className="text-xs font-semibold">
                Allocate Advances Automatically (FIFO)
              </span>
            </div>

            <div className="rounded-xl border bg-slate-50/50 p-4 text-xs text-slate-500">
              Tidak ada uang muka (advance payment) pending yang dialokasikan pada invoice ini.
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Loyalty Points Redemption
            </h3>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={row.redeem_loyalty_points}
                disabled={isReadonly}
                onCheckedChange={(c) => update("redeem_loyalty_points", !!c)}
              />
              <span className="text-xs font-semibold">Redeem Loyalty Points</span>
            </div>

            {row.redeem_loyalty_points && (
              <div className="max-w-md mt-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Loyalty Program
                </label>
                <Input
                  value={row.loyalty_program || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("loyalty_program", e.target.value)}
                  placeholder="Nama program loyalty..."
                  className="mt-1 text-xs"
                />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Address & Contact */}
        <TabsContent value="address" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Billing Address & Contact
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer Address
                </label>
                <textarea
                  value={row.customer_address || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("customer_address", e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                  placeholder="Alamat penagihan pelanggan..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Contact Person
                </label>
                <Input
                  value={row.contact_person || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("contact_person", e.target.value)}
                  placeholder="Nama kontak PIC..."
                  className="mt-1 text-xs"
                />

                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-3 block">
                  Territory
                </label>
                <Input
                  value={row.territory || "Indonesia"}
                  disabled={isReadonly}
                  onChange={(e) => update("territory", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Shipping & Company Address
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Shipping Address Name
                </label>
                <Input
                  value={row.shipping_address_name || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("shipping_address_name", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Dispatch Address Name
                </label>
                <Input
                  value={row.dispatch_address_name || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("dispatch_address_name", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Company Address
                </label>
                <textarea
                  value={row.company_address || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("company_address", e.target.value)}
                  rows={2}
                  placeholder="Gg. Melati 08E Jl Kapten Haryadi, Sleman, Yogyakarta 55581"
                  className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Terms */}
        <TabsContent value="terms" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Payment Terms
            </h3>

            <div className="max-w-md">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Payment Terms Template
              </label>
              <Input
                value={row.payment_terms_template || ""}
                disabled={isReadonly}
                onChange={(e) => update("payment_terms_template", e.target.value)}
                placeholder="e.g. Net 30 Days"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Terms and Conditions
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Terms
                </label>
                <Input
                  value={row.tc_name || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("tc_name", e.target.value)}
                  placeholder="e.g. Garansi & Pengembalian"
                  className="mt-1 text-xs max-w-md"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Terms and Conditions Details
                </label>
                <textarea
                  value={row.terms_and_conditions || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("terms_and_conditions", e.target.value)}
                  rows={4}
                  placeholder="Detail klausul syarat & ketentuan transaksi..."
                  className="mt-1 w-full rounded-md border bg-white p-2.5 text-xs dark:bg-slate-900"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: More Info */}
        <TabsContent value="more_info" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Customer PO Details & Accounting
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer's Purchase Order
                </label>
                <Input
                  value={row.po_no || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("po_no", e.target.value)}
                  placeholder="PO-2026-XXXX"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer's PO Date
                </label>
                <Input
                  type="date"
                  value={row.po_date ? row.po_date.slice(0, 10) : ""}
                  disabled={isReadonly}
                  onChange={(e) => update("po_date", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Debit To
                </label>
                <Input
                  value={row.debit_to || "1310 - Piutang Usaha"}
                  disabled={isReadonly}
                  onChange={(e) => update("debit_to", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Commission & Sales Partner
            </h3>

            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Sales Partner
                </label>
                <Input
                  value={row.sales_partner || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("sales_partner", e.target.value)}
                  placeholder="Mitra Penjualan..."
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Amount Eligible for Commission
                </label>
                <Input
                  type="number"
                  step="any"
                  value={row.amount_eligible_for_commission || 0}
                  disabled={isReadonly}
                  onChange={(e) =>
                    update("amount_eligible_for_commission", parseFloat(e.target.value) || 0)
                  }
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Commission Rate (%)
                </label>
                <Input
                  type="number"
                  step="any"
                  value={row.commission_rate || 0}
                  disabled={isReadonly}
                  onChange={(e) => update("commission_rate", parseFloat(e.target.value) || 0)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Total Commission
                </label>
                <div className="mt-1 p-2 border rounded-md font-semibold text-xs bg-slate-50 dark:bg-slate-900">
                  {money(
                    ((row.amount_eligible_for_commission || 0) * (row.commission_rate || 0)) / 100
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Print Settings & UTM Analytics
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Letter Head
                </label>
                <Input
                  value={row.letter_head || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("letter_head", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Print Heading
                </label>
                <Input
                  value={row.select_print_heading || "Invoice"}
                  disabled={isReadonly}
                  onChange={(e) => update("select_print_heading", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Print Language
                </label>
                <Input
                  value={row.language || "English"}
                  disabled={isReadonly}
                  onChange={(e) => update("language", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  UTM Source
                </label>
                <Input
                  value={row.utm_source || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("utm_source", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  UTM Medium
                </label>
                <Input
                  value={row.utm_medium || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("utm_medium", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  UTM Campaign
                </label>
                <Input
                  value={row.utm_campaign || ""}
                  disabled={isReadonly}
                  onChange={(e) => update("utm_campaign", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
