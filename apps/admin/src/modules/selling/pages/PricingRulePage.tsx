import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Code2,
  DollarSign,
  FileText,
  HelpCircle,
  Layers,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sliders,
  Tag,
  Trash2,
  Warehouse as WarehouseIcon,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  pricingRuleApi,
  type PricingRule,
  type PricingRuleItem,
} from "../pricingRuleApi";

const defaultUOMs = [
  "Nos",
  "Unit",
  "Pcs",
  "Box",
  "Kg",
  "Gram",
  "Meter",
  "Liter",
  "Set",
  "Roll",
  "Pack",
];

const emptyPricingRule: PricingRule = {
  naming_series: "PRLE-.####",
  title: "",
  disable: false,
  apply_on: "Item Code",
  price_or_product_discount: "Price",
  warehouse: "",
  mixed_conditions: false,
  is_cumulative: false,
  coupon_code_based: false,
  selling: true,
  buying: false,
  applicable_for: "Customer",
  party: "",
  min_qty: 0,
  max_qty: 0,
  min_amt: 0,
  max_amt: 0,
  valid_from: "",
  valid_upto: "",
  company: "",
  currency: "IDR",
  margin_type: "",
  margin_rate_or_amount: 0,
  rate_or_discount: "Discount Percentage",
  rate: 0,
  discount_percentage: 0,
  discount_amount: 0,
  for_price_list: "",
  condition: "",
  apply_multiple_pricing_rules: false,
  threshold_percentage: 0,
  validate_applied_rule: false,
  has_priority: false,
  priority: 0,
  items: [],
};

