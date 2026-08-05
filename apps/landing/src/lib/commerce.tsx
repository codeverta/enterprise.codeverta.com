import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import api from "./api";
import {
  mapProduct,
  type StoreCartItemResponse,
  type StoreOrderResponse,
  type StoreProduct,
  type StoreWishlistItemResponse,
} from "./store-data";

export type CartItem = StoreProduct & { quantity: number };
export type BuyerOrder = {
  id: string;
  databaseId: string;
  createdAt: string;
  status: "Menunggu Pembayaran" | "Diproses" | "Dikirim" | "Selesai";
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: string;
  paymentProvider: string;
  paymentStatus: string;
  paymentReference: string;
  paymentUrl: string;
  paymentExpiresAt?: string;
  paidAt?: string;
  address: string;
};

type CommerceContextValue = {
  cart: CartItem[];
  cartCount: number;
  subtotal: number;
  wishlist: StoreProduct[];
  orders: BuyerOrder[];
  loading: boolean;
  addToCart: (product: StoreProduct, quantity?: number) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  toggleWishlist: (product: StoreProduct) => Promise<void>;
  isWishlisted: (id: string) => boolean;
  placeOrder: (input: { paymentMethod: string; address: string }) => Promise<BuyerOrder>;
  refreshCommerce: () => Promise<void>;
};

const CommerceContext = createContext<CommerceContextValue | null>(null);

function mapOrder(order: StoreOrderResponse): BuyerOrder {
  return {
    id: order.order_number,
    databaseId: order.id,
    createdAt: order.created_at,
    status: order.status,
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    total: Number(order.total),
    paymentMethod: order.payment_method,
    paymentProvider: order.payment_provider || "",
    paymentStatus: order.payment_status || "",
    paymentReference: order.payment_reference || "",
    paymentUrl: order.payment_url || "",
    paymentExpiresAt: order.payment_expires_at,
    paidAt: order.paid_at,
    address: order.address,
    items: order.items.map((item) => ({
      id: item.product_id,
      categoryId: "",
      slug: item.product_id,
      sku: "",
      brand: item.brand,
      name: item.name,
      description: "",
      ingredients: "",
      howToUse: "",
      price: Number(item.price),
      compareAtPrice: 0,
      badge: "",
      image: item.image,
      secondaryImage: item.image,
      rating: 0,
      reviewCount: 0,
      stock: 0,
      isFeatured: false,
      quantity: item.quantity,
    })),
  };
}

export function CommerceProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<StoreProduct[]>([]);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCommerce = async () => {
    if (!isAuthenticated) {
      setCart([]);
      setWishlist([]);
      setOrders([]);
      return;
    }
    setLoading(true);
    try {
      const [cartResponse, wishlistResponse, ordersResponse] = await Promise.all([
        api.get<{ data: StoreCartItemResponse[] }>("/store/cart"),
        api.get<{ data: StoreWishlistItemResponse[] }>("/store/wishlist"),
        api.get<{ data: StoreOrderResponse[] }>("/store/orders"),
      ]);
      setCart(cartResponse.data.data.map((item) => ({ ...mapProduct(item.product), quantity: item.quantity })));
      setWishlist(wishlistResponse.data.data.map((item) => mapProduct(item.product)));
      setOrders(ordersResponse.data.data.map(mapOrder));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCommerce().catch(() => {
      setCart([]);
      setWishlist([]);
      setOrders([]);
    });
  }, [user?.id, isAuthenticated]);

  const value = useMemo<CommerceContextValue>(
    () => ({
      cart,
      cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
      wishlist,
      orders,
      loading,
      addToCart: async (product, quantity = 1) => {
        if (!isAuthenticated) throw new Error("AUTH_REQUIRED");
        const previous = cart;
        setCart((current) => {
          const found = current.find((item) => item.id === product.id);
          return found
            ? current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item))
            : [...current, { ...product, quantity }];
        });
        try {
          await api.post(`/store/cart/${encodeURIComponent(product.id)}`, { quantity });
        } catch (error) {
          setCart(previous);
          throw error;
        }
      },
      removeFromCart: async (id) => {
        const previous = cart;
        setCart((current) => current.filter((item) => item.id !== id));
        try {
          await api.delete(`/store/cart/${encodeURIComponent(id)}`);
        } catch (error) {
          setCart(previous);
          throw error;
        }
      },
      updateQuantity: async (id, quantity) => {
        if (quantity <= 0) {
          const previous = cart;
          setCart((current) => current.filter((item) => item.id !== id));
          try {
            await api.delete(`/store/cart/${encodeURIComponent(id)}`);
          } catch (error) {
            setCart(previous);
            throw error;
          }
          return;
        }
        const previous = cart;
        setCart((current) => current.map((item) => (item.id === id ? { ...item, quantity } : item)));
        try {
          await api.put(`/store/cart/${encodeURIComponent(id)}`, { quantity });
        } catch (error) {
          setCart(previous);
          throw error;
        }
      },
      toggleWishlist: async (product) => {
        if (!isAuthenticated) throw new Error("AUTH_REQUIRED");
        const exists = wishlist.some((item) => item.id === product.id);
        const previous = wishlist;
        setWishlist((current) =>
          exists ? current.filter((item) => item.id !== product.id) : [product, ...current],
        );
        try {
          if (exists) await api.delete(`/store/wishlist/${encodeURIComponent(product.id)}`);
          else await api.post(`/store/wishlist/${encodeURIComponent(product.id)}`);
        } catch (error) {
          setWishlist(previous);
          throw error;
        }
      },
      isWishlisted: (id) => wishlist.some((item) => item.id === id),
      placeOrder: async ({ paymentMethod, address }) => {
        const response = await api.post<{ data: StoreOrderResponse }>("/store/orders", {
          payment_method: paymentMethod,
          address,
        });
        const order = mapOrder(response.data.data);
        setOrders((current) => [order, ...current]);
        setCart([]);
        return order;
      },
      refreshCommerce,
    }),
    [cart, wishlist, orders, loading, isAuthenticated],
  );

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const value = useContext(CommerceContext);
  if (!value) throw new Error("useCommerce must be used inside CommerceProvider");
  return value;
}
