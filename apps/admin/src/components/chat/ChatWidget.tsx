import React from "react";
import { useNavigate, useLocation, useParams } from "react-router";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat } from "@/context/ChatContext"; // Ambil dari context

export default function ChatWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { unreadCount, refresh } = useChat(); // Panggil state global di sini

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const routeLessonId = params.lessonId || "";
  const isLessonPage = Boolean(
    routeLessonId && location.pathname.includes("/dashboard/lessons/")
  );

  if (location.pathname === "/dashboard/chat") {
    return null;
  }

  const handleWidgetClick = () => {
    if (isLessonPage && routeLessonId) {
      navigate(`/dashboard/chat?lesson_id=${routeLessonId}`);
    } else {
      navigate("/dashboard/chat");
    }
  };

  return (
    <button
      onClick={handleWidgetClick}
      className={cn(
        "fixed bottom-5 right-5 z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-200 bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95"
      )}
      style={{ height: 52, width: 52 }}
      aria-label="Buka chat"
    >
      <MessageCircle className="h-5 w-5 text-white" />

      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow animate-pulse">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
