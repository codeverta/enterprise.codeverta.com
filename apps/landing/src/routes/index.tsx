import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Globe2,
  Heart,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCommerce } from "@/lib/commerce";
import {
  formatPrice,
  formatReviewCount,
  getStoreCategories,
  getStoreProducts,
  type StoreProduct,
} from "@/lib/store-data";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  head: () => ({
    meta: [
      { title: "LUMÉA — Your Beauty, Your Way" },
      {
        name: "description",
        content:
          "Belanja makeup, skincare, fragrance, dan beauty essentials pilihan di LUMÉA.",
      },
      { property: "og:title", content: "LUMÉA — Your Beauty, Your Way" },
      {
        property: "og:description",
        content: "Temukan beauty essentials baru, produk eksklusif, dan penawaran pilihan.",
      },
    ],
  }),
  component: BeautyHomePage,
});

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-neutral-950 transition hover:bg-neutral-100"
    >
      {children}
    </button>
  );
}

function ProductCard({
  product,
}: {
  product: StoreProduct;
}) {
  const { addToCart, toggleWishlist, isWishlisted } = useCommerce();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const liked = isWishlisted(product.id);

  const requireBuyer = () => {
    if (isAuthenticated) return true;
    navigate({ to: "/login", search: { redirect: `/product/${product.slug}` } });
    return false;
  };

  const addBag = async () => {
    if (!requireBuyer()) return;
    try {
      await addToCart(product);
      toast.success("Produk ditambahkan ke bag");
    } catch {
      toast.error("Produk gagal ditambahkan ke bag");
    }
  };

  const toggleLike = async () => {
    if (!requireBuyer()) return;
    try {
      await toggleWishlist(product);
    } catch {
      toast.error("Wishlist gagal diperbarui");
    }
  };

  return (
    <article className="group min-w-[74vw] snap-start sm:min-w-[46%] lg:min-w-0">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#f6f3f0]">
        <Link to="/product/$slug" params={{ slug: product.slug }} className="block h-full">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
            loading="lazy"
          />
        </Link>
        {product.badge && <span className="absolute left-3 top-3 bg-white px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] text-black">
          {product.badge}
        </span>}
        <button
          type="button"
          aria-label={liked ? "Hapus dari wishlist" : "Tambah ke wishlist"}
          onClick={toggleLike}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-105"
        >
          <Heart className={`h-[18px] w-[18px] ${liked ? "fill-[#db3150] text-[#db3150]" : "text-black"}`} />
        </button>
        <button
          type="button"
          onClick={addBag}
          className="absolute inset-x-3 bottom-3 translate-y-0 bg-black py-3 text-xs font-bold tracking-[0.14em] text-white opacity-100 transition duration-300 hover:bg-[#d9294f] focus:translate-y-0 focus:opacity-100 lg:translate-y-3 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100"
        >
          ADD TO BAG
        </button>
      </div>
      <div className="pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-neutral-600">{product.brand}</p>
        <Link to="/product/$slug" params={{ slug: product.slug }}><h3 className="mt-1.5 min-h-11 text-sm font-medium leading-snug text-neutral-950 hover:underline">{product.name}</h3></Link>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
          <Star className="h-3.5 w-3.5 fill-black text-black" />
          <span className="font-semibold text-black">{product.rating}</span>
          <span>({formatReviewCount(product.reviewCount)})</span>
        </div>
        <p className="mt-2 text-sm font-bold text-neutral-950">{formatPrice(product.price)}</p>
      </div>
    </article>
  );
}

