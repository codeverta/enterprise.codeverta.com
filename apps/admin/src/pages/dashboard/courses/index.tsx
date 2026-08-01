import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { toast } from "sonner";
import {
  BookOpen,
  Bold,
  Edit,
  Eye,
  FileAudio,
  FileImage,
  FileText,
  Heading2,
  Italic,
  Link,
  List,
  Loader2,
  PlusCircle,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  Trash2,
  Upload,
  Video,
  X,
  ChevronDown,
  Layers,
  LayoutGrid,
  Tag,
} from "lucide-react";
import { Link as RouterLink, useNavigate } from "react-router";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import AdminCourseList from "@/components/course-list/AdminCourseList";
import StudentCourseList from "@/components/course-list/StudentCourseList";
import { ROLES } from "../../../lib/constants";

/* ─── constants ─────────────────────────────────────────────── */

const emptyModuleForm = {
  id: "",
  title: "",
  description: "",
  sort_order: 0,
  is_published: false,
};

const emptyAssetForm = {
  title: "",
  type: "video",
  file_url: "",
  thumbnail_url: "",
  description: "",
  is_downloadable: false,
};

const assetTypes = [
  { value: "video", label: "Video", icon: Video },
  { value: "audiobook", label: "Audiobook", icon: FileAudio },
  { value: "image", label: "Gambar", icon: FileImage },
  { value: "ebook", label: "Ebook", icon: FileText },
  { value: "worksheet", label: "Worksheet", icon: FileText },
];

const acceptByAssetType = {
  video: "video/mp4,video/webm,video/quicktime,video/x-m4v",
  audiobook: "audio/*,.m4a,.mp3,.wav,.ogg,.flac",
  image: "image/*",
  ebook: ".pdf,.epub,.doc,.docx,application/pdf,application/epub+zip",
  worksheet: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip",
};

/* ─── helpers ────────────────────────────────────────────────── */

const getResponseData = (r) => r.data?.data || r.data || [];

const statusMeta = {
  published: { label: "Published", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  archived: { label: "Archived", cls: "bg-red-100 text-red-600 border-red-200" },
};

const markdownPreview = (value) => {
  if (!value) return "";
  return value
    .replace(/^### (.*$)/gim, "<h3 class='text-base font-semibold mt-3 mb-1'>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2 class='text-lg font-semibold mt-4 mb-1'>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1 class='text-xl font-bold mt-4 mb-2'>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noreferrer" class="text-blue-600 underline">$1</a>')
    .replace(/^\- (.*$)/gim, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/\n/g, "<br />");
};

/* ─── sub-components ─────────────────────────────────────────── */



/* ─── main page ──────────────────────────────────────────────── */

function CourseManagementPage({ user, sellerStatus, sellerStatusLoading }) {
  return (
    <div>
      <StudentCourseList user={user}/>
    </div>
  );
}

export default DashboardLayout(CourseManagementPage);
