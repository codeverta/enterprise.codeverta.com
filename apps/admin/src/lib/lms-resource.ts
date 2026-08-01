import {
  FileText,
  Video,
  FileAudio,
  Library,
  ShieldCheck,
  UsersRound,
    MessageSquareText,
    CheckCircle2,
  UserCircle,
  Home,
  UserCircle2,
  UserCog,
  TicketPercent,
  ChartNoAxesCombined,
  Mailbox,
  TicketCheck,
  Train,
  TowerControlIcon,
  BriefcaseBusiness,
  PartyPopper,
  CalendarDays,
  BusFront,
  FolderOpen,
  GraduationCap,
  Tags,
} from "lucide-react";
import { useNavigate} from "react-router";
import { toast } from "sonner";
import Sidebar from "../components/Sidebar";
import {
  CreditCard,
  Users,
  BookOpen,
  MessageSquare,
  Settings,
} from "lucide-react";


const assetTypes = ["video", "ebook", "audiobook", "worksheet", "image"];
const roleTypes = ["student", "parent", "mentor", "admin"];
const courseStatuses = ["draft", "published", "archived"];
const subscriptionStatuses = ["trialing", "active", "past_due", "canceled", "expired"];
const paymentStatuses = ["pending", "paid", "failed", "expired"];
type FieldType = "text" | "textarea" | "number" | "select" | "switch" | "datetime" | "json";

type FieldConfig = {
  key: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  options?: string[];
};

type ResourceConfig = {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: FieldConfig[];
  columns: string[];
  defaults?: Record<string, unknown>;
};

