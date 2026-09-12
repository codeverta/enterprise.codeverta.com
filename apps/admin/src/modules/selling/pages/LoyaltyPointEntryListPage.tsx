import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Coins, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loyaltyApi, type LoyaltyPointEntry } from "../loyaltyApi";

export default function LoyaltyPointEntryListPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LoyaltyPointEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    loyaltyApi
      .entriesList()
      .then((data) => {
        let filtered = data;
        if (search) {
          const q = search.toLowerCase();
          filtered = data.filter(
            (e) =>
              e.customer.toLowerCase().includes(q) ||
              e.id.toLowerCase().includes(q) ||
              e.loyalty_program.toLowerCase().includes(q) ||
              e.sales_invoice?.toLowerCase().includes(q)
          );
        }
        setEntries(filtered);
      })
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="mx-auto max-w-screen-xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/desk/loyalty-program")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600">Selling</span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs text-slate-500">Loyalty Point Entry</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Coins className="size-6 text-amber-500" />
              Loyalty Point Entries
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Riwayat perolehan, penukaran, dan kadaluarsa poin pelanggan dari transaksi POS, Sales Invoice, dan Sales Order.
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => navigate("/desk/loyalty-program")}>
          Kembali ke Loyalty Program
        </Button>
      </div>

      {/* Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan pelanggan, invoice, atau ID entry..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="p-4">Entry ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Loyalty Program</th>
                <th className="p-4">Referensi Penjualan</th>
                <th className="p-4 text-right">Purchase Amount</th>
                <th className="p-4 text-right">Loyalty Points</th>
                <th className="p-4 text-center">Posting Date</th>
                <th className="p-4 text-center">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-slate-400">
                    Memuat riwayat poin...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-slate-400">
                    Belum ada riwayat perolehan poin.
                  </td>
                </tr>
              ) : (
                entries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/60">
                    <td className="p-4 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {item.id}
                    </td>
                    <td className="p-4 font-medium text-slate-900 dark:text-slate-100">
                      {item.customer}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">
                      {item.loyalty_program}
                    </td>
                    <td className="p-4 text-blue-600 font-mono text-xs">
                      <div>{item.sales_invoice || "-"}</div>
                      {item.reference_type && (
                        <div className="mt-1 font-sans text-[10px] text-slate-400">{item.reference_type}</div>
                      )}
                    </td>
                    <td className="p-4 text-right text-slate-700 dark:text-slate-300">
                      Rp {item.purchase_amount?.toLocaleString("id-ID") || 0}
                    </td>
                    <td
                      className={`p-4 text-right font-bold ${
                        item.loyalty_points > 0 ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {item.loyalty_points > 0 ? `+${item.loyalty_points}` : item.loyalty_points} LP
                    </td>
                    <td className="p-4 text-center text-xs text-slate-500">
                      {item.posting_date}
                    </td>
                    <td className="p-4 text-center">
                      <Badge
                        variant={
                          item.type === "Earned"
                            ? "default"
                            : item.type === "Redeemed"
                            ? "secondary"
                            : "outline"
                        }
                        className={item.type === "Earned" ? "bg-emerald-600" : ""}
                      >
                        {item.type}
                      </Badge>
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