function BeautyHomePage() {
  const { user, isAuthenticated } = useAuth();
  const { cartCount } = useCommerce();
  const { category } = Route.useSearch();
  const navigate = useNavigate();
  const adminUrl = import.meta.env.VITE_ADMIN_URL || "http://localhost:5174";
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());

  const categoriesQuery = useQuery({ queryKey: ["store-categories"], queryFn: getStoreCategories });
  const productsQuery = useQuery({
    queryKey: ["store-products", category || "all"],
    queryFn: () => getStoreProducts({ category }),
  });
  const categories = categoriesQuery.data || [];
  const storeProducts = productsQuery.data || [];
  const navItems = ["New", ...categories.map((item) => item.name), "Brands", "Gifts", "Sale"];
  const searchQuery = useQuery({
    queryKey: ["store-products-search", deferredQuery],
    queryFn: () => getStoreProducts({ query: deferredQuery }),
    enabled: deferredQuery.length > 0,
  });
  const searchResults = deferredQuery ? searchQuery.data || [] : [];

  const selectCategory = (slug?: string) => {
    navigate({ to: "/", search: { category: slug } });
    window.setTimeout(() => document.getElementById("new")?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-neutral-950 selection:bg-[#f8c6cf]">
      <div className="bg-[#e4003f] px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-white sm:text-xs">
        10% off pembelian pertama · Gunakan kode <span className="underline underline-offset-2">HELLOLUMEA</span>
      </div>

      <div className="hidden bg-black text-white lg:block">
        <div className="mx-auto flex h-11 max-w-[1440px] items-center justify-between px-8 text-xs">
          <div className="flex items-center gap-6">
            <a href={isAuthenticated ? "/account" : "/login"} className="flex items-center gap-2 hover:text-white/70"><UserRound className="h-4 w-4" /> {isAuthenticated ? user?.fullName : "Masuk / Daftar"}</a>
            <a href="#pass" className="flex items-center gap-2 hover:text-white/70"><Sparkles className="h-4 w-4" /> Beauty Circle</a>
          </div>
          <div className="flex items-center gap-6">
            <button type="button" className="flex items-center gap-1.5 hover:text-white/70"><Globe2 className="h-4 w-4" /> ID <ChevronDown className="h-3 w-3" /></button>
            <a href={adminUrl} className="flex items-center gap-2 font-semibold hover:text-white/70">Login sebagai Seller</a>
            <a href="#stores" className="flex items-center gap-2 hover:text-white/70"><MapPin className="h-4 w-4" /> Store & Events</a>
            <a href={isAuthenticated ? "/account?tab=wishlist" : "/login?redirect=/account?tab=wishlist"} className="flex items-center gap-2 hover:text-white/70"><Heart className="h-4 w-4" /> Wishlist</a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-4 px-4 sm:px-8 lg:h-[86px]">
          <IconButton label="Buka menu" onClick={() => setMenuOpen(true)}><Menu className="h-6 w-6" /></IconButton>
          <a href="#top" className="shrink-0 text-[25px] font-black tracking-[0.28em] sm:text-[30px]">LUMÉA</a>
          <div className="mx-auto hidden max-w-2xl flex-1 lg:block">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-12 w-full items-center justify-between rounded-full border border-neutral-300 px-5 text-sm text-neutral-500 transition hover:border-black"
            >
              Cari produk, kategori, atau brand
              <Search className="h-5 w-5" />
            </button>
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <IconButton label="Cari" onClick={() => setSearchOpen(true)}><Search className="h-5 w-5 lg:hidden" /></IconButton>
            <a href={isAuthenticated ? "/account" : "/login"} aria-label="Akun" className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-neutral-100"><UserRound className="h-5 w-5" /></a>
            <a href="/checkout" aria-label="Tas belanja" className="relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-neutral-100"><ShoppingBag className="h-5 w-5" />{cartCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e4003f] px-1 text-[10px] font-bold text-white">{cartCount}</span>}</a>
          </div>
        </div>
        <nav className="mx-auto hidden h-12 max-w-[1440px] items-center justify-between px-8 lg:flex">
          {navItems.map((item) => {
            const itemCategory = categories.find((candidate) => candidate.name === item);
            return <button key={item} type="button" onClick={() => itemCategory ? selectCategory(itemCategory.slug) : document.getElementById(item === "New" ? "new" : item.toLowerCase())?.scrollIntoView({ behavior: "smooth" })} className={`text-[13px] font-bold transition hover:text-[#e4003f] ${item === "Sale" ? "text-[#e4003f]" : ""}`}>{item}</button>;
          })}
        </nav>
      </header>

      <main id="top">
        <section className="relative min-h-[570px] overflow-hidden bg-[#f2e0d3] lg:min-h-[610px]">
          <img src="/beauty/hero-beauty.png" alt="Koleksi beauty terbaru LUMÉA" className="absolute inset-0 h-full w-full object-cover object-[64%_center] lg:object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f5eadf] via-[#f5eadf]/90 to-transparent sm:via-[#f5eadf]/55" />
          <div className="relative mx-auto flex min-h-[570px] max-w-[1440px] items-center px-6 sm:px-10 lg:min-h-[610px] lg:px-16">
            <div className="max-w-xl pt-6">
              <div className="mb-5 inline-flex items-center gap-2 bg-[#d5685e] px-3 py-2 text-[10px] font-bold tracking-[0.2em] text-white sm:text-xs">
                THE BEAUTY EDIT
              </div>
              <h1 className="font-serif text-[54px] font-medium leading-[0.91] tracking-[-0.055em] text-black sm:text-7xl lg:text-[92px]">
                Your glow,<br />your rules.
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-neutral-700 sm:text-lg">
                Temukan ritual baru, warna favorit, dan fragrance yang terasa sepenuhnya Anda.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#new" className="inline-flex items-center gap-3 bg-black px-7 py-4 text-xs font-bold tracking-[0.15em] text-white transition hover:bg-[#e4003f]">SHOP NEW <ArrowRight className="h-4 w-4" /></a>
                <a href="#categories" className="inline-flex items-center border border-black bg-white/30 px-7 py-4 text-xs font-bold tracking-[0.15em] backdrop-blur-sm transition hover:bg-white">EXPLORE BEAUTY</a>
              </div>
            </div>
          </div>
        </section>

        <div className="border-b border-neutral-200 bg-white">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 divide-y divide-neutral-200 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8">
            <div className="flex items-center justify-center gap-3 py-4 text-xs font-semibold"><Truck className="h-5 w-5" /> Gratis ongkir mulai Rp 500.000</div>
            <div className="flex items-center justify-center gap-3 py-4 text-xs font-semibold"><Sparkles className="h-5 w-5" /> Sample gratis setiap pembelian</div>
            <div className="flex items-center justify-center gap-3 py-4 text-xs font-semibold"><ShoppingBag className="h-5 w-5" /> Ambil langsung di store</div>
          </div>
        </div>

        <section id="new" className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:py-24">
          <div className="mb-9 flex items-end justify-between gap-5">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#d9294f]">Just landed</p>
              <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">{category ? categories.find((item) => item.slug === category)?.name || "Products" : "New arrivals"} <span aria-hidden>✦</span></h2>
              <p className="mt-3 max-w-xl text-sm text-neutral-600 sm:text-base">Fresh drops, cult favourites, dan obsesi baru Anda—dipilih oleh beauty experts kami.</p>
            </div>
            <a href="#all-products" className="hidden items-center gap-2 border-b border-black pb-1 text-xs font-bold tracking-[0.12em] sm:flex">VIEW ALL <ArrowRight className="h-3.5 w-3.5" /></a>
          </div>
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-5 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
            {productsQuery.isLoading && Array.from({ length: 5 }).map((_, index) => <div key={index} className="min-w-[74vw] animate-pulse sm:min-w-[46%] lg:min-w-0"><div className="aspect-[4/5] bg-neutral-100" /><div className="mt-4 h-4 w-2/3 bg-neutral-100" /><div className="mt-3 h-4 bg-neutral-100" /></div>)}
            {storeProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
          {!productsQuery.isLoading && storeProducts.length === 0 && <p className="py-14 text-center text-sm text-neutral-500">Produk belum tersedia untuk kategori ini.</p>}
        </section>

        <section className="mx-auto grid max-w-[1440px] gap-4 px-5 pb-16 sm:px-8 lg:grid-cols-2 lg:pb-24">
          <article className="relative min-h-[460px] overflow-hidden bg-[#1b1817] text-white">
            <img src="/beauty/perfume.jpg" alt="Koleksi fragrance" className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-700 hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10">
              <p className="text-[10px] font-bold tracking-[0.2em] text-white/80">THE FRAGRANCE FINDER</p>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl">Scent speaks first.</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">Floral, woody, fresh, atau gourmand—temukan signature scent yang tinggal lebih lama.</p>
              <a href="#fragrance" className="mt-6 inline-flex items-center gap-2 border-b border-white pb-1 text-xs font-bold tracking-[0.12em]">FIND YOUR SCENT <ArrowRight className="h-4 w-4" /></a>
            </div>
          </article>
          <article className="relative min-h-[460px] overflow-hidden bg-[#d8a8a3]">
            <img src="/beauty/makeup.jpg" alt="Koleksi makeup" className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-700 hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#5a2929]/90 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-8 text-white sm:p-10">
              <p className="text-[10px] font-bold tracking-[0.2em] text-white/80">MAKEUP, YOUR WAY</p>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl">Turn up the colour.</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">Dari barely-there glow sampai statement lips. Tidak ada aturan, hanya ekspresi.</p>
              <a href="#makeup" className="mt-6 inline-flex items-center gap-2 border-b border-white pb-1 text-xs font-bold tracking-[0.12em]">SHOP MAKEUP <ArrowRight className="h-4 w-4" /></a>
            </div>
          </article>
        </section>

        <section id="categories" className="bg-[#f7f5f2] py-16 lg:py-24">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
            <div className="mb-10 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d9294f]">Start here</p>
              <h2 className="mt-2 font-serif text-4xl sm:text-5xl">Shop by category</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
              {categories.map((category) => (
                <button type="button" key={category.id} onClick={() => selectCategory(category.slug)} className="group relative aspect-[3/4] overflow-hidden bg-neutral-200 text-left">
                  <img src={category.image} alt={category.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-white sm:p-6">
                    <h3 className="font-serif text-2xl sm:text-3xl">{category.name}</h3>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 transition group-hover:bg-white group-hover:text-black"><ArrowRight className="h-4 w-4" /></span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="pass" className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:py-24">
          <div className="grid overflow-hidden bg-[#f6d9dc] lg:grid-cols-[1.05fr_.95fr]">
            <div className="flex items-center px-7 py-14 sm:px-14 lg:px-20">
              <div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black text-white"><Sparkles className="h-5 w-5" /></span>
                <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.2em]">LUMÉA BEAUTY CIRCLE</p>
                <h2 className="mt-3 max-w-lg font-serif text-4xl leading-tight sm:text-6xl">Beauty loves company.</h2>
                <p className="mt-5 max-w-lg text-sm leading-relaxed text-neutral-700 sm:text-base">Kumpulkan poin, nikmati birthday treats, akses peluncuran eksklusif, dan kejutan yang dipilih khusus untuk Anda.</p>
                <a href="#join" className="mt-8 inline-flex items-center gap-3 bg-black px-7 py-4 text-xs font-bold tracking-[0.14em] text-white transition hover:bg-[#e4003f]">JOIN FOR FREE <ArrowRight className="h-4 w-4" /></a>
              </div>
            </div>
            <div className="relative min-h-[390px]">
              <img src="/beauty/lipstick.jpg" alt="LUMÉA Beauty Circle" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-7 border border-white/70" />
              <div className="absolute bottom-10 right-10 rounded-full bg-black px-6 py-8 text-center text-xs font-bold leading-relaxed tracking-[0.14em] text-white">MEMBER<br /><span className="text-2xl">PERKS</span><br />ALL YEAR</div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-black text-white">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-6 py-16 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-20">
          <div>
            <a href="#top" className="text-3xl font-black tracking-[0.28em]">LUMÉA</a>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">Beauty should feel like you. Curated essentials, new discoveries, dan little luxuries untuk setiap hari.</p>
            <div className="mt-8 flex max-w-sm border-b border-white/50 pb-2">
              <input aria-label="Alamat email" type="email" placeholder="Email untuk beauty updates" className="min-w-0 flex-1 rounded-none border-0 bg-transparent text-sm text-white outline-none placeholder:text-white/45" />
              <button type="button" aria-label="Daftar newsletter"><ArrowRight className="h-5 w-5" /></button>
            </div>
          </div>
          {[
            ["Explore", "New Arrivals", "Bestsellers", "Brands", "Beauty Offers"],
            ["Help", "Delivery", "FAQ", "Contact Us", "Find a Store"],
            ["About", "Our Story", "Careers", "Privacy", "Terms"],
          ].map(([title, ...links]) => (
            <div key={title}>
              <h3 className="text-xs font-bold uppercase tracking-[0.16em]">{title}</h3>
              <ul className="mt-5 space-y-3 text-sm text-white/60">{links.map((link) => <li key={link}><a href={`#${link.toLowerCase().replaceAll(" ", "-")}`} className="transition hover:text-white">{link}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/15 px-6 py-5 text-center text-[11px] text-white/45">© 2026 LUMÉA BEAUTY. ALL RIGHTS RESERVED.</div>
      </footer>

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <button type="button" aria-label="Tutup menu" className="absolute inset-0 bg-black/45" onClick={closeMenu} />
          <aside className="relative h-full w-[88%] max-w-sm overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-5">
              <span className="text-2xl font-black tracking-[0.24em]">LUMÉA</span>
              <IconButton label="Tutup menu" onClick={closeMenu}><X className="h-6 w-6" /></IconButton>
            </div>
            <nav className="py-4">{navItems.map((item) => { const itemCategory = categories.find((candidate) => candidate.name === item); return <button type="button" key={item} onClick={() => { closeMenu(); if (itemCategory) selectCategory(itemCategory.slug); }} className="flex w-full items-center justify-between border-b border-neutral-100 py-4 text-base font-semibold">{item}<ChevronRight className="h-4 w-4" /></button>; })}</nav>
            <div className="mt-4 space-y-4 text-sm text-neutral-600">
              <a href={isAuthenticated ? "/account" : "/login"} className="flex items-center gap-3"><UserRound className="h-5 w-5" /> {isAuthenticated ? "Akun Saya" : "Masuk / Daftar"}</a>
              <a href="#stores" className="flex items-center gap-3"><MapPin className="h-5 w-5" /> Store & Events</a>
              <a href={isAuthenticated ? "/account?tab=wishlist" : "/login"} className="flex items-center gap-3"><Heart className="h-5 w-5" /> Wishlist</a>
              <a href={adminUrl} className="flex items-center gap-3 font-semibold"><ShieldCheck className="h-5 w-5" /> Login sebagai Seller</a>
            </div>
          </aside>
        </div>
      )}

      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-white" role="dialog" aria-modal="true" aria-label="Pencarian produk">
          <div className="mx-auto max-w-4xl px-5 py-7 sm:px-8">
            <div className="flex items-center gap-3 border-b-2 border-black pb-3">
              <Search className="h-5 w-5" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari produk atau brand..." className="min-w-0 flex-1 rounded-none border-0 bg-transparent text-lg outline-none" />
              <IconButton label="Tutup pencarian" onClick={() => { setSearchOpen(false); setQuery(""); }}><X className="h-6 w-6" /></IconButton>
            </div>
            <div className="pt-8">
              {!query && <><p className="text-xs font-bold uppercase tracking-[0.15em]">Popular searches</p><div className="mt-4 flex flex-wrap gap-2">{["Lip gloss", "Serum", "Perfume", "Blush", "Sunscreen"].map((term) => <button key={term} type="button" onClick={() => setQuery(term)} className="rounded-full border border-neutral-300 px-4 py-2 text-sm hover:border-black">{term}</button>)}</div></>}
              {query && <p className="mb-5 text-sm text-neutral-500">{searchQuery.isFetching ? "Mencari produk..." : `${searchResults.length} hasil untuk “${query}”`}</p>}
              <div className="space-y-3">{searchResults.map((product) => <Link key={product.name} to="/product/$slug" params={{ slug: product.slug }} onClick={() => setSearchOpen(false)} className="flex w-full items-center gap-4 border-b border-neutral-200 py-3 text-left"><img src={product.image} alt="" className="h-20 w-16 object-cover" /><span className="flex-1"><span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">{product.brand}</span><span className="mt-1 block text-sm font-medium">{product.name}</span><span className="mt-1 block text-sm font-bold">{formatPrice(product.price)}</span></span><ChevronRight className="h-4 w-4" /></Link>)}</div>
            </div>
          </div>
        </div>
      )}

      {cartCount > 0 && (
        <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 whitespace-nowrap bg-black px-5 py-3 text-xs font-semibold text-white shadow-xl">
          <ShoppingBag className="h-4 w-4" /> {cartCount} item di bag
          <a href="/checkout" className="border-l border-white/30 pl-4 font-bold text-[#ff9aae]">VIEW BAG</a>
        </div>
      )}
    </div>
  );
}
