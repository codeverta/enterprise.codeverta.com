import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams, useParams } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  CheckCheck,
  ChevronDown,
  Loader2,
  MessageCircle,
  Send,
  X,
  Search,
  Menu,
  Archive,
	Plus,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import isToday from "dayjs/plugin/isToday";
import isYesterday from "dayjs/plugin/isYesterday";
import "dayjs/locale/id";
import { toast } from "sonner";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import EmptyChat from "@/components/chat/EmptyChat";
import LessonContextBanner from "@/components/chat/LessonContextBanner";
import ConversationList from "@/components/chat/ConversationList";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { renderBody } from "../../../lib/utils";
import { tableComponents } from "@/components/course-editor/MarkdownView";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";

// Registrasikan plugin Day.js
dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.locale("id");

/* ─────────────────────────────────────────────
   Interfaces & Type Definitions
───────────────────────────────────────────── */
interface Student {
  id: string;
  username: string;
  display_name: string;
  email: string;
  role: number;
}

interface AssignedTo {
  display_name: string;
}

interface Conversation {
  id: string;
  title?: string;
	lesson_id?: string;
  lesson_title?: string;
	course_id?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  status?: string;
  sender_id?: string;
  sender?: Student;
  receiver_id?: string;
  receiver?: Student;
  receiver_role?: string;
  student_id?: string;
  student?: Student;
  assigned_to?: AssignedTo;
  is_archived?: boolean;
  is_pinned?: boolean;
}

interface Message {
  id: string;
  conversation_id?: string;
  sender_id: string;
  sender_name: string;
  sender_role?: string;
  body: string;
  is_read?: boolean;
  created_at: string;
  lesson_id?: string;
  lesson_title?: string;
  course_id?: string;
}

interface CourseOption {
  id: string;
  title: string;
}

interface LessonOption {
  id: string;
  title: string;
  module_title?: string;
  course_id: string;
  course_title: string;
}

const AI_STARTER_QUESTIONS = [
  "Bagaimana cara menghubungi pengajar lewat fitur Chat?",
  "Jika aplikasi saya error, ke mana saya harus melaporkannya?",
  "Bagaimana cara melihat course yang sudah saya ikuti?",
  "Bagaimana cara mengubah profil dan foto akun saya?",
  "Bagaimana cara melihat jadwal belajar saya?",
  "Bagaimana cara mengecek status langganan atau pembayaran?",
];

/* ─────────────────────────────────────────────
   Helpers & Sub-components
───────────────────────────────────────────── */
function formatTime(ts: string) {
  return dayjs(ts).format("HH:mm");
}

function formatDay(ts: string) {
  const d = dayjs(ts);
  if (d.isToday()) return "Hari ini";
  if (d.isYesterday()) return "Kemarin";
  return d.format("dddd, D MMMM YYYY");
}

function groupByDay(messages: Message[]) {
  const groups: any[] = [];
  let lastDay: string | null = null;
  for (const msg of messages) {
    const day = dayjs(msg.created_at).format("YYYY-MM-DD");
    if (day !== lastDay) {
      groups.push({ type: "divider", day, label: formatDay(msg.created_at) });
      lastDay = day;
    }
    groups.push({ type: "message", ...msg });
  }
  return groups;
}

function conversationDisplayName(conv: Conversation | null, currentUserId: string, fallback = "Student") {
  if (!conv) return fallback;
  if (conv.receiver && conv.sender_id === currentUserId) {
    return conv.receiver.display_name || fallback;
  }
  if (conv.sender && conv.sender_id !== currentUserId) {
    return conv.sender.display_name || fallback;
  }
  if (conv.student_id && conv.student_id !== currentUserId) {
    return conv.student?.display_name || fallback;
  }
  return conv.assigned_to?.display_name || conv.receiver?.display_name || conv.sender?.display_name || conv.student?.display_name || fallback;
}

