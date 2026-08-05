import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Clock3, CreditCard, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/lib/auth";
import api from "@/lib/api";
import { formatPrice } from "@/lib/store-data";

type PaymentStatusData = {
  id: string;
  order_number: string;
  total: number;
  status: string;
  payment_status: string;
  payment_url?: string;
  payment_reference?: string;
  payment_expires_at?: string;
  paid_at?: string;
};

export const Route = createFileRoute("/payments/")({
  validateSearch: (search: Record<string, unknown>): { order_id?: string; result?: string } => ({
    order_id: typeof search.order_id === "string" ? search.order_id : undefined,
    result: typeof search.result === "string" ? search.result : undefined,
  }),
  head: () => ({ meta: [{ title: "Status Pembayaran — LUMÉA" }, { name: "robots", content: "noindex" }] }),
  component: () => <RequireAuth><PaymentStatusPage /></RequireAuth>,
});

function PaymentStatusPage() {
  const { order_id: orderID, result } = Route.useSearch();
  const [payment, setPayment] = useState<PaymentStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    if (!orderID) {
      setError("Nomor pesanan tidak ditemukan pada tautan pembayaran.");
      setLoading(false);
      return;
    }
    try {
      const response = await api.get<{ data: PaymentStatusData }>(`/store/orders/${encodeURIComponent(orderID)}/payment-status`);
      setPayment(response.data.data);
      setError("");
    } catch (requestError) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || "Status pembayaran belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, [orderID]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!orderID || payment?.payment_status === "PAID" || payment?.payment_status === "EXPIRED") return;
    const timer = window.setInterval(() => void loadStatus(), 4000);
    return () => window.clearInterval(timer);
  }, [loadStatus, orderID, payment?.payment_status]);

  const status = payment?.payment_status?.toUpperCase();
  const paid = status === "PAID";
  const expired = status === "EXPIRED";

  return <div className="min-h-screen bg-[#f7f7f7] text-neutral-950">
    <header className="border-b bg-white"><div className="mx-auto flex h-20 max-w-[1100px] items-center justify-between px-5 sm:px-8"><Link to="/" className="text-2xl font-black tracking-[0.25em]">LUMÉA</Link><div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="size-4" /> SECURE PAYMENT</div></div></header>
    <main className="mx-auto flex max-w-[1100px] justify-center px-5 py-14 sm:px-8 lg:py-20">
      <section className={`w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-sm ${paid ? "border-t-4 border-t-emerald-500" : expired || error ? "border-t-4 border-t-rose-500" : "border-t-4 border-t-black"}`}>
        <div className="p-7 text-center sm:p-9">
          {loading ? <><Loader2 className="mx-auto size-12 animate-spin text-neutral-400" /><h1 className="mt-5 text-2xl font-bold">Memeriksa pembayaran</h1><p className="mt-2 text-sm text-neutral-500">Menunggu konfirmasi aman dari Xendit.</p></> : error ? <><AlertCircle className="mx-auto size-14 text-rose-600" /><h1 className="mt-5 text-2xl font-bold">Pembayaran tidak dapat dimuat</h1><p className="mt-2 text-sm text-neutral-500">{error}</p></> : paid ? <><CheckCircle2 className="mx-auto size-16 text-emerald-600" /><h1 className="mt-5 text-2xl font-bold">Pembayaran berhasil!</h1><p className="mt-2 text-sm text-neutral-500">Pesanan Anda sudah dikonfirmasi dan akan segera kami proses.</p></> : expired ? <><AlertCircle className="mx-auto size-16 text-rose-600" /><h1 className="mt-5 text-2xl font-bold">Pembayaran kedaluwarsa</h1><p className="mt-2 text-sm text-neutral-500">Batas waktu pembayaran Xendit telah berakhir. Silakan buat pesanan baru.</p></> : <><Clock3 className="mx-auto size-16 text-amber-500" /><h1 className="mt-5 text-2xl font-bold">Menunggu pembayaran</h1><p className="mt-2 text-sm text-neutral-500">{result === "failed" ? "Pembayaran belum diselesaikan. Anda masih dapat melanjutkannya selama invoice aktif." : "Status diperbarui otomatis setelah Xendit mengonfirmasi pembayaran."}</p></>}

          {payment && <div className="mt-7 rounded-xl border bg-neutral-50 p-5 text-left"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Nomor Pesanan</p><p className="mt-1 font-mono text-sm font-semibold">{payment.order_number}</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Total</p><p className="mt-1 font-bold">{formatPrice(Number(payment.total))}</p></div></div>{payment.payment_expires_at && !paid && !expired && <p className="mt-4 border-t pt-3 text-xs text-neutral-500">Berlaku sampai {new Date(payment.payment_expires_at).toLocaleString("id-ID")}</p>}</div>}

          {!loading && !error && !paid && !expired && payment?.payment_url && <a href={payment.payment_url} className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-black text-xs font-bold tracking-[0.12em] text-white transition hover:bg-[#e4003f]"><CreditCard className="size-4" /> LANJUTKAN DI XENDIT</a>}
          {!loading && <button type="button" onClick={() => void loadStatus()} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-black"><RefreshCw className="size-3.5" /> Perbarui status</button>}
          {(paid || expired || error) && <a href={paid ? "/account?tab=orders" : "/"} className="mt-6 flex h-12 w-full items-center justify-center bg-black text-xs font-bold tracking-[0.12em] text-white">{paid ? "LIHAT PESANAN" : "KEMBALI KE BERANDA"}</a>}
        </div>
        <div className="border-t bg-neutral-50 px-7 py-4 text-center text-[11px] text-neutral-400">Pembayaran diproses secara aman oleh Xendit. Secret key tidak pernah dikirim ke browser.</div>
      </section>
    </main>
  </div>;
}
