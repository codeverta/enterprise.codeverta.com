import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ChevronLeft, CreditCard, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RequireAuth, useAuth } from "@/lib/auth";
import { useCommerce } from "@/lib/commerce";
import { formatPrice } from "@/lib/store-data";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — LUMÉA" }] }),
  component: () => <RequireAuth><CheckoutPage /></RequireAuth>,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const { cart, subtotal, updateQuantity, removeFromCart, placeOrder } = useCommerce();
  const [address, setAddress] = useState(user?.address || "");
  const [paymentMethod, setPaymentMethod] = useState("GoPay");
  const [processing, setProcessing] = useState(false);
  const shipping = subtotal >= 500000 || subtotal === 0 ? 0 : 25000;
  const total = subtotal + shipping;

  const submit = async () => {
    if (!address.trim()) return toast.error("Masukkan alamat pengiriman");
    setProcessing(true);
    try {
      const profileResult = await updateProfile({ address });
      if (profileResult.error) throw new Error(profileResult.error);
      const order = await placeOrder({ paymentMethod, address });
      toast.success(`Pesanan ${order.id} berhasil dibuat`);
      navigate({ to: "/account", search: { tab: "orders" } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pesanan gagal dibuat");
    } finally {
      setProcessing(false);
    }
  };

  return <div className="min-h-screen bg-[#f7f7f7] text-neutral-950">
    <header className="border-b bg-white"><div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-5 sm:px-8"><Link to="/" className="text-2xl font-black tracking-[0.25em]">LUMÉA</Link><div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="size-4" /> SECURE CHECKOUT</div></div></header>
    <main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold"><ChevronLeft className="size-4" /> Lanjut belanja</Link>
      <h1 className="mt-6 font-serif text-4xl sm:text-5xl">Checkout</h1>
      {cart.length === 0 ? <div className="mt-8 rounded-xl border bg-white py-20 text-center"><ShoppingBag className="mx-auto size-12 text-neutral-300" /><h2 className="mt-4 text-xl font-semibold">Bag Anda masih kosong</h2><p className="mt-2 text-sm text-neutral-500">Tambahkan beauty essentials sebelum checkout.</p><Link to="/" className="mt-6 inline-block bg-black px-7 py-3 text-xs font-bold text-white">MULAI BELANJA</Link></div> : <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <section className="rounded-xl border bg-white p-5 sm:p-6"><div className="flex items-center gap-3 border-b pb-4"><Truck className="size-5" /><div><h2 className="font-semibold">Alamat Pengiriman</h2><p className="text-xs text-neutral-500">Pesanan akan dikirim ke alamat ini.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-neutral-500">Penerima<input value={user?.fullName || ""} disabled className="mt-2 h-11 w-full rounded-lg border bg-neutral-50 px-3 text-sm text-black" /></label><label className="text-xs font-semibold text-neutral-500">Nomor HP<input value={user?.phone || ""} disabled className="mt-2 h-11 w-full rounded-lg border bg-neutral-50 px-3 text-sm text-black" /></label></div><label className="mt-4 block text-xs font-semibold text-neutral-500">Alamat Lengkap<textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Nama jalan, nomor rumah, kecamatan, kota, kode pos" className="mt-2 min-h-28 w-full rounded-lg border p-3 text-sm text-black outline-none focus:border-black" /></label></section>
          <section className="rounded-xl border bg-white p-5 sm:p-6"><h2 className="border-b pb-4 font-semibold">Produk ({cart.reduce((sum, item) => sum + item.quantity, 0)})</h2><div className="divide-y">{cart.map((item) => <article key={item.id} className="flex gap-4 py-5"><img src={item.image} alt={item.name} className="size-24 shrink-0 object-cover sm:size-28" /><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{item.brand}</p><h3 className="mt-1 text-sm font-semibold">{item.name}</h3><p className="mt-2 text-sm font-bold">{formatPrice(item.price)}</p><div className="mt-4 flex items-center justify-between"><div className="flex items-center border"><button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2"><Minus className="size-3" /></button><span className="w-8 text-center text-sm">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2"><Plus className="size-3" /></button></div><button type="button" aria-label={`Hapus ${item.name}`} onClick={() => removeFromCart(item.id)}><Trash2 className="size-4 text-neutral-400 hover:text-rose-600" /></button></div></div></article>)}</div></section>
        </div>
        <aside className="rounded-xl border bg-white p-5 shadow-sm lg:sticky lg:top-5 sm:p-6"><h2 className="text-lg font-semibold">Ringkasan Belanja</h2><div className="mt-5 space-y-3 border-b pb-5 text-sm"><div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span>{formatPrice(subtotal)}</span></div><div className="flex justify-between"><span className="text-neutral-500">Pengiriman</span><span className={shipping === 0 ? "font-semibold text-emerald-600" : ""}>{shipping === 0 ? "Gratis" : formatPrice(shipping)}</span></div></div><div className="flex justify-between py-5 text-lg font-bold"><span>Total</span><span>{formatPrice(total)}</span></div><label className="text-xs font-semibold text-neutral-500">Metode Pembayaran<div className="relative mt-2"><CreditCard className="absolute left-3 top-3.5 size-4" /><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="h-12 w-full appearance-none rounded-lg border bg-white pl-10 pr-3 text-sm font-medium"><option>GoPay</option><option>QRIS</option><option>Virtual Account BCA</option><option>Kartu Kredit / Debit</option><option>Bank Transfer</option></select></div></label><button type="button" disabled={processing} onClick={submit} className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-black text-xs font-bold tracking-[0.12em] text-white transition hover:bg-[#e4003f] disabled:opacity-60">{processing ? "MEMPROSES..." : "BUAT PESANAN"}<CheckCircle2 className="size-4" /></button><p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-400">Dengan melanjutkan, Anda menyetujui syarat pembelian dan kebijakan privasi LUMÉA.</p></aside>
      </div>}
    </main>
  </div>;
}
