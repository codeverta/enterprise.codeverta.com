import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Truck,
  ScanBarcode,
  Receipt,
  FileCheck,
  Building2,
  User,
  Percent,
  RotateCcw,
  Repeat2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { stockApi, type DeliveryNote, type DeliveryNoteItem, type DeliveryNoteTax, type DeliveryNoteOptions } from "../api";
import { toast } from "sonner";
import api from "@/lib/api";

type Tab = "details" | "items" | "taxes" | "totals" | "address" | "more";
type SalesOrderSource = { id: string; customer: string; items?: Array<{ item_code: string; item_name?: string; quantity: number; rate: number; amount: number }> };

const formatRp = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

const emptyNote = (): DeliveryNote => {
  const now = new Date();
  return {
    naming_series: "MAT-DN-.YYYY.-",
    status: "Draft",
    customer: "",
    posting_date: now.toISOString().slice(0, 10),
    posting_time: now.toTimeString().slice(0, 8),
    set_posting_time: false,
    company: "PT ZENIT TECHNOLOGY SOLUTION",
    is_return: false,

    set_warehouse: "Stores - PT ZENIT",
    tax_category: "In State",
    taxes_and_charges: "PPN 11%",
    shipping_rule: "Standard Delivery",
    incoterm: "EXW",

    total_qty: 0,
    total: 0,
    base_total_taxes_and_charges: 0,
    total_taxes_and_charges: 0,
    grand_total: 0,
    rounding_adjustment: 0,
    rounded_total: 0,

    apply_discount_on: "grand_total",
    additional_discount_percentage: 0,
    additional_discount_amount: 0,

    items: [
      { item_code: "ITEM-001", item_name: "Item Sample A", quantity: 1, uom: "Nos", rate: 0, amount: 0, warehouse: "Stores - PT ZENIT" },
    ],
    taxes: [],
  };
};