export default function PricingRulePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const pathParts = location.pathname.split("/").filter(Boolean);
  const rawId = pathParts[2];
  const isForm = Boolean(rawId);
  const isNew = isForm && (rawId === "new" || rawId.startsWith("new-pricing-rule"));

  // List States
  const [rows, setRows] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterApplyOn, setFilterApplyOn] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Form States
  const [formData, setFormData] = useState<PricingRule>(emptyPricingRule);
  const [activeTab, setActiveTab] = useState<"details" | "dynamic" | "advanced" | "help">("details");
  const [saving, setSaving] = useState(false);

  // Dropdown Reference Data
  const [itemList, setItemList] = useState<{ item_code: string; item_name: string; stock_uom?: string }[]>([]);
  const [itemGroupList, setItemGroupList] = useState<{ id?: string; item_group_name: string; name?: string }[]>([]);
  const [priceLists, setPriceLists] = useState<{ id?: string; price_list_name: string; currency?: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id?: string; warehouse_name?: string; name?: string }[]>([]);
  const [companies, setCompanies] = useState<{ id?: string; name?: string; company_name?: string }[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name?: string; symbol?: string }[]>([]);
  const [uoms, setUoms] = useState<{ id?: string; uom_name: string; symbol?: string }[]>([]);

  // Load dropdown references
  const loadReferences = useCallback(async () => {
    try {
      const [itms, igs, pls, whs, comps, currs, uomRes] = await Promise.all([
        pricingRuleApi.listItems(),
        pricingRuleApi.listItemGroups(),
        pricingRuleApi.listPriceLists(),
        pricingRuleApi.listWarehouses(),
        pricingRuleApi.listCompanies(),
        pricingRuleApi.listCurrencies(),
        pricingRuleApi.listUOMs(),
      ]);
      setItemList(itms);
      setItemGroupList(igs);
      setPriceLists(pls);
      setWarehouses(whs);
      setCompanies(comps);
      setCurrencies(currs);
      setUoms(uomRes);
    } catch {
      // ignore
    }
  }, []);

  // Fetch List
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: { q?: string; apply_on?: string; disable?: string } = {};
      if (search.trim()) params.q = search.trim();
      if (filterApplyOn !== "ALL") params.apply_on = filterApplyOn;
      if (filterStatus === "active") params.disable = "false";
      if (filterStatus === "disabled") params.disable = "true";

      const data = await pricingRuleApi.list(params);
      setRows(data || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal memuat Pricing Rules");
    } finally {
      setLoading(false);
    }
  }, [search, filterApplyOn, filterStatus]);

  // Fetch Form Record
  const fetchRecord = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await pricingRuleApi.get(id);
      setFormData({
        ...emptyPricingRule,
        ...data,
        valid_from: data.valid_from ? data.valid_from.substring(0, 10) : "",
        valid_upto: data.valid_upto ? data.valid_upto.substring(0, 10) : "",
        items: data.items || [],
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal memuat Pricing Rule");
      navigate("/desk/pricing-rule");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadReferences();
  }, [loadReferences]);

  useEffect(() => {
    if (isForm) {
      if (isNew) {
        setFormData({ ...emptyPricingRule, items: [] });
      } else if (rawId) {
        fetchRecord(rawId);
      }
    } else {
      fetchList();
    }
  }, [isForm, isNew, rawId, fetchList, fetchRecord]);

  // Child table item handlers
  const handleAddItemRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        { item_code: "", item_group: "", brand: "", uom: "" },
      ],
    }));
  };

  const handleRemoveItemRow = (index: number) => {
    setFormData((prev) => {
      const next = [...(prev.items || [])];
      next.splice(index, 1);
      return { ...prev, items: next };
    });
  };

  const handleUpdateItemRow = (index: number, field: keyof PricingRuleItem, value: any) => {
    setFormData((prev) => {
      const next = [...(prev.items || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, items: next };
    });
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Title wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<PricingRule> = {
        ...formData,
        min_qty: Number(formData.min_qty) || 0,
        max_qty: Number(formData.max_qty) || 0,
        min_amt: Number(formData.min_amt) || 0,
        max_amt: Number(formData.max_amt) || 0,
        margin_rate_or_amount: Number(formData.margin_rate_or_amount) || 0,
        rate: Number(formData.rate) || 0,
        discount_percentage: Number(formData.discount_percentage) || 0,
        discount_amount: Number(formData.discount_amount) || 0,
        threshold_percentage: Number(formData.threshold_percentage) || 0,
        priority: Number(formData.priority) || 0,
      };

      if (isNew) {
        const created = await pricingRuleApi.create(payload);
        toast.success("Pricing Rule berhasil dibuat");
        navigate(`/desk/pricing-rule/${created.id}`);
      } else if (formData.id) {
        await pricingRuleApi.update(formData.id, payload);
        toast.success("Pricing Rule berhasil diperbarui");
        fetchRecord(formData.id);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Pricing Rule");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!formData.id) return;
    if (!window.confirm("Apakah Anda yakin ingin menghapus Pricing Rule ini?")) return;
    setSaving(true);
    try {
      await pricingRuleApi.remove(formData.id);
      toast.success("Pricing Rule berhasil dihapus");
      navigate("/desk/pricing-rule");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus Pricing Rule");
    } finally {
      setSaving(false);
    }
  };

  // Options for dropdowns
  const companyOptions = useMemo(() => {
    return companies.map((c) => ({
      value: c.company_name || c.name || "",
      label: c.company_name || c.name || "",
    })).filter((o) => o.value);
  }, [companies]);

  const currencyOptions = useMemo(() => {
    const list = currencies.length > 0 ? currencies.map((c) => ({ value: c.code, label: `${c.code} - ${c.name || c.code}` })) : [
      { value: "IDR", label: "IDR - Indonesian Rupiah" },
      { value: "USD", label: "USD - US Dollar" },
      { value: "EUR", label: "EUR - Euro" },
      { value: "SGD", label: "SGD - Singapore Dollar" },
    ];
    return list;
  }, [currencies]);

  const warehouseOptions = useMemo(() => {
    return warehouses.map((w) => ({
      value: w.warehouse_name || w.name || "",
      label: w.warehouse_name || w.name || "",
    })).filter((o) => o.value);
  }, [warehouses]);

  const priceListOptions = useMemo(() => {
    return priceLists.map((p) => ({
      value: p.price_list_name,
      label: p.price_list_name,
    }));
  }, [priceLists]);

  const itemOptions = useMemo(() => {
    return itemList.map((i) => ({
      value: i.item_code,
      label: `${i.item_code} - ${i.item_name}`,
    }));
  }, [itemList]);

  const itemGroupOptions = useMemo(() => {
    return itemGroupList.map((g) => ({
      value: g.item_group_name || g.name || "",
      label: g.item_group_name || g.name || "",
    })).filter((o) => o.value);
  }, [itemGroupList]);

  const uomOptions = useMemo(() => {
    if (uoms.length > 0) {
      return uoms.map((u) => ({ value: u.uom_name, label: u.uom_name }));
    }
    return defaultUOMs.map((u) => ({ value: u, label: u }));
  }, [uoms]);

  // RENDER FORM VIEW
  if (isForm) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/desk/pricing-rule")}
                className="text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    {isNew ? "New Pricing Rule" : formData.title || formData.id}
                  </h1>
                  {formData.disable ? (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      Disabled
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <Link to="/desk/pricing-rule" className="hover:underline">
                    Pricing Rules
                  </Link>
                  <ChevronRight className="h-3 w-3" />
                  <span>{isNew ? "Create" : formData.id}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isNew && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={saving}
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={saving}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {saving ? "Saving..." : isNew ? "Save" : "Save Changes"}
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="mt-4 -mb-3">
            <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-slate-200 bg-transparent p-0">
            <TabsTrigger value="details" className="gap-1.5 rounded-none px-4 py-2 text-sm">
              <FileText className="h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="dynamic" className="gap-1.5 rounded-none px-4 py-2 text-sm">
              <Code2 className="h-4 w-4" />
              Dynamic Condition
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1.5 rounded-none px-4 py-2 text-sm">
              <Settings2 className="h-4 w-4" />
              Advanced Settings
            </TabsTrigger>
            <TabsTrigger value="help" className="gap-1.5 rounded-none px-4 py-2 text-sm">
              <HelpCircle className="h-4 w-4" />
              Help Article
            </TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        {/* Tab Contents */}
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: DETAILS */}
          {activeTab === "details" && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-slate-900 border-b pb-2">Rule Identification</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="naming_series" className="text-xs font-semibold text-slate-600">
                      Naming Series
                    </Label>
                    <Input
                      id="naming_series"
                      value={formData.naming_series}
                      onChange={(e) => setFormData({ ...formData, naming_series: e.target.value })}
                      placeholder="PRLE-.####"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="title" className="text-xs font-semibold text-slate-600">
                      Title <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. Summer Discount 10%"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="disable"
                    checked={formData.disable}
                    onCheckedChange={(c) => setFormData({ ...formData, disable: Boolean(c) })}
                  />
                  <Label htmlFor="disable" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Disable
                  </Label>
                </div>
              </div>

              {/* Scope & Applicability */}
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-slate-900 border-b pb-2">Applicability & Scope</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Apply On</Label>
                    <select
                      value={formData.apply_on}
                      onChange={(e) => setFormData({ ...formData, apply_on: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Item Code">Item Code</option>
                      <option value="Item Group">Item Group</option>
                      <option value="Brand">Brand</option>
                      <option value="Transaction">Transaction</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Price or Product Discount</Label>
                    <select
                      value={formData.price_or_product_discount}
                      onChange={(e) => setFormData({ ...formData, price_or_product_discount: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Price">Price</option>
                      <option value="Product">Product</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Warehouse</Label>
                    <div className="mt-1">
                      <SearchableSelect
                        options={warehouseOptions}
                        value={formData.warehouse || ""}
                        onChange={(val) => setFormData({ ...formData, warehouse: val })}
                        placeholder="Begin typing for results..."
                        allowClear
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-end space-y-2 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="mixed_conditions"
                        checked={formData.mixed_conditions}
                        onCheckedChange={(c) => setFormData({ ...formData, mixed_conditions: Boolean(c) })}
                      />
                      <Label htmlFor="mixed_conditions" className="text-xs font-medium text-slate-700 cursor-pointer">
                        Mixed Conditions (Conditions will be applied on all the selected items combined)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_cumulative"
                        checked={formData.is_cumulative}
                        onCheckedChange={(c) => setFormData({ ...formData, is_cumulative: Boolean(c) })}
                      />
                      <Label htmlFor="is_cumulative" className="text-xs font-medium text-slate-700 cursor-pointer">
                        Is Cumulative
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="coupon_code_based"
                        checked={formData.coupon_code_based}
                        onCheckedChange={(c) => setFormData({ ...formData, coupon_code_based: Boolean(c) })}
                      />
                      <Label htmlFor="coupon_code_based" className="text-xs font-medium text-slate-700 cursor-pointer">
                        Coupon Code Based
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Items Child Table (if Apply On is Item Code, Item Group, or Brand) */}
                {formData.apply_on !== "Transaction" && (
                  <div className="mt-6 border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">
                          Items Apply Rule On {formData.apply_on}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Tentukan item, item group, atau brand yang tercakup dalam aturan harga ini
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddItemRow}
                        className="text-xs h-8"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Row
                      </Button>
                    </div>

                    <div className="overflow-x-auto border rounded-md">
                      <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                        <thead className="bg-slate-50 font-medium text-slate-700">
                          <tr>
                            <th className="px-3 py-2 w-10 text-center">#</th>
                            {formData.apply_on === "Item Code" && (
                              <th className="px-3 py-2 min-w-[200px]">Item Code</th>
                            )}
                            {formData.apply_on === "Item Group" && (
                              <th className="px-3 py-2 min-w-[200px]">Item Group</th>
                            )}
                            {formData.apply_on === "Brand" && (
                              <th className="px-3 py-2 min-w-[200px]">Brand</th>
                            )}
                            <th className="px-3 py-2 min-w-[120px]">Unit</th>
                            <th className="px-3 py-2 w-12 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {(formData.items || []).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                                No rows. Click "Add Row" to specify items.
                              </td>
                            </tr>
                          ) : (
                            formData.items?.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-3 py-2 text-center font-mono text-slate-400">
                                  {idx + 1}
                                </td>
                                {formData.apply_on === "Item Code" && (
                                  <td className="px-3 py-2">
                                    <SearchableSelect
                                      options={itemOptions}
                                      value={item.item_code || ""}
                                      onChange={(val) => {
                                        handleUpdateItemRow(idx, "item_code", val);
                                        const found = itemList.find((i) => i.item_code === val);
                                        if (found && found.stock_uom && !item.uom) {
                                          handleUpdateItemRow(idx, "uom", found.stock_uom);
                                        }
                                      }}
                                      placeholder="Select Item..."
                                      allowClear
                                    />
                                  </td>
                                )}
                                {formData.apply_on === "Item Group" && (
                                  <td className="px-3 py-2">
                                    <SearchableSelect
                                      options={itemGroupOptions}
                                      value={item.item_group || ""}
                                      onChange={(val) => handleUpdateItemRow(idx, "item_group", val)}
                                      placeholder="Select Item Group..."
                                      allowClear
                                    />
                                  </td>
                                )}
                                {formData.apply_on === "Brand" && (
                                  <td className="px-3 py-2">
                                    <Input
                                      value={item.brand || ""}
                                      onChange={(e) => handleUpdateItemRow(idx, "brand", e.target.value)}
                                      placeholder="e.g. Nike, Apple"
                                      className="h-8 text-xs"
                                    />
                                  </td>
                                )}
                                <td className="px-3 py-2">
                                  <SearchableSelect
                                    options={uomOptions}
                                    value={item.uom || ""}
                                    onChange={(val) => handleUpdateItemRow(idx, "uom", val)}
                                    placeholder="Select UOM..."
                                    allowClear
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveItemRow(idx)}
                                    className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Party Information */}
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-slate-900 border-b pb-2">Party Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="selling"
                        checked={formData.selling}
                        onCheckedChange={(c) => setFormData({ ...formData, selling: Boolean(c) })}
                      />
                      <Label htmlFor="selling" className="text-sm font-medium text-slate-700 cursor-pointer">
                        Selling
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="buying"
                        checked={formData.buying}
                        onCheckedChange={(c) => setFormData({ ...formData, buying: Boolean(c) })}
                      />
                      <Label htmlFor="buying" className="text-sm font-medium text-slate-700 cursor-pointer">
                        Buying
                      </Label>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Applicable For</Label>
                    <select
                      value={formData.applicable_for}
                      onChange={(e) => setFormData({ ...formData, applicable_for: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Customer">Customer</option>
                      <option value="Customer Group">Customer Group</option>
                      <option value="Territory">Territory</option>
                      <option value="Sales Partner">Sales Partner</option>
                      <option value="Campaign">Campaign</option>
                      <option value="Supplier">Supplier</option>
                      <option value="Supplier Group">Supplier Group</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="party" className="text-xs font-semibold text-slate-600">
                      Party ({formData.applicable_for || "Party Name"})
                    </Label>
                    <Input
                      id="party"
                      value={formData.party || ""}
                      onChange={(e) => setFormData({ ...formData, party: e.target.value })}
                      placeholder={`Begin typing ${formData.applicable_for || "Party"}...`}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Quantity and Amount */}
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-slate-900 border-b pb-2">Quantity and Amount</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_qty" className="text-xs font-semibold text-slate-600">
                      Min Qty (As Per Unit)
                    </Label>
                    <Input
                      id="min_qty"
                      type="number"
                      value={formData.min_qty}
                      onChange={(e) => setFormData({ ...formData, min_qty: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                      min={0}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_qty" className="text-xs font-semibold text-slate-600">
                      Max Qty (As Per Unit)
                    </Label>
                    <Input
                      id="max_qty"
                      type="number"
                      value={formData.max_qty}
                      onChange={(e) => setFormData({ ...formData, max_qty: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                      min={0}
                    />
                  </div>
                  <div>
                    <Label htmlFor="min_amt" className="text-xs font-semibold text-slate-600">
                      Min Amt
                    </Label>
                    <Input
                      id="min_amt"
                      type="number"
                      value={formData.min_amt}
                      onChange={(e) => setFormData({ ...formData, min_amt: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                      min={0}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_amt" className="text-xs font-semibold text-slate-600">
                      Max Amt
                    </Label>
                    <Input
                      id="max_amt"
                      type="number"
                      value={formData.max_amt}
                      onChange={(e) => setFormData({ ...formData, max_amt: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Period Settings & Company */}
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-slate-900 border-b pb-2">Period Settings & Company</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="valid_from" className="text-xs font-semibold text-slate-600">
                      Valid From
                    </Label>
                    <Input
                      id="valid_from"
                      type="date"
                      value={formData.valid_from || ""}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="valid_upto" className="text-xs font-semibold text-slate-600">
                      Valid Up To
                    </Label>
                    <Input
                      id="valid_upto"
                      type="date"
                      value={formData.valid_upto || ""}
                      onChange={(e) => setFormData({ ...formData, valid_upto: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Company</Label>
                    <div className="mt-1">
                      <SearchableSelect
                        options={companyOptions}
                        value={formData.company || ""}
                        onChange={(val) => setFormData({ ...formData, company: val })}
                        placeholder="Begin typing for results..."
                        allowClear
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Currency</Label>
                    <div className="mt-1">
                      <SearchableSelect
                        options={currencyOptions}
                        value={formData.currency || "IDR"}
                        onChange={(val) => setFormData({ ...formData, currency: val })}
                        placeholder="Select Currency..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Margin Settings */}
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-slate-900 border-b pb-2">Margin</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Margin Type</Label>
                    <select
                      value={formData.margin_type || ""}
                      onChange={(e) => setFormData({ ...formData, margin_type: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">None</option>
                      <option value="Percentage">Percentage</option>
                      <option value="Amount">Amount</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="margin_rate_or_amount" className="text-xs font-semibold text-slate-600">
                      Margin Rate or Amount
                    </Label>
                    <Input
                      id="margin_rate_or_amount"
                      type="number"
                      value={formData.margin_rate_or_amount}
                      onChange={(e) => setFormData({ ...formData, margin_rate_or_amount: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Price Discount Scheme */}
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-slate-900 border-b pb-2">Price Discount Scheme</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Rate or Discount</Label>
                    <select
                      value={formData.rate_or_discount}
                      onChange={(e) => setFormData({ ...formData, rate_or_discount: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Rate">Rate</option>
                      <option value="Discount Percentage">Discount Percentage</option>
                      <option value="Discount Amount">Discount Amount</option>
                    </select>
                  </div>

                  {formData.rate_or_discount === "Rate" && (
                    <div>
                      <Label htmlFor="rate" className="text-xs font-semibold text-slate-600">
                        Rate ({formData.currency})
                      </Label>
                      <Input
                        id="rate"
                        type="number"
                        value={formData.rate}
                        onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                        className="mt-1"
                        min={0}
                      />
                    </div>
                  )}

                  {formData.rate_or_discount === "Discount Percentage" && (
                    <div>
                      <Label htmlFor="discount_percentage" className="text-xs font-semibold text-slate-600">
                        Discount Percentage (%)
                      </Label>
                      <Input
                        id="discount_percentage"
                        type="number"
                        value={formData.discount_percentage}
                        onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || 0 })}
                        className="mt-1"
                        min={0}
                        max={100}
                      />
                    </div>
                  )}

                  {formData.rate_or_discount === "Discount Amount" && (
                    <div>
                      <Label htmlFor="discount_amount" className="text-xs font-semibold text-slate-600">
                        Discount Amount ({formData.currency})
                      </Label>
                      <Input
                        id="discount_amount"
                        type="number"
                        value={formData.discount_amount}
                        onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })}
                        className="mt-1"
                        min={0}
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-xs font-semibold text-slate-600">For Price List</Label>
                    <div className="mt-1">
                      <SearchableSelect
                        options={priceListOptions}
                        value={formData.for_price_list || ""}
                        onChange={(val) => setFormData({ ...formData, for_price_list: val })}
                        placeholder="Select Price List..."
                        allowClear
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DYNAMIC CONDITION */}
          {activeTab === "dynamic" && (
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="border-b pb-2">
                <h2 className="text-base font-semibold text-slate-900">Dynamic Condition</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tuliskan ekspresi kondisi (misal JavaScript expression) yang dievaluasi saat runtime dokumen transaksi.
                </p>
              </div>

              <div>
                <Label htmlFor="condition" className="text-xs font-semibold text-slate-600">
                  Condition Expression
                </Label>
                <Textarea
                  id="condition"
                  value={formData.condition || ""}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  placeholder={`e.g. doc.grand_total > 500000 && doc.customer_group === "Commercial"`}
                  rows={8}
                  className="mt-1 font-mono text-sm bg-slate-900 text-emerald-400 placeholder:text-slate-600 selection:bg-slate-700"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Variabel konteks yang tersedia: <code>doc</code> (dokumen saat ini), <code>item</code> (baris item transaksi), <code>customer</code>.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: ADVANCED SETTINGS */}
          {activeTab === "advanced" && (
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-6">
              <div className="border-b pb-2">
                <h2 className="text-base font-semibold text-slate-900">Advanced Settings</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Aturan prioritas dan validasi pricing rule majemuk
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="apply_multiple_pricing_rules"
                    checked={formData.apply_multiple_pricing_rules}
                    onCheckedChange={(c) => setFormData({ ...formData, apply_multiple_pricing_rules: Boolean(c) })}
                  />
                  <Label htmlFor="apply_multiple_pricing_rules" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Apply Multiple Pricing Rules
                  </Label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label htmlFor="threshold_percentage" className="text-xs font-semibold text-slate-600">
                      Threshold for Suggestion (%)
                    </Label>
                    <Input
                      id="threshold_percentage"
                      type="number"
                      value={formData.threshold_percentage}
                      onChange={(e) => setFormData({ ...formData, threshold_percentage: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                      min={0}
                      max={100}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Beri saran diskon jika selisih kuantitas pembelian berada dalam persentase ambang ini.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="validate_applied_rule"
                    checked={formData.validate_applied_rule}
                    onCheckedChange={(c) => setFormData({ ...formData, validate_applied_rule: Boolean(c) })}
                  />
                  <Label htmlFor="validate_applied_rule" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Validate Applied Rule
                  </Label>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has_priority"
                      checked={formData.has_priority}
                      onCheckedChange={(c) => setFormData({ ...formData, has_priority: Boolean(c) })}
                    />
                    <Label htmlFor="has_priority" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Has Priority (Skala 0 - 20)
                    </Label>
                  </div>

                  {formData.has_priority && (
                    <div className="max-w-xs">
                      <Label htmlFor="priority" className="text-xs font-semibold text-slate-600">
                        Priority Value (0 to 20, higher priority wins)
                      </Label>
                      <Input
                        id="priority"
                        type="number"
                        value={formData.priority}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setFormData({ ...formData, priority: Math.max(0, Math.min(20, val)) });
                        }}
                        className="mt-1"
                        min={0}
                        max={20}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HELP ARTICLE */}
          {activeTab === "help" && (
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6 text-slate-800 leading-relaxed text-sm">
              <div className="border-b pb-3">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-blue-600" />
                  Help Article: How Pricing Rule Works
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
                    1. Priority Resolution (0 to 20)
                  </h3>
                  <p>
                    Priority can be directly assigned between <strong>0 to 20</strong>, where a higher number denotes higher priority.
                    If multiple pricing rules match the same transaction conditions, the rule with the highest priority will prevail.
                  </p>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
                    2. Internal Priority Hierarchy
                  </h3>
                  <p>
                    If rules share the same Priority value, the system breaks ties using internal specificity:
                  </p>
                  <ul className="list-disc list-inside space-y-1 mt-2 text-slate-700 pl-2 font-mono text-xs">
                    <li>
                      <strong>Item Hierarchy:</strong> Item Code &gt; Item Group &gt; Brand
                    </li>
                    <li>
                      <strong>Customer Hierarchy:</strong> Customer &gt; Customer Group &gt; Territory
                    </li>
                    <li>
                      <strong>Supplier Hierarchy:</strong> Supplier &gt; Supplier Group
                    </li>
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
                    3. Notes &amp; Behavior
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2 text-xs text-slate-700">
                    <p>
                      • <strong>Apply On:</strong> Controls whether the rule matches specific items, groups, or whole transaction total.
                    </p>
                    <p>
                      • <strong>Mixed Conditions:</strong> If checked, items matching the criteria will combine their quantities/amounts to satisfy the threshold.
                    </p>
                    <p>
                      • <strong>Cumulative Rules:</strong> If enabled, the rule accumulates totals across previous orders within the validity period.
                    </p>
                    <p>
                      • <strong>Apply Multiple Pricing Rules:</strong> Allows stacking discounts if multiple matching rules have this flag enabled.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // RENDER LIST VIEW
  return (
    <ERPPage>
      {/* Top Header */}
      <ERPPageHeader title="Pricing Rule" description="Atur skema diskon, margin, dan promosi harga untuk penjualan dan pembelian." breadcrumbs={[{ label: "Selling", href: "/desk/selling" }, { label: "Pricing Rule" }]} actions={<>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchList}
            disabled={loading}
            className="h-9"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            asChild
            size="sm"
            className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <Link to="/desk/pricing-rule/new">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Pricing Rule
            </Link>
          </Button>
        </>}/>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchList()}
            placeholder="Search by Title, ID, or Party..."
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={filterApplyOn}
            onChange={(e) => setFilterApplyOn(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Apply On</option>
            <option value="Item Code">Item Code</option>
            <option value="Item Group">Item Group</option>
            <option value="Brand">Brand</option>
            <option value="Transaction">Transaction</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Status</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled Only</option>
          </select>
        </div>
      </div>

      {/* List Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
            <thead className="bg-slate-50 font-medium text-slate-700">
              <tr>
                <th className="px-4 py-3">Title / ID</th>
                <th className="px-4 py-3">Apply On</th>
                <th className="px-4 py-3">Applicable For</th>
                <th className="px-4 py-3">Scheme</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
                    Memuat daftar Pricing Rule...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Belum ada Pricing Rule. Klik "Add Pricing Rule" untuk membuat baru.
                  </td>
                </tr>
              ) : (
                rows.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/desk/pricing-rule/${rule.id}`}
                        className="font-medium text-blue-600 hover:underline flex flex-col"
                      >
                        <span>{rule.title}</span>
                        <span className="text-xs text-slate-400 font-mono">{rule.id}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <Badge variant="outline" className="font-normal text-xs bg-slate-50">
                        {rule.apply_on}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex flex-col">
                        <span>{rule.applicable_for}</span>
                        {rule.party && <span className="text-xs text-slate-400">{rule.party}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1.5 font-medium">
                        {rule.rate_or_discount === "Discount Percentage" && (
                          <span className="text-emerald-600">Diskon {rule.discount_percentage}%</span>
                        )}
                        {rule.rate_or_discount === "Discount Amount" && (
                          <span className="text-emerald-600">Diskon {rule.currency} {rule.discount_amount}</span>
                        )}
                        {rule.rate_or_discount === "Rate" && (
                          <span className="text-blue-600">Harga Khusus {rule.currency} {rule.rate}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {rule.has_priority ? (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                          Priority {rule.priority}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {rule.disable ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                          Disabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                          Active
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 text-blue-600 hover:text-blue-800"
                      >
                        <Link to={`/desk/pricing-rule/${rule.id}`}>Edit</Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ERPPage>
  );
}
