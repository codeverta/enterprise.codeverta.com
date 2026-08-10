import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  LogOut,
  Minus,
  MoreHorizontal,
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
  const [customer, setCustomer] = useState("");
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [submitting, setSubmitting] = useState(false);

  const [isOutdated, setIsOutdated] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [closingAmounts, setClosingAmounts] = useState<Record<string, number>>({});
  const [closingSubmitting, setClosingSubmitting] = useState(false);

  useEffect(() => {
    posApi
      .currentOpening()
      .then(({ data, is_outdated }) => {
        setOpening(data);
        const outdated = Boolean(is_outdated);
        setIsOutdated(outdated);
        if (data && outdated) {
          setCloseShiftOpen(true);
          toast.warning(
            "Opening shift sudah lebih dari 12 jam. Selesaikan transaksi lalu tutup shift.",
          );
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

  useEffect(() => {
    void loadItems();
  }, []);

  const groups = useMemo(
    () => ["All Item Groups", ...new Set(items.map((item) => item.item_group))],
    [items],
  );
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesGroup =
          group === "All Item Groups" || item.item_group === group;
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

  const checkout = async () => {
    if (!opening || cart.length === 0) return;
    setSubmitting(true);
    try {
      const invoice = await posApi.createInvoice({
        opening_entry_id: opening.id,
        customer: customer || "Walk-in Customer",
        tax_total: 0,
        mode_of_payment: paymentMethod,
        paid_amount: netTotal,
        items: cart.map((item) => ({
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.quantity,
          rate: item.rate,
        })),
      });
      toast.success(
        `${invoice.invoice_number || "POS Invoice"} berhasil dibayar`,
      );
      setCart([]);
      setCustomer("");
      setPaymentOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Gagal menyimpan transaksi");
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
          <Button
            onClick={() => {
              setCart([]);
              setCustomer("");
            }}
          >
            New Invoice
          </Button>
        </div>
      </div>

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
              <div className="flex h-10 flex-1 items-center rounded-lg bg-slate-100 px-3">
                <Search className="mr-2 size-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by item code, serial number or barcode"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
              <div className="relative min-w-52">
                <ERPSelect
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border-0 bg-slate-100 px-3 pr-8 text-sm outline-none"
                >
                  {groups.map((name) => (
                    <ERPSelectOption key={name}>{name}</ERPSelectOption>
                  ))}
                </ERPSelect>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-slate-400" />
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
          <div className="flex h-11 items-center rounded-lg bg-slate-100 px-3">
            <UserRound className="mr-2 size-4 text-slate-400" />
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Search by customer name, phone, email"
              className="w-full bg-transparent text-sm outline-none"
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
                    <p className="mt-0.5 text-xs text-slate-500">
                      {money(item.rate)} / {item.unit}
                    </p>
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
            onClick={() => setPaymentOpen(true)}
          >
            Checkout
          </Button>
        </aside>
      </div>

      {paymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Payment</p>
                <h2 className="text-xl font-semibold">Selesaikan transaksi</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPaymentOpen(false)}
              >
                <X />
              </Button>
            </div>
            <div className="my-6 rounded-xl bg-slate-950 p-5 text-white">
              <p className="text-xs text-white/60">Amount to pay</p>
              <p className="mt-1 text-3xl font-semibold">{money(netTotal)}</p>
              <p className="mt-3 text-xs text-white/60">
                {customer || "Walk-in Customer"} · {totalQuantity} item
              </p>
            </div>
            <label className="text-sm font-medium">
              Mode of Payment
              <ERPSelect
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-2 h-11 w-full rounded-lg border bg-white px-3"
              >
                <ERPSelectOption>Cash</ERPSelectOption>
                <ERPSelectOption>QRIS</ERPSelectOption>
                <ERPSelectOption>Bank Transfer</ERPSelectOption>
                <ERPSelectOption>Credit Card</ERPSelectOption>
              </ERPSelect>
            </label>
            <Button
              className="mt-6 h-11 w-full"
              onClick={checkout}
              disabled={submitting}
            >
              {submitting ? "Processing..." : `Pay ${money(netTotal)}`}
            </Button>
          </div>
        </div>
      )}

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
