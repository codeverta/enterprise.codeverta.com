import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router";
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Filter,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import CourseCard from "./CourseCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CardSkeleton = () => (
  <div className="h-72 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
);

const ExploreOtherCourses = ({
  title = "Jelajahi Course Lainnya",
  subtitle = "Kembangkan skill barumu dengan course pilihan terbaik",
  limit = 8,
}) => {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [ageRanges, setAgeRanges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // States for filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedAgeRange, setSelectedAgeRange] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [order, setOrder] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search term
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [categoryRes, filterRes] = await Promise.all([
          api.get("/lms/course-categories"),
          api.get("/lms/courses/explore/filters"),
        ]);

        const categoryData = categoryRes.data?.data || categoryRes.data;
        if (Array.isArray(categoryData)) {
          setCategories(categoryData);
        }

        const filterData = filterRes.data?.data || filterRes.data || {};
        setLevels(Array.isArray(filterData.levels) ? filterData.levels : []);
        setAgeRanges(
          Array.isArray(filterData.age_ranges) ? filterData.age_ranges : []
        );
      } catch {
        // Filter options are non-critical; course list still loads below.
      }
    };

    fetchFilterOptions();
  }, []);

  // Fetch initial courses when filters change
  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchCourses(1, true);
  }, [
    debouncedSearch,
    selectedCategory,
    selectedLevel,
    selectedAgeRange,
    minPrice,
    maxPrice,
    order,
  ]);

  const fetchCourses = async (pageNum: number, isInitial = false) => {
    try {
      const res = await api.get("/lms/courses/explore", {
        params: {
          limit,
          page: pageNum,
          exclude_enrolled: false,
          search: debouncedSearch,
          category_id: selectedCategory || undefined,
          level: selectedLevel || undefined,
          age_range: selectedAgeRange || undefined,
          min_price: minPrice,
          max_price: maxPrice,
          order,
        },
      });
      const d = res.data?.data || res.data;
      const fetchedCourses = Array.isArray(d)
        ? d
        : Array.isArray(d?.courses)
        ? d.courses
        : [];

      if (isInitial) {
        setCourses(fetchedCourses);
      } else {
        setCourses((prev) => [...prev, ...fetchedCourses]);
      }

      setHasMore(fetchedCourses.length >= limit);
    } catch (err) {
      if (isInitial) setCourses([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCourses(nextPage, false);
  };

  // Infinite Scroll Trigger via Intersection Observer
  const observerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }
    return () => observer.disconnect();
  }, [page, hasMore, loadingMore, loading]);

  const handleResetFilters = () => {
    setSearch("");
    setSelectedCategory("");
    setSelectedLevel("");
    setSelectedAgeRange("");
    setMinPrice("");
    setMaxPrice("");
    setOrder("newest");
  };

  return (
    <section className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            <Sparkles className="h-5 w-5 text-violet-600 animate-pulse" />
            {title}
          </h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>

        {/* Toggle Filters & Sort Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`gap-1.5 ${
              showFilters ? "bg-slate-100 border-slate-300" : ""
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter & Search
          </Button>

          <div className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:bg-slate-950">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="newest">Terbaru</option>
              <option value="popular">Terpopuler</option>
              <option value="price_asc">Harga Terendah</option>
              <option value="price_desc">Harga Tertinggi</option>
            </select>
          </div>

          {(search ||
            selectedCategory ||
            selectedLevel ||
            selectedAgeRange ||
            minPrice ||
            maxPrice) && (
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
        <Card className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {/* Search Input */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cari Kursus</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Ketik judul kursus..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Category Select */}
            <div className="space-y-1.5">
              <Label className="text-xs">Kategori</Label>
              <Select
                value={selectedCategory || "all"}
                onValueChange={(value) =>
                  setSelectedCategory(value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Level Select */}
            <div className="space-y-1.5">
              <Label className="text-xs">Level</Label>
              <Select
                value={selectedLevel || "all"}
                onValueChange={(value) =>
                  setSelectedLevel(value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Level</SelectItem>
                  {levels.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {lvl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Age Range Select */}
            <div className="space-y-1.5">
              <Label className="text-xs">Rentang Usia</Label>
              <Select
                value={selectedAgeRange || "all"}
                onValueChange={(value) =>
                  setSelectedAgeRange(value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Rentang Usia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Rentang Usia</SelectItem>
                  {ageRanges.map((range) => (
                    <SelectItem key={range} value={range}>
                      {range}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div className="space-y-1.5">
              <Label className="text-xs">Filter Harga (IDR)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="text-xs"
                />
                <span className="text-slate-400 text-xs shrink-0">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="text-xs"
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

      {/* Courses Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-950">
          <Filter className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
            Tidak ada kursus yang ditemukan
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Coba sesuaikan filter pencarian, kategori, atau rentang harga yang
            Anda pilih.
          </p>
          {(search ||
            selectedCategory ||
            selectedLevel ||
            selectedAgeRange ||
            minPrice ||
            maxPrice) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="mt-4"
            >
              Reset Semua Filter
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {courses.map((course) => (
              <CourseCard
                key={course.course_id || course.id || course.slug}
                course={course}
              />
            ))}
          </div>

          {/* Loader and Infinite Scroll Trigger */}
          {hasMore && (
            <div
              ref={observerRef}
              className="flex justify-center items-center py-6"
            >
              {loadingMore ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white dark:bg-slate-900 border px-4 py-2 rounded-full shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
                  Memuat kelas lainnya...
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  className="rounded-full shadow-sm"
                >
                  Lihat Lebih Banyak
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ExploreOtherCourses;
