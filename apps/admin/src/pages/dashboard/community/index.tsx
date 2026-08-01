import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import { ROLES } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Bookmark,
  Eye,
  Flag,
  Heart,
  Lock,
  MessageCircle,
  Pencil,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Tag as TagIcon,
  TrendingUp,
} from "lucide-react";

type CommunityCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_visible?: boolean;
  allowed_roles?: string;
};

type CommunityAuthor = {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  role?: number;
};

type CommunityPost = {
  id: string;
  title: string;
  excerpt?: string;
  content?: string;
  type: string;
  status: string;
  visibility: string;
  author?: CommunityAuthor;
  category?: CommunityCategory;
  is_pinned?: boolean;
  is_locked?: boolean;
  is_edited?: boolean;
  accepted_comment_id?: string | null;
  view_count: number;
  reaction_count: number;
  comment_count: number;
  bookmark_count: number;
  follow_count: number;
  user_reaction?: string | null;
  is_bookmarked?: boolean;
  is_following?: boolean;
  created_at: string;
  updated_at: string;
};

type CommunityReport = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description?: string;
  status: string;
  created_at: string;
  reporter?: CommunityAuthor;
};

const postTypes = [
  { value: "discussion", label: "Diskusi umum" },
  { value: "question", label: "Pertanyaan" },
  { value: "material", label: "Berbagi materi" },
  { value: "announcement", label: "Pengumuman" },
  { value: "study_tips", label: "Tips belajar" },
  { value: "poll", label: "Polling" },
  { value: "showcase", label: "Showcase" },
];

const visibilityOptions = [
  { value: "tenant", label: "Semua user platform" },
  { value: "public", label: "Publik" },
  { value: "teachers_only", label: "Guru & mentor" },
  { value: "admins_only", label: "Admin" },
];

const defaultForm = {
  title: "",
  content: "",
  type: "discussion",
  visibility: "tenant",
  category_id: "none",
  status: "published",
  tag_slugs: "",
};

// Popular static tags
const popularTags = [
  { slug: "belajar", label: "#belajar" },
  { slug: "tanya", label: "#tanya" },
  { slug: "diskusi", label: "#diskusi" },
  { slug: "tugas", label: "#tugas" },
  { slug: "homeschool", label: "#homeschool" },
  { slug: "parenting", label: "#parenting" },
  { slug: "tips", label: "#tips" },
  { slug: "sharing", label: "#sharing" },
];

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function authorName(author?: CommunityAuthor) {
  return author?.display_name || author?.username || "User komunitas";
}

function getCurrentUserRole() {
  try {
    const raw = localStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return Number(user?.role || 0);
  } catch {
    return 0;
  }
}

