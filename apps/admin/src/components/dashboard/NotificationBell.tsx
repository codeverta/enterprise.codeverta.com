import React, { useState } from "react";
import { Bell, Trash2, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import dayjs from "dayjs";
import { useNotificationStore } from "@/store/useNotificationStore";

export default function NotificationBell({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    deleteNotification,
  } = useNotificationStore();

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification(id);
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center w-full my-1 text-sm h-10 px-3 rounded-md transition-all duration-200 text-gray-600 hover:bg-gray-100 relative ${
            !isSidebarOpen && "justify-center"
          }`}
          title="Notifikasi"
        >
          <div className="relative flex items-center justify-center">
            <Bell className="h-4 w-4 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
          {isSidebarOpen && (
            <span className="ml-3 font-semibold text-gray-700 flex-1 text-left">
              Notifikasi
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-xl shadow-xl border border-gray-100 bg-white" align={isSidebarOpen ? "start" : "center"}>
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-gray-900 text-sm">Notifikasi</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-50 border-none">
                {unreadCount} baru
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              Tandai semua dibaca
            </button>
          )}
        </div>
        
        <ScrollArea className="h-72">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 p-4 text-center text-gray-500">
              <Bell className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-xs">Belum ada notifikasi.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                  className={`flex gap-3 p-3 text-left transition duration-200 cursor-pointer hover:bg-slate-50 relative group ${
                    !notif.is_read ? "bg-blue-50/20 font-medium" : ""
                  }`}
                >
                  <div className="shrink-0 mt-0.5">{getNotifIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0 pr-4">
                    <p className={`text-xs text-gray-900 leading-normal ${!notif.is_read ? "font-bold" : "font-semibold"}`}>
                      {notif.title}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500 leading-normal break-words">
                      {notif.content}
                    </p>
                    <p className="mt-1 text-[9px] text-gray-400">
                      {dayjs(notif.created_at).format("DD MMM, HH:mm")}
                    </p>
                  </div>
                  
                  <button
                    onClick={(e) => handleDelete(notif.id, e)}
                    className="absolute right-2 top-2 p-1 rounded-md text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition duration-150"
                    title="Hapus"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  {!notif.is_read && (
                    <span className="absolute right-3 bottom-3 h-1.5 w-1.5 rounded-full bg-blue-500" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
