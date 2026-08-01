import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Bell, ChevronRight, CircleHelp, Coins, Heart, Home, LogOut, MapPin, MessageCircle, Package, Settings, ShieldCheck, ShoppingBag, Star, UserRound, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth, useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/store-data";
import { useCommerce } from "@/lib/commerce";
import api from "@/lib/api";

type AccountTab = "profile" | "orders" | "wishlist" | "addresses" | "security";
export const Route = createFileRoute("/account")({
  validateSearch: (search: Record<string, unknown>) => ({ tab: (["profile", "orders", "wishlist", "addresses", "security"].includes(String(search.tab)) ? search.tab : "profile") as AccountTab }),
  head: () => ({ meta: [{ title: "Akun Saya — LUMÉA" }] }),
  component: () => <RequireAuth><AccountPage /></RequireAuth>,
});

const menuGroups = [
  { title: "Kotak Masuk", items: [{ label: "Chat", icon: MessageCircle }, { label: "Ulasan", icon: Star }, { label: "Pesan Bantuan", icon: CircleHelp }, { label: "Update", icon: Bell }] },
  { title: "Pembelian", items: [{ label: "Menunggu Pembayaran", icon: WalletCards, tab: "orders" }, { label: "Daftar Transaksi", icon: Package, tab: "orders" }] },
  { title: "Profil Saya", items: [{ label: "Wishlist", icon: Heart, tab: "wishlist" }, { label: "Daftar Alamat", icon: MapPin, tab: "addresses" }, { label: "Pengaturan", icon: Settings, tab: "profile" }, { label: "Keamanan", icon: ShieldCheck, tab: "security" }] },
] as const;

