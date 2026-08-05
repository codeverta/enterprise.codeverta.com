import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  Facebook,
  ImageIcon,
  Instagram,
  Loader2,
  MessageCircleMore,
  RefreshCw,
  Search,
  Send,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CRMChannel, CRMConversation, CRMMessage, crmApi } from "@/lib/crm-api";
import { CRMPageHeader } from "./shared";

const channelMeta: Record<
  CRMChannel,
  { name: string; icon: typeof Facebook; color: string }
> = {
  whatsapp: {
    name: "WhatsApp",
    icon: Smartphone,
    color: "bg-emerald-500 text-white",
  },
  instagram: {
    name: "Instagram",
    icon: Instagram,
    color: "bg-gradient-to-br from-fuchsia-500 to-orange-400 text-white",
  },
  facebook: {
    name: "Facebook",
    icon: Facebook,
    color: "bg-blue-600 text-white",
  },
};

const filters: Array<{ id: CRMChannel | "all"; label: string }> = [
  { id: "all", label: "Semua" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
];

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function ChannelBadge({
  channel,
  compact = false,
}: {
  channel: CRMChannel;
  compact?: boolean;
}) {
  const meta = channelMeta[channel];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${meta.color} ${compact ? "p-1.5" : "px-2.5 py-1 text-xs font-semibold"}`}
    >
      <Icon className="size-3.5" />
      {!compact && meta.name}
    </span>
  );
}

function MessageBody({ message }: { message: CRMMessage }) {
  return (
    <div className="space-y-1">
      {message.media_url && (
        <div className="flex items-center gap-2 rounded-lg bg-black/5 p-2 text-xs">
          <ImageIcon className="size-4" />
          Lampiran {message.type}
        </div>
      )}
      {message.text && (
        <p className="whitespace-pre-wrap break-words text-sm leading-5">
          {message.text}
        </p>
      )}
      <div
        className={`flex items-center justify-end gap-1 text-[10px] ${message.direction === "outbound" ? "text-blue-100" : "text-slate-400"}`}
      >
        {formatTime(message.sent_at)}
        {message.direction === "outbound" && (
          <CheckCheck
            className={`size-3.5 ${message.status === "read" ? "text-cyan-200" : ""}`}
          />
        )}
      </div>
    </div>
  );
}

export default function CRMInboxPage() {
  const [channel, setChannel] = useState<CRMChannel | "all">("all");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<CRMConversation[]>([]);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [messages, setMessages] = useState<CRMMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedID) || null,
    [conversations, selectedID],
  );

  const loadConversations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await crmApi.conversations({
        channel,
        q: query || undefined,
      });
      setConversations(result);
      setSelectedID((current) =>
        current && result.some((item) => item.id === current)
          ? current
          : result[0]?.id || null,
      );
    } catch {
      if (!silent) toast.error("Gagal memuat inbox CRM");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (conversationID: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const result = await crmApi.conversationMessages(conversationID);
      setMessages(result);
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationID ? { ...item, unread_count: 0 } : item,
        ),
      );
    } catch {
      if (!silent) toast.error("Gagal memuat pesan");
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => loadConversations(), 250);
    return () => window.clearTimeout(timer);
  }, [channel, query]);

  useEffect(() => {
    if (!selectedID) {
      setMessages([]);
      return;
    }
    loadMessages(selectedID);
  }, [selectedID]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadConversations(true);
      if (selectedID) loadMessages(selectedID, true);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [selectedID, channel, query]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!selected || !text || sending) return;
    setSending(true);
    try {
      const message = await crmApi.sendConversationMessage(selected.id, text);
      setMessages((current) => [...current, message]);
      setConversations((current) =>
        current.map((item) =>
          item.id === selected.id
            ? { ...item, preview: text, last_message_at: message.sent_at }
            : item,
        ),
      );
      setDraft("");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Pesan gagal dikirim");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CRMPageHeader
        title="Inbox Omnichannel"
        description="Kelola chat WhatsApp, Instagram, dan Facebook dari satu tempat."
      />
      <main className="p-4 lg:p-8">
        <section className="grid min-h-[680px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="space-y-4 border-b border-slate-100 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900">Percakapan</h2>
                  <p className="text-xs text-slate-500">
                    Diperbarui otomatis setiap 10 detik
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => loadConversations()}
                  title="Perbarui"
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder="Cari nama atau pesan..."
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setChannel(filter.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${channel === filter.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[520px] overflow-y-auto lg:max-h-[600px]">
              {loading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-blue-600" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircleMore className="mx-auto size-9 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-600">
                    Belum ada percakapan
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Pesan masuk dari Meta akan muncul di sini.
                  </p>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedID(conversation.id)}
                    className={`flex w-full gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${selectedID === conversation.id ? "bg-blue-50/70" : ""}`}
                  >
                    <div className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">
                      {(
                        conversation.participant_name ||
                        conversation.external_participant_id
                      )
                        .slice(0, 1)
                        .toUpperCase()}
                      <span className="absolute -bottom-1 -right-1">
                        <ChannelBadge channel={conversation.channel} compact />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                          {conversation.participant_name ||
                            conversation.external_participant_id}
                        </p>
                        <span className="text-[11px] text-slate-400">
                          {formatTime(conversation.last_message_at)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-slate-500">
                          {conversation.preview || "Percakapan baru"}
                        </p>
                        {conversation.unread_count > 0 && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                            {Math.min(conversation.unread_count, 99)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          {selected ? (
            <div className="flex min-h-[620px] flex-col">
              <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="font-bold text-slate-900">
                    {selected.participant_name ||
                      selected.external_participant_id}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    ID: {selected.external_participant_id}
                  </p>
                </div>
                <ChannelBadge channel={selected.channel} />
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-5">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-blue-600" />
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-sm ${message.direction === "outbound" ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"}`}
                      >
                        <MessageBody message={message} />
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              <form
                onSubmit={submit}
                className="flex gap-3 border-t border-slate-200 bg-white p-4"
              >
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Balas melalui ${channelMeta[selected.channel].name}...`}
                  maxLength={4096}
                  disabled={sending}
                />
                <Button type="submit" disabled={sending || !draft.trim()}>
                  {sending ? <Loader2 className="animate-spin" /> : <Send />}
                  <span className="hidden sm:inline">Kirim</span>
                </Button>
              </form>
            </div>
          ) : (
            <div className="hidden min-h-[620px] items-center justify-center text-center lg:flex">
              <div>
                <MessageCircleMore className="mx-auto size-12 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-600">
                  Pilih percakapan
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Pesan akan tampil di area ini.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