export default function DeliveryNoteFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === "new";

  const [tab, setTab] = useState<Tab>("details");
  const [row, setRow] = useState<DeliveryNote>(emptyNote());
  const [options, setOptions] = useState<DeliveryNoteOptions>({
    naming_series: ["MAT-DN-.YYYY.-", "MAT-DN-RET-.YYYY.-"],
    companies: ["PT ZENIT TECHNOLOGY SOLUTION"],
    warehouses: ["Stores - PT ZENIT", "Finished Goods - PT ZENIT"],
    tax_categories: ["In State", "Out of State", "Export"],
    taxes_templates: ["PPN 11%", "PPN 12%", "Exempt Tax"],
    shipping_rules: ["Standard Delivery", "Express Delivery", "Free Shipping"],
    incoterms: ["EXW", "FOB", "CIF", "DDP"],
  });
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
	const returnAgainst = searchParams.get("return_against") || "";
	const replacementFor = searchParams.get("replacement_for") || "";

  useEffect(() => {
    stockApi.deliveryNoteOptions().then(setOptions).catch(() => {});

    if (isNew) {
      if (returnAgainst || replacementFor) {
        setLoading(true);
        stockApi.deliveryNoteGet(returnAgainst || replacementFor).then((source) => {
          const isReturn = Boolean(returnAgainst);
          setRow(calculateTotals({
            ...emptyNote(),
            customer: source.customer,
            company: source.company,
            sales_order_id: source.sales_order_id,
            set_warehouse: source.set_warehouse,
            is_return: isReturn,
            return_against_id: returnAgainst || undefined,
            replacement_for_id: replacementFor || undefined,
            naming_series: isReturn ? "MAT-DN-RET-.YYYY.-" : "MAT-DN-.YYYY.-",
            items: (source.items || []).map((item) => ({
              item_code: item.item_code,
              item_name: item.item_name,
              quantity: Math.min(1, Math.abs(item.quantity)),
              uom: item.uom,
              rate: item.rate,
              amount: item.rate,
              warehouse: item.warehouse || source.set_warehouse,
              against_item_id: isReturn ? item.id : undefined,
            })),
            taxes: isReturn ? source.taxes || [] : [],
          }));
        }).catch(() => {
          toast.error("Dokumen asal return tidak ditemukan");
          navigate("/desk/delivery-note");
        }).finally(() => setLoading(false));
        return;
      }
      // Check if coming from Sales Order
      const customerParam = searchParams.get("customer");
      const soParam = searchParams.get("sales_order_id");
      if (soParam) {
        setLoading(true);
        api.get<SalesOrderSource>(`/crm/sales-orders/${soParam}`).then(({ data: source }) => {
          setRow((previous) => calculateTotals({
            ...previous,
            customer: source.customer || customerParam || previous.customer,
            sales_order_id: source.id,
            items: (source.items || []).map((item) => ({
              item_code: item.item_code,
              item_name: item.item_name,
              quantity: item.quantity,
              uom: "Nos",
              rate: item.rate,
              amount: item.amount,
              warehouse: previous.set_warehouse,
            })),
          }));
        }).catch(() => {
          toast.error("Detail item Sales Order tidak dapat dimuat");
          setRow((previous) => ({ ...previous, customer: customerParam || previous.customer, sales_order_id: soParam }));
        }).finally(() => setLoading(false));
        return;
      }
      if (customerParam) {
        setRow((prev) => ({
          ...prev,
          customer: customerParam,
        }));
      }
    } else if (id) {
      stockApi
        .deliveryNoteGet(id)
        .then((v) => {
          setRow({
            ...v,
            items: v.items || [],
            taxes: v.taxes || [],
          });
        })
        .catch(() => {
          toast.error("Delivery Note tidak ditemukan");
          navigate("/desk/delivery-note");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate, searchParams, returnAgainst, replacementFor]);

  // Recalculate totals
  const calculateTotals = (updated: DeliveryNote): DeliveryNote => {
    let totalQty = 0;
    let subtotal = 0;
    const items = updated.items.map((it) => {
      const qty = it.quantity > 0 ? it.quantity : 1;
      const amt = qty * (it.rate || 0);
      totalQty += qty;
      subtotal += amt;
      return { ...it, quantity: qty, amount: amt };
    });

    let taxTotal = 0;
    const taxes = updated.taxes.map((t) => {
      const taxAmt = t.rate > 0 ? (subtotal * t.rate) / 100 : t.tax_amount || 0;
      taxTotal += taxAmt;
      return { ...t, net_amount: subtotal, tax_amount: taxAmt, total: subtotal + taxAmt };
    });

    let grandTotal = subtotal + taxTotal;
    let discAmt = updated.additional_discount_amount || 0;
    if (updated.additional_discount_percentage > 0) {
      discAmt = (grandTotal * updated.additional_discount_percentage) / 100;
    }
    grandTotal -= discAmt;
    if (grandTotal < 0) grandTotal = 0;

    const rounded = Math.round(grandTotal);

    return {
      ...updated,
      items,
      taxes,
      total_qty: totalQty,
      total: subtotal,
      base_total_taxes_and_charges: taxTotal,
      total_taxes_and_charges: taxTotal,
      additional_discount_amount: discAmt,
      grand_total: grandTotal,
      rounding_adjustment: rounded - grandTotal,
      rounded_total: rounded,
    };
  };

  const update = <K extends keyof DeliveryNote>(key: K, value: DeliveryNote[K]) => {
    setRow((prev) => calculateTotals({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!row.customer.trim()) {
      return toast.error("Customer wajib diisi");
    }
    setSaving(true);
    try {
      const saved = isNew && returnAgainst
        ? await stockApi.deliveryNoteCreateReturn(returnAgainst, {
            reason: row.return_reason || "",
            items: row.items.map((item) => ({ against_item_id: item.against_item_id || "", quantity: item.quantity })),
          })
        : isNew ? await stockApi.deliveryNoteCreate(row) : await stockApi.deliveryNoteUpdate(id!, row);
      toast.success("Delivery Note berhasil disimpan");
      setRow(saved);
      if (isNew && saved.id) {
        navigate(`/desk/delivery-note/${saved.id}`, { replace: true });
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menyimpan Delivery Note");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitDoc = async () => {
    if (!id || isNew) return;
    try {
      const saved = await stockApi.deliveryNoteSubmit(id);
      toast.success("Delivery Note submitted");
      setRow(saved);
    } catch {
      toast.error("Gagal submit Delivery Note");
    }
  };

  // Flow Integration: Create Shipment
  const handleCreateShipment = () => {
    const dnNumber = row.number || "MAT-DN-2026-00001";
    navigate(`/desk/shipment/new?delivery_note=${encodeURIComponent(dnNumber)}&customer=${encodeURIComponent(row.customer)}&value=${row.grand_total}`);
  };

  // Flow Integration: Create Sales Invoice
  const handleCreateSalesInvoice = () => {
    navigate(`/desk/sales-invoice/new?delivery_note_id=${encodeURIComponent(row.id || "")}`);
  };

  // Item Table handlers
  const addItemRow = () => {
    const newItems: DeliveryNoteItem[] = [
      ...row.items,
      { item_code: "", item_name: "", quantity: 1, uom: "Nos", rate: 0, amount: 0, warehouse: row.set_warehouse },
    ];
    update("items", newItems);
  };

  const updateItemRow = (index: number, key: keyof DeliveryNoteItem, val: any) => {
    const updated = row.items.map((it, i) => (i === index ? { ...it, [key]: val } : it));
    update("items", updated);
  };

  const removeItemRow = (index: number) => {
    update("items", row.items.filter((_, i) => i !== index));
  };

  const handleScanBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;
    const code = barcodeQuery.trim().toUpperCase();
    const existingIndex = row.items.findIndex((it) => it.item_code.toUpperCase() === code);
    if (existingIndex >= 0) {
      updateItemRow(existingIndex, "quantity", row.items[existingIndex].quantity + 1);
      toast.success(`Quantity untuk ${code} ditambah 1`);
    } else {
      const newItems = [
        ...row.items,
        { item_code: code, item_name: code, quantity: 1, uom: "Nos", rate: 0, amount: 0, warehouse: row.set_warehouse },
      ];
      update("items", newItems);
      toast.success(`Item ${code} ditambahkan`);
    }
    setBarcodeQuery("");
  };

  // Tax Table handlers
  const addTaxRow = () => {
    const newTaxes: DeliveryNoteTax[] = [
      ...row.taxes,
      { charge_type: "On Net Total", account_head: "411000 - PPN Keluaran", rate: 11, net_amount: row.total, tax_amount: 0, total: 0 },
    ];
    update("taxes", newTaxes);
  };

  const updateTaxRow = (index: number, key: keyof DeliveryNoteTax, val: any) => {
    const updated = row.taxes.map((t, i) => (i === index ? { ...t, [key]: val } : t));
    update("taxes", updated);
  };

  const removeTaxRow = (index: number) => {
    update("taxes", row.taxes.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Memuat Delivery Note...</div>;
  }

  const tabs: Array<[Tab, string]> = [
    ["details", "Details"],
    ["items", "Items"],
    ["taxes", "Taxes & Charges"],
    ["totals", "Totals & Discount"],
    ["address", "Address & Contact"],
    ["more", "More Info"],
  ];

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/desk/delivery-note">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <p className="text-sm text-slate-500">Stock / Delivery Note</p>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{isNew ? "New Delivery Note" : row.number}</h1>
              <Badge variant={row.status === "Submitted" ? "default" : "secondary"}>
                {isNew ? "Not Saved" : row.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isNew && (
            <>
              {row.status === "Submitted" && !row.is_return && <Button variant="outline" onClick={() => navigate(`/desk/delivery-note/new?return_against=${encodeURIComponent(row.id || "")}`)} className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-slate-900">
                <RotateCcw className="mr-1 size-4" /> Create Return
              </Button>}
              {row.status === "Submitted" && row.is_return && <Button variant="outline" onClick={() => navigate(`/desk/delivery-note/new?replacement_for=${encodeURIComponent(row.id || "")}`)} className="border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-slate-900">
                <Repeat2 className="mr-1 size-4" /> Create Replacement
              </Button>}
              {!row.is_return && <Button variant="outline" onClick={handleCreateShipment} className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-slate-900">
                <Truck className="mr-1 size-4" /> Create Shipment
              </Button>}
              {row.status === "Submitted" && !row.is_return && <Button variant="outline" onClick={handleCreateSalesInvoice} className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-slate-900">
                <Receipt className="mr-1 size-4" /> Create Sales Invoice
              </Button>}
            </>
          )}

          {!isNew && row.status === "Draft" && (
            <Button variant="outline" onClick={handleSubmitDoc}>
              <CheckCircle2 className="mr-2 size-4 text-emerald-600" /> Submit
            </Button>
          )}
          {(isNew || (row.status === "Draft" && !row.is_return)) && <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 size-4" />
            {saving ? "Saving..." : "Save"}
          </Button>}
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">
            {tabs.map(([v, l]) => (
              <TabsTrigger
                key={v}
                value={v}
                className="rounded-none px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:font-semibold"
              >
                {l}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* TAB 1: DETAILS */}
          <TabsContent value="details" className="space-y-6 p-5 lg:p-7">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Series</label>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                  value={row.naming_series}
                  onChange={(e) => update("naming_series", e.target.value)}
                >
                  {options.naming_series.map((ns) => (
                    <option key={ns} value={ns}>
                      {ns}
                    </option>
                  ))}
                </select>
              </div>

              {row.is_return && <div className="md:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">Return Against</label>
                <Input value={row.return_against_id || ""} readOnly />
                <label className="mb-1 mt-4 block text-xs font-medium text-slate-500">Alasan Return</label>
                <Input value={row.return_reason || ""} onChange={(e) => update("return_reason", e.target.value)} placeholder="Rusak, bocor, salah barang, dll." />
              </div>}

              {row.replacement_for_id && <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">
                Delivery barang pengganti untuk return: <strong>{row.replacement_for_id}</strong>
              </div>}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Customer <span className="text-red-500">*</span>
                </label>
                <Input
                  value={row.customer}
                  onChange={(e) => update("customer", e.target.value)}
                  placeholder="Nama Customer"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Company</label>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                  value={row.company}
                  onChange={(e) => update("company", e.target.value)}
                >
                  {options.companies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Posting Date</label>
                <Input
                  type="date"
                  value={row.posting_date ? row.posting_date.slice(0, 10) : ""}
                  onChange={(e) => update("posting_date", e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Posting Time</label>
                <Input
                  type="time"
                  value={row.posting_time}
                  onChange={(e) => update("posting_time", e.target.value)}
                />
              </div>

              <div className="flex flex-col justify-end space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={row.set_posting_time}
                    onChange={(e) => update("set_posting_time", e.target.checked)}
                  />
                  Edit Posting Date and Time
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <input
                    type="checkbox"
                    checked={row.is_return}
                    onChange={(e) => update("is_return", e.target.checked)}
                  />
                  Is Return (Surat Jalan Retur)
                </label>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: ITEMS */}
          <TabsContent value="items" className="space-y-6 p-5 lg:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <form onSubmit={handleScanBarcode} className="flex items-center gap-2 max-w-md">
                <ScanBarcode className="size-5 text-slate-400" />
                <Input
                  placeholder="Scan Barcode / Kode Item..."
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                />
                <Button type="submit" variant="secondary" size="sm">
                  Add
                </Button>
              </form>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Set Source Warehouse:</span>
                <select
                  className="h-9 rounded-md border px-2 text-xs dark:bg-slate-900"
                  value={row.set_warehouse}
                  onChange={(e) => update("set_warehouse", e.target.value)}
                >
                  {options.warehouses.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="p-3">No.</th>
                    <th className="p-3">Item Code</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">UOM</th>
                    <th className="p-3 text-right">Rate (IDR)</th>
                    <th className="p-3 text-right">Amount (IDR)</th>
                    <th className="p-3">Warehouse</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {row.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500">
                        No rows (Klik tombol Add Row)
                      </td>
                    </tr>
                  ) : (
                    row.items.map((it, i) => (
                      <tr key={i}>
                        <td className="p-3 text-center">{i + 1}</td>
                        <td className="p-2">
                          <Input
                            value={it.item_code}
                            onChange={(e) => updateItemRow(i, "item_code", e.target.value)}
                            placeholder="ITEM-001"
                          />
                        </td>
                        <td className="p-2 w-28">
                          <Input
                            type="number"
                            value={it.quantity}
                            onChange={(e) => updateItemRow(i, "quantity", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-2 w-28">
                          <Input
                            value={it.uom}
                            onChange={(e) => updateItemRow(i, "uom", e.target.value)}
                            placeholder="Nos"
                          />
                        </td>
                        <td className="p-2 w-36">
                          <Input
                            type="number"
                            className="text-right"
                            value={it.rate}
                            onChange={(e) => updateItemRow(i, "rate", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-3 text-right font-medium">{formatRp(it.amount)}</td>
                        <td className="p-2">
                          <Input
                            value={it.warehouse}
                            onChange={(e) => updateItemRow(i, "warehouse", e.target.value)}
                            placeholder="Stores"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <Button variant="ghost" size="icon" onClick={() => removeItemRow(i)}>
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-end justify-between gap-4 border-t pt-4 sm:flex-row">
              <Button variant="outline" size="sm" onClick={addItemRow}>
                <Plus className="mr-1 size-4" /> Add Row
              </Button>

              <div className="space-y-1 text-right text-sm">
                <div>
                  Total Quantity: <span className="font-bold">{row.total_qty || 0}</span>
                </div>
                <div>
                  Total (IDR): <span className="font-bold text-blue-600">{formatRp(row.total)}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: TAXES & CHARGES */}
          <TabsContent value="taxes" className="space-y-6 p-5 lg:p-7">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Tax Category</label>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                  value={row.tax_category}
                  onChange={(e) => update("tax_category", e.target.value)}
                >
                  {options.tax_categories.map((tc) => (
                    <option key={tc} value={tc}>
                      {tc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Sales Taxes and Charges Template</label>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                  value={row.taxes_and_charges}
                  onChange={(e) => update("taxes_and_charges", e.target.value)}
                >
                  {options.taxes_templates.map((tt) => (
                    <option key={tt} value={tt}>
                      {tt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Shipping Rule</label>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                  value={row.shipping_rule}
                  onChange={(e) => update("shipping_rule", e.target.value)}
                >
                  {options.shipping_rules.map((sr) => (
                    <option key={sr} value={sr}>
                      {sr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Incoterm</label>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                  value={row.incoterm}
                  onChange={(e) => update("incoterm", e.target.value)}
                >
                  {options.incoterms.map((inc) => (
                    <option key={inc} value={inc}>
                      {inc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="p-3">No.</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Account Head</th>
                    <th className="p-3">Tax Rate (%)</th>
                    <th className="p-3 text-right">Tax Amount</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {row.taxes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        No rows (Klik Add Tax Row)
                      </td>
                    </tr>
                  ) : (
                    row.taxes.map((t, i) => (
                      <tr key={i}>
                        <td className="p-3 text-center">{i + 1}</td>
                        <td className="p-2">
                          <Input
                            value={t.charge_type}
                            onChange={(e) => updateTaxRow(i, "charge_type", e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={t.account_head}
                            onChange={(e) => updateTaxRow(i, "account_head", e.target.value)}
                          />
                        </td>
                        <td className="p-2 w-28">
                          <Input
                            type="number"
                            value={t.rate}
                            onChange={(e) => updateTaxRow(i, "rate", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-3 text-right font-medium">{formatRp(t.tax_amount)}</td>
                        <td className="p-3 text-right font-medium">{formatRp(t.total)}</td>
                        <td className="p-2 text-right">
                          <Button variant="ghost" size="icon" onClick={() => removeTaxRow(i)}>
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-end justify-between gap-4 border-t pt-4 sm:flex-row">
              <Button variant="outline" size="sm" onClick={addTaxRow}>
                <Plus className="mr-1 size-4" /> Add Tax Row
              </Button>

              <div className="space-y-1 text-right text-sm">
                <div>
                  Total Taxes and Charges (IDR): <span className="font-bold">{formatRp(row.total_taxes_and_charges)}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: TOTALS & DISCOUNT */}
          <TabsContent value="totals" className="space-y-6 p-5 lg:p-7">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4 rounded-xl border p-5">
                <h3 className="font-semibold text-slate-900 dark:text-white">Additional Discount</h3>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Apply Additional Discount On</label>
                  <select
                    className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                    value={row.apply_discount_on}
                    onChange={(e) => update("apply_discount_on", e.target.value as any)}
                  >
                    <option value="grand_total">Grand Total</option>
                    <option value="net_total">Net Total</option>
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Additional Discount (%)</label>
                    <Input
                      type="number"
                      value={row.additional_discount_percentage}
                      onChange={(e) => update("additional_discount_percentage", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Additional Discount Amount (IDR)</label>
                    <Input
                      type="number"
                      value={row.additional_discount_amount}
                      onChange={(e) => update("additional_discount_amount", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border bg-slate-50 p-5 dark:bg-slate-900">
                <h3 className="font-semibold text-slate-900 dark:text-white">Totals (IDR)</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-medium">{formatRp(row.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Taxes & Charges:</span>
                  <span className="font-medium">{formatRp(row.total_taxes_and_charges)}</span>
                </div>
                {row.additional_discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Discount:</span>
                    <span>- {formatRp(row.additional_discount_amount)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between text-base font-bold text-slate-900 dark:text-white">
                  <span>Grand Total:</span>
                  <span className="text-blue-600">{formatRp(row.grand_total)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Rounding Adjustment:</span>
                  <span>{formatRp(row.rounding_adjustment)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-slate-900 dark:text-white">
                  <span>Rounded Total:</span>
                  <span>{formatRp(row.rounded_total)}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 5: ADDRESS & CONTACT */}
          <TabsContent value="address" className="space-y-6 p-5 lg:p-7">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Customer Address</label>
                <Input placeholder="Detail alamat pengiriman customer" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Contact Person</label>
                <Input placeholder="Nama kontak penerima" />
              </div>
            </div>
          </TabsContent>

          {/* TAB 6: MORE INFO */}
          <TabsContent value="more" className="space-y-6 p-5 lg:p-7">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Sales Order Reference ID</label>
              <Input
                value={row.sales_order_id || ""}
                onChange={(e) => update("sales_order_id", e.target.value)}
                readOnly={Boolean(row.sales_order_id)}
                placeholder="ID / Nomor Sales Order"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
