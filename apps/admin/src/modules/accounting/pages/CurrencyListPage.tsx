import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { currencyApi, Currency } from "../currencyApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Coins,
  Trash2,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";

export default function CurrencyListPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEnabled, setFilterEnabled] = useState<string>("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const enabledParam =
        filterEnabled === "enabled"
          ? true
          : filterEnabled === "disabled"
          ? false
          : undefined;
      const data = await currencyApi.list({
        q: search || undefined,
        enabled: enabledParam,
      });
      setList(data || []);
    } catch {
      toast.error("Gagal memuat data Currency");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterEnabled]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(`Hapus Currency "${id}"?`)) return;
    try {
      await currencyApi.remove(id);
      toast.success(`Currency "${id}" berhasil dihapus`);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus Currency");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Link to="/desk/accounting" className="hover:underline">
              Accounting
            </Link>
            <span>/</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              Currency
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Currency
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            className="bg-blue-600 font-medium text-white hover:bg-blue-700"
          >
            <Link to="/desk/currency/new">
              <Plus className="mr-1.5 size-4" />
              New Currency
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode currency, nama, atau symbol..."
            className="pl-9"
          />
        </form>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setFilterEnabled("all")}
              className={`rounded-md px-3 py-1.5 transition ${
                filterEnabled === "all"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterEnabled("enabled")}
              className={`rounded-md px-3 py-1.5 transition ${
                filterEnabled === "enabled"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Enabled
            </button>
            <button
              type="button"
              onClick={() => setFilterEnabled("disabled")}
              className={`rounded-md px-3 py-1.5 transition ${
                filterEnabled === "disabled"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Disabled
            </button>
          </div>
        </div>
      </div>

      {/* Table / List */}
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">Currency</th>
                <th className="px-5 py-3">Symbol</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Fraction</th>
                <th className="px-5 py-3">Number Format</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    Memuat data currency...
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    <Coins className="mx-auto mb-3 size-10 text-slate-400" />
                    <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      Tidak ada data Currency
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Klik tombol &quot;New Currency&quot; untuk menambahkan mata uang baru.
                    </p>
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/desk/currency/${item.id}`)}
                    className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-900/40"
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-bold text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                          {item.symbol || item.id.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.id}
                          </div>
                          {item.currency_name && item.currency_name !== item.id && (
                            <div className="text-xs text-slate-500">
                              {item.currency_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                      {item.symbol || "-"}
                      {item.symbol_on_right && (
                        <span className="ml-1.5 text-xs text-slate-400 font-normal">
                          (kanan)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {item.enabled ? (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200">
                          <CheckCircle className="mr-1 size-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">
                          <XCircle className="mr-1 size-3" />
                          Disabled
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                      {item.fraction || "-"}
                      {item.fraction_units ? ` (1 = ${item.fraction_units})` : ""}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {item.number_format || "#,###.##"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDelete(e, item.id)}
                          title="Hapus"
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/desk/currency/${item.id}`)}
                          className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          <ArrowRight className="size-4" />
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
    </div>
  );
}
