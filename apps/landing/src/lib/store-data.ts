import api from "./api";

export type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  sortOrder: number;
};

export type StoreProduct = {
  id: string;
  categoryId: string;
  category?: StoreCategory;
  slug: string;
  sku: string;
  brand: string;
  name: string;
  description: string;
  ingredients: string;
  howToUse: string;
  price: number;
  compareAtPrice: number;
  badge: string;
  image: string;
  secondaryImage: string;
  rating: number;
  reviewCount: number;
  stock: number;
  isFeatured: boolean;
};

type RawCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sort_order?: number;
};

type RawProduct = {
  id: string;
  category_id: string;
  category?: RawCategory;
  slug: string;
  sku: string;
  brand: string;
  name: string;
  description?: string;
  ingredients?: string;
  how_to_use?: string;
  price: number;
  compare_at_price?: number;
  badge?: string;
  image?: string;
  secondary_image?: string;
  rating?: number;
  review_count?: number;
  stock?: number;
  is_featured?: boolean;
};

export type StoreCartItemResponse = {
  id: string;
  product_id: string;
  product: RawProduct;
  quantity: number;
};

export type StoreWishlistItemResponse = {
  id: string;
  product_id: string;
  product: RawProduct;
};

export type StoreOrderResponse = {
  id: string;
  order_number: string;
  status: "Menunggu Pembayaran" | "Diproses" | "Dikirim" | "Selesai";
  subtotal: number;
  shipping: number;
  total: number;
  payment_method: string;
  payment_provider?: string;
  payment_status?: string;
  payment_reference?: string;
  payment_url?: string;
  payment_expires_at?: string;
  paid_at?: string;
  address: string;
  created_at: string;
  items: Array<{
    id: string;
    product_id: string;
    name: string;
    brand: string;
    image: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
};

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export function mapCategory(category: RawCategory): StoreCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description || "",
    image: category.image || "/beauty/makeup.jpg",
    sortOrder: category.sort_order || 0,
  };
}

export function mapProduct(product: RawProduct): StoreProduct {
  return {
    id: product.id,
    categoryId: product.category_id,
    category: product.category ? mapCategory(product.category) : undefined,
    slug: product.slug,
    sku: product.sku,
    brand: product.brand,
    name: product.name,
    description: product.description || "",
    ingredients: product.ingredients || "",
    howToUse: product.how_to_use || "",
    price: Number(product.price || 0),
    compareAtPrice: Number(product.compare_at_price || 0),
    badge: product.badge || "",
    image: product.image || "/beauty/makeup.jpg",
    secondaryImage: product.secondary_image || product.image || "/beauty/makeup.jpg",
    rating: Number(product.rating || 0),
    reviewCount: Number(product.review_count || 0),
    stock: Number(product.stock || 0),
    isFeatured: Boolean(product.is_featured),
  };
}

export async function getStoreCategories() {
  const response = await api.get<{ data: RawCategory[] }>("/store/categories");
  return response.data.data.map(mapCategory);
}

export async function getStoreProducts(params?: { category?: string; query?: string; featured?: boolean }) {
  const response = await api.get<{ data: RawProduct[] }>("/store/products", {
    params: {
      category: params?.category || undefined,
      q: params?.query || undefined,
      featured: params?.featured ? "true" : undefined,
    },
  });
  return response.data.data.map(mapProduct);
}

export async function getStoreProduct(slug: string) {
  const response = await api.get<{ data: RawProduct }>(`/store/products/${encodeURIComponent(slug)}`);
  return mapProduct(response.data.data);
}

export function formatReviewCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return new Intl.NumberFormat("id-ID").format(value);
}
