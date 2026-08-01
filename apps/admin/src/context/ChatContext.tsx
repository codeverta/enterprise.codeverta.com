import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

const ChatContext = createContext({ unreadCount: 0, refresh: () => {} });

export function ChatProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setUnreadCount(0);
      return;
    }
    try {
      // const [mentorRes, parentRes] = await Promise.all([
      //   api.get("/lms/chat/conversations?status=open&receiver_role=mentor"),
      //   api.get("/lms/chat/conversations?status=open&receiver_role=parent"),
      // ]);
      // const convs = [
      //   ...(mentorRes.data?.data || mentorRes.data || []),
      //   ...(parentRes.data?.data || parentRes.data || []),
      // ];
      // const total = convs.reduce((sum, c) => sum + (c.unread_count || 0), 0);
      // setUnreadCount(total);
    } catch {
      // silent error
    }
  }, []);

  // useEffect(() => {
  //   fetchUnread();
  //   const interval = setInterval(fetchUnread, 30_000); // Tetap poll setiap 30 detik
  //   return () => clearInterval(interval);
  // }, [fetchUnread]);

  return (
    <ChatContext.Provider value={{ unreadCount, refresh: fetchUnread }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
