import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Award, Coins, Gift, Plus, Search, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loyaltyApi, type LoyaltyProgram } from "../loyaltyApi";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";

export default function LoyaltyProgramListPage() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await loyaltyApi.list({
        q: search,
        type: typeFilter !== "all" ? typeFilter : undefined,
      });
      setPrograms(data);
    } catch {
      toast.error("Gagal memuat daftar Loyalty Program");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, typeFilter]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Hapus Loyalty Program "${name}"?`)) return;
    try {
      await loyaltyApi.remove(id);
      toast.success("Loyalty Program dihapus");
      loadData();
    } catch {
      toast.error("Gagal menghapus Loyalty Program");
    }
  };

  return (
    <ERPPage>
      {/* Top Header */}
      <ERPPageHeader title="Loyalty Program" description="Kelola skema poin belanja dan tingkat reward (tier) untuk pelanggan di modul Selling." breadcrumbs={[{ label: "Selling", href: "/desk/selling" }, { label: "Loyalty Program" }]} actions={<>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/desk/loyalty-point-entry")}
            className="flex items-center gap-1.5"
          >
            <Coins className="size-4 text-amber-500" />
            Loyalty Point Entries
          </Button>
          <Button
            onClick={() => navigate("/desk/loyalty-program/new")}
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5"
          >
            <Plus className="size-4" />
            New Loyalty Program
          </Button>
        </>}/>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari Loyalty Program..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-4 text-slate-400" />
          <ERPSelect
            className="h-9 rounded-md border border-slate-200 bg-transparent px-3 text-xs shadow-sm focus:outline-none dark:border-slate-800 dark:text-slate-200"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <ERPSelectOption value="all">Semua Tipe Program</ERPSelectOption>
            <ERPSelectOption value="Single Tier Program">Single Tier Program</ERPSelectOption>
            <ERPSelectOption value="Multiple Tier Program">Multiple Tier Program</ERPSelectOption>
          </ERPSelect>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="p-4">Program Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">Customer Group</th>
                <th className="p-4">Territory</th>
                <th className="p-4 text-center">Expiry (Days)</th>
                <th className="p-4 text-right">Conversion (1 LP = IDR)</th>
                <th className="p-4 text-center">Auto Opt In</th>
                <th className="w-20 p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-slate-400">
                    Memuat data Loyalty Program...
                  </td>
                </tr>
              ) : programs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-slate-400">
                    Belum ada Loyalty Program terdaftar. Klik "New Loyalty Program" untuk membuat.
                  </td>
                </tr>
              ) : (
                programs.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-900/60 transition-colors"
                  >
                    <td className="p-4 font-semibold text-slate-900 dark:text-slate-100">
                      <Link
                        to={`/desk/loyalty-program/${p.id}`}
                        className="text-blue-600 hover:underline flex items-center gap-2"
                      >
                        <Award className="size-4 text-blue-500 shrink-0" />
                        {p.loyalty_program_name}
                      </Link>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          p.loyalty_program_type === "Multiple Tier Program"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {p.loyalty_program_type}
                      </Badge>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">
                      {p.customer_group || "All Groups"}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">
                      {p.customer_territory || "All Territories"}
                    </td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-300">
                      {p.expiry_duration > 0 ? `${p.expiry_duration} days` : "Unlimited"}
                    </td>
                    <td className="p-4 text-right font-medium text-slate-900 dark:text-slate-100">
                      Rp {p.conversion_factor?.toLocaleString("id-ID") || 1}
                    </td>
                    <td className="p-4 text-center">
                      {p.auto_opt_in ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          No
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            navigate(
                              `/desk/loyalty-point-entry?program=${encodeURIComponent(
                                p.loyalty_program_name,
                              )}`,
                            )
                          }
                          className="text-amber-600 hover:text-amber-700"
                          title="Lihat riwayat poin untuk program ini"
                        >
                          <Coins className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(p.id!, p.loyalty_program_name)}
                          className="text-red-500 hover:text-red-700"
                          title="Hapus Loyalty Program"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ERPPage>
  );
}