function AccountPage() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const { user, updateProfile, refreshProfile, signOut } = useAuth();
  const { orders, wishlist, addToCart } = useCommerce();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: user?.fullName || "", phone: user?.phone || "", birthDate: user?.birthDate || "", gender: user?.gender || "", address: user?.address || "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingOrders = orders.filter((order) => order.status === "Menunggu Pembayaran").length;
  const totalSpent = useMemo(() => orders.filter((order) => order.status !== "Menunggu Pembayaran").reduce((sum, order) => sum + order.total, 0), [orders]);

  const save = async () => {
    const result = await updateProfile(form);
    if (result.error) return toast.error(result.error);
    setEditing(false);
    toast.success("Profil berhasil diperbarui");
  };
  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (file.size > 5_000_000 || !["image/jpeg", "image/png"].includes(file.type)) return toast.error("Gunakan JPG atau PNG maksimal 5 MB");
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post("/my-profile/avatar", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await refreshProfile();
      toast.success("Foto profil diperbarui");
    } catch {
      toast.error("Foto profil gagal diunggah");
    }
  };

  return <div className="min-h-screen bg-[#f7f7f7] text-neutral-950">
    <header className="border-b bg-white"><div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-5 sm:px-8"><Link to="/" className="text-2xl font-black tracking-[0.25em]">LUMÉA</Link><div className="flex items-center gap-3"><Link to="/" className="hidden text-sm font-semibold sm:block">Lanjut Belanja</Link><Link to="/checkout" aria-label="Tas belanja" className="relative flex size-10 items-center justify-center rounded-full hover:bg-neutral-100"><ShoppingBag className="size-5" /></Link></div></div></header>
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 lg:py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-neutral-500"><Home className="size-3.5" /><Link to="/">Home</Link><ChevronRight className="size-3" /><span>Akun Saya</span></div>
      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-black p-5 text-white md:col-span-2"><p className="text-xs font-bold tracking-[0.12em] text-white/60">LUMÉA CIRCLE</p><div className="mt-3 flex items-end justify-between"><div><h2 className="text-xl font-semibold">Membership belum aktif</h2><p className="mt-1 text-sm text-white/60">Belanja 1x lagi untuk membuka member perks.</p></div><Coins className="size-8 text-[#f2a6b5]" /></div></div>
        <div className="rounded-xl border bg-white p-5"><p className="text-xs text-neutral-500">Beauty Points</p><p className="mt-2 text-2xl font-bold">{Math.floor(totalSpent / 10000)} <span className="text-sm font-medium">points</span></p></div>
        <div className="rounded-xl border bg-white p-5"><p className="text-xs text-neutral-500">LUMÉA Wallet</p><p className="mt-2 text-2xl font-bold">{formatPrice(user?.balance || 0)}</p></div>
      </section>
      <div className="grid gap-6 lg:grid-cols-[270px_1fr]">
        <aside className="self-start rounded-xl border bg-white p-4 lg:sticky lg:top-5">
          <div className="flex items-center gap-3 border-b pb-4"><div className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-[#f5d7dc]">{user?.avatar ? <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" /> : <UserRound className="size-5" />}</div><div className="min-w-0"><p className="truncate font-semibold">{user?.fullName}</p><p className="truncate text-xs text-neutral-500">{user?.email}</p></div></div>
          <nav className="mt-4 space-y-5">{menuGroups.map((group) => <div key={group.title}><p className="px-2 text-[11px] font-bold uppercase tracking-[0.13em] text-neutral-400">{group.title}</p><div className="mt-2 space-y-1">{group.items.map((item) => { const Icon = item.icon; const itemTab = "tab" in item ? item.tab : undefined; return <button key={item.label} type="button" onClick={() => itemTab ? navigate({ to: "/account", search: { tab: itemTab } }) : toast.info(`${item.label} akan segera tersedia`)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-neutral-100 ${itemTab === tab ? "bg-neutral-100 font-semibold" : "text-neutral-600"}`}><Icon className="size-4" />{item.label}{item.label === "Menunggu Pembayaran" && pendingOrders > 0 && <span className="ml-auto rounded-full bg-[#e4003f] px-2 py-0.5 text-[10px] font-bold text-white">{pendingOrders}</span>}</button>; })}</div></div>)}</nav>
          <button type="button" onClick={async () => { await signOut(); navigate({ to: "/" }); }} className="mt-6 flex w-full items-center gap-3 border-t px-2.5 pt-4 text-sm font-semibold text-rose-600"><LogOut className="size-4" /> Keluar</button>
        </aside>

        <section className="min-w-0 rounded-xl border bg-white p-5 sm:p-8">
          {tab === "profile" && <div><div className="flex items-center justify-between border-b pb-5"><div><h1 className="text-2xl font-semibold">Biodata Diri</h1><p className="mt-1 text-sm text-neutral-500">Kelola informasi personal dan kontak Anda.</p></div><button type="button" onClick={() => editing ? save() : setEditing(true)} className="border-b border-black pb-1 text-xs font-bold tracking-[0.1em]">{editing ? "SIMPAN" : "UBAH"}</button></div><div className="grid gap-8 py-7 md:grid-cols-[190px_1fr]">
            <div><div className="aspect-square overflow-hidden rounded-xl bg-neutral-100">{user?.avatar ? <img src={user.avatar} alt="Foto profile" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><UserRound className="size-16 text-neutral-300" /></div>}</div><input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} /><button type="button" onClick={() => fileRef.current?.click()} className="mt-3 w-full border border-black py-2.5 text-xs font-bold tracking-[0.1em]">PILIH FOTO</button><p className="mt-2 text-[11px] leading-relaxed text-neutral-400">JPG, JPEG, atau PNG. Maksimal 5 MB.</p></div>
            <div className="space-y-7"><div><h2 className="text-sm font-bold">Biodata</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Nama" value={form.fullName} disabled={!editing} onChange={(value) => setForm({ ...form, fullName: value })} /><Field label="Tanggal Lahir" value={form.birthDate} type="date" disabled={!editing} onChange={(value) => setForm({ ...form, birthDate: value })} /><Field label="Jenis Kelamin" value={form.gender} disabled={!editing} onChange={(value) => setForm({ ...form, gender: value })} /></div></div><div className="border-t pt-6"><h2 className="text-sm font-bold">Kontak</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Email" value={user?.email || ""} disabled verified /><Field label="Nomor HP" value={form.phone} disabled={!editing} onChange={(value) => setForm({ ...form, phone: value })} verified={Boolean(form.phone)} /></div></div></div>
          </div></div>}
          {tab === "orders" && <div><PageTitle title="Daftar Transaksi" subtitle="Pantau status dan detail seluruh pembelian Anda." />{orders.length ? <div className="mt-6 space-y-4">{orders.map((order) => <article key={order.id} className="rounded-xl border p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-xs"><div><span className="font-bold">{order.id}</span><span className="ml-3 text-neutral-500">{new Date(order.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}</span></div><span className={`rounded-full px-3 py-1 font-semibold ${order.status === "Menunggu Pembayaran" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{order.status}</span></div><div className="mt-4 flex gap-4"><img src={order.items[0]?.image} alt="" className="size-20 object-cover" /><div className="min-w-0 flex-1"><p className="font-semibold">{order.items[0]?.name}</p><p className="mt-1 text-xs text-neutral-500">{order.items.length > 1 ? `+${order.items.length - 1} produk lainnya` : `${order.items[0]?.quantity} item`}</p><p className="mt-3 text-sm font-bold">{formatPrice(order.total)}</p></div></div></article>)}</div> : <EmptyState icon={Package} title="Belum ada transaksi" action="Mulai belanja" />}</div>}
          {tab === "wishlist" && <div><PageTitle title="Wishlist" subtitle="Beauty finds yang Anda simpan untuk nanti." />{wishlist.length ? <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">{wishlist.map((product) => <article key={product.id}><Link to="/product/$slug" params={{ slug: product.slug }}><img src={product.image} alt={product.name} className="aspect-[4/5] w-full object-cover" /></Link><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{product.brand}</p><Link to="/product/$slug" params={{ slug: product.slug }}><h3 className="mt-1 text-sm font-medium hover:underline">{product.name}</h3></Link><p className="mt-2 text-sm font-bold">{formatPrice(product.price)}</p><button type="button" onClick={async () => { try { await addToCart(product); toast.success("Ditambahkan ke bag"); } catch { toast.error("Gagal menambahkan ke bag"); } }} className="mt-3 w-full bg-black py-2.5 text-xs font-bold text-white">ADD TO BAG</button></article>)}</div> : <EmptyState icon={Heart} title="Wishlist masih kosong" action="Cari produk favorit" />}</div>}
          {tab === "addresses" && <div><PageTitle title="Daftar Alamat" subtitle="Alamat ini akan digunakan sebagai tujuan pengiriman checkout." /><div className="mt-6 rounded-xl border p-5"><div className="flex items-start justify-between"><div><span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white">UTAMA</span><p className="mt-3 font-semibold">{user?.fullName}</p><p className="mt-1 text-sm text-neutral-500">{user?.phone || "Nomor HP belum ditambahkan"}</p></div><MapPin className="size-5 text-neutral-400" /></div><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Masukkan alamat lengkap, kecamatan, kota, dan kode pos" className="mt-5 min-h-28 w-full rounded-lg border p-3 text-sm outline-none focus:border-black" /><button type="button" onClick={async () => { const result = await updateProfile({ address: form.address }); result.error ? toast.error(result.error) : toast.success("Alamat disimpan"); }} className="mt-3 bg-black px-5 py-2.5 text-xs font-bold text-white">SIMPAN ALAMAT</button></div></div>}
          {tab === "security" && <div><PageTitle title="Keamanan" subtitle="Kelola perlindungan akun buyer Anda." /><div className="mt-6 divide-y rounded-xl border">{[{ title: "Kata Sandi", desc: "Ubah kata sandi secara berkala" }, { title: "PIN LUMÉA", desc: "Tambahkan PIN untuk konfirmasi pembayaran" }, { title: "Verifikasi Instan", desc: "Email Anda sudah terverifikasi" }, { title: "Google Authenticator", desc: "Tambahkan autentikasi dua langkah" }].map((item) => <div key={item.title} className="flex items-center justify-between p-5"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-neutral-500">{item.desc}</p></div><button type="button" onClick={() => toast.info("Pengaturan ini akan tersedia pada tahap keamanan berikutnya")} className="text-xs font-bold">ATUR</button></div>)}</div></div>}
        </section>
      </div>
    </main>
  </div>;
}

function Field({ label, value, disabled, type = "text", verified, onChange }: { label: string; value: string; disabled?: boolean; type?: string; verified?: boolean; onChange?: (value: string) => void }) { return <label className="text-xs font-semibold text-neutral-500">{label}<div className="mt-2 flex h-11 items-center border-b border-neutral-200"><input type={type} value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-black outline-none disabled:text-neutral-700" />{verified && <span className="text-[10px] font-bold text-emerald-600">TERVERIFIKASI</span>}</div></label>; }
function PageTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="border-b pb-5"><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-1 text-sm text-neutral-500">{subtitle}</p></div>; }
function EmptyState({ icon: Icon, title, action }: { icon: typeof Package; title: string; action: string }) { return <div className="py-20 text-center"><Icon className="mx-auto size-12 text-neutral-300" /><h2 className="mt-4 font-semibold">{title}</h2><Link to="/" className="mt-5 inline-block bg-black px-6 py-3 text-xs font-bold text-white">{action.toUpperCase()}</Link></div>; }
