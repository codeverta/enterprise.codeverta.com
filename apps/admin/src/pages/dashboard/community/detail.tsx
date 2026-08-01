import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import { ROLES } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  Eye,
  Flag,
  Heart,
  Home,
  Lock,
  MessageCircle,
  Pin,
  Send,
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

type CommunityComment = {
  id: string;
  post_id: string;
  parent_comment_id?: string | null;
  author?: CommunityAuthor;
  content: string;
  depth: number;
  is_answer?: boolean;
  is_accepted_answer?: boolean;
  is_edited?: boolean;
  reaction_count: number;
  reply_count: number;
  user_reaction?: string | null;
  created_at: string;
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

function CommunityDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const role = useMemo(() => getCurrentUserRole(), []);
  const isAdmin = role >= ROLES.ADMIN;

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [recommendations, setRecommendations] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Extract ID from slug
  const postId = useMemo(() => {
    if (!slug || slug.length < 36) return "";
    return slug.slice(-36);
  }, [slug]);

  const loadPostDetail = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const [postResponse, commentResponse] = await Promise.all([
        api.get(`/lms/community/posts/${postId}`),
        api.get(`/lms/community/posts/${postId}/comments`, { params: { include_replies: true, limit: 100 } }),
      ]);
      const postData = postResponse.data?.data || null;
      setPost(postData);
      setComments(commentResponse.data?.data || []);

      // Load recommended posts from same category
      if (postData?.category?.id) {
        const recResponse = await api.get("/lms/community/posts", {
          params: { category_id: postData.category.id, limit: 5 },
        });
        const recs = (recResponse.data?.data || []).filter((p: CommunityPost) => p.id !== postId);
        setRecommendations(recs);
      } else {
        const recResponse = await api.get("/lms/community/posts", { params: { limit: 5 } });
        const recs = (recResponse.data?.data || []).filter((p: CommunityPost) => p.id !== postId);
        setRecommendations(recs);
      }
    } catch (error) {
      toast.error("Gagal memuat detail posting");
      navigate("/dashboard/community");
    } finally {
      setLoading(false);
    }
  }, [postId, navigate]);

  useEffect(() => {
    loadPostDetail();
  }, [loadPostDetail]);

  const getPostSlug = (p: CommunityPost) => {
    const slugifiedTitle = (p.title || "post")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `${slugifiedTitle}-${p.id}`;
  };

  const submitComment = async () => {
    if (!post || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await api.post(`/lms/community/posts/${post.id}/comments`, { content: commentText });
      setCommentText("");
      toast.success("Komentar dikirim");
      // Reload comments
      const commentResponse = await api.get(`/lms/community/posts/${post.id}/comments`, {
        params: { include_replies: true, limit: 100 },
      });
      setComments(commentResponse.data?.data || []);
    } catch {
      toast.error("Gagal mengirim komentar");
    } finally {
      setSubmittingComment(false);
    }
  };

  const togglePostReaction = async () => {
    if (!post) return;
    try {
      if (post.user_reaction) {
        await api.delete(`/lms/community/posts/${post.id}/like`);
        setPost((p) =>
          p
            ? {
                ...p,
                user_reaction: null,
                reaction_count: Math.max(0, p.reaction_count - 1),
              }
            : null
        );
      } else {
        await api.post(`/lms/community/posts/${post.id}/like`, { reaction_type: "like" });
        setPost((p) =>
          p
            ? {
                ...p,
                user_reaction: "like",
                reaction_count: p.reaction_count + 1,
              }
            : null
        );
      }
    } catch {
      toast.error("Gagal memproses reaksi");
    }
  };

  const toggleBookmark = async () => {
    if (!post) return;
    try {
      if (post.is_bookmarked) {
        await api.delete(`/lms/community/posts/${post.id}/bookmark`);
        setPost((p) =>
          p
            ? {
                ...p,
                is_bookmarked: false,
                bookmark_count: Math.max(0, p.bookmark_count - 1),
              }
            : null
        );
      } else {
        await api.post(`/lms/community/posts/${post.id}/bookmark`);
        setPost((p) =>
          p
            ? {
                ...p,
                is_bookmarked: true,
                bookmark_count: p.bookmark_count + 1,
              }
            : null
        );
      }
    } catch {
      toast.error("Gagal menyimpan bookmark");
    }
  };

  const toggleFollow = async () => {
    if (!post) return;
    try {
      if (post.is_following) {
        await api.delete(`/lms/community/posts/${post.id}/follow`);
        setPost((p) =>
          p
            ? {
                ...p,
                is_following: false,
                follow_count: Math.max(0, p.follow_count - 1),
              }
            : null
        );
      } else {
        await api.post(`/lms/community/posts/${post.id}/follow`);
        setPost((p) =>
          p
            ? {
                ...p,
                is_following: true,
                follow_count: p.follow_count + 1,
              }
            : null
        );
      }
    } catch {
      toast.error("Gagal mengikuti postingan");
    }
  };

  const reportPost = async () => {
    if (!post) return;
    const reason = window.prompt("Masukkan alasan report postingan ini:");
    if (!reason) return;
    try {
      await api.post(`/lms/community/posts/${post.id}/report`, { reason });
      toast.success("Postingan berhasil di-report");
    } catch {
      toast.error("Gagal men-report postingan");
    }
  };

  const moderatePost = async (action: "pin" | "lock") => {
    if (!post) return;
    const isSet = action === "pin" ? post.is_pinned : post.is_locked;
    const method = isSet ? "delete" : "post";
    try {
      await api[method](`/lms/admin/community/posts/${post.id}/${action}`);
      toast.success(`Berhasil mengubah status moderasi`);
      setPost((p) =>
        p
          ? {
              ...p,
              is_pinned: action === "pin" ? !p.is_pinned : p.is_pinned,
              is_locked: action === "lock" ? !p.is_locked : p.is_locked,
            }
          : null
      );
    } catch {
      toast.error("Gagal melakukan moderasi");
    }
  };

  const toggleCommentReaction = async (comment: CommunityComment) => {
    try {
      if (comment.user_reaction) {
        await api.delete(`/lms/community/comments/${comment.id}/like`);
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id
              ? {
                  ...c,
                  user_reaction: null,
                  reaction_count: Math.max(0, c.reaction_count - 1),
                }
              : c
          )
        );
      } else {
        await api.post(`/lms/community/comments/${comment.id}/like`, { reaction_type: "like" });
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id
              ? {
                  ...c,
                  user_reaction: "like",
                  reaction_count: c.reaction_count + 1,
                }
              : c
          )
        );
      }
    } catch {
      toast.error("Gagal memproses reaksi komentar");
    }
  };

  const acceptAnswer = async (comment: CommunityComment) => {
    try {
      await api.post(`/lms/community/comments/${comment.id}/accept`);
      toast.success("Jawaban diterima");
      loadPostDetail();
    } catch {
      toast.error("Gagal menerima jawaban");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-12">
        <div className="space-y-4 w-full max-w-4xl">
          <div className="h-6 bg-slate-200 rounded animate-pulse w-1/4"></div>
          <Card className="p-6 space-y-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-200 animate-pulse"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-1/3"></div>
                <div className="h-3 bg-slate-200 rounded animate-pulse w-1/4"></div>
              </div>
            </div>
            <div className="h-8 bg-slate-200 rounded animate-pulse w-2/3"></div>
            <div className="h-32 bg-slate-200 rounded animate-pulse w-full"></div>
          </Card>
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 space-y-6">
      {/* BREADCRUMB SECTION */}
      <nav className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <Link to="/dashboard" className="hover:text-blue-600 transition flex items-center gap-1">
          <Home className="h-3.5 w-3.5" />
          Home
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/dashboard/community" className="hover:text-blue-600 transition">
          Komunitas
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-800 truncate max-w-[240px]">
          {post.title}
        </span>
      </nav>

      {/* BACK ACTION */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard/community")}
          className="gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Feed</span>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
        {/* LEFT COLUMN: MAIN POST DETAILS */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-slate-200 shadow-sm">
                    <AvatarImage src={post.author?.avatar_url || ""} />
                    <AvatarFallback className="bg-slate-100 font-semibold text-slate-700">
                      {authorName(post.author).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-slate-900">
                      {authorName(post.author)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDate(post.created_at)} {post.is_edited ? "· diedit" : ""}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moderatePost("pin")}
                        className={post.is_pinned ? "bg-cyan-50 border-cyan-200 text-cyan-700" : ""}
                      >
                        <Pin className="mr-1 h-3.5 w-3.5" />
                        {post.is_pinned ? "Unpin" : "Pin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moderatePost("lock")}
                        className={post.is_locked ? "bg-amber-50 border-amber-200 text-amber-700" : ""}
                      >
                        <Lock className="mr-1 h-3.5 w-3.5" />
                        {post.is_locked ? "Unlock" : "Lock"}
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={reportPost} className="text-slate-600">
                    <Flag className="mr-1 h-3.5 w-3.5" />
                    Report
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  {postTypes.find((item) => item.value === post.type)?.label || post.type}
                </Badge>
                <Badge variant="outline" className="border-slate-300 text-slate-600">
                  {post.visibility}
                </Badge>
                {post.status === "solved" && (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700">Solved</Badge>
                )}
                {post.category && (
                  <Badge
                    style={{ backgroundColor: post.category.color || "#e2e8f0" }}
                    className="text-white"
                  >
                    {post.category.name}
                  </Badge>
                )}
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  {post.title || "Tanpa judul"}
                </h1>
                <div className="prose prose-sm md:prose-base mt-6 max-w-none whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50/50 p-5 md:p-6 text-slate-700 leading-relaxed shadow-inner">
                  {post.content || post.excerpt || ""}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
                <Button
                  variant={post.user_reaction ? "secondary" : "outline"}
                  size="sm"
                  onClick={togglePostReaction}
                  className={post.user_reaction ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : ""}
                >
                  {post.user_reaction ? (
                    <span className="mr-1 text-base leading-none">❤️</span>
                  ) : (
                    <Heart className="mr-1 h-4 w-4 text-slate-500" />
                  )}
                  Like {post.reaction_count}
                </Button>
                <Button
                  variant={post.is_bookmarked ? "secondary" : "outline"}
                  size="sm"
                  onClick={toggleBookmark}
                  className={post.is_bookmarked ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : ""}
                >
                  <Bookmark className="mr-1 h-4 w-4" />
                  Simpan {post.bookmark_count}
                </Button>
                <Button
                  variant={post.is_following ? "secondary" : "outline"}
                  size="sm"
                  onClick={toggleFollow}
                  className={post.is_following ? "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100" : ""}
                >
                  <MessageCircle className="mr-1 h-4 w-4" />
                  Ikuti {post.follow_count}
                </Button>
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500">
                  <Eye className="h-4 w-4 text-slate-400" />
                  {post.view_count} views
                </span>
              </div>
            </CardContent>
          </Card>

          {/* COMMENTS & ANSWERS CONTAINER */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-slate-900">Komentar & Jawaban</h3>
                <Badge className="bg-slate-900 text-white">{comments.length}</Badge>
              </div>

              <div className="flex gap-2">
                <Textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder={
                    post.is_locked ? "Diskusi dikunci oleh admin" : "Tulis komentar atau tanggapan..."
                  }
                  disabled={post.is_locked && !isAdmin}
                  className="min-h-[90px] rounded-xl border-slate-200 focus-visible:ring-blue-100"
                />
                <Button
                  onClick={submitComment}
                  disabled={!commentText.trim() || submittingComment || (post.is_locked && !isAdmin)}
                  className="self-end rounded-xl bg-slate-950 hover:bg-slate-800"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {comments.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                    Belum ada komentar. Berikan tanggapan pertama Anda!
                  </div>
                )}
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`rounded-2xl border p-5 transition-colors ${
                      comment.is_accepted_answer
                        ? "border-emerald-300 bg-emerald-50/50"
                        : "border-slate-100 bg-white"
                    }`}
                    style={{ marginLeft: Math.min(comment.depth || 0, 2) * 20 }}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 border">
                          <AvatarImage src={comment.author?.avatar_url || ""} />
                          <AvatarFallback className="bg-slate-100 text-[10px] font-semibold text-slate-700">
                            {authorName(comment.author).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-semibold text-slate-800">
                          {authorName(comment.author)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      {comment.is_accepted_answer && (
                        <Badge className="bg-emerald-600">Jawaban Diterima</Badge>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                      {comment.content}
                    </p>
                    <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-50">
                      <Button
                        size="xs"
                        variant={comment.user_reaction ? "secondary" : "ghost"}
                        onClick={() => toggleCommentReaction(comment)}
                        className={`h-8 rounded-lg ${
                          comment.user_reaction
                            ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {comment.user_reaction ? (
                          <span className="mr-1 text-xs">❤️</span>
                        ) : (
                          <Heart className="mr-1 h-3.5 w-3.5" />
                        )}
                        Like {comment.reaction_count}
                      </Button>
                      {post.type === "question" && !comment.is_accepted_answer && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => acceptAnswer(comment)}
                          className="h-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        >
                          Terima Jawaban
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: RECOMMENDED POSTS */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base font-bold text-slate-900">
                Rekomendasi Postingan Lainnya
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {recommendations.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-6">
                  Tidak ada postingan rekomendasi lainnya saat ini.
                </div>
              ) : (
                recommendations.map((p) => (
                  <Link
                    key={p.id}
                    to={`/dashboard/community/${getPostSlug(p)}`}
                    className="block group space-y-1.5 p-2 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                        {postTypes.find((item) => item.value === p.type)?.label || p.type}
                      </span>
                      {p.category && (
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: p.category.color || "#e2e8f0" }}
                        />
                      )}
                    </div>
                    <h4 className="font-semibold text-sm text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition">
                      {p.title}
                    </h4>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{authorName(p.author)}</span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {p.comment_count}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const WrappedPage = DashboardLayout(CommunityDetailPage);
export default WrappedPage;