function MessageBubble({ msg, isMine }: { msg: Message; isMine: boolean }) {
  return (
    <div
      className={cn(
        "flex items-end gap-3 w-full",
        isMine ? "justify-end" : "justify-start"
      )}
    >
      {!isMine && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
          {(msg.sender_name || "G")[0].toUpperCase()}
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] flex flex-col gap-1",
          isMine ? "items-end" : "items-start"
        )}
      >
        {!isMine && msg.sender_name && (
          <p className="px-1 text-[11px] font-semibold text-slate-500">
            {msg.sender_name}
          </p>
        )}

        {msg.lesson_id && (
          <Link
            to={`/dashboard/lessons/${msg.lesson_id}`}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all",
              isMine
                ? "bg-blue-700/10 border-blue-600/20 text-blue-800 hover:bg-blue-700/20"
                : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
            )}
          >
            <BookOpen className="h-3 w-3 flex-shrink-0 text-blue-500" />
            <span className="truncate">{msg.lesson_title || "Lesson"}</span>
          </Link>
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm break-words border",
            isMine
              ? "rounded-br-sm bg-blue-600 text-white border-blue-700 selection:bg-blue-500"
              : "rounded-bl-sm bg-white text-slate-800 border-slate-200/60"
          )}
        >
          <div className="prose prose-sm max-w-none prose-slate text-inherit dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
              components={tableComponents}
            >
              {renderBody(msg.body) || ""}
            </ReactMarkdown>
          </div>
        </div>

        <div className="flex items-center gap-1 px-1 text-[10px] text-slate-400">
          <span>{formatTime(msg.created_at)}</span>
          {isMine && (
            <CheckCheck
              className={cn(
                "h-3 w-3",
                msg.is_read ? "text-blue-500" : "text-slate-400"
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-3 w-full justify-start">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white shadow-sm">
        AI
      </div>
      <div className="max-w-[75%] flex flex-col gap-1 items-start">
        <p className="px-1 text-[11px] font-semibold text-purple-600">
          AI Assistant
        </p>
        <div className="flex items-center gap-3 rounded-2xl rounded-bl-sm border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <span className="text-xs font-medium">AI sedang berpikir</span>
          <span className="flex gap-1 items-center">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500 [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500 [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main ChatPage Component
───────────────────────────────────────────── */
function ChatPage({ setIsSidebarOpen }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    dayjs.locale(language);
  }, [language]);

  const routeParams = useParams();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as "ai" | "mentor" | "parent" | null;
  const [chatMode, setChatMode] = useState<"ai" | "mentor" | "parent">(
    tabParam && ["ai", "mentor", "parent"].includes(tabParam) ? tabParam : "ai"
  );

  const [parentChildren, setParentChildren] = useState<Student[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [mentors, setMentors] = useState<Student[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState<string>(
    searchParams.get("mentor_id") || ""
  );
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const switchTab = (mode: "ai" | "mentor" | "parent") => {
    setChatMode(mode);
    setActiveConv(null);
    setActiveAiConv(null);
    setMessages([]);
    setSearchParams(
      (prev) => {
        prev.set("tab", mode);
        return prev;
      },
      { replace: true }
    );
  };

  const routeLessonId =
    routeParams.lessonId || searchParams.get("lesson_id") || "";

  const [lessonPayload, setLessonPayload] = useState<any>(null);
  const [lessonLoading, setLessonLoading] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showBanner, setShowBanner] = useState(!!routeLessonId);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [archiveFilter, setArchiveFilter] = useState<"active" | "archived">(
    "active"
  );
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiConversations, setAiConversations] = useState<Conversation[]>([]);
  const [aiConvsLoading, setAiConvsLoading] = useState(false);
  const [activeAiConv, setActiveAiConv] = useState<Conversation | null>(null);
  const [aiTopic, setAiTopic] = useState<"guide" | "material" | null>(
    routeLessonId ? "material" : null
  );
  const [myCourses, setMyCourses] = useState<CourseOption[]>([]);
  const [courseLessons, setCourseLessons] = useState<LessonOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [materialsLoading, setMaterialsLoading] = useState(false);
	const [creatingAIConversation, setCreatingAIConversation] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const me = { id: savedUser?.id || "b7c84aa8-b281-4296-b809-d32a2dd57276" };
  const currentUserRole = Number(savedUser?.role || 0);
  const isMentorStaff =
    currentUserRole === 30 || currentUserRole === 40 || currentUserRole >= 99;
  const requiresMentorSelection = chatMode === "mentor" && !isMentorStaff;
  const selectedMentor = mentors.find(
    (mentor) => mentor.id === selectedMentorId
  );
  const humanChatDisabled =
    chatMode === "mentor" &&
    (requiresMentorSelection ? !selectedMentorId : !activeConv);

  const lessonContext = {
    lesson_id: routeLessonId,
    lesson_title:
      lessonPayload?.lesson?.title ||
      searchParams.get("lesson_title") ||
      "Materi",
    module_title:
      lessonPayload?.module?.title || searchParams.get("module_title") || "",
    course_id: lessonPayload?.course?.id || searchParams.get("course_id") || "",
    course_title:
      lessonPayload?.course?.title || searchParams.get("course_title") || "",
  };

  useEffect(() => {
    if (!routeLessonId) return;
    let alive = true;
    const fetchLesson = async () => {
      setLessonLoading(true);
      try {
        const res = await api.get(`/lms/lessons/${routeLessonId}`);
        if (alive) setLessonPayload(res.data?.data || res.data);
      } catch {
        toast.error("Gagal memuat konteks lesson.");
      } finally {
        if (alive) setLessonLoading(false);
      }
    };
    fetchLesson();
    return () => {
      alive = false;
    };
  }, [routeLessonId]);

  useEffect(() => {
    if (routeLessonId) setAiTopic("material");
  }, [routeLessonId]);

  useEffect(() => {
	if (chatMode !== "ai" || aiTopic !== "guide" || creatingAIConversation || activeAiConv) return;
    let alive = true;
    const loadGuideHistory = async () => {
      setAiLoading(true);
      try {
        const res = await api.get("/lms/chat/ai/messages");
        const payload = res.data?.data || res.data || {};
        if (alive) {
          setAiMessages(payload.messages || []);
          setActiveAiConv(payload.conversation || null);
        }
      } catch {
        if (alive) toast.error("Gagal memuat history panduan aplikasi.");
      } finally {
        if (alive) setAiLoading(false);
      }
    };
    loadGuideHistory();
    return () => {
      alive = false;
    };
	}, [chatMode, aiTopic, creatingAIConversation, activeAiConv?.id]);

  useEffect(() => {
    if (!routeLessonId) {
	  // A guide/RAG conversation intentionally has no lesson_id. Do not clear
	  // its messages when activeAiConv changes after an AI response arrives.
	  if (aiTopic === "material") setAiMessages([]);
      return;
    }
	if (activeAiConv?.id && activeAiConv.lesson_id === routeLessonId) return;
    let alive = true;
    const loadAIHistory = async () => {
      setAiLoading(true);
      try {
        const res = await api.get(
          `/lms/chat/lessons/${routeLessonId}/ai/messages`
        );
        const payload = res.data?.data || res.data || {};
		if (alive) {
		  setAiMessages(payload.messages || []);
		  setActiveAiConv(payload.conversation || null);
		}
      } catch {
        if (alive) toast.error("Gagal memuat history AI.");
      } finally {
        if (alive) setAiLoading(false);
      }
    };
    loadAIHistory();
    return () => {
      alive = false;
    };
	}, [routeLessonId, activeAiConv?.id, aiTopic]);

  useEffect(() => {
    if (savedUser?.role !== 10) return;
    let alive = true;
    const fetchChildren = async () => {
      try {
        const res = await api.get("/lms/parent/students");
        const data = res.data?.data || res.data || [];
        if (alive) {
          setParentChildren(data);
          if (data.length > 0 && !selectedChildId) {
            setSelectedChildId(data[0].id);
          }
        }
      } catch {
        // Silently fail
      }
    };
    fetchChildren();
    return () => {
      alive = false;
    };
  }, [selectedChildId]);

  useEffect(() => {
    if (chatMode !== "mentor" || isMentorStaff) return;
    let alive = true;
    const fetchMentors = async () => {
      setMentorsLoading(true);
      try {
        const res = await api.get("/lms/chat/mentors");
        const data = res.data?.data || res.data || [];
        if (!alive) return;
        setMentors(data);
        setSelectedMentorId((current) =>
          data.some((mentor: Student) => mentor.id === current)
            ? current
            : data[0]?.id || ""
        );
      } catch {
        if (alive) toast.error("Gagal memuat daftar mentor.");
      } finally {
        if (alive) setMentorsLoading(false);
      }
    };
    fetchMentors();
    return () => {
      alive = false;
    };
  }, [chatMode, isMentorStaff]);

  useEffect(() => {
    if (chatMode === "ai") {
      loadAIConversations();
    }
  }, [chatMode]);

  const loadAIConversations = async () => {
    setAiConvsLoading(true);
    try {
      const res = await api.get("/lms/chat/conversations?receiver_role=ai");
      setAiConversations(res.data?.data || res.data || []);
    } catch {
      // Silently fail
    } finally {
      setAiConvsLoading(false);
    }
  };

  const selectAIConversation = useCallback(
    async (conv: Conversation) => {
	  setCreatingAIConversation(false);
      setActiveAiConv(conv);
      setAiLoading(true);
      setShowMobileSidebar(false);

      // Set query param lesson_id secara dinamis saat conversation di-klik
      if (conv.lesson_id) {
		setAiTopic("material");
        setSearchParams(
          (prev) => {
            prev.set("lesson_id", conv.lesson_id!);
            prev.set("tab", "ai"); // Memastikan tab tetap di posisi 'ai'
            return prev;
          },
          { replace: true }
        );
	  } else {
		setAiTopic("guide");
		setSearchParams(
		  (prev) => {
			prev.delete("lesson_id");
			prev.delete("lesson_title");
			prev.delete("module_title");
			prev.delete("course_id");
			prev.delete("course_title");
			prev.set("tab", "ai");
			return prev;
		  },
		  { replace: true }
		);
      }

      try {
        const res = await api.get(
          `/lms/chat/conversations/${conv.id}/messages`
        );
        setAiMessages(res.data?.data || res.data || []);
      } catch {
        toast.error("Gagal memuat pesan AI.");
      } finally {
        setAiLoading(false);
      }
    },
    [setSearchParams]
  ); // Tambahkan setSearchParams ke dependency array

	const startNewAIConversation = () => {
	  setCreatingAIConversation(true);
	  setAiTopic(null);
	  setActiveAiConv(null);
	  setAiMessages([]);
	  setLessonPayload(null);
	  setSelectedCourseId("");
	  setCourseLessons([]);
	  setInput("");
	  setSearchParams(
		(prev) => {
		  ["lesson_id", "lesson_title", "module_title", "course_id", "course_title"].forEach((key) => prev.delete(key));
		  prev.set("tab", "ai");
		  return prev;
		},
		{ replace: true }
	  );
	  setTimeout(() => inputRef.current?.focus(), 0);
	};

  const chooseGuideTopic = () => {
    setAiTopic("guide");
    setActiveAiConv(null);
    setAiMessages([]);
    setLessonPayload(null);
    setSearchParams(
      (prev) => {
        ["lesson_id", "lesson_title", "module_title", "course_id", "course_title"].forEach((key) => prev.delete(key));
        prev.set("tab", "ai");
        return prev;
      },
      { replace: true }
    );
  };

  const chooseMaterialTopic = async () => {
    setAiTopic("material");
    if (myCourses.length > 0 || materialsLoading) return;
    setMaterialsLoading(true);
    try {
      const res = await api.get("/lms/my-courses", { params: { limit: 100 } });
      setMyCourses(res.data?.data || []);
    } catch {
      toast.error("Gagal memuat course yang Anda ikuti.");
    } finally {
      setMaterialsLoading(false);
    }
  };

  const changeMaterial = async () => {
    setActiveAiConv(null);
    setAiMessages([]);
    setLessonPayload(null);
    setSelectedCourseId("");
    setCourseLessons([]);
    setSearchParams(
      (prev) => {
        ["lesson_id", "lesson_title", "module_title", "course_id", "course_title"].forEach((key) => prev.delete(key));
        prev.set("tab", "ai");
        return prev;
      },
      { replace: true }
    );
    await chooseMaterialTopic();
  };

  const chooseCourse = async (course: CourseOption) => {
    setSelectedCourseId(course.id);
    setCourseLessons([]);
    setMaterialsLoading(true);
    try {
      const moduleRes = await api.get("/lms/modules", { params: { course_id: course.id, limit: 100 } });
      const modules = moduleRes.data?.data || moduleRes.data || [];
      const lessonResponses = await Promise.all(
        modules.map((module: any) => api.get("/lms/lessons", { params: { module_id: module.id, limit: 100 } }))
      );
      const lessons = lessonResponses.flatMap((response, index) => {
        const rows = response.data?.data || response.data || [];
        return rows.map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title,
          module_title: modules[index]?.title,
          course_id: course.id,
          course_title: course.title,
        }));
      });
      setCourseLessons(lessons);
    } catch {
      toast.error("Gagal memuat materi course.");
    } finally {
      setMaterialsLoading(false);
    }
  };

  const chooseLesson = (lesson: LessonOption) => {
    setAiTopic("material");
    setActiveAiConv(null);
    setAiMessages([]);
    setSearchParams(
      (prev) => {
        prev.set("tab", "ai");
        prev.set("lesson_id", lesson.id);
        prev.set("lesson_title", lesson.title);
        prev.set("module_title", lesson.module_title || "");
        prev.set("course_id", lesson.course_id);
        prev.set("course_title", lesson.course_title);
        return prev;
      },
      { replace: true }
    );
    inputRef.current?.focus();
  };
  useEffect(() => {
    setIsSidebarOpen(false);
  }, []);

  useEffect(() => {
    loadConversations(statusFilter, archiveFilter);
  }, [chatMode, statusFilter, archiveFilter, selectedMentorId]);

  const loadConversations = async (
    status = "all",
    archive: "active" | "archived" = "active"
  ) => {
    if (chatMode === "ai") return;
    if (requiresMentorSelection && !selectedMentorId) {
      setConversations([]);
      setConvsLoading(false);
      return;
    }
    setConvsLoading(true);
    try {
      const params = new URLSearchParams({ receiver_role: chatMode });
      if (requiresMentorSelection) {
        params.set("receiver_id", selectedMentorId);
      }
      if (status !== "all") params.set("status", status);
      params.set("archived", archive === "archived" ? "true" : "false");
      const res = await api.get(`/lms/chat/conversations?${params.toString()}`);
      setConversations(res.data?.data || res.data || []);
    } catch {
      toast.error("Gagal memuat percakapan.");
    } finally {
      setConvsLoading(false);
    }
  };

  const updateConversationState = async (
    conv: Conversation,
    patch: {
      is_archived?: boolean;
      is_pinned?: boolean;
      status?: "open" | "resolved";
    }
  ) => {
    try {
      await api.patch(`/lms/chat/conversations/${conv.id}/state`, patch);
      if (activeConv?.id === conv.id) {
        if (patch.is_archived) {
          setActiveConv(null);
          setMessages([]);
        } else {
          setActiveConv((current) =>
            current ? { ...current, ...patch } : current
          );
        }
      }
      await loadConversations(statusFilter, archiveFilter);
      if (patch.is_archived !== undefined) {
        toast.success(
          patch.is_archived
            ? "Percakapan diarsipkan."
            : "Percakapan dipulihkan."
        );
      } else if (patch.is_pinned !== undefined) {
        toast.success(patch.is_pinned ? "Percakapan dipin." : "Pin dilepas.");
      } else if (patch.status) {
        toast.success(
          patch.status === "resolved"
            ? "Percakapan diselesaikan."
            : "Percakapan dibuka kembali."
        );
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Gagal memperbarui percakapan."
      );
    }
  };

  const markAllConversationsRead = async () => {
    if (chatMode === "ai" || markingAllRead) return;
    try {
      setMarkingAllRead(true);
      await api.post(
        `/lms/chat/conversations/read-all?receiver_role=${chatMode}`
      );
      setConversations((current) =>
        current.map((conv) => ({ ...conv, unread_count: 0 }))
      );
      toast.success("Semua percakapan ditandai sudah dibaca.");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Gagal menandai semua percakapan."
      );
    } finally {
      setMarkingAllRead(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const q = searchQuery.toLowerCase();
    return (
      (conv.title || "").toLowerCase().includes(q) ||
      (conv.lesson_title || "").toLowerCase().includes(q) ||
      (conv.sender?.display_name || "").toLowerCase().includes(q) ||
      (conv.receiver?.display_name || "").toLowerCase().includes(q) ||
      (conv.student?.display_name || "").toLowerCase().includes(q)
    );
  });

  const selectConversation = useCallback(async (conv: Conversation) => {
    setActiveConv(conv);
    setMsgsLoading(true);
    setShowMobileSidebar(false);
    try {
      const res = await api.get(`/lms/chat/conversations/${conv.id}/messages`);
      setMessages(res.data?.data || res.data || []);
      setConversations((current) =>
        current.map((item) =>
          item.id === conv.id ? { ...item, unread_count: 0 } : item
        )
      );
    } catch {
      toast.error("Gagal memuat pesan.");
    } finally {
      setMsgsLoading(false);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiMessages, aiThinking]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  };

  const insertLessonMention = () => {
    const mention = `[Lesson: ${lessonContext.lesson_title}${
      lessonContext.module_title ? ` | ${lessonContext.module_title}` : ""
    }] `;
    setInput((prev) => mention + prev);
    setShowBanner(false);
    inputRef.current?.focus();
  };

  const buildLessonMeta = () => {
    if (!lessonContext.lesson_id || !input.includes("[Lesson:")) return {};
    return {
      lesson_id: lessonContext.lesson_id,
      lesson_title: lessonContext.lesson_title,
      course_id: lessonContext.course_id,
    };
  };

  const startNewConversation = async () => {
    if (requiresMentorSelection && !selectedMentorId) {
      toast.info("Pilih mentor tujuan terlebih dahulu.");
      return;
    }
    if (chatMode === "mentor" && isMentorStaff && !activeConv) {
      toast.info("Pilih percakapan partner yang ingin dibalas.");
      return;
    }
    const isParentUser = savedUser?.role === 10;
    const targetLabel =
      chatMode === "parent"
        ? isParentUser
          ? "Anak"
          : "Merchant"
        : selectedMentor?.display_name || selectedMentor?.username || "Mentor";
    try {
      const payload: any = {
        title: lessonContext.lesson_id
          ? `${targetLabel}: ${lessonContext.lesson_title}`
          : `Chat dengan ${targetLabel}`,
        lesson_id: lessonContext.lesson_id || undefined,
        lesson_title: lessonContext.lesson_title || undefined,
        course_id: lessonContext.course_id || undefined,
        receiver_role: chatMode,
      };
      if (isParentUser && chatMode === "parent" && selectedChildId) {
        payload.receiver_id = selectedChildId;
      }
      if (chatMode === "mentor" && selectedMentorId) {
        payload.receiver_id = selectedMentorId;
      }
      const res = await api.post("/lms/chat/conversations", payload);
      const conv = res.data?.data || res.data;
      setConversations((prev) => [conv, ...prev]);
      setActiveConv(conv);
      setMessages([]);
      if (lessonContext.lesson_id) insertLessonMention();
    } catch {
      toast.error("Gagal membuat percakapan baru.");
    }
  };

  const sendHumanMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    if (requiresMentorSelection && !selectedMentorId) {
      toast.info("Pilih mentor tujuan terlebih dahulu.");
      return;
    }
    if (chatMode === "mentor" && isMentorStaff && !activeConv) {
      toast.info("Pilih percakapan partner yang ingin dibalas.");
      return;
    }

    let conv = activeConv;
    if (!conv) {
      try {
        const isParentUser = savedUser?.role === 10;
        const payload: any = {
          title: lessonContext.lesson_id
            ? `Pertanyaan: ${lessonContext.lesson_title}`
            : trimmed.slice(0, 60),
          lesson_id: lessonContext.lesson_id || undefined,
          lesson_title: lessonContext.lesson_title || undefined,
          course_id: lessonContext.course_id || undefined,
          receiver_role: chatMode,
        };
        if (isParentUser && chatMode === "parent" && selectedChildId) {
          payload.receiver_id = selectedChildId;
        }
        if (chatMode === "mentor" && selectedMentorId) {
          payload.receiver_id = selectedMentorId;
        }
        const res = await api.post("/lms/chat/conversations", payload);
        conv = res.data?.data || res.data;
        setConversations((prev) => [conv, ...prev]);
        setActiveConv(conv);
      } catch {
        toast.error("Gagal membuat percakapan.");
        return;
      }
    }

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conv?.id,
      sender_id: me.id,
      sender_name: "Saya",
      body: trimmed,
      is_read: false,
      created_at: new Date().toISOString(),
      ...buildLessonMeta(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setSending(true);

    try {
      const res = await api.post(
        `/lms/chat/conversations/${conv?.id}/messages`,
        {
          body: trimmed,
          receiver_role: chatMode,
          ...buildLessonMeta(),
        }
      );
      const saved = res.data?.data || res.data;
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? saved : m))
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengirim pesan.");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

	const sendAIMessage = async (
	  questionOverride?: string,
	  topicOverride?: "guide" | "material",
	  forceNewOverride?: boolean
	) => {
	const trimmed = (questionOverride ?? input).trim();
	const selectedTopic = topicOverride ?? aiTopic;
	const shouldCreateNew = forceNewOverride ?? creatingAIConversation;
	if (!trimmed || aiThinking) return;
	if (!selectedTopic) {
	  toast.info("Pilih dulu: panduan penggunaan aplikasi atau materi pembelajaran.");
	  return;
	}
	if (selectedTopic === "material" && !routeLessonId) {
	  toast.info("Pilih course dan materi yang ingin ditanyakan.");
	  return;
	}

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender_id: me.id,
      sender_name: "Saya",
      body: trimmed,
      created_at: new Date().toISOString(),
	  lesson_id: selectedTopic === "material" ? routeLessonId : undefined,
	  lesson_title: selectedTopic === "material" ? lessonContext.lesson_title : undefined,
    };

    setAiMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAiThinking(true);

    try {
	  const endpoint = selectedTopic === "guide" ? "/lms/chat/ai" : `/lms/chat/lessons/${routeLessonId}/ai`;
	  const res = await api.post(endpoint, {
        message: trimmed,
		conversation_id: shouldCreateNew ? undefined : activeAiConv?.id,
		new_conversation: shouldCreateNew,
      });
      const data = res.data?.data || res.data || {};
      const answer = data.answer;
      const savedUserMessage = data.user_message;
      const assistantMessage = data.assistant_message;
	  if (data.conversation) setActiveAiConv(data.conversation);

      setAiMessages((prev) => [
        ...prev.map((msg) =>
          msg.id === userMsg.id ? savedUserMessage || msg : msg
        ),
        assistantMessage || {
          id: `ai-${Date.now()}`,
          sender_id: "ai-assistant",
          sender_name: "AI Assistant",
          sender_role: "ai",
		  body: answer || "Informasi belum tersedia.",
          created_at: new Date().toISOString(),
		  lesson_id: selectedTopic === "material" ? routeLessonId : undefined,
		  lesson_title: selectedTopic === "material" ? lessonContext.lesson_title : undefined,
        },
      ]);
	  setCreatingAIConversation(false);
	  await loadAIConversations();
    } catch (err: any) {
	  setCreatingAIConversation(false);
	  loadAIConversations();
      setAiMessages((prev) => prev.filter((msg) => msg.id !== userMsg.id));
      setAiMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender_id: "ai-assistant",
          sender_name: "AI Assistant",
          sender_role: "ai",
          body:
            err.response?.data?.message ||
            "Maaf, AI sedang mengalami gangguan. Coba lagi nanti.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setAiThinking(false);
      inputRef.current?.focus();
    }
  };

	const askStarterQuestion = async (question: string) => {
	  startNewAIConversation();
	  setAiTopic("guide");
	  await sendAIMessage(question, "guide", true);
	};

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMode === "ai") {
      sendAIMessage();
    } else {
      sendHumanMessage();
    }
  };

  const currentMessages = chatMode === "ai" ? aiMessages : messages;
  const isTargetLoading =
	chatMode === "ai"
	  ? aiLoading || (aiTopic === "material" && lessonLoading)
	  : msgsLoading;
  const chatCategories = [
    { key: "ai", label: "AI Assistant" },
    { key: "mentor", label: "Tanya Mentor" },
  ];

  // if (savedUser?.role === 20)
  //   chatCategories.push({ key: "parent", label: "Hubungi Merchant" });
  // if (savedUser?.role === 10)
  //   chatCategories.push({ key: "parent", label: "Chat Anak" });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 relative">
      {/* ── Sidebar Container (Desktop & Drawer Mobile) ── */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 w-80 md:w-96 border-r bg-white flex flex-col h-full transform transition-transform duration-300 ease-in-out md:relative md:transform-none",
          showMobileSidebar
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-slate-900 text-lg">Percakapan</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {chatMode === "ai"
                ? aiConversations.length
                : filteredConversations.length}
            </span>
            {chatMode !== "ai" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500"
                onClick={markAllConversationsRead}
                disabled={markingAllRead}
                title="Tandai semua sudah dibaca"
              >
                {markingAllRead ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setShowMobileSidebar(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search Control */}
        <div className="px-4 py-2 shrink-0">
		  {chatMode === "ai" ? (
			<Button type="button" onClick={startNewAIConversation} className="w-full rounded-xl bg-purple-600 text-white hover:bg-purple-700">
			  <Plus className="h-4 w-4" /> Percakapan AI baru
			</Button>
		  ) : (
			<div className="relative flex items-center">
			  <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
			  <input type="text" placeholder={t("chat.search_placeholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition" />
			</div>
		  )}
        </div>

        {/* Parent Role Filter Child Selector */}
        {savedUser?.role === 10 &&
          chatMode === "parent" &&
          parentChildren.length > 0 && (
            <div className="px-4 py-2 border-b shrink-0 bg-slate-50/50">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                {t("chat.chat_with")}
              </label>
              <ERPSelect
                value={selectedChildId}
                onChange={(e) => {
                  setSelectedChildId(e.target.value);
                  setActiveConv(null);
                  setMessages([]);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none shadow-sm cursor-pointer"
              >
                {parentChildren.map((child) => (
                  <ERPSelectOption key={child.id} value={child.id}>
                    {child.display_name ||
                      child.username ||
                      child.email ||
                      "Anak"}
                  </ERPSelectOption>
                ))}
              </ERPSelect>
            </div>
          )}

        {requiresMentorSelection && (
          <div className="border-b bg-blue-50/40 px-4 py-3 shrink-0">
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Mentor tujuan
            </label>
            <div className="flex gap-2">
              <ERPSelect
                value={selectedMentorId}
                disabled={mentorsLoading || mentors.length === 0}
                onChange={(event) => {
                  const mentorId = event.target.value;
                  setSelectedMentorId(mentorId);
                  setActiveConv(null);
                  setMessages([]);
                  setSearchParams(
                    (current) => {
                      current.set("tab", "mentor");
                      if (mentorId) current.set("mentor_id", mentorId);
                      else current.delete("mentor_id");
                      return current;
                    },
                    { replace: true }
                  );
                }}
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mentorsLoading ? (
                  <ERPSelectOption value="">Memuat mentor...</ERPSelectOption>
                ) : mentors.length === 0 ? (
                  <ERPSelectOption value="">Belum ada mentor tersedia</ERPSelectOption>
                ) : (
                  mentors.map((mentor) => (
                    <ERPSelectOption key={mentor.id} value={mentor.id}>
                      {mentor.display_name || mentor.username || "Mentor"}
                    </ERPSelectOption>
                  ))
                )}
              </ERPSelect>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 bg-white"
                disabled={!selectedMentorId}
                title="Mulai chat baru dengan mentor ini"
                onClick={() => {
                  setActiveConv(null);
                  setMessages([]);
                  setInput("");
                  inputRef.current?.focus();
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {selectedMentor && (
              <p className="mt-1.5 text-[10px] text-slate-500">
                Pesan baru hanya akan diterima oleh {selectedMentor.display_name || selectedMentor.username}.
              </p>
            )}
          </div>
        )}

        {chatMode !== "ai" && (
          <div className="space-y-2 border-b px-4 py-2.5 shrink-0">
            <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1">
              {(["active", "archived"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setArchiveFilter(view)}
                  className={cn(
                    "flex h-7 items-center justify-center gap-1.5 rounded text-[11px] font-semibold",
                    archiveFilter === view
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  {view === "archived" && <Archive className="h-3 w-3" />}
                  {view === "active" ? "Aktif" : "Arsip"}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {["all", "open", "resolved"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                    statusFilter === status
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {status === "all"
                    ? "Semua"
                    : status === "open"
                    ? "Baru"
                    : "Selesai"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Sidebar Content List */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {chatMode === "ai" ? (
            aiConvsLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {aiConversations.map((conv) => (
                  <li key={conv.id}>
                    <button
                      onClick={() => selectAIConversation(conv)}
                      className={cn(
                        "w-full px-4 py-3.5 text-left transition-all relative flex flex-col gap-0.5",
                        activeAiConv?.id === conv.id
                          ? "bg-purple-50/70"
                          : "hover:bg-slate-50"
                      )}
                    >
                      {activeAiConv?.id === conv.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-600 rounded-r" />
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-sm font-semibold",
                            activeAiConv?.id === conv.id
                              ? "text-purple-700"
                              : "text-slate-800"
                          )}
                        >
                          {conv.title || conv.lesson_title || "AI Chat"}
                        </p>
                        <span className="flex-shrink-0 text-[10px] text-slate-400 font-medium">
                          {conv.last_message_at
                            ? dayjs(conv.last_message_at).fromNow(true)
                            : ""}
                        </span>
                      </div>
                      {conv.lesson_title && (
                        <p className="truncate text-[11px] font-medium text-purple-600/90 mt-0.5">
                          📚 {conv.lesson_title}
                        </p>
                      )}
                      {conv.last_message && (
                        <p className="mt-1 truncate text-xs text-slate-500 leading-normal">
                          {conv.last_message}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ConversationList
              conversations={filteredConversations}
              activeId={activeConv?.id}
              onSelect={selectConversation}
              onAction={updateConversationState}
              currentUserId={me.id}
              canResolve={
                currentUserRole === 30 ||
                currentUserRole === 40 ||
                currentUserRole >= 99
              }
              loading={convsLoading}
            />
          )}
        </div>
      </div>

      {/* Backdrop for Mobile Sidebar Drawer */}
      {showMobileSidebar && <div onClick={() => setShowMobileSidebar(false)} />}

      {/* ── Main Chat Room Panel Area ── */}
      <div className="flex flex-1 flex-col overflow-hidden h-full bg-white md:bg-slate-50/40">
        {/* Upper Switcher Bar Tab */}
        <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex rounded-xl bg-slate-100 p-1 w-full max-w-md shadow-inner">
            {chatCategories.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchTab(tab.key as any)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-bold transition-all text-center",
                  chatMode === tab.key
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200/40"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upper Chat Identity Header Header */}
        <div className="flex items-center gap-3 border-b bg-white px-4 py-3 shrink-0 shadow-sm z-10">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 text-slate-500 shrink-0"
            onClick={() => setShowMobileSidebar(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm border",
              chatMode === "ai"
                ? "bg-purple-50 border-purple-100 text-purple-700"
                : "bg-blue-50 border-blue-100 text-blue-700"
            )}
          >
            {chatMode === "ai" ? (
              "AI"
            ) : activeConv ? (
              conversationDisplayName(activeConv, me.id, "S")[0].toUpperCase()
            ) : requiresMentorSelection && selectedMentor ? (
              (selectedMentor.display_name || selectedMentor.username || "M")[0].toUpperCase()
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-slate-900 text-sm md:text-base">
              {chatMode === "ai"
				? aiTopic === "guide" ? "AI Panduan Aplikasi" : "AI Materi Pembelajaran"
                : activeConv
                ? conversationDisplayName(activeConv, me.id)
                : requiresMentorSelection && selectedMentor
                ? selectedMentor.display_name || selectedMentor.username
                : `Chat dengan ${
                    chatMode === "parent"
                      ? savedUser?.role === 10
                        ? "Anak"
                        : "Merchant"
                      : selectedMentor?.display_name || "Mentor"
                  }`}
            </p>
            <p className="truncate text-xs font-medium text-slate-400 mt-0.5">
              {chatMode === "ai"
				? aiTopic === "guide"
				  ? "Jawaban berdasarkan dokumentasi aplikasi"
				  : routeLessonId ? lessonContext.lesson_title : "Pilih topik pertanyaan di bawah"
                : activeConv?.title ||
                  activeConv?.lesson_title ||
                  t("chat.select_placeholder")}
            </p>
          </div>

          {routeLessonId && (
            <Link
              to={`/dashboard/lessons/${routeLessonId}`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl transition"
            >
              {t("chat.open_material")}
            </Link>
          )}
        </div>

        {/* Content Context Banner */}
        {chatMode !== "ai" && showBanner && (
          <LessonContextBanner
            context={lessonContext}
            onDismiss={() => setShowBanner(false)}
            onInsert={insertLessonMention}
          />
        )}

		{chatMode === "ai" && aiTopic && (
          <div className="bg-blue-50/60 border-b px-4 py-2 text-xs text-blue-800 flex items-center gap-2 font-medium shrink-0">
            <BookOpen className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
            <span className="truncate">
			  Mode aktif:{" "}
              <strong className="text-blue-900 font-bold">
				{aiTopic === "guide" ? "Panduan penggunaan aplikasi" : routeLessonId ? lessonContext.lesson_title : "Pilih course dan materi"}
              </strong>
            </span>
          </div>
        )}

        {/* ── Messages Box Container (Scrollable) ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-y-auto px-4 py-6 bg-slate-50/30"
        >
          {isTargetLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : currentMessages.length === 0 ? (
            chatMode === "ai" ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center p-6">
                <div className="h-12 w-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg shadow-sm">
                  AI
                </div>
                <p className="text-sm font-bold text-slate-800 mt-2">
                  Tanya AI Assistant
                </p>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
				  {aiTopic === "guide"
					? "Tanyakan cara menggunakan fitur aplikasi. Jawaban akan dicari dari knowledge base."
					: aiTopic === "material"
					? "Pilih course dan materi, lalu tanyakan bagian yang belum dipahami."
					: "Pilih dahulu ingin bertanya tentang panduan aplikasi atau materi pembelajaran."}
                </p>
				{aiTopic !== "material" && (
				  <div className="mt-4 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
					{AI_STARTER_QUESTIONS.map((question) => (
					  <button
						key={question}
						type="button"
						onClick={() => askStarterQuestion(question)}
						disabled={aiThinking}
						className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-left text-xs font-medium leading-5 text-slate-700 shadow-sm transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-800 disabled:opacity-50"
					  >
						“{question}”
					  </button>
					))}
				  </div>
				)}
              </div>
            ) : (
              <EmptyChat
                context={lessonContext}
                onStartNew={startNewConversation}
              />
            )
          ) : (
            <div className="space-y-6 pb-2">
              {groupByDay(currentMessages).map((item) =>
                item.type === "divider" ? (
                  <div
                    key={`divider-${item.day}`}
                    className="flex items-center gap-3 py-2"
                  >
                    <div className="flex-1 border-t border-slate-200/80" />
                    <span className="rounded-full bg-slate-200/60 px-3 py-0.5 text-[10px] font-bold text-slate-500 shadow-2xs">
                      {item.label}
                    </span>
                    <div className="flex-1 border-t border-slate-200/80" />
                  </div>
                ) : (
                  <MessageBubble
                    key={item.id}
                    msg={item}
                    isMine={
                      item.sender_id === me.id && item.sender_role !== "ai"
                    }
                  />
                )
              )}
              {chatMode === "ai" && aiThinking && <TypingBubble />}
              <div ref={bottomRef} />
            </div>
          )}

          {showScrollBtn && (
            <button
              onClick={() =>
                bottomRef.current?.scrollIntoView({ behavior: "smooth" })
              }
              className="absolute bottom-5 right-5 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition z-20"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Input Action Box ── */}
        <div className="border-t bg-white px-4 py-4 shrink-0">
		  {chatMode === "ai" && (
			<div className="mx-auto mb-3 max-w-5xl space-y-2.5">
			  <p className="text-xs font-bold text-slate-700">Ingin tanya tentang apa?</p>
			  <div className="grid grid-cols-2 gap-2">
				<button type="button" onClick={chooseGuideTopic} className={cn("rounded-xl border px-3 py-2 text-left text-xs font-semibold transition", aiTopic === "guide" ? "border-purple-400 bg-purple-50 text-purple-800 ring-2 ring-purple-100" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
				  Panduan penggunaan aplikasi
				</button>
				<button type="button" onClick={chooseMaterialTopic} className={cn("rounded-xl border px-3 py-2 text-left text-xs font-semibold transition", aiTopic === "material" ? "border-blue-400 bg-blue-50 text-blue-800 ring-2 ring-blue-100" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
				  Materi pembelajaran
				</button>
			  </div>
			  {aiTopic === "material" && routeLessonId && (
				<div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs">
				  <span className="truncate text-blue-800"><strong>Materi:</strong> {lessonContext.lesson_title}</span>
				  <button type="button" onClick={changeMaterial} className="ml-3 shrink-0 font-bold text-blue-700 hover:text-blue-900">Ganti materi</button>
				</div>
			  )}

			  {aiTopic === "material" && !routeLessonId && (
				<div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2.5">
				  <p className="mb-2 text-[11px] font-bold text-slate-600">Course yang Anda ikuti</p>
				  {materialsLoading && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-blue-500" /></div>}
				  {!materialsLoading && myCourses.length === 0 && <p className="py-2 text-xs text-slate-500">Belum ada course aktif di My Courses.</p>}
				  <div className="flex flex-wrap gap-2">
					{myCourses.map((course) => (
					  <button key={course.id} type="button" onClick={() => chooseCourse(course)} className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold", selectedCourseId === course.id ? "border-blue-400 bg-blue-100 text-blue-800" : "border-slate-200 bg-white text-slate-700")}>
						{course.title}
					  </button>
					))}
				  </div>
				  {selectedCourseId && courseLessons.length > 0 && (
					<div className="mt-3 border-t border-slate-200 pt-2">
					  <p className="mb-2 text-[11px] font-bold text-slate-600">Pilih materi yang ingin ditanyakan</p>
					  <div className="grid gap-1.5 sm:grid-cols-2">
						{courseLessons.map((lesson) => (
						  <button key={lesson.id} type="button" onClick={() => chooseLesson(lesson)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs hover:border-blue-300 hover:bg-blue-50">
							<span className="block font-semibold text-slate-800">{lesson.title}</span>
							{lesson.module_title && <span className="mt-0.5 block text-[10px] text-slate-500">{lesson.module_title}</span>}
						  </button>
						))}
					  </div>
					</div>
				  )}
				</div>
			  )}
			</div>
		  )}
          {chatMode !== "ai" &&
            lessonContext.lesson_id &&
            input.includes("[Lesson:") && (
              <div className="mb-2.5 flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-xl bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-100 shadow-2xs">
                  <BookOpen className="h-3 w-3 text-blue-500" />
                  {lessonContext.lesson_title}
                  <button
                    type="button"
                    onClick={() =>
                      setInput((prev) =>
                        prev.replace(/\[Lesson:[^\]]+\]\s*/g, "")
                      )
                    }
                    className="ml-1 text-blue-400 hover:text-blue-600 p-0.5 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}

          <form
            onSubmit={handleFormSubmit}
            className="flex items-end gap-3 max-w-5xl mx-auto"
          >
            <div className="flex flex-1 items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 focus-within:bg-white">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleFormSubmit(e);
                  }
                }}
                placeholder={
                  chatMode === "ai"
					? aiTopic === "guide"
					  ? "Tanyakan cara menggunakan aplikasi..."
					  : aiTopic === "material" && routeLessonId
					  ? `Tanya AI seputar "${lessonContext.lesson_title}"...`
					  : "Pilih topik pertanyaan di atas..."
                    : humanChatDisabled
                    ? isMentorStaff
                      ? "Pilih percakapan partner terlebih dahulu..."
                      : "Pilih mentor tujuan terlebih dahulu..."
                    : `Tulis pesan ke ${
                        chatMode === "parent"
                          ? savedUser?.role === 10
                            ? "Anak"
                            : "Merchant"
                          : selectedMentor?.display_name || "Mentor"
                      }...`
                }
                rows={1}
				disabled={(chatMode === "ai" && aiThinking) || humanChatDisabled}
                className="max-h-32 flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed leading-relaxed py-0.5"
                style={{ lineHeight: "1.25rem" }}
              />
            </div>
            <Button
              type="submit"
              disabled={
                !input.trim() ||
                sending ||
					aiThinking ||
                humanChatDisabled
              }
              className="h-10 w-10 flex-shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 shadow-sm transition-all"
            >
              {sending || aiThinking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="mt-2 text-center text-[10px] font-medium text-slate-400 tracking-wide">
            Enter untuk kirim · Shift+Enter untuk baris baru
          </p>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout(ChatPage);
