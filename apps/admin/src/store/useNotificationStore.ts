import { create } from "zustand";
import { DEFAULT_TENANT_ID } from "@/lib/api";
import api from "@/lib/api";
import { BASE_API_URL } from "@/lib/utils";

interface NotificationStore {
  notifications: any[];
  unreadCount: number;
  onlineUsers: any[];
  socket: WebSocket | null;
  isFetching: boolean;
  fetchNotifications: () => Promise<void>;
  initializeWebSocket: () => void;
  disconnectWebSocket: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

let wsReconnectTimeout: any = null;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  onlineUsers: [],
  socket: null,
  isFetching: false,

  fetchNotifications: async () => {
    set({ isFetching: true });
    try {
      const res = await api.get("/user/notifications");
      const data = res.data?.data || res.data || [];
      if (Array.isArray(data)) {
        set({
          notifications: data,
          unreadCount: data.filter((n: any) => !n.is_read).length,
        });
      }
    } catch (err) {
      console.error("Gagal memuat notifikasi:", err);
    } finally {
      set({ isFetching: false });
    }
  },

  initializeWebSocket: () => {
    // Prevent multiple connections
    if (get().socket) return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    let base = BASE_API_URL || "";
    if (!base.startsWith("http")) {
      base = window.location.origin;
    }
    const wsProto = base.startsWith("https") ? "wss:" : "ws:";
    const cleanHost = base.replace(/^https?:\/\//, "").replace(/\/$/, "");

    let path = "/ws/activity";
    if (!cleanHost.includes("/api")) {
      path = "/api/ws/activity";
    }
    const tenantId = import.meta.env.VITE_X_TENANT_ID || DEFAULT_TENANT_ID;
    const wsUrl = `${wsProto}//${cleanHost}${path}?token=${token}&tenant_id=${tenantId}`;
    
    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected for notifications");
        if (wsReconnectTimeout) {
          clearTimeout(wsReconnectTimeout);
          wsReconnectTimeout = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "notification" && data.notification) {
            const newNotif = data.notification;
            set((state) => {
              // Prevent duplicates
              const exists = state.notifications.some((n) => n.id === newNotif.id);
              if (exists) return state;

              const updatedNotifications = [newNotif, ...state.notifications];
              return {
                notifications: updatedNotifications,
                unreadCount: updatedNotifications.filter((n) => !n.is_read).length,
              };
            });
          } else if (data.type === "online_users") {
            set({ onlineUsers: data.users || [] });
          }
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected. Retrying in 5 seconds...");
        set({ socket: null });
        
        // Auto reconnect
        if (!wsReconnectTimeout) {
          wsReconnectTimeout = setTimeout(() => {
            wsReconnectTimeout = null;
            get().initializeWebSocket();
          }, 5000);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close();
      };

      set({ socket: ws });
    } catch (e) {
      console.error("Failed to establish WebSocket connection", e);
    }
  },

  disconnectWebSocket: () => {
    const ws = get().socket;
    if (ws) {
      ws.close();
    }
    if (wsReconnectTimeout) {
      clearTimeout(wsReconnectTimeout);
      wsReconnectTimeout = null;
    }
    set({ socket: null });
  },

  markAsRead: async (id: string) => {
    try {
      await api.put(`/user/notifications/${id}/read`);
      set((state) => {
        const updated = state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        );
        return {
          notifications: updated,
          unreadCount: updated.filter((n) => !n.is_read).length,
        };
      });
    } catch (err) {
      console.error("Gagal menandai dibaca:", err);
    }
  },

  markAllRead: async () => {
    try {
      await api.put("/user/notifications/read-all");
      set((state) => {
        const updated = state.notifications.map((n) => ({ ...n, is_read: true }));
        return {
          notifications: updated,
          unreadCount: 0,
        };
      });
    } catch (err) {
      console.error("Gagal menandai semua dibaca:", err);
    }
  },

  deleteNotification: async (id: string) => {
    try {
      await api.delete(`/user/notifications/${id}`);
      set((state) => {
        const updated = state.notifications.filter((n) => n.id !== id);
        return {
          notifications: updated,
          unreadCount: updated.filter((n) => !n.is_read).length,
        };
      });
    } catch (err) {
      console.error("Gagal menghapus notifikasi:", err);
    }
  },
}));
