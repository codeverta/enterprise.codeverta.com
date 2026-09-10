import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStorageUrl } from "@/lib/utils";
import { buyingApi, type Item, type MasterOptions } from "../api";
import { Check, Combo, Field, Section } from "../components/MasterUI";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
type Tab =
  | "details"
  | "inventory"
  | "defaults"
  | "accounting"
  | "purchasing"
  | "sales"
  | "tax"
  | "quality"
  | "manufacturing";
const empty = (): Item => ({
  item_code: "",
  item_name: "",
  item_group: "All Item Groups",
  stock_uom: "Nos",
  disabled: false,
  allow_alternative_item: false,
  is_stock_item: true,
  has_variants: false,
  is_fixed_asset: false,
  opening_stock: 0,
  standard_rate: 0,
  image_url: "",
  description: "",
  brand: "",
  valuation_method: "FIFO",
  valuation_rate: 0,
  shelf_life_in_days: 0,
  end_of_life: "2099-12-31",
  default_material_request_type: "Purchase",
  warranty_period: 0,
  weight_per_unit: 0,
  weight_uom: "Kg",
  allow_negative_stock: false,
  has_batch_no: false,
  purchase_uom: "",
  min_order_qty: 0,
  safety_stock: 0,
  is_purchase_item: true,
  lead_time_days: 0,
  is_customer_provided_item: false,
  delivered_by_supplier: false,
  country_of_origin: "Indonesia",
  customs_tariff_number: "",
  income_account: "",
  expense_account: "",
  tax_category: "",
  quality_inspection_required: false,
  uoms: [],
  barcodes: [],
  reorder_levels: [],
  supplier_items: [],
});
const initial: MasterOptions = {
  supplier_groups: [],
  suppliers: [],
  items: [],
  item_groups: ["All Item Groups", "Products", "Raw Material", "Services"],
  countries: ["Indonesia"],
  currencies: ["IDR"],
  price_lists: [],
  languages: [],
  uoms: ["Nos", "Unit", "Pcs", "Box", "Kg", "Meter", "Set"],
  weight_uoms: ["Kg", "Gram"],
  warehouses: [],
};
const NumberInput = (
  { value, onChange }: { value: number; onChange: (v: number) => void },
) => (
  <Input
    type="number"
    min="0"
    step="any"
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
  />
);
const hydrateItem = (value?: Partial<Item>): Item => ({
  ...empty(),
  ...(value || {}),
  uoms: value?.uoms || [],
  barcodes: value?.barcodes || [],
  reorder_levels: value?.reorder_levels || [],
  supplier_items: value?.supplier_items || [],
});

const readCachedItem = (id?: string): Partial<Item> | undefined => {
  if (!id) return undefined;
  try {
    const items = JSON.parse(
      sessionStorage.getItem("erp.items.cache") || "[]",
    ) as Item[];
    return items.find((item) => item.id === id);
  } catch {
    return undefined;
  }
};

