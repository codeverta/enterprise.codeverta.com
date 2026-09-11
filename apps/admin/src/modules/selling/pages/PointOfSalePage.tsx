import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  LogOut,
  Minus,
  MoreHorizontal,
  Percent,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { customerApi, type Customer } from "../customerApi";
import { itemGroupApi, type ItemGroup } from "../itemGroupApi";
import {
  posApi,
  type POSCartItem,
  type POSItem,
  type POSOpeningEntry,
} from "../posApi";

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function PointOfSalePage() {
  const navigate = useNavigate();
  const [opening, setOpening] = useState<POSOpeningEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<POSItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [group, setGroup] = useState("All Item Groups");
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [customer, setCustomer] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [isCheckoutView, setIsCheckoutView] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("Cash");
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState(0);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [completedOrder, setCompletedOrder] = useState<{
    invoice_number: string;
    customer: string;
    sold_by: string;
    items: POSCartItem[];
    net_total: number;
    discount: number;
    grand_total: number;
    payments: Record<string, number>;
    created_at: string;
  } | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [isOutdated, setIsOutdated] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [closingAmounts, setClosingAmounts] = useState<Record<string, number>>({});
  const [closingSubmitting, setClosingSubmitting] = useState(false);

  const warnedRef = useRef(false);

  useEffect(() => {
    posApi
      .currentOpening()
      .then(({ data, is_outdated }) => {
        setOpening(data);
        const outdated = Boolean(is_outdated);
        setIsOutdated(outdated);
        if (data && outdated) {
          setCloseShiftOpen(true);
          if (!warnedRef.current) {
            warnedRef.current = true;
            toast.warning(
              "Opening shift sudah lebih dari 12 jam. Selesaikan transaksi lalu tutup shift.",
              { id: "pos-opening-outdated-warning" },
            );
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCloseAndReopen = async () => {
    if (!opening) return;
    setClosingSubmitting(true);
    try {
      await posApi.closeOpening(opening.id, closingAmounts);
      toast.success("Shift lama berhasil ditutup! Silakan buat Opening Entry baru.");
      setCloseShiftOpen(false);
      navigate("/desk/pos-opening-entry/new");
    } catch (error: any) {
      toast.error(error?.message || "Gagal menutup POS shift");
    } finally {
      setClosingSubmitting(false);
    }
  };

  const loadItems = async () => {
    setItemsLoading(true);
    setItemsError("");
    try {
      setItems(await posApi.listItems());
    } catch (error: any) {
      setItems([]);
      setItemsError(
        error?.response?.data?.error || "Gagal mengambil item dari database",
      );
    } finally {
      setItemsLoading(false);
    }
  };

  const loadItemGroups = async () => {
    try {
      const data = await itemGroupApi.list();
      setItemGroups(data || []);
    } catch (err) {
      console.error("Failed to load item groups:", err);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await customerApi.list();
      setCustomers(data || []);
    } catch (err) {
      console.error("Failed to load customers:", err);
    }
  };

  useEffect(() => {
    void loadItems();
    void loadItemGroups();
    void loadCustomers();
  }, []);

  const searchCustomers = async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await customerApi.list(q);
      const opts: SearchableSelectOption[] = data.map((c) => ({
        value: c.customer_name,
        label: c.customer_name,
        sublabel: c.email || c.phone || c.customer_group || undefined,
        badge: c.territory || undefined,
      }));
      if (!q || "walk-in customer".includes(q.toLowerCase())) {
        opts.unshift({
          value: "Walk-in Customer",
          label: "Walk-in Customer",
          sublabel: "Pelanggan langsung",
        });
      }
      return opts;
    } catch {
      return [];
    }
  };

  const customerOptions = useMemo<SearchableSelectOption[]>(() => {
    const opts: SearchableSelectOption[] = [
      {
        value: "Walk-in Customer",
        label: "Walk-in Customer",
        sublabel: "Pelanggan langsung",
      },
      ...customers.map((c) => ({
        value: c.customer_name,
        label: c.customer_name,
        sublabel: c.email || c.phone || c.customer_group || undefined,
        badge: c.territory || undefined,
      })),
    ];
    if (customer && !opts.some((o) => o.value === customer)) {
      opts.push({ value: customer, label: customer });
    }
    return opts;
  }, [customers, customer]);

  const itemGroupOptions = useMemo<SearchableSelectOption[]>(() => {
    const names = new Set<string>();
    names.add("All Item Groups");
    itemGroups.forEach((ig) => {
      if (ig.item_group_name) names.add(ig.item_group_name);
    });
    items.forEach((it) => {
      if (it.item_group) names.add(it.item_group);
    });
    return Array.from(names).map((name) => ({
      value: name,
      label: name,
      badge: name === "All Item Groups" ? "Semua" : undefined,
    }));
  }, [itemGroups, items]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesGroup =
          group === "All Item Groups" || !group || item.item_group === group;
        const normalized = query.toLowerCase();
        return (
          matchesGroup &&
          (!normalized ||
            item.item_name.toLowerCase().includes(normalized) ||
            item.item_code.toLowerCase().includes(normalized) ||
            item.barcodes.some((barcode) =>
              barcode.toLowerCase().includes(normalized),
            ))
        );
      }),
    [group, items, query],
  );
  const netTotal = cart.reduce(
    (sum, item) => sum + item.rate * item.quantity,
    0,
  );
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addItem = (item: POSItem) => {
    setCart((current) => {
      const existing = current.find((row) => row.item_code === item.item_code);
      return existing
        ? current.map((row) =>
            row.item_code === item.item_code
              ? { ...row, quantity: row.quantity + 1 }
              : row,
          )
        : [...current, { ...item, quantity: 1 }];
    });
  };
  const changeQuantity = (code: string, quantity: number) =>
    setCart((current) =>
      quantity <= 0
        ? current.filter((row) => row.item_code !== code)
        : current.map((row) =>
            row.item_code === code ? { ...row, quantity } : row,
        ),
    );
  const changeRate = (code: string, rate: number) =>
    setCart((current) =>
      current.map((row) =>
        row.item_code === code
          ? { ...row, rate: Number.isFinite(rate) ? Math.max(0, rate) : 0 }
          : row,
      ),
    );

  const grandTotal = Math.max(0, netTotal - discount);
  const paidAmount = Object.values(paymentAmounts).reduce((a, b) => a + b, 0);

  const paymentMethods = useMemo(() => {
    const list = ["Cash", "Bank Transfer"];
    if (opening?.balance_details) {
      opening.balance_details.forEach((b) => {
        if (b.mode_of_payment && !list.includes(b.mode_of_payment)) {
          list.push(b.mode_of_payment);
        }
      });
    }
    return list;
  }, [opening]);

  const selectedCustomerObj = customers.find((c) => c.customer_name === customer);
  const customerEmailOrPhone = selectedCustomerObj?.email || selectedCustomerObj?.phone;

  const handleNumpadPress = (digit: string) => {
    setPaymentAmounts((prev) => {
      const currentVal = prev[selectedMethod] || 0;
      const strVal = currentVal === 0 ? digit : `${currentVal}${digit}`;
      const numVal = parseInt(strVal.slice(0, 12), 10) || 0;
      return { ...prev, [selectedMethod]: numVal };
    });
  };

  const handleNumpadDelete = () => {
    setPaymentAmounts((prev) => {
      const currentVal = prev[selectedMethod] || 0;
      const strVal = currentVal.toString();
      const nextStr = strVal.length > 1 ? strVal.slice(0, -1) : "0";
      return { ...prev, [selectedMethod]: parseInt(nextStr, 10) || 0 };
    });
  };

  const handleNumpadToggle = () => {
    setPaymentAmounts((prev) => ({
      ...prev,
      [selectedMethod]: 0,
    }));
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    const initialMethod = "Cash";
    setSelectedMethod(initialMethod);
    setPaymentAmounts({ [initialMethod]: Math.max(0, netTotal - discount) });
    setIsCheckoutView(true);
  };

  const handleNewOrder = () => {
    setCompletedOrder(null);
    setIsCheckoutView(false);
    setCart([]);
    setCustomer("");
    setDiscount(0);
    setPaymentAmounts({});
  };

  const handlePrintReceipt = () => {
    if (typeof window !== "undefined" && window.print) {
      window.print();
    }
  };


  const handleCompleteOrder = async () => {
    if (!opening || cart.length === 0) return;
    if (paidAmount < grandTotal) {
      toast.error(
        `Pembayaran masih kurang ${money(grandTotal - paidAmount)}. Masukkan jumlah pembayaran yang mencukupi.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const invoice = await posApi.createInvoice({
        opening_entry_id: opening.id,
        customer: customer || "Walk-in Customer",
        tax_total: 0,
        mode_of_payment: selectedMethod,
        paid_amount: paidAmount,
        items: cart.map((item) => ({
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.quantity,
          rate: item.rate,
        })),
      });
      const invoiceNum =
        invoice.invoice_number ||
        `ACC-SINV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;

      setCompletedOrder({
        invoice_number: invoiceNum,
        customer: customer || "Rabih",
        sold_by: opening.user || "Administrator",
        items: [...cart],
        net_total: netTotal,
        discount,
        grand_total: grandTotal,
        payments:
          Object.keys(paymentAmounts).length > 0
            ? { ...paymentAmounts }
            : { [selectedMethod]: paidAmount },
        created_at: new Date().toISOString(),
      });

      toast.success(`${invoiceNum} berhasil dibayar!`);
    } catch (error: any) {
      toast.error(error?.message || "Gagal menyelesaikan transaksi");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Menyiapkan POS...
      </div>
    );

  if (!opening)
    return (
      <div className="flex min-h-[75vh] items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100">
            <ReceiptText className="size-7 text-slate-600" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold">
            Buka shift sebelum mulai
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            POS membutuhkan Opening Entry aktif untuk mencatat kas awal dan
            merekonsiliasi pembayaran saat closing.
          </p>
          <Button
            className="mt-6 w-full"
            onClick={() => navigate("/desk/pos-opening-entry/new")}
          >
            <Plus /> Buat POS Opening Entry
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-[#f8f9fb]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">Point of Sale</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
            {opening.pos_profile}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOutdated ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setCloseShiftOpen(true)}
            >
              <AlertTriangle className="mr-1 size-4" /> Shift Outdated (&gt;12h) - Tutup Shift
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCloseShiftOpen(true)}
            >
              <LogOut className="mr-1 size-4" /> Tutup Shift
            </Button>
          )}
          <Button variant="outline" size="icon">
            <MoreHorizontal />
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/desk/pos-invoice")}
          >
            Recent Orders
          </Button>
          <Button onClick={handleNewOrder}>
            New Invoice
          </Button>
        </div>
      </div>

      {completedOrder ? (
        <div className="flex flex-1 items-start justify-center p-4 sm:p-8">
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #pos-receipt-card, #pos-receipt-card * {
                visibility: visible;
              }
              #pos-receipt-card {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0 !important;
                padding: 24px !important;
                border: none !important;
                box-shadow: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>
          <div
            id="pos-receipt-card"
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {completedOrder.customer || "Walk-in Customer"}
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Sold by: {completedOrder.sold_by}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl sm:text-2xl font-bold text-slate-900">
                  {money(completedOrder.grand_total)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {completedOrder.invoice_number}
                </p>
                <div className="mt-1.5 flex justify-end">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-600" />
                    Paid
                  </span>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="mt-6">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2.5">
                Items
              </h2>
              <div className="space-y-2">
                {completedOrder.items.map((item) => (
                  <div
                    key={item.item_code}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs sm:text-sm"
                  >
                    <span className="font-medium text-slate-800">
                      {item.item_name}
                    </span>
                    <div className="flex items-center gap-6 sm:gap-12">
                      <span className="text-slate-500">
                        {item.quantity} {item.unit || "Nos"}
                      </span>
                      <span className="min-w-20 text-right font-semibold text-slate-900">
                        {money(item.rate * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="mt-6">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2.5">
                Totals
              </h2>
              <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-xs sm:text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Net Total</span>
                  <span className="font-medium text-slate-900">
                    {money(completedOrder.net_total)}
                  </span>
                </div>
                {completedOrder.discount > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Discount</span>
                    <span className="font-medium text-rose-600">
                      -{money(completedOrder.discount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 font-bold text-slate-900">
                  <span>Grand Total</span>
                  <span>{money(completedOrder.grand_total)}</span>
                </div>
              </div>
            </div>

            {/* Payments */}
            <div className="mt-6">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2.5">
                Payments
              </h2>
              <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-xs sm:text-sm">
                {Object.entries(completedOrder.payments)
                  .filter(([, amount]) => amount > 0)
                  .map(([method, amount]) => (
                    <div
                      key={method}
                      className="flex items-center justify-between text-slate-700"
                    >
                      <span className="font-medium">{method}</span>
                      <span className="font-semibold text-slate-900">
                        {money(amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="no-print mt-6 flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4 shadow-none"
                onClick={handlePrintReceipt}
              >
                Print Receipt
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4 shadow-none"
                onClick={() => {
                  setEmailInput(selectedCustomerObj?.email || "");
                  setEmailDialogOpen(true);
                }}
              >
                Email Receipt
              </Button>
              <Button
                type="button"
                className="h-10 rounded-xl bg-slate-950 hover:bg-slate-900 text-white text-xs font-semibold px-5 shadow-xs ml-auto"
                onClick={handleNewOrder}
              >
                New Order
              </Button>
            </div>
          </div>
        </div>
      ) : !isCheckoutView ? (
        <div className="grid flex-1 gap-3 p-3 xl:grid-cols-[1.45fr_.95fr]">
          <section className="min-h-[720px] rounded-xl border bg-white p-4 shadow-sm lg:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">All Items</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {items.length} item aktif dari database
                </p>
              </div>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:max-w-2xl">
                <div className="flex h-10 flex-1 items-center rounded-lg bg-slate-100 px-3.5">
                  <Search className="size-4 shrink-0 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by item code, serial number or barcode"
                    className="w-full bg-transparent pl-2.5 text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="min-w-56 flex-1 sm:flex-initial">
                  <SearchableSelect
                    value={group}
                    options={itemGroupOptions}
                    onChange={(val) => setGroup(val || "All Item Groups")}
                    placeholder="Pilih Item Group..."
                    searchPlaceholder="Cari item group..."
                    addNewLabel="Tambah Item Group"
                    addNewHref="/desk/item-group/new"
                    buttonClassName="h-10 rounded-lg bg-slate-100 border-0 text-sm font-medium"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {filteredItems.map((item) => (
                <button
                  key={item.id || item.item_code}
                  type="button"
                  onClick={() => addItem(item)}
                  className="group overflow-hidden rounded-xl border bg-white text-left transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md"
                >
                  <div
                    className={`relative flex aspect-[1.22] items-center justify-center bg-gradient-to-br ${item.color}`}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-medium text-slate-500/80">
                        {item.initials}
                      </span>
                    )}
                    <span className="absolute right-2 top-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {item.is_stock_item
                        ? `● ${item.stock >= 1000 ? `${(item.stock / 1000).toFixed(1)}K` : item.stock}`
                        : "Non-stock"}
                    </span>
                    <span className="absolute bottom-2 right-2 flex size-7 scale-75 items-center justify-center rounded-full bg-slate-950 text-white opacity-0 transition group-hover:scale-100 group-hover:opacity-100">
                      <Plus className="size-4" />
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">
                      {item.item_name}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {money(item.rate)}{" "}
                      <span className="font-normal text-slate-400">
                        / {item.unit}
                      </span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {itemsLoading && (
              <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
                <RefreshCw className="size-4 animate-spin" /> Memuat item dari
                database...
              </div>
            )}
            {!itemsLoading && itemsError && (
              <div className="py-20 text-center">
                <p className="text-sm font-medium text-rose-600">{itemsError}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => void loadItems()}
                >
                  <RefreshCw className="size-4" /> Coba lagi
                </Button>
              </div>
            )}
            {!itemsLoading && !itemsError && filteredItems.length === 0 && (
              <div className="py-24 text-center text-sm text-slate-500">
                Item aktif tidak ditemukan. Tambahkan item melalui menu Item.
              </div>
            )}
          </section>

          <aside className="flex min-h-[720px] flex-col rounded-xl border bg-white p-4 shadow-sm lg:p-5">
            <div className="w-full">
              <SearchableSelect
                value={customer}
                options={customerOptions}
                onChange={(val) => setCustomer(val)}
                onSearch={searchCustomers}
                placeholder="Pilih atau cari customer..."
                searchPlaceholder="Cari customer (nama, phone, email)..."
                addNewLabel="Tambah Customer Baru"
                addNewHref="/desk/customer/new"
                buttonClassName="h-11 rounded-lg bg-slate-100 border-0 text-sm font-medium"
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Item Cart</h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Clear cart
                </button>
              )}
            </div>
            <div className="mt-4 min-h-80 flex-1 space-y-2 rounded-xl bg-slate-50 p-3">
              {cart.map((item) => (
                <div
                  key={item.item_code}
                  className="rounded-lg border bg-white p-3 shadow-sm"
                >
                  <div className="flex gap-3">
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-semibold text-slate-600 ${item.color}`}
                    >
                      {item.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.item_name}
                      </p>
                      <label className="mt-2 block text-xs font-medium text-slate-500">
                        Harga satuan ({item.unit})
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={item.rate}
                          aria-label={`Harga satuan ${item.item_name}`}
                          onChange={(event) =>
                            changeRate(item.item_code, Number(event.target.value))
                          }
                          className="mt-1 h-8 bg-white px-2 text-sm font-semibold text-slate-900"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => changeQuantity(item.item_code, 0)}
                      className="self-start text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center rounded-md border">
                      <button
                        type="button"
                        className="p-1.5"
                        onClick={() =>
                          changeQuantity(item.item_code, item.quantity - 1)
                        }
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-9 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="p-1.5"
                        onClick={() =>
                          changeQuantity(item.item_code, item.quantity + 1)
                        }
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-semibold">
                      {money(item.rate * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="flex h-full min-h-80 flex-col items-center justify-center text-slate-400">
                  <ShoppingCart className="size-9" />
                  <p className="mt-3 text-sm">No items in cart</p>
                  <p className="mt-1 text-xs">Klik item untuk menambahkannya</p>
                </div>
              )}
            </div>
            <div className="space-y-3 pt-5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Quantity</span>
                <span>{totalQuantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Net Total</span>
                <span>{money(netTotal)}</span>
              </div>
              <div className="flex justify-between border-t pt-4 text-lg font-semibold">
                <span>Grand Total</span>
                <span>{money(netTotal)}</span>
              </div>
            </div>
            <Button
              className="mt-5 h-12 w-full text-base"
              disabled={cart.length === 0}
              onClick={handleOpenCheckout}
            >
              Checkout
            </Button>
          </aside>
        </div>
      ) : (
        /* Full-screen Payment View matching user's reference */
        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr]">
          {/* Left Column: Customer & Cart */}
          <div className="space-y-4">
            {/* Customer Box */}
            <div className="flex items-center gap-3.5 rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-600">
                {customer ? customer.trim()[0].toUpperCase() : "R"}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-slate-900">
                  {customer || "Rabih"}
                </h3>
                <p className="truncate text-xs text-slate-400">
                  {customerEmailOrPhone || "Click to add email / phone"}
                </p>
              </div>
            </div>

            {/* Cart Box */}
            <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Item Cart</h2>

              <div className="text-xs">
                <div className="grid grid-cols-[1fr_80px_90px] border-b pb-2.5 font-medium text-slate-400">
                  <span>Item</span>
                  <span className="text-center">Quantity</span>
                  <span className="text-right">Amount</span>
                </div>
                <div className="divide-y max-h-80 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={item.item_code}
                      className="grid grid-cols-[1fr_80px_90px] items-center py-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100 text-[10px] font-semibold text-slate-500">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            item.initials
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {item.item_name}
                          </p>
                          <p className="truncate text-[10px] text-slate-400">
                            {item.item_code}
                          </p>
                        </div>
                      </div>
                      <span className="text-center text-xs font-medium text-slate-700">
                        {item.quantity} {item.unit || "Nos"}
                      </span>
                      <span className="text-right text-xs font-semibold text-slate-900">
                        {money(item.rate * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Discount */}
              <button
                type="button"
                onClick={() => {
                  setDiscountInput(discount ? String(discount) : "");
                  setDiscountDialogOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <Percent className="size-3.5 text-slate-400" />
                <span>
                  {discount > 0
                    ? `Discount: ${money(discount)}`
                    : "Add Discount"}
                </span>
              </button>

              {/* Totals breakdown */}
              <div className="space-y-2 border-t pt-3 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Total Quantity</span>
                  <span className="font-semibold text-slate-900">{totalQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Total</span>
                  <span className="font-semibold text-slate-900">{money(netTotal)}</span>
                </div>
                <div className="flex justify-between pt-1 text-sm font-bold text-slate-900">
                  <span>Grand Total</span>
                  <span>{money(grandTotal)}</span>
                </div>
              </div>

              {/* Edit Cart Button */}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCheckoutView(false)}
                className="h-10 w-full rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs shadow-none"
              >
                Edit Cart
              </Button>
            </div>
          </div>

          {/* Right Column: Payment Method & Numpad */}
          <div className="flex flex-col justify-between rounded-2xl border bg-white p-6 shadow-sm min-h-[640px]">
            <div>
              <h2 className="text-base font-semibold text-slate-900 mb-6">Payment Method</h2>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
                {/* Payment Methods list */}
                <div className="space-y-3">
                  {paymentMethods.map((method) => {
                    const isSelected = selectedMethod === method;
                    const amt = paymentAmounts[method] || 0;
                    return (
                      <div
                        key={method}
                        onClick={() => {
                          setSelectedMethod(method);
                          if (!paymentAmounts[method] && grandTotal > 0) {
                            setPaymentAmounts((prev) => ({
                              ...prev,
                              [method]: grandTotal,
                            }));
                          }
                        }}
                        className={cn(
                          "flex h-14 w-full cursor-pointer items-center justify-between rounded-xl px-4 transition",
                          isSelected
                            ? "border-2 border-slate-800 bg-white shadow-sm"
                            : "border border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <span className="text-sm font-medium text-slate-800">
                          {method}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {amt > 0 ? money(amt) : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Numpad */}
                <div className="flex justify-center lg:justify-end">
                  <div className="grid grid-cols-3 gap-2.5 w-60">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "+/-", "0", "Delete"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (key === "Delete") handleNumpadDelete();
                          else if (key === "+/-") handleNumpadToggle();
                          else handleNumpadPress(key);
                        }}
                        className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 active:bg-slate-100"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom stats and complete order button */}
            <div className="mt-8 space-y-3 pt-6 border-t lg:border-t-0">
              <div className="rounded-xl bg-slate-100 py-3.5 px-4">
                <div className="grid grid-cols-3 divide-x divide-slate-200 text-center">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">Grand Total</p>
                    <p className="mt-1 text-sm md:text-base font-bold text-slate-900">{money(grandTotal)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">Paid Amount</p>
                    <p className="mt-1 text-sm md:text-base font-bold text-slate-900">{money(paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">
                      {paidAmount >= grandTotal ? "Change Amount" : "Remaining Amount"}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm md:text-base font-bold",
                        paidAmount >= grandTotal
                          ? "text-emerald-600"
                          : paidAmount === 0
                          ? "text-slate-900"
                          : "text-amber-600"
                      )}
                    >
                      {money(
                        paidAmount >= grandTotal
                          ? paidAmount - grandTotal
                          : grandTotal - paidAmount
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="h-12 w-full rounded-xl bg-slate-950 hover:bg-slate-900 text-white text-sm font-semibold shadow-xs transition"
                onClick={handleCompleteOrder}
                disabled={submitting || cart.length === 0}
              >
                {submitting ? "Processing..." : "Complete Order"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Discount</DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan nominal diskon untuk pesanan ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-slate-700">Diskon (IDR)</label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDiscount(0);
                setDiscountInput("");
                setDiscountDialogOpen(false);
              }}
            >
              Hapus Diskon
            </Button>
            <Button
              onClick={() => {
                const val = parseFloat(discountInput) || 0;
                setDiscount(val);
                setDiscountDialogOpen(false);
              }}
            >
              Terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Receipt Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Email Receipt</DialogTitle>
            <DialogDescription className="text-xs">
              Kirim salinan receipt transaksi ke alamat email customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-slate-700">Alamat Email</label>
            <Input
              type="email"
              placeholder="customer@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              onClick={() => {
                if (!emailInput.trim() || !emailInput.includes("@")) {
                  toast.error("Silakan masukkan alamat email yang valid");
                  return;
                }
                toast.success(`Receipt berhasil dikirim ke ${emailInput}!`);
                setEmailDialogOpen(false);
              }}
            >
              Kirim Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={closeShiftOpen} onOpenChange={setCloseShiftOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <DialogTitle>Tutup Shift & Buka Opening Baru</DialogTitle>
                <DialogDescription className="text-xs">
                  {isOutdated
                    ? "Shift kasir ini sudah aktif lebih dari 12 jam. Selesaikan rekonsiliasi kas untuk menutup shift."
                    : "Selesaikan rekonsiliasi kas sebelum menutup shift kasir."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {opening && (
            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">POS Profile:</span>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {opening.pos_profile}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Kasir:</span>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {opening.user}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Waktu Buka Shift:</span>
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      {new Date(opening.period_start_date).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Status Shift:</span>
                    <div>
                      <Badge variant={isOutdated ? "destructive" : "outline"}>
                        {isOutdated ? "> 12 Jam (Kadaluarsa)" : "Aktif"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-medium text-slate-900 dark:text-white">
                  Saldo Akhir Kasir (Closing Amounts)
                </h4>
                <div className="space-y-2.5">
                  {(opening.balance_details || [{ mode_of_payment: "Cash", opening_amount: 0 }]).map((b) => (
                    <div
                      key={b.mode_of_payment}
                      className="flex items-center justify-between gap-4 rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {b.mode_of_payment}
                        </p>
                        <p className="text-xs text-slate-500">
                          Saldo Awal: {money(b.opening_amount)}
                        </p>
                      </div>
                      <div className="w-40">
                        <Input
                          type="number"
                          placeholder="0"
                          value={closingAmounts[b.mode_of_payment] ?? ""}
                          onChange={(e) =>
                            setClosingAmounts({
                              ...closingAmounts,
                              [b.mode_of_payment]: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCloseShiftOpen(false)}>
              Lanjutkan Transaksi
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={closingSubmitting}
              onClick={handleCloseAndReopen}
            >
              <LogOut className="mr-1 size-4" />
              {closingSubmitting ? "Menutup Shift..." : "Tutup Shift & Buat Opening Entry Baru"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