export const resources: ResourceConfig[] = [
{
    key: "classes",
    label: "Classes / Cohorts",
    description: "Ruang kelas aktual yang diajar oleh Mentor.",
    icon: UsersRound,
    columns: ["name", "course_id", "mentor_id", "is_active"],
    defaults: { is_active: true },
    fields: [
      { key: "name", label: "Class Name", placeholder: "e.g. Kelas Golang Batch 1" },
      { key: "course_id", label: "Course ID" },
      { key: "mentor_id", label: "Mentor ID" },
      { key: "start_date", label: "Start Date", type: "datetime" },
      { key: "end_date", label: "End Date", type: "datetime" },
      { key: "is_active", label: "Active", type: "switch" },
    ],
  },
  {
    key: "class-students",
    label: "Class Assignments",
    description: "Penempatan siswa ke dalam suatu kelas (Hanya Mentor/Admin).",
    icon: CheckCircle2,
    columns: ["class_id", "student_id", "created_at"],
    fields: [
      { key: "class_id", label: "Class ID" },
      { key: "student_id", label: "Student User ID" },
    ],
  },
  {
    key: "course-categories",
    label: "Course Categories",
    description: "Kategori wajib untuk mengelompokkan course.",
    icon: FolderOpen,
    columns: ["name", "slug", "is_active", "sort_order"],
    defaults: { is_active: true, sort_order: 0 },
    fields: [
      { key: "name", label: "Name" },
      { key: "slug", label: "Slug" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "sort_order", label: "Sort Order", type: "number" },
      { key: "is_active", label: "Active", type: "switch" },
    ],
  },
  {
    key: "courses",
    label: "Courses",
    description: "Kelas utama yang dijual dan dibuka untuk siswa.",
    icon: GraduationCap,
    columns: ["title", "slug", "level", "status", "minimum_passing_grade", "allow_skip", "sort_order"],
    defaults: { status: "draft", sort_order: 0, minimum_passing_grade: 0, allow_skip: false },
    fields: [
      { key: "title", label: "Title" },
      { key: "slug", label: "Slug" },
      { key: "short_description", label: "Short Description", type: "textarea" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "cover_image_url", label: "Cover Image URL" },
      { key: "course_category_id", label: "Course Category ID" },
      { key: "level", label: "Level" },
      { key: "age_range", label: "Age Range" },
      { key: "status", label: "Status", type: "select", options: courseStatuses },
      { key: "minimum_passing_grade", label: "Nilai Kelulusan Minimum", type: "number" },
      { key: "allow_skip", label: "Boleh Lompat Lesson", type: "switch" },
      { key: "sort_order", label: "Sort Order", type: "number" },
      { key: "mentor_id", label: "Mentor ID" },
    ],
  },
  {
    key: "modules",
    label: "Modules",
    description: "Bab di dalam course.",
    icon: BookOpen,
    columns: ["title", "course_id", "is_published", "sort_order"],
    defaults: { is_published: false, sort_order: 0 },
    fields: [
      { key: "course_id", label: "Course ID" },
      { key: "title", label: "Title" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "sort_order", label: "Sort Order", type: "number" },
      { key: "is_published", label: "Published", type: "switch" },
    ],
  },
  {
    key: "lessons",
    label: "Lessons",
    description: "Unit belajar dan video pendek di dalam module.",
    icon: Video,
    columns: ["title", "module_id", "duration_sec", "is_preview", "is_published"],
    defaults: { duration_sec: 0, sort_order: 0, is_preview: false, is_published: false },
    fields: [
      { key: "module_id", label: "Module ID" },
      { key: "title", label: "Title" },
      { key: "summary", label: "Summary", type: "textarea" },
      { key: "duration_sec", label: "Duration Seconds", type: "number" },
      { key: "sort_order", label: "Sort Order", type: "number" },
      { key: "is_preview", label: "Preview", type: "switch" },
      { key: "is_published", label: "Published", type: "switch" },
    ],
  },
  {
    key: "learning-assets",
    label: "Learning Assets",
    description: "Video pendek, ebook, audiobook, dan worksheet per lesson.",
    icon: FileAudio,
    columns: ["title", "type", "lesson_id", "is_downloadable", "sort_order"],
    defaults: { type: "video", is_downloadable: false, duration_sec: 0, file_size: 0, sort_order: 0 },
    fields: [
      { key: "lesson_id", label: "Lesson ID" },
      { key: "type", label: "Type", type: "select", options: assetTypes },
      { key: "title", label: "Title" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "file_url", label: "File URL" },
      { key: "thumbnail_url", label: "Thumbnail URL" },
      { key: "duration_sec", label: "Duration Seconds", type: "number" },
      { key: "file_size", label: "File Size", type: "number" },
      { key: "is_downloadable", label: "Downloadable", type: "switch" },
      { key: "sort_order", label: "Sort Order", type: "number" },
    ],
  },
  {
    key: "library-items",
    label: "Library",
    description: "Materi umum yang bisa tampil sebagai library.",
    icon: Library,
    columns: ["title", "type", "is_published", "created_at"],
    defaults: { type: "ebook", is_published: false, tags: "[]" },
    fields: [
      { key: "type", label: "Type", type: "select", options: assetTypes },
      { key: "title", label: "Title" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "file_url", label: "File URL" },
      { key: "thumbnail_url", label: "Thumbnail URL" },
      { key: "tags", label: "Tags JSON", type: "json", placeholder: '["coding","worksheet"]' },
      { key: "is_published", label: "Published", type: "switch" },
    ],
  },
  {
    key: "subscriptions",
    label: "Subscriptions",
    description: "Langganan bulanan untuk membuka akses belajar.",
    icon: CreditCard,
    columns: ["student_id", "parent_id", "status", "amount", "current_period_end"],
    defaults: { status: "active", provider: "xendit", currency: "IDR", interval: "month", cancel_at_period_end: false },
    fields: [
      { key: "parent_id", label: "Parent User ID" },
      { key: "student_id", label: "Student User ID" },
      { key: "course_id", label: "Course ID" },
      { key: "status", label: "Status", type: "select", options: subscriptionStatuses },
      { key: "provider", label: "Provider" },
      { key: "provider_customer_id", label: "Provider Customer ID" },
      { key: "provider_plan_id", label: "Provider Plan ID" },
      { key: "provider_subscription_id", label: "Provider Subscription ID" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "currency", label: "Currency" },
      { key: "interval", label: "Interval" },
      { key: "current_period_start", label: "Current Period Start", type: "datetime" },
      { key: "current_period_end", label: "Current Period End", type: "datetime" },
      { key: "cancel_at_period_end", label: "Cancel At Period End", type: "switch" },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    description: "Daftar invoice dan status pembayaran.",
    icon: ShieldCheck,
    columns: ["external_id", "status", "amount", "provider", "paid_at"],
    defaults: { status: "pending", provider: "xendit", currency: "IDR", gateway_data: "{}" },
    fields: [
      { key: "subscription_id", label: "Subscription ID" },
      { key: "parent_id", label: "Parent User ID" },
      { key: "student_id", label: "Student User ID" },
      { key: "course_id", label: "Course ID" },
      { key: "provider", label: "Provider" },
      { key: "external_id", label: "External ID" },
      { key: "invoice_url", label: "Invoice URL" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "currency", label: "Currency" },
      { key: "status", label: "Status", type: "select", options: paymentStatuses },
      { key: "paid_at", label: "Paid At", type: "datetime" },
      { key: "gateway_data", label: "Gateway Data JSON", type: "json" },
    ],
  },
  {
    key: "profiles",
    label: "Profiles",
    description: "Profil siswa, orangtua, mentor, dan admin.",
    icon: UsersRound,
    columns: ["full_name", "user_id", "phone_number", "display_name", "nisn"],
    defaults: { metadata: "{}" },
    fields: [
      { key: "user_id", label: "User ID" },
      { key: "full_name", label: "Full Name" },
      { key: "display_name", label: "Display Name" },
      { key: "phone_number", label: "Phone Number" },
      { key: "nisn", label: "NISN Siswa" },
      { key: "avatar_url", label: "Avatar URL" },
      { key: "bio", label: "Bio", type: "textarea" },
      { key: "date_of_birth", label: "Date of Birth", type: "datetime" },
      { key: "metadata", label: "Metadata JSON", type: "json" },
    ],
  },
  {
    key: "user-roles",
    label: "User Roles",
    description: "Role LMS: siswa, orangtua, mentor/guru, admin.",
    icon: ShieldCheck,
    columns: ["user_id", "role", "created_at"],
    defaults: { role: "student" },
    fields: [
      { key: "user_id", label: "User ID" },
      { key: "role", label: "Role", type: "select", options: roleTypes },
    ],
  },
  {
    key: "mentors",
    label: "Mentors",
    description: "Guru atau mentor yang mengelola materi.",
    icon: UsersRound,
    columns: ["name", "user_id", "headline", "is_active"],
    defaults: { is_active: true },
    fields: [
      { key: "user_id", label: "User ID" },
      { key: "name", label: "Name" },
      { key: "headline", label: "Headline" },
      { key: "bio", label: "Bio", type: "textarea" },
      { key: "avatar_url", label: "Avatar URL" },
      { key: "is_active", label: "Active", type: "switch" },
    ],
  },
  {
    key: "memberships",
    label: "Memberships",
    description: "Relasi orangtua dan siswa.",
    icon: UsersRound,
    columns: ["parent_id", "student_id", "status"],
    defaults: { status: "active" },
    fields: [
      { key: "parent_id", label: "Parent User ID" },
      { key: "student_id", label: "Student User ID" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "student-progress",
    label: "Student Progress",
    description: "Progres lesson per siswa.",
    icon: CheckCircle2,
    columns: ["student_id", "lesson_id", "is_completed", "progress_percent"],
    defaults: { is_completed: false, last_position_sec: 0, progress_percent: 0 },
    fields: [
      { key: "student_id", label: "Student User ID" },
      { key: "course_id", label: "Course ID" },
      { key: "module_id", label: "Module ID" },
      { key: "lesson_id", label: "Lesson ID" },
      { key: "is_completed", label: "Completed", type: "switch" },
      { key: "completed_at", label: "Completed At", type: "datetime" },
      { key: "last_position_sec", label: "Last Position Seconds", type: "number" },
      { key: "progress_percent", label: "Progress Percent", type: "number" },
    ],
  },
  {
    key: "pricing-settings",
    label: "Paket Langganan",
    description: "Paket yang dipilih peserta sebelum membayar lewat Xendit.",
    icon: CreditCard,
    columns: ["name", "pricing_category_id", "bundle_id", "amount", "currency", "interval", "is_active"],
    defaults: {
      name: "Pemula",
      amount: 99000,
      currency: "IDR",
      interval: "month",
      is_active: true,
      features: '["Akses materi dasar","Course pemula","Progress belajar"]',
    },
    fields: [
      { key: "name", label: "Nama Paket", type: "select", options: ["Pemula", "Anak-anak", "Dewasa"] },
      { key: "pricing_category_id", label: "Pricing Category ID" },
      { key: "bundle_id", label: "Course Bundle ID" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "currency", label: "Currency" },
      { key: "interval", label: "Interval" },
      // { key: "features", label: "Features JSON", type: "json" },
      { key: "is_active", label: "Active", type: "switch" },
    ],
  },
  {
    key: "pricing-categories",
    label: "Kategori Harga",
    description: "Kategori paket harga langganan (SD, SMP, SMA, Guru2Digit, Parent System).",
    icon: Tags,
    columns: ["name", "slug", "checkout_type", "sort_order", "is_active"],
    defaults: { sort_order: 1, is_active: true, checkout_type: "student" },
    fields: [
      { key: "name", label: "Nama Kategori", placeholder: "cth: SD" },
      { key: "slug", label: "Slug", placeholder: "cth: sd" },
      {
        key: "checkout_type",
        label: "Checkout Type",
        type: "select",
        options: ["student", "teacher"],
      },
      { key: "sort_order", label: "Sort Order", type: "number" },
      { key: "is_active", label: "Active", type: "switch" },
    ],
  },
  {
    key: "faqs",
    label: "FAQs",
    description: "Pertanyaan untuk landing page.",
    icon: MessageSquareText,
    columns: ["question", "category", "is_published", "sort_order"],
    defaults: { is_published: false, sort_order: 0 },
    fields: [
      { key: "question", label: "Question", type: "textarea" },
      { key: "answer", label: "Answer", type: "textarea" },
      { key: "category", label: "Category" },
      { key: "sort_order", label: "Sort Order", type: "number" },
      { key: "is_published", label: "Published", type: "switch" },
    ],
  },
  {
    key: "testimonials",
    label: "Testimonials",
    description: "Testimoni untuk landing page.",
    icon: MessageSquareText,
    columns: ["name", "role", "rating", "is_published"],
    defaults: { rating: 5, is_published: false, sort_order: 0 },
    fields: [
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
      { key: "content", label: "Content", type: "textarea" },
      { key: "avatar_url", label: "Avatar URL" },
      { key: "rating", label: "Rating", type: "number" },
      { key: "sort_order", label: "Sort Order", type: "number" },
      { key: "is_published", label: "Published", type: "switch" },
    ],
  },
  {
    key: "site-content",
    label: "Site Content",
    description: "Konten landing page berbentuk JSON.",
    icon: FileText,
    columns: ["key", "title", "updated_at"],
    defaults: { content: "{}" },
    fields: [
      { key: "key", label: "Key" },
      { key: "title", label: "Title" },
      { key: "content", label: "Content JSON", type: "json" },
    ],
  },
  {
    key: "community-posts",
    label: "Community Posts",
    description: "Post komunitas siswa/orangtua.",
    icon: MessageSquareText,
    columns: ["title", "author_id", "is_published", "published_at"],
    defaults: { is_published: false },
    fields: [
      { key: "author_id", label: "Author User ID" },
      { key: "title", label: "Title" },
      { key: "body", label: "Body", type: "textarea" },
      { key: "is_published", label: "Published", type: "switch" },
      { key: "published_at", label: "Published At", type: "datetime" },
    ],
  },
  {
    key: "parent-guides",
    label: "Parent Guides",
    description: "Panduan khusus orangtua.",
    icon: FileText,
    columns: ["title", "is_published", "sort_order"],
    defaults: { is_published: false, sort_order: 0 },
    fields: [
      { key: "title", label: "Title" },
      { key: "content", label: "Content", type: "textarea" },
      { key: "sort_order", label: "Sort Order", type: "number" },
      { key: "is_published", label: "Published", type: "switch" },
    ],
  },
  {
    key: "level-unlocks",
    label: "Level Unlocks",
    description: "Akses level belajar per siswa.",
    icon: ShieldCheck,
    columns: ["student_id", "course_id", "level", "unlocked_at"],
    fields: [
      { key: "student_id", label: "Student User ID" },
      { key: "course_id", label: "Course ID" },
      { key: "level", label: "Level" },
      { key: "unlocked_at", label: "Unlocked At", type: "datetime" },
    ],
  },
];

export const lmsConfigs = resources.reduce((acc, config) => {
  // Kita ubah kebab-case (learning-assets) jadi camelCase (learningAssets) untuk key object
  const objectKey = config.key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  
  acc[objectKey] = config;
  return acc;
}, {} as Record<string, ResourceConfig>);
