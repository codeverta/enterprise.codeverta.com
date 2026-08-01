import React, { useEffect, useState } from "react";
import {
  CreditCard,
  Loader2,
  ExternalLink,
  Calendar,
  BookOpen,
  GraduationCap,
  Search,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { Link } from "react-router";
import dayjs from "dayjs";
import { toast } from "sonner";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CoursePurchase {
  id: string;
  course_id: string;
  course: {
    id: string;
    title: string;
    cover_image_url: string;
    short_description: string;
    course_category?: {
      id: string;
      name: string;
    };
    level?: string;
  };
  course_category_id?: string;
  price: number;
  status: string;
  created_at: string;
}

const rupiah = (value = 0) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

function PurchasesPage() {
  const [purchases, setPurchases] = useState<CoursePurchase[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States for filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [order, setOrder] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchPurchases();
    fetchCategories();
  }, []);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await api.get("/lms/my-purchases");
      const data = res.data?.data || res.data || [];
      setPurchases(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal memuat daftar pembelian");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/lms/course-categories");
      const d = res.data?.data || res.data;
      if (Array.isArray(d)) {
        setCategories(d);
      }
    } catch (err) {}
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedCategory("");
    setSelectedLevel("");
    setMinPrice("");
    setMaxPrice("");
    setOrder("newest");
  };

  const levels = ["Early Years", "Elementary", "Intermediate", "Advanced"];

  // Client-side filtering & sorting
  const filteredPurchases = purchases
    .filter((item) => {
      // Search filter
      const searchLower = search.toLowerCase();
      const titleMatch =
        !search ||
        item.course?.title?.toLowerCase().includes(searchLower) ||
        item.course?.short_description?.toLowerCase().includes(searchLower);

      // Category filter
      const categoryMatch =
        !selectedCategory ||
        item.course?.course_category?.id === selectedCategory ||
        item.course_category_id === selectedCategory;

      // Level filter
      const levelMatch = !selectedLevel || item.course?.level === selectedLevel;

      // Price filter
      const minPriceMatch = !minPrice || item.price >= Number(minPrice);
      const maxPriceMatch = !maxPrice || item.price <= Number(maxPrice);

      return titleMatch && categoryMatch && levelMatch && minPriceMatch && maxPriceMatch;
    })
    .sort((a, b) => {
      if (order === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (order === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (order === "price_asc") {
        return a.price - b.price;
      }
      if (order === "price_desc") {
        return b.price - a.price;
      }
      return 0;
    });

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">
          Memuat riwayat pembelian...
        </span>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Pembelian Saya</h1>
          <p className="text-sm text-slate-500">
            Daftar kelas mandiri yang telah Anda beli dan dapat diakses selamanya.
          </p>
        </div>

        {/* Filters and Sorting Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`gap-1.5 ${showFilters ? "bg-slate-100 border-slate-300" : ""}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter & Cari
          </Button>

          <div className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:bg-slate-950">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="newest">Pembelian Terbaru</option>
              <option value="oldest">Pembelian Terlama</option>
              <option value="price_asc">Harga Terendah</option>
              <option value="price_desc">Harga Tertinggi</option>
            </select>
          </div>

          {(search || selectedCategory || selectedLevel || minPrice || maxPrice) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="gap-1.5 text-slate-500 hover:text-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Advanced Filter Box */}
      {showFilters && (
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm p-4 rounded-xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Cari Kelas</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ketik judul kelas..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent"
                />
              </div>
            </div>

            {/* Category Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Kategori</label>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-violet-600 cursor-pointer appearance-none"
                >
                  <option value="">Semua Kategori</option>
                  {categories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 h-4 w-4 pointer-events-none text-slate-400" />
              </div>
            </div>

            {/* Level Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Level</label>
              <div className="relative">
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-violet-600 cursor-pointer appearance-none"
                >
                  <option value="">Semua Level</option>
                  {levels.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 h-4 w-4 pointer-events-none text-slate-400" />
              </div>
            </div>

            {/* Price Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Filter Harga Beli (IDR)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-violet-600"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Category Shortcuts Strip (Visible when advanced filter is hidden) */}
      {!showFilters && categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          <Button
            variant={selectedCategory === "" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("")}
            className="rounded-full text-xs"
          >
            Semua
          </Button>
          {categories.map((cat: any) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="rounded-full text-xs whitespace-nowrap"
            >
              {cat.name}
            </Button>
          ))}
        </div>
      )}

      {/* Purchases Grid / Lists */}
      {purchases.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white dark:bg-slate-950 p-8">
          <CreditCard className="h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-200">
            Belum Ada Pembelian
          </h2>
          <p className="mt-2 max-w-sm text-center text-sm text-slate-500">
            Anda belum pernah melakukan pembelian kelas satuan. Jelajahi katalog
            kelas kami untuk mulai belajar.
          </p>
          <Link
            to="/dashboard"
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
          >
            Jelajahi Kelas
          </Link>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white dark:bg-slate-950 p-8">
          <Filter className="h-10 w-10 text-slate-300 mb-3" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Tidak ada hasil pembelian yang cocok
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs text-center">
            Cobalah untuk mengubah kata kunci pencarian atau atur ulang opsi filter Anda.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="mt-4"
          >
            Reset Semua Filter
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPurchases.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-xl border bg-white dark:bg-slate-950 shadow-sm transition hover:shadow-md"
            >
              {/* Cover Image */}
              <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-900">
                {item.course?.cover_image_url ? (
                  <img
                    src={item.course.cover_image_url}
                    alt={item.course.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-100 dark:bg-slate-900">
                    <BookOpen className="h-8 w-8 text-slate-300" />
                  </div>
                )}
                <div className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm uppercase tracking-wider">
                  Aktif
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-4 gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {item.course?.course_category?.name && (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      {item.course.course_category.name}
                    </span>
                  )}
                  {item.course?.level && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                      {item.course.level}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-50 leading-snug group-hover:underline">
                    <Link to={`/dashboard/courses/${item.course_id}`}>
                      {item.course?.title || "Kelas Tanpa Judul"}
                    </Link>
                  </h3>
                  <p className="line-clamp-2 text-xs text-slate-500 leading-relaxed">
                    {item.course?.short_description ||
                      "Tidak ada deskripsi singkat."}
                  </p>
                </div>

                {/* Metadata & Pricing info */}
                <div className="border-t pt-3 flex flex-col gap-2 mt-auto text-xs text-slate-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        Dibeli: {dayjs(item.created_at).format("DD MMM YYYY")}
                      </span>
                    </div>
                    {/* <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {rupiah(item.price)}
                    </span> */}
                  </div>
                </div>

                {/* Action button */}
                <div className="mt-1 pt-1">
                  <Link
                    to={`/dashboard/courses/${item.course_id}`}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    <GraduationCap className="h-4 w-4" />
                    Mulai Belajar
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DashboardLayout(PurchasesPage);