function CommunityPage() {
  const role = useMemo(() => getCurrentUserRole(), []);
  const isAdmin = role >= ROLES.ADMIN;

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [popularTopics, setPopularTopics] = useState<CommunityPost[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedRefreshing, setFeedRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CommunityCategory | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    icon: "message-circle",
    color: "#2563eb",
    description: "",
    sort_order: 0,
    is_visible: true,
    allowed_roles: "10,20,30,40,99,100",
  });

  const [filters, setFilters] = useState({
    search: "",
    type: "all",
    category_id: "all",
    status: "all",
    sort: "latest",
    tag: "all",
  });

  const hasLoadedPostsRef = useRef(false);

  const loadCategories = useCallback(async () => {
    const response = await api.get("/lms/community/categories");
    setCategories(response.data?.data || []);
  }, []);

  const loadPosts = useCallback(async (pageNum = 1) => {
    if (pageNum === 1) {
      if (hasLoadedPostsRef.current) {
        setFeedRefreshing(true);
      } else {
        setLoadingPosts(true);
      }
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await api.get("/lms/community/posts", {
        params: {
          ...filters,
          page: pageNum,
          limit: 10,
          tag: filters.tag === "all" ? "" : filters.tag,
        },
      });
      const nextPosts = response.data?.data || [];
      if (pageNum === 1) {
        setPosts(nextPosts);
      } else {
        setPosts((prev) => [...prev, ...nextPosts]);
      }
      setHasMore(nextPosts.length >= 10);
    } catch (error) {
      toast.error("Gagal memuat feed komunitas");
    } finally {
      hasLoadedPostsRef.current = true;
      setLoadingPosts(false);
      setLoadingMore(false);
      setFeedRefreshing(false);
    }
  }, [filters]);

  const loadPopularTopics = useCallback(async () => {
    try {
      const response = await api.get("/lms/community/posts", {
        params: { sort: "popular", limit: 5 },
      });
      setPopularTopics(response.data?.data || []);
    } catch (error) {
      console.error("Gagal memuat topik populer", error);
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [statsResponse, reportsResponse] = await Promise.all([
        api.get("/lms/admin/community/statistics"),
        api.get("/lms/admin/community/reports", { params: { status: "pending", limit: 20 } }),
      ]);
      setStats(statsResponse.data?.data || null);
      setReports(reportsResponse.data?.data || []);
    } catch {
      // Non-admin tenant configs may intentionally reject this; keep community usable.
    }
  }, [isAdmin]);

  useEffect(() => {
    loadCategories().catch(() => toast.error("Gagal memuat kategori komunitas"));
    loadPopularTopics();
  }, [loadCategories, loadPopularTopics]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadPosts(1);
  }, [filters, loadPosts]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Infinite Scroll Sentinel Hook using IntersectionObserver
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingPosts || loadingMore || !hasMore) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const next = page + 1;
        setPage(next);
        loadPosts(next);
      }
    });

    if (node) observerRef.current.observe(node);
  }, [loadingPosts, loadingMore, hasMore, page, loadPosts]);

  const getPostSlug = (post: CommunityPost) => {
    const slugifiedTitle = (post.title || "post")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `${slugifiedTitle}-${post.id}`;
  };

  const createPost = async () => {
    try {
      const response = await api.post("/lms/community/posts", {
        ...form,
        category_id: form.category_id === "none" ? "" : form.category_id,
        tag_slugs: form.tag_slugs
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      toast.success("Posting berhasil dibuat");
      setCreateOpen(false);
      setForm(defaultForm);
      setPage(1);
      setHasMore(true);
      await loadPosts(1);
      loadPopularTopics();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal membuat posting");
    }
  };

  const togglePostReaction = async (e: React.MouseEvent, post: CommunityPost) => {
    e.preventDefault();
    e.stopPropagation();
    const wasLiked = Boolean(post.user_reaction);
    setPosts((items) =>
      items.map((item) =>
        item.id === post.id
          ? {
              ...item,
              reaction_count: Math.max(0, item.reaction_count + (wasLiked ? -1 : 1)),
              user_reaction: wasLiked ? null : "like",
            }
          : item
      )
    );
    try {
      if (wasLiked) {
        await api.delete(`/lms/community/posts/${post.id}/like`);
      } else {
        await api.post(`/lms/community/posts/${post.id}/like`, { reaction_type: "like" });
      }
    } catch {
      toast.error("Reaksi gagal diperbarui");
      loadPosts(1);
    }
  };

  const toggleBookmark = async (e: React.MouseEvent, post: CommunityPost) => {
    e.preventDefault();
    e.stopPropagation();
    const wasBookmarked = Boolean(post.is_bookmarked);
    setPosts((items) =>
      items.map((item) =>
        item.id === post.id
          ? {
              ...item,
              is_bookmarked: !wasBookmarked,
              bookmark_count: Math.max(0, item.bookmark_count + (wasBookmarked ? -1 : 1)),
            }
          : item
      )
    );
    try {
      if (wasBookmarked) {
        await api.delete(`/lms/community/posts/${post.id}/bookmark`);
        toast.success("Bookmark dibatalkan");
      } else {
        await api.post(`/lms/community/posts/${post.id}/bookmark`);
        toast.success("Posting disimpan");
      }
    } catch {
      toast.error("Gagal memperbarui bookmark");
      loadPosts(1);
    }
  };

  const reviewReport = async (report: CommunityReport, status: "approved" | "rejected") => {
    try {
      await api.put(`/lms/admin/community/reports/${report.id}/review`, {
        status,
        action: status === "approved" && report.target_type === "post" ? "hide" : "review_report",
        resolution: status === "approved" ? "Konten ditindaklanjuti moderator" : "Laporan ditolak moderator",
      });
      toast.success("Laporan diproses");
      loadAdminData();
      setPage(1);
      setHasMore(true);
      loadPosts(1);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal memproses laporan");
    }
  };

  const saveCategory = async () => {
    try {
      const payload = {
        ...categoryForm,
        sort_order: Number(categoryForm.sort_order || 0),
      };
      if (editingCategory) {
        await api.put(`/lms/admin/community/categories/${editingCategory.id}`, payload);
      } else {
        await api.post("/lms/admin/community/categories", payload);
      }
      toast.success(editingCategory ? "Kategori diperbarui" : "Kategori dibuat");
      setCategoryOpen(false);
      setEditingCategory(null);
      setCategoryForm({
        name: "",
        slug: "",
        icon: "message-circle",
        color: "#2563eb",
        description: "",
        sort_order: 0,
        is_visible: true,
        allowed_roles: "10,20,30,40,99,100",
      });
      loadCategories();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal membuat kategori");
    }
  };

  const openCategoryForm = (category?: CommunityCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name || "",
        slug: category.slug || "",
        icon: category.icon || "message-circle",
        color: category.color || "#2563eb",
        description: category.description || "",
        sort_order: category.sort_order || 0,
        is_visible: category.is_visible ?? true,
        allowed_roles: category.allowed_roles || "10,20,30,40,99,100",
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: "",
        slug: "",
        icon: "message-circle",
        color: "#2563eb",
        description: "",
        sort_order: 0,
        is_visible: true,
        allowed_roles: "10,20,30,40,99,100",
      });
    }
    setCategoryOpen(true);
  };

  const deleteCategory = async (category: CommunityCategory) => {
    if (!window.confirm(`Hapus kategori "${category.name}"?`)) return;
    try {
      await api.delete(`/lms/admin/community/categories/${category.id}`);
      setCategories((items) => items.filter((item) => item.id !== category.id));
      toast.success("Kategori dihapus");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal menghapus kategori");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] p-4 md:p-6 lg:p-8 space-y-6">
      {/* BRAND JUMBOTRON HEADER */}
      <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-slate-950 text-white shadow-xl">
        <div className="grid gap-6 p-6 md:grid-cols-[1.5fr_0.8fr] md:p-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-200">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300 animate-pulse" />
              Ruang diskusi LMS
            </div>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight md:text-5xl leading-tight">
              Tanya, jawab, bagikan materi, dan jalin kolaborasi.
            </h1>
            <p className="mt-3 max-w-xl text-xs leading-6 text-slate-300">
              Terhubung dengan komunitas pembelajar. Cari jawaban, bagikan temuan menarik, dan diskusikan topik penting di forum kami.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 flex flex-col justify-center">
            <div className="text-xs uppercase tracking-[0.24em] text-cyan-200 font-bold">Forum Summary</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-slate-400">Total Post</p>
                <p className="text-lg font-black text-white mt-0.5">{stats?.posts_count || posts.length}</p>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-slate-400">Kategori</p>
                <p className="text-lg font-black text-white mt-0.5">{categories.length}</p>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-slate-400">Komentar</p>
                <p className="text-lg font-black text-white mt-0.5">{stats?.comments_count || "-"}</p>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-slate-400">Laporan</p>
                <p className="text-lg font-black text-white mt-0.5">{reports.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="feed" className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TabsList className="w-fit bg-white shadow-sm rounded-full p-1 border">
            <TabsTrigger value="feed" className="rounded-full">Feed Komunitas</TabsTrigger>
            {isAdmin && <TabsTrigger value="moderation" className="rounded-full">Moderasi</TabsTrigger>}
            {isAdmin && <TabsTrigger value="categories" className="rounded-full">Kategori</TabsTrigger>}
          </TabsList>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5">
                <Plus className="h-4 w-4" />
                Buat Posting Baru
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Buat Posting Komunitas</DialogTitle>
              </DialogHeader>
              <PostForm form={form} setForm={setForm} categories={categories} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button>
                <Button onClick={createPost} className="bg-blue-600 hover:bg-blue-700 text-white">Publish</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* FEED TAB */}
        <TabsContent value="feed" className="mt-0">
          <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
            {/* LEFT SIDE: FEED LIST (INFINITE SCROLL) */}
            <div className="space-y-4">
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="space-y-4 bg-slate-50/50 border-b pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-slate-800">Lini Masa / Diskusi</CardTitle>
                    {feedRefreshing && (
                      <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-700">
                        Memperbarui feed…
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-9 h-11 rounded-xl"
                      placeholder="Cari judul atau isi posting..."
                      value={filters.search}
                      onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Select
                      value={filters.type}
                      onValueChange={(type) => setFilters((prev) => ({ ...prev, type }))}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Tipe</SelectItem>
                        {postTypes.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.sort}
                      onValueChange={(sort) => setFilters((prev) => ({ ...prev, sort }))}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="latest">Terbaru</SelectItem>
                        <SelectItem value="popular">Terpopuler</SelectItem>
                        <SelectItem value="discussed">Banyak dibahas</SelectItem>
                        <SelectItem value="views">Views</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.category_id}
                      onValueChange={(category_id) => setFilters((prev) => ({ ...prev, category_id }))}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {filters.tag !== "all" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Filter tag:</span>
                      <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 flex items-center gap-1">
                        #{filters.tag}
                        <button
                          onClick={() => setFilters((prev) => ({ ...prev, tag: "all" }))}
                          className="font-bold text-[10px] ml-1 text-blue-500 hover:text-blue-800"
                        >
                          ✕
                        </button>
                      </Badge>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {loadingPosts && (
                    <div className="space-y-4">
                      {[1, 2, 3].map((item) => (
                        <Skeleton key={item} className="h-32 rounded-2xl w-full" />
                      ))}
                    </div>
                  )}
                  {!loadingPosts && posts.length === 0 && (
                    <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500">
                      Belum ada postingan yang sesuai filter. Mulai postingan pertama Anda!
                    </div>
                  )}
                  {posts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/dashboard/community/${getPostSlug(post)}`}
                      className="block rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        {post.is_pinned && (
                          <Badge className="bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center gap-1">
                            <Pin className="h-3 w-3" />
                            Pinned
                          </Badge>
                        )}
                        {post.is_locked && (
                          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Locked
                          </Badge>
                        )}
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {postTypes.find((item) => item.value === post.type)?.label || post.type}
                        </Badge>
                        {post.category && (
                          <Badge
                            style={{ backgroundColor: post.category.color || "#e2e8f0" }}
                            className="text-white"
                          >
                            {post.category.name}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 leading-snug line-clamp-2">
                        {post.title || "Tanpa judul"}
                      </h3>
                      <p className="mt-2.5 line-clamp-2 text-sm text-slate-500 leading-relaxed">
                        {post.excerpt || post.content}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-50 pt-3">
                        <span className="font-medium">
                          {authorName(post.author)} · {formatDate(post.created_at)}
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5 text-slate-400" />
                            {post.comment_count}
                          </span>
                          <button
                            onClick={(e) => togglePostReaction(e, post)}
                            className={`inline-flex items-center gap-1.5 transition ${
                              post.user_reaction ? "font-bold text-rose-600" : "hover:text-rose-600"
                            }`}
                          >
                            {post.user_reaction ? "❤️" : <Heart className="h-3.5 w-3.5 text-slate-400" />}
                            {post.reaction_count}
                          </button>
                          <button
                            onClick={(e) => toggleBookmark(e, post)}
                            className={`inline-flex items-center gap-1.5 transition ${
                              post.is_bookmarked ? "text-amber-500" : "hover:text-amber-500"
                            }`}
                          >
                            <Bookmark className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {/* INFINITE SCROLL SENTINEL */}
                  <div ref={sentinelRef} className="py-4 text-center">
                    {loadingMore && (
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Memuat konten lainnya...</span>
                      </div>
                    )}
                    {!hasMore && posts.length > 0 && (
                      <span className="text-xs text-slate-400 font-medium">
                        Seluruh postingan telah ditampilkan.
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT SIDE: POPULAR TOPICS, CATEGORIES, TAGS */}
            <div className="space-y-6">
              {/* POPULAR TOPICS */}
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="border-b pb-3 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    Topik Populer
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {popularTopics.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-6">
                      Belum ada topik populer terkini.
                    </div>
                  ) : (
                    popularTopics.map((p) => (
                      <Link
                        key={p.id}
                        to={`/dashboard/community/${getPostSlug(p)}`}
                        className="block group space-y-1.5 p-2 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100"
                      >
                        <h4 className="font-semibold text-sm text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition">
                          {p.title}
                        </h4>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{authorName(p.author)}</span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3 text-slate-300" />
                            {p.view_count} views
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* CATEGORIES FILTER */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b pb-3 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold text-slate-800">Kategori</CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-1.5">
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, category_id: "all" }))}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-sm font-semibold transition ${
                        filters.category_id === "all"
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>Semua Kategori</span>
                      <Badge variant="outline" className="text-[10px]">
                        {categories.length}
                      </Badge>
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setFilters((prev) => ({ ...prev, category_id: c.id }))}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-sm font-semibold transition ${
                          filters.category_id === c.id
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: c.color || "#e2e8f0" }}
                          />
                          <span className="truncate">{c.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* POPULAR TAGS FILTER */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b pb-3 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <TagIcon className="h-4 w-4 text-blue-600" />
                    Tag Populer
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {popularTags.map((tag) => (
                      <button
                        key={tag.slug}
                        onClick={() => setFilters((prev) => ({ ...prev, tag: tag.slug }))}
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold border transition ${
                          filters.tag === tag.slug
                            ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ADMIN MODERATION TAB */}
        {isAdmin && (
          <TabsContent value="moderation">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Daftar laporan pending</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reports.length === 0 && (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
                    Tidak ada laporan pending. Moderasi aman!
                  </div>
                )}
                {reports.map((report) => (
                  <div key={report.id} className="rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                      <div>
                        <span className="text-xs text-slate-400">Target type:</span>{" "}
                        <Badge variant="secondary">{report.target_type}</Badge>
                      </div>
                      <span className="text-xs text-slate-400">{formatDate(report.created_at)}</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-sm font-bold text-slate-900">Alasan: {report.reason}</div>
                      {report.description && (
                        <p className="mt-1 text-xs text-slate-500">{report.description}</p>
                      )}
                      <div className="mt-2 text-xs text-slate-400">
                        Pelapor: {authorName(report.reporter)}
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => reviewReport(report, "approved")}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                      >
                        Tolak & Sembunyikan Post
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reviewReport(report, "rejected")}
                      >
                        Abaikan Laporan
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ADMIN CATEGORIES TAB */}
        {isAdmin && (
          <TabsContent value="categories">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Kategori forum</CardTitle>
                <Button onClick={() => openCategoryForm()} size="sm" className="gap-1 bg-slate-900 hover:bg-slate-800 text-white">
                  <Plus className="h-4 w-4" /> Kategori
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-2xl border p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-4 w-4 rounded-full shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <div>
                        <h4 className="font-bold text-slate-900">{c.name}</h4>
                        {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => openCategoryForm(c)}>
                        <Pencil className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteCategory(c)}>
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* CATEGORY FORM DIALOG */}
      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Kategori" : "Buat Kategori Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Nama Kategori</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="cth: Pengumuman"
              />
            </div>
            <div className="space-y-1">
              <Label>Slug Kategori</Label>
              <Input
                value={categoryForm.slug}
                onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                placeholder="cth: pengumuman"
              />
            </div>
            <div className="space-y-1">
              <Label>Warna</Label>
              <Input
                type="color"
                value={categoryForm.color}
                onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                className="h-10 cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <Label>Deskripsi</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Deskripsi singkat..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveCategory} className="bg-blue-600 hover:bg-blue-700 text-white">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3 text-center border border-white/5">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-xl font-black text-white mt-0.5">{value}</p>
    </div>
  );
}

function PostForm({
  form,
  setForm,
  categories,
}: {
  form: typeof defaultForm;
  setForm: any;
  categories: CommunityCategory[];
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="title">Judul Posting</Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => setForm((prev: any) => ({ ...prev, title: e.target.value }))}
          placeholder="Tulis judul posting yang informatif..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="type">Tipe Posting</Label>
          <Select
            value={form.type}
            onValueChange={(type) => setForm((prev: any) => ({ ...prev, type }))}
          >
            <SelectTrigger id="type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {postTypes.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="visibility">Visibilitas</Label>
          <Select
            value={form.visibility}
            onValueChange={(visibility) => setForm((prev: any) => ({ ...prev, visibility }))}
          >
            <SelectTrigger id="visibility"><SelectValue /></SelectTrigger>
            <SelectContent>
              {visibilityOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Kategori Forum</Label>
        <Select
          value={form.category_id}
          onValueChange={(category_id) => setForm((prev: any) => ({ ...prev, category_id }))}
        >
          <SelectTrigger id="category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Tanpa Kategori</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="content">Konten / Isi Diskusi</Label>
        <Textarea
          id="content"
          value={form.content}
          onChange={(e) => setForm((prev: any) => ({ ...prev, content: e.target.value }))}
          placeholder="Tulis detail materi atau pertanyaan diskusi..."
          rows={6}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tags">Tags (pisahkan dengan koma)</Label>
        <Input
          id="tags"
          value={form.tag_slugs}
          onChange={(e) => setForm((prev: any) => ({ ...prev, tag_slugs: e.target.value }))}
          placeholder="cth: belajar, matematika, info"
        />
      </div>
    </div>
  );
}

const WrappedPage = DashboardLayout(CommunityPage);
export default WrappedPage;
