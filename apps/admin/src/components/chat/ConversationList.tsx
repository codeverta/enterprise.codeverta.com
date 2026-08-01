import React from "react";
import dayjs from "dayjs";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pin,
  PinOff,
  RotateCcw,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Student {
  id?: string;
  display_name: string;
  role: number;
  email: string;
}

interface Conversation {
  id: string;
  title?: string;
  lesson_title?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  status?: string;
  sender_id?: string;
  sender?: Student;
  receiver_id?: string;
  receiver?: Student;
  student?: Student;
  is_archived?: boolean;
  is_pinned?: boolean;
}

type ConversationStatePatch = {
  is_archived?: boolean;
  is_pinned?: boolean;
  status?: "open" | "resolved";
};

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onAction,
  currentUserId,
  canResolve,
  loading,
}: {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (conv: Conversation) => void;
  onAction: (conv: Conversation, patch: ConversationStatePatch) => void;
  currentUserId: string;
  canResolve: boolean;
  loading: boolean;
}) {
  return (
    <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden bg-white">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <div className="rounded-full bg-slate-100 p-3">
            <MessageCircle className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Belum ada percakapan</p>
          <p className="text-xs text-slate-400">Percakapan akan muncul di sini.</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {conversations.map((conv) => {
            const isSelected = activeId === conv.id;
            const senderName =
              (conv.sender_id === currentUserId
                ? conv.receiver?.display_name
                : conv.sender?.display_name) ||
              conv.student?.display_name ||
              "Anonymous";

            return (
              <li key={conv.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(conv)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onSelect(conv);
                  }}
                  className={cn(
                    "relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                    isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"
                  )}
                >
                  {isSelected && (
                    <div className="absolute inset-y-0 left-0 w-1 rounded-r bg-blue-600" />
                  )}
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-blue-200 bg-blue-100 text-blue-700"
                        : "border-slate-200 bg-slate-100 text-slate-600"
                    )}
                  >
                    <User className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-semibold text-slate-800">
                        {senderName}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-[11px] text-slate-400">
                          {conv.last_message_at ? dayjs(conv.last_message_at).fromNow() : ""}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-slate-700"
                              onClick={(event) => event.stopPropagation()}
                              title="Aksi percakapan"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <DropdownMenuItem
                              onClick={() =>
                                onAction(conv, { is_pinned: !conv.is_pinned })
                              }
                            >
                              {conv.is_pinned ? <PinOff /> : <Pin />}
                              {conv.is_pinned ? "Lepas pin" : "Pin chat"}
                            </DropdownMenuItem>
                            {canResolve && (
                              <DropdownMenuItem
                                onClick={() =>
                                  onAction(conv, {
                                    status:
                                      conv.status === "resolved" ? "open" : "resolved",
                                  })
                                }
                              >
                                {conv.status === "resolved" ? (
                                  <RotateCcw />
                                ) : (
                                  <CheckCircle2 />
                                )}
                                {conv.status === "resolved"
                                  ? "Buka kembali"
                                  : "Tandai selesai"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                onAction(conv, { is_archived: !conv.is_archived })
                              }
                            >
                              {conv.is_archived ? <ArchiveRestore /> : <Archive />}
                              {conv.is_archived ? "Pulihkan chat" : "Arsipkan chat"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <p className="mt-0.5 truncate text-xs font-medium text-blue-600/90">
                      {conv.title || conv.lesson_title || "Percakapan"}
                    </p>
                    {conv.last_message && (
                      <p
                        className={cn(
                          "mt-1 truncate text-xs text-slate-500",
                          conv.unread_count > 0 && "font-medium text-slate-900"
                        )}
                      >
                        {conv.last_message}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-1.5">
                      {conv.is_pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <Pin className="h-2.5 w-2.5" /> Pin
                        </span>
                      )}
                      {conv.status === "resolved" && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Selesai
                        </span>
                      )}
                      {conv.unread_count > 0 && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          {conv.unread_count} baru
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export default ConversationList;