export default function ItemFormPage(
  { workspace = "buying" }: { workspace?: "buying" | "selling" },
) {
  // The shared `/desk/item/*` route exposes the record ID as a splat (`*`),
  // not as a named `id` parameter. Keep support for a named param as well so
  // this form remains safe if the route is mounted directly in the future.
  const params = useParams<{ id?: string; "*"?: string }>();
  const id = params.id || params["*"]?.split("/").filter(Boolean)[0];
  const location = useLocation();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const navigationItem = location.state?.item as Partial<Item> | undefined;
  const fallbackItem = navigationItem || readCachedItem(id);
  const navigationState = { workspace };
  const itemListURL = `/desk/item?workspace=${workspace}`;
  const moduleLabel = workspace === "selling" ? "Selling" : "Buying";
  const [tab, setTab] = useState<Tab>("details");
  const [row, setRow] = useState<Item>(() => hydrateItem(fallbackItem));
  const [options, setOptions] = useState(initial);
  const [loading, setLoading] = useState(!isNew && !fallbackItem);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  useEffect(() => {
    buyingApi.masterOptions().then((v) => setOptions({ ...initial, ...v }))
      .catch(() => {});
    if (!isNew && id) {
      setLoadError("");
      buyingApi.itemGet(id).then((v) =>
        setRow(hydrateItem({ ...fallbackItem, ...v }))
      )
        .catch((e: any) => {
          const message = e?.response?.data?.error ||
            "Gagal mengambil detail Item dari API";
          setLoadError(message);
          toast.error(message);
        }).finally(() => setLoading(false));
    }
  }, [id, isNew]);
  const update = <K extends keyof Item>(key: K, value: Item[K]) =>
    setRow((v) => ({ ...v, [key]: value }));
  const uploadImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast.error("File harus berupa gambar");
    }
    if (file.size > 10 * 1024 * 1024) {
      return toast.error("Ukuran foto maksimal 10 MB");
    }
    setUploadingImage(true);
    try {
      const result = await buyingApi.itemUploadImage(file);
      update("image_url", result.image_url);
      toast.success(
        "Foto item berhasil diupload. Klik Save untuk menyimpan perubahan.",
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal mengupload foto item");
    } finally {
      setUploadingImage(false);
    }
  };
  const save = async () => {
    if (
      !row.item_code.trim() || !row.item_name.trim() ||
      !row.item_group.trim() || !row.stock_uom.trim()
    ) {
      return toast.error(
        "Item Code, Item Name, Item Group dan Stock UOM wajib diisi",
      );
    }
    setSaving(true);
    try {
      const saved = isNew
        ? await buyingApi.itemCreate(row)
        : await buyingApi.itemUpdate(id!, row);
      toast.success("Item berhasil disimpan");
      navigate(itemListURL, { replace: true, state: navigationState });
      setRow(saved);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menyimpan Item");
    } finally {
      setSaving(false);
    }
  };
  if (loading) return <div className="p-12 text-center">Memuat Item...</div>;
  if (loadError && !fallbackItem) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 dark:bg-red-950/20">
          <h1 className="text-lg font-semibold">
            Detail Item belum dapat dimuat
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {loadError}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" asChild>
              <Link to={itemListURL} state={navigationState}>Kembali</Link>
            </Button>
            <Button onClick={() => window.location.reload()}>Coba Lagi</Button>
          </div>
        </div>
      </div>
    );
  }
  const tabs: Array<[Tab, string]> = [
    ["details", "Details"],
    ["inventory", "Inventory"],
    ["defaults", "Defaults"],
    ["accounting", "Accounting"],
    ["purchasing", "Purchasing"],
    ["sales", "Sales"],
    ["tax", "Tax"],
    ["quality", "Quality"],
    ["manufacturing", "Manufacturing"],
  ];
  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7">
      <header className="mb-5 flex items-center justify-between rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950">
        <div className="flex gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={itemListURL} state={navigationState}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <p className="text-sm text-slate-500">{moduleLabel} / Item</p>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {isNew ? "New Item" : row.item_code}
              </h1>
              <Badge variant="secondary">
                {isNew ? "Not Saved" : row.disabled ? "Disabled" : "Active"}
              </Badge>
            </div>
          </div>
        </div>
        <Button
          className="bg-blue-600"
          onClick={save}
          disabled={saving || uploadingImage}
        >
          <Save className="size-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </header>
      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          API belum dapat memperbarui detail. Data terakhir dari daftar tetap
          ditampilkan.
        </div>
      )}
      <div className="rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">
            {tabs.map(([v, l]) => (
              <TabsTrigger
                key={v}
                value={v}
                className="rounded-none px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
              >
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="space-y-8 p-5 lg:p-7">
          {tab === "details" && (
            <section className="grid gap-5 rounded-xl border bg-slate-50/60 p-4 sm:grid-cols-[160px_1fr] dark:bg-slate-900/40">
              <div className="aspect-square overflow-hidden rounded-lg border bg-white dark:bg-slate-950">
                {row.image_url
                  ? (
                    <img
                      src={getStorageUrl(row.image_url)}
                      alt={row.item_name || "Foto item"}
                      className="size-full object-cover"
                    />
                  )
                  : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 text-slate-400">
                      <ImageIcon className="size-9" />
                      <span className="text-xs">Belum ada foto</span>
                    </div>
                  )}
              </div>
              <div className="flex flex-col justify-center gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Foto Produk / Item</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Foto akan dikompresi otomatis. JPEG, PNG, WebP, HEIC, BMP,
                    TIFF, atau GIF; maksimal 10 MB.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingImage}
                    asChild
                  >
                    <label className="cursor-pointer">
                      {uploadingImage
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Upload className="size-4" />}
                      {uploadingImage ? "Uploading..." : "Upload Foto"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/bmp,image/tiff,image/gif"
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={(e) => {
                          const input = e.currentTarget;
                          void uploadImage(input.files?.[0]).finally(() => {
                            input.value = "";
                          });
                        }}
                      />
                    </label>
                  </Button>
                  {row.image_url && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => update("image_url", "")}
                    >
                      <X className="size-4" />Hapus Foto
                    </Button>
                  )}
                </div>
              </div>
            </section>
          )}
          {tab === "details" && (
            <>
              <Section title="Item">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Item Code" name="item_code" required>
                    <Input
                      value={row.item_code}
                      onChange={(e) => update("item_code", e.target.value)}
                    />
                  </Field>
                  <Field label="Item Name" name="item_name" required>
                    <Input
                      value={row.item_name}
                      onChange={(e) => update("item_name", e.target.value)}
                    />
                  </Field>
                  <Field label="Item Group" name="item_group" required>
                    <Combo
                      value={row.item_group}
                      values={options.item_groups}
                      onChange={(v) => update("item_group", v)}
                    />
                  </Field>
                  <Field
                    label="Default Unit of Measure"
                    name="stock_uom"
                    required
                  >
                    <Combo
                      value={row.stock_uom}
                      values={options.uoms}
                      onChange={(v) => update("stock_uom", v)}
                    />
                  </Field>
                  <Check
                    checked={row.disabled}
                    onChange={(v) => update("disabled", v)}
                    label="Disabled"
                    name="disabled"
                  />
                  <Check
                    checked={row.allow_alternative_item}
                    onChange={(v) => update("allow_alternative_item", v)}
                    label="Allow Alternative Item"
                    name="allow_alternative_item"
                  />
                  <Check
                    checked={row.is_stock_item}
                    onChange={(v) => update("is_stock_item", v)}
                    label="Maintain Stock"
                    name="is_stock_item"
                  />
                  <Check
                    checked={row.has_variants}
                    onChange={(v) => update("has_variants", v)}
                    label="Has Variants"
                    name="has_variants"
                    description="If this item has variants, it cannot be selected in sales orders etc."
                  />
                  <Check
                    checked={row.is_fixed_asset}
                    onChange={(v) => update("is_fixed_asset", v)}
                    label="Is Fixed Asset"
                    name="is_fixed_asset"
                  />
                  <Field label="Opening Stock" name="opening_stock">
                    <NumberInput
                      value={row.opening_stock}
                      onChange={(v) => update("opening_stock", v)}
                    />
                  </Field>
                  <Field label="Standard Selling Rate" name="standard_rate">
                    <NumberInput
                      value={row.standard_rate}
                      onChange={(v) => update("standard_rate", v)}
                    />
                  </Field>
                  <Field label="Brand" name="brand">
                    <Input
                      value={row.brand}
                      onChange={(e) => update("brand", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Description" name="description">
                  <Textarea
                    className="min-h-32"
                    value={row.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </Field>
              </Section>
              <Section
                title="Units of Measure"
                description="Will also apply for variants"
              >
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="p-3">No.</th>
                        <th className="p-3 text-left">UOM</th>
                        <th className="p-3 text-left">Conversion Factor</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {row.uoms.length === 0
                        ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-6 text-center text-slate-500"
                            >
                              No rows
                            </td>
                          </tr>
                        )
                        : row.uoms.map((u, i) => (
                          <tr className="border-t" key={i}>
                            <td className="p-2 text-center">{i + 1}</td>
                            <td className="p-2">
                              <Combo
                                value={u.uom}
                                values={options.uoms}
                                onChange={(v) =>
                                  update(
                                    "uoms",
                                    row.uoms.map((x, j) =>
                                      j === i ? { ...x, uom: v } : x
                                    ),
                                  )}
                              />
                            </td>
                            <td className="p-2">
                              <NumberInput
                                value={u.conversion_factor}
                                onChange={(v) =>
                                  update(
                                    "uoms",
                                    row.uoms.map((x, j) =>
                                      j === i
                                        ? { ...x, conversion_factor: v }
                                        : x
                                    ),
                                  )}
                              />
                            </td>
                            <td>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  update(
                                    "uoms",
                                    row.uoms.filter((_, j) => j !== i),
                                  )}
                              >
                                <Trash2 className="size-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    update("uoms", [...row.uoms, {
                      uom: "",
                      conversion_factor: 1,
                    }])}
                >
                  <Plus className="size-4" /> Add Row
                </Button>
              </Section>
            </>
          )}
          {tab === "inventory" && (
            <>
              <Section title="Inventory Valuation">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Valuation Method" name="valuation_method">
                    <ERPSelect
                      className="h-9 w-full rounded-md border bg-transparent px-3"
                      value={row.valuation_method}
                      onChange={(e) =>
                        update("valuation_method", e.target.value)}
                    >
                      <ERPSelectOption>FIFO</ERPSelectOption>
                      <ERPSelectOption>Moving Average</ERPSelectOption>
                      <ERPSelectOption>LIFO</ERPSelectOption>
                    </ERPSelect>
                  </Field>
                  <Field label="Valuation Rate" name="valuation_rate">
                    <NumberInput
                      value={row.valuation_rate}
                      onChange={(v) => update("valuation_rate", v)}
                    />
                  </Field>
                </div>
              </Section>
              <Section title="Inventory Settings">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Shelf Life In Days" name="shelf_life_in_days">
                    <NumberInput
                      value={row.shelf_life_in_days}
                      onChange={(v) => update("shelf_life_in_days", v)}
                    />
                  </Field>
                  <Field label="End of Life" name="end_of_life">
                    <Input
                      type="date"
                      value={row.end_of_life}
                      onChange={(e) => update("end_of_life", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Default Material Request Type"
                    name="default_material_request_type"
                  >
                    <ERPSelect
                      className="h-9 w-full rounded-md border bg-transparent px-3"
                      value={row.default_material_request_type}
                      onChange={(e) =>
                        update("default_material_request_type", e.target.value)}
                    >
                      <ERPSelectOption>Purchase</ERPSelectOption>
                      <ERPSelectOption>Material Transfer</ERPSelectOption>
                      <ERPSelectOption>Manufacture</ERPSelectOption>
                    </ERPSelect>
                  </Field>
                  <Field
                    label="Warranty Period (in days)"
                    name="warranty_period"
                  >
                    <NumberInput
                      value={row.warranty_period}
                      onChange={(v) => update("warranty_period", v)}
                    />
                  </Field>
                  <Field label="Weight Per Unit" name="weight_per_unit">
                    <NumberInput
                      value={row.weight_per_unit}
                      onChange={(v) => update("weight_per_unit", v)}
                    />
                  </Field>
                  <Field label="Weight UOM" name="weight_uom">
                    <Combo
                      value={row.weight_uom}
                      values={options.weight_uoms}
                      onChange={(v) => update("weight_uom", v)}
                    />
                  </Field>
                  <Check
                    checked={row.allow_negative_stock}
                    onChange={(v) => update("allow_negative_stock", v)}
                    label="Allow Negative Stock"
                    name="allow_negative_stock"
                  />
                </div>
              </Section>
              <Section title="Barcodes">
                <SimpleBarcodes row={row} update={update} options={options} />
              </Section>
              <Section
                title="Auto re-order"
                description="Reorder level based on Warehouse. Will also apply for variants unless overridden"
              >
                <Reorders row={row} update={update} options={options} />
              </Section>
              <Section title="Serial Nos and Batches">
                <Check
                  checked={row.has_batch_no}
                  onChange={(v) => update("has_batch_no", v)}
                  label="Has Batch No"
                  name="has_batch_no"
                  description="Enable Serial / Batch No for Item in Stock Settings."
                />
              </Section>
            </>
          )}
          {tab === "purchasing" && (
            <>
              <Section title="Purchasing">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  <Field
                    label="Default Purchase Unit of Measure"
                    name="purchase_uom"
                  >
                    <Combo
                      value={row.purchase_uom}
                      values={options.uoms}
                      onChange={(v) => update("purchase_uom", v)}
                    />
                  </Field>
                  <Field label="Minimum Order Qty" name="min_order_qty">
                    <NumberInput
                      value={row.min_order_qty}
                      onChange={(v) => update("min_order_qty", v)}
                    />
                    <p className="text-xs text-slate-500">
                      Minimum quantity should be as per Stock UOM
                    </p>
                  </Field>
                  <Field label="Safety Stock" name="safety_stock">
                    <NumberInput
                      value={row.safety_stock}
                      onChange={(v) => update("safety_stock", v)}
                    />
                  </Field>
                  <Check
                    checked={row.is_purchase_item}
                    onChange={(v) => update("is_purchase_item", v)}
                    label="Allow Purchase"
                    name="is_purchase_item"
                  />
                  <Field label="Lead Time in days" name="lead_time_days">
                    <NumberInput
                      value={row.lead_time_days}
                      onChange={(v) => update("lead_time_days", v)}
                    />
                    <p className="text-xs text-slate-500">
                      Average time taken by the supplier to deliver
                    </p>
                  </Field>
                  <Check
                    checked={row.is_customer_provided_item}
                    onChange={(v) => update("is_customer_provided_item", v)}
                    label="Is Customer Provided Item"
                    name="is_customer_provided_item"
                  />
                  <Check
                    checked={row.delivered_by_supplier}
                    onChange={(v) => update("delivered_by_supplier", v)}
                    label="Delivered by Supplier (Drop Ship)"
                    name="delivered_by_supplier"
                  />
                </div>
              </Section>
              <Section title="Supplier Details">
                <SupplierItems row={row} update={update} options={options} />
              </Section>
              <Section title="Foreign Trade Details">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Country of Origin" name="country_of_origin">
                    <Combo
                      value={row.country_of_origin}
                      values={options.countries}
                      onChange={(v) => update("country_of_origin", v)}
                    />
                  </Field>
                  <Field
                    label="Customs Tariff Number"
                    name="customs_tariff_number"
                  >
                    <Input
                      value={row.customs_tariff_number}
                      onChange={(e) =>
                        update("customs_tariff_number", e.target.value)}
                    />
                  </Field>
                </div>
              </Section>
            </>
          )}
          {tab === "defaults" && (
            <Section title="Defaults">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Default UOM" name="stock_uom">
                  <Combo
                    value={row.stock_uom}
                    values={options.uoms}
                    onChange={(v) => update("stock_uom", v)}
                  />
                </Field>
                <Field
                  label="Default Material Request Type"
                  name="default_material_request_type"
                >
                  <Input
                    value={row.default_material_request_type}
                    onChange={(e) =>
                      update("default_material_request_type", e.target.value)}
                  />
                </Field>
              </div>
            </Section>
          )}
          {tab === "accounting" && (
            <Section title="Accounting">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Income Account" name="income_account">
                  <Input
                    value={row.income_account}
                    onChange={(e) => update("income_account", e.target.value)}
                  />
                </Field>
                <Field label="Expense Account" name="expense_account">
                  <Input
                    value={row.expense_account}
                    onChange={(e) => update("expense_account", e.target.value)}
                  />
                </Field>
              </div>
            </Section>
          )}
          {tab === "sales" && (
            <Section title="Sales">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Standard Selling Rate" name="standard_rate">
                  <NumberInput
                    value={row.standard_rate}
                    onChange={(v) => update("standard_rate", v)}
                  />
                </Field>
                <Check
                  checked={!row.disabled}
                  onChange={(v) => update("disabled", !v)}
                  label="Allow Sales"
                  name="is_sales_item"
                />
              </div>
            </Section>
          )}
          {tab === "tax" && (
            <Section title="Tax">
              <Field label="Tax Category" name="tax_category">
                <Input
                  value={row.tax_category}
                  onChange={(e) => update("tax_category", e.target.value)}
                />
              </Field>
            </Section>
          )}
          {tab === "quality" && (
            <Section title="Quality">
              <Check
                checked={row.quality_inspection_required}
                onChange={(v) => update("quality_inspection_required", v)}
                label="Inspection Required Before Purchase"
                name="quality_inspection_required"
              />
            </Section>
          )}
          {tab === "manufacturing" && (
            <Section title="Manufacturing">
              <div className="grid gap-5 md:grid-cols-2">
                <Check
                  checked={row.has_variants}
                  onChange={(v) => update("has_variants", v)}
                  label="Has Variants"
                  name="has_variants"
                />
                <Check
                  checked={row.is_stock_item}
                  onChange={(v) => update("is_stock_item", v)}
                  label="Maintain Stock"
                  name="is_stock_item"
                />
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

type Updater = <K extends keyof Item>(key: K, value: Item[K]) => void;
function SimpleBarcodes(
  { row, update, options }: {
    row: Item;
    update: Updater;
    options: MasterOptions;
  },
) {
  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="p-3">No.</th>
              <th>Barcode</th>
              <th>Barcode Type</th>
              <th>UOM</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {row.barcodes.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    No rows
                  </td>
                </tr>
              )
              : row.barcodes.map((b, i) => (
                <tr className="border-t" key={i}>
                  <td className="p-2 text-center">{i + 1}</td>
                  <td className="p-2">
                    <Input
                      value={b.barcode}
                      onChange={(e) =>
                        update(
                          "barcodes",
                          row.barcodes.map((x, j) =>
                            j === i ? { ...x, barcode: e.target.value } : x
                          ),
                        )}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={b.barcode_type}
                      onChange={(e) =>
                        update(
                          "barcodes",
                          row.barcodes.map((x, j) =>
                            j === i ? { ...x, barcode_type: e.target.value } : x
                          ),
                        )}
                    />
                  </td>
                  <td className="p-2">
                    <Combo
                      value={b.uom}
                      values={options.uoms}
                      onChange={(v) =>
                        update(
                          "barcodes",
                          row.barcodes.map((x, j) =>
                            j === i ? { ...x, uom: v } : x
                          ),
                        )}
                    />
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        update(
                          "barcodes",
                          row.barcodes.filter((_, j) => j !== i),
                        )}
                    >
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="outline"
        onClick={() =>
          update("barcodes", [...row.barcodes, {
            barcode: "",
            barcode_type: "",
            uom: row.stock_uom,
          }])}
      >
        <Plus className="size-4" /> Add Row
      </Button>
    </>
  );
}
function Reorders(
  { row, update, options }: {
    row: Item;
    update: Updater;
    options: MasterOptions;
  },
) {
  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="p-3">No.</th>
              <th>Request for</th>
              <th>Check Availability in Warehouse</th>
              <th>Re-order Level</th>
              <th>Re-order Qty</th>
              <th>Material Request Type</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {row.reorder_levels.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    No rows
                  </td>
                </tr>
              )
              : row.reorder_levels.map((r, i) => (
                <tr className="border-t" key={i}>
                  <td className="p-2 text-center">{i + 1}</td>
                  <td className="p-2">
                    <Input
                      value={r.request_for}
                      onChange={(e) =>
                        update(
                          "reorder_levels",
                          row.reorder_levels.map((x, j) =>
                            j === i ? { ...x, request_for: e.target.value } : x
                          ),
                        )}
                    />
                  </td>
                  <td className="p-2">
                    <Combo
                      value={r.warehouse}
                      values={options.warehouses}
                      onChange={(v) =>
                        update(
                          "reorder_levels",
                          row.reorder_levels.map((x, j) =>
                            j === i ? { ...x, warehouse: v } : x
                          ),
                        )}
                    />
                  </td>
                  <td className="p-2">
                    <NumberInput
                      value={r.reorder_level}
                      onChange={(v) =>
                        update(
                          "reorder_levels",
                          row.reorder_levels.map((x, j) =>
                            j === i ? { ...x, reorder_level: v } : x
                          ),
                        )}
                    />
                  </td>
                  <td className="p-2">
                    <NumberInput
                      value={r.reorder_qty}
                      onChange={(v) =>
                        update(
                          "reorder_levels",
                          row.reorder_levels.map((x, j) =>
                            j === i ? { ...x, reorder_qty: v } : x
                          ),
                        )}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={r.material_request_type}
                      onChange={(e) =>
                        update(
                          "reorder_levels",
                          row.reorder_levels.map((x, j) =>
                            j === i
                              ? { ...x, material_request_type: e.target.value }
                              : x
                          ),
                        )}
                    />
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        update(
                          "reorder_levels",
                          row.reorder_levels.filter((_, j) =>
                            j !== i
                          ),
                        )}
                    >
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="outline"
        onClick={() =>
          update("reorder_levels", [...row.reorder_levels, {
            request_for: "",
            warehouse: "",
            reorder_level: 0,
            reorder_qty: 0,
            material_request_type: "Purchase",
          }])}
      >
        <Plus className="size-4" /> Add Row
      </Button>
    </>
  );
}
function SupplierItems(
  { row, update, options }: {
    row: Item;
    update: Updater;
    options: MasterOptions;
  },
) {
  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="p-3">No.</th>
              <th>Supplier</th>
              <th>Supplier Part Number</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {row.supplier_items.length === 0
              ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500">
                    No rows
                  </td>
                </tr>
              )
              : row.supplier_items.map((s, i) => (
                <tr className="border-t" key={i}>
                  <td className="p-2 text-center">{i + 1}</td>
                  <td className="p-2">
                    <Combo
                      value={s.supplier}
                      values={options.suppliers}
                      onChange={(v) =>
                        update(
                          "supplier_items",
                          row.supplier_items.map((x, j) =>
                            j === i ? { ...x, supplier: v } : x
                          ),
                        )}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={s.supplier_part_number}
                      onChange={(e) =>
                        update(
                          "supplier_items",
                          row.supplier_items.map((x, j) =>
                            j === i
                              ? { ...x, supplier_part_number: e.target.value }
                              : x
                          ),
                        )}
                    />
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        update(
                          "supplier_items",
                          row.supplier_items.filter((_, j) =>
                            j !== i
                          ),
                        )}
                    >
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="outline"
        onClick={() =>
          update("supplier_items", [...row.supplier_items, {
            supplier: "",
            supplier_part_number: "",
          }])}
      >
        <Plus className="size-4" /> Add Row
      </Button>
    </>
  );
}
