import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useCommerce } from "@/lib/commerce";
import {
  formatPrice,
  formatReviewCount,
  getStoreProduct,
  getStoreProducts,
} from "@/lib/store-data";

export const Route = createFileRoute("/product/$slug")({
  head: () => ({ meta: [{ title: "Detail Produk — LUMÉA" }] }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addToCart, toggleWishlist, isWishlisted, cartCount } = useCommerce();
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const productQuery = useQuery({
    queryKey: ["store-product", slug],
    queryFn: () => getStoreProduct(slug),
  });
  const product = productQuery.data;
  const relatedQuery = useQuery({
    queryKey: ["store-products-related", product?.category?.slug],
    queryFn: () => getStoreProducts({ category: product?.category?.slug }),
    enabled: Boolean(product?.category?.slug),
  });

  if (productQuery.isLoading) {
    return <div className="min-h-screen bg-white"><StoreHeader cartCount={cartCount} /><main className="mx-auto grid max-w-[1400px] animate-pulse gap-10 px-5 py-12 sm:px-8 lg:grid-cols-2"><div className="aspect-[4/5] bg-neutral-100" /><div className="space-y-5 py-5"><div className="h-4 w-28 bg-neutral-100" /><div className="h-14 w-3/4 bg-neutral-100" /><div className="h-6 w-40 bg-neutral-100" /><div className="h-32 bg-neutral-100" /></div></main></div>;
  }

  if (!product || productQuery.isError) {
    return <div className="min-h-screen bg-[#f7f7f7]"><StoreHeader cartCount={cartCount} /><main className="mx-auto max-w-xl px-5 py-24 text-center"><h1 className="font-serif text-4xl">Produk tidak ditemukan</h1><p className="mt-3 text-sm text-neutral-500">Produk mungkin sudah tidak tersedia atau alamatnya berubah.</p><Link to="/" className="mt-7 inline-flex bg-black px-7 py-3 text-xs font-bold text-white">KEMBALI BELANJA</Link></main></div>;
  }

  const images = [...new Set([product.image, product.secondaryImage].filter(Boolean))];
  const liked = isWishlisted(product.id);

  const requireLogin = () => {
    if (isAuthenticated) return true;
    navigate({ to: "/login", search: { redirect: `/product/${product.slug}` } });
    return false;
  };

  const addBag = async () => {
    if (!requireLogin()) return;
    try {
      await addToCart(product, quantity);
      toast.success(`${quantity} produk ditambahkan ke bag`);
    } catch {
      toast.error("Produk gagal ditambahkan ke bag");
    }
  };

  const toggleLike = async () => {
    if (!requireLogin()) return;
    try {
      await toggleWishlist(product);
    } catch {
      toast.error("Wishlist gagal diperbarui");
    }
  };

  const related = (relatedQuery.data || []).filter((item) => item.id !== product.id).slice(0, 4);

  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <StoreHeader cartCount={cartCount} />
      <main>
        <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8 lg:py-10">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Link to="/">Home</Link><ChevronRight className="size-3" />
            {product.category && <><Link to="/" search={{ category: product.category.slug }}>{product.category.name}</Link><ChevronRight className="size-3" /></>}
            <span className="truncate text-neutral-800">{product.name}</span>
          </div>

          <section className="mt-6 grid gap-9 lg:grid-cols-[1.08fr_.92fr] lg:gap-14">
            <div className="grid gap-3 sm:grid-cols-[88px_1fr]">
              <div className="order-2 flex gap-2 sm:order-1 sm:flex-col">
                {images.map((image, index) => <button key={image} type="button" onClick={() => setActiveImage(index)} className={`aspect-square w-20 overflow-hidden border-2 bg-neutral-100 ${activeImage === index ? "border-black" : "border-transparent"}`}><img src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" /></button>)}
              </div>
              <div className="order-1 relative aspect-[4/5] overflow-hidden bg-[#f5f2ef] sm:order-2">
                <img src={images[activeImage] || product.image} alt={product.name} className="h-full w-full object-cover" />
                {product.badge && <span className="absolute left-4 top-4 bg-white px-3 py-2 text-[10px] font-bold tracking-[0.16em]">{product.badge}</span>}
              </div>
            </div>

            <div className="lg:py-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">{product.brand}</p>
              <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{product.name}</h1>
              <div className="mt-4 flex items-center gap-2 text-sm"><Star className="size-4 fill-black" /><span className="font-semibold">{product.rating.toFixed(1)}</span><span className="text-neutral-500">({formatReviewCount(product.reviewCount)} ulasan)</span></div>
              <div className="mt-7 flex items-baseline gap-3"><p className="text-2xl font-bold">{formatPrice(product.price)}</p>{product.compareAtPrice > product.price && <p className="text-sm text-neutral-400 line-through">{formatPrice(product.compareAtPrice)}</p>}</div>
              <p className="mt-6 border-t pt-6 text-sm leading-7 text-neutral-600">{product.description}</p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <div className="flex h-12 items-center border border-neutral-300"><button type="button" aria-label="Kurangi jumlah" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="px-3"><Minus className="size-4" /></button><span className="w-9 text-center text-sm font-semibold">{quantity}</span><button type="button" aria-label="Tambah jumlah" onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} className="px-3"><Plus className="size-4" /></button></div>
                <button type="button" disabled={product.stock < 1} onClick={addBag} className="flex h-12 flex-1 items-center justify-center gap-2 bg-black px-7 text-xs font-bold tracking-[0.13em] text-white transition hover:bg-[#e4003f] disabled:bg-neutral-300"><ShoppingBag className="size-4" />{product.stock > 0 ? "ADD TO BAG" : "STOK HABIS"}</button>
                <button type="button" aria-label={liked ? "Hapus dari wishlist" : "Tambah ke wishlist"} onClick={toggleLike} className="flex size-12 items-center justify-center border border-neutral-300"><Heart className={`size-5 ${liked ? "fill-[#e4003f] text-[#e4003f]" : ""}`} /></button>
              </div>
              <p className={`mt-3 text-xs font-semibold ${product.stock > 5 ? "text-emerald-700" : "text-amber-700"}`}>{product.stock > 0 ? `${product.stock} tersedia` : "Stok sedang kosong"}</p>

              <div className="mt-8 divide-y border-y text-sm">
                <details className="group py-5" open><summary className="flex cursor-pointer list-none items-center justify-between font-semibold">Ingredients <Plus className="size-4 group-open:rotate-45" /></summary><p className="pt-4 leading-7 text-neutral-600">{product.ingredients}</p></details>
                <details className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between font-semibold">Cara Penggunaan <Plus className="size-4 group-open:rotate-45" /></summary><p className="pt-4 leading-7 text-neutral-600">{product.howToUse}</p></details>
              </div>

              <div className="mt-6 grid gap-3 text-xs sm:grid-cols-3">
                <div className="flex items-center gap-2"><Truck className="size-4" /> Gratis ongkir Rp500k</div>
                <div className="flex items-center gap-2"><RefreshCw className="size-4" /> Retur mudah</div>
                <div className="flex items-center gap-2"><ShieldCheck className="size-4" /> Produk autentik</div>
              </div>
            </div>
          </section>

          {related.length > 0 && <section className="border-t py-16 lg:py-20"><div className="flex items-end justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e4003f]">You may also like</p><h2 className="mt-2 font-serif text-4xl">Pilihan lainnya</h2></div><Sparkles className="size-6" /></div><div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">{related.map((item) => <Link key={item.id} to="/product/$slug" params={{ slug: item.slug }} className="group"><div className="aspect-[4/5] overflow-hidden bg-neutral-100"><img src={item.image} alt={item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{item.brand}</p><h3 className="mt-1 text-sm font-medium">{item.name}</h3><p className="mt-2 text-sm font-bold">{formatPrice(item.price)}</p></Link>)}</div></section>}
        </div>
      </main>
    </div>
  );
}

function StoreHeader({ cartCount }: { cartCount: number }) {
  return <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur"><div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-5 sm:px-8"><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold"><ChevronLeft className="size-4 sm:hidden" /><span className="text-2xl font-black tracking-[0.25em]">LUMÉA</span></Link><div className="flex items-center gap-4"><Link to="/" className="hidden text-sm font-semibold sm:block">Lanjut Belanja</Link><Link to="/checkout" aria-label="Tas belanja" className="relative flex size-10 items-center justify-center rounded-full hover:bg-neutral-100"><ShoppingBag className="size-5" />{cartCount > 0 && <span className="absolute right-0 top-0 flex size-[18px] items-center justify-center rounded-full bg-[#e4003f] text-[10px] font-bold text-white">{cartCount}</span>}</Link></div></div></header>;
}
