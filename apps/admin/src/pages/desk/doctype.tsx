import React, { useEffect, useMemo, useState } from "react";
import { Database, KeyRound, Search } from "lucide-react";
import api from "@/lib/api";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";

type Column = { name: string; type: string; nullable: boolean; primary_key: boolean; default?: string | null };
type Table = { name: string; columns: Column[] };

function DocTypeBrowser() {
  const [tables, setTables] = useState<Table[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ data: Table[] }>("/doctype/schema")
      .then(({ data }) => { setTables(data.data || []); setSelected(data.data?.[0]?.name || null); })
      .catch(() => setError("Struktur database tidak dapat dimuat."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => tables.filter((table) => table.name.toLowerCase().includes(query.toLowerCase())), [tables, query]);
  const active = filtered.find((table) => table.name === selected) || filtered[0];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><p className="text-sm font-medium text-violet-600">Build</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">DocType</h1><p className="mt-2 text-sm text-slate-500">Lihat tabel database dan kolomnya. Halaman ini bersifat read-only.</p></div>
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 sm:flex"><Database className="size-4" />{tables.length} tabel</div>
        </div>
        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[280px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50/70 md:border-b-0 md:border-r">
            <div className="border-b border-slate-200 p-4"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari tabel..." className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-violet-400" /></div></div>
            <div className="max-h-[520px] overflow-y-auto p-2">{loading ? <p className="p-3 text-sm text-slate-500">Memuat tabel...</p> : filtered.length === 0 ? <p className="p-3 text-sm text-slate-500">Tabel tidak ditemukan.</p> : filtered.map((table) => <button key={table.name} onClick={() => setSelected(table.name)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${active?.name === table.name ? "bg-violet-100 font-semibold text-violet-800" : "text-slate-600 hover:bg-white"}`}><span className="truncate">{table.name}</span><span className="ml-2 text-xs text-slate-400">{table.columns.length}</span></button>)}</div>
          </aside>
          <section className="p-5 sm:p-7">{active ? <><div className="mb-5 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Database className="size-5" /></div><div><h2 className="text-xl font-semibold text-slate-900">{active.name}</h2><p className="text-sm text-slate-500">{active.columns.length} kolom</p></div></div><div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Kolom</th><th className="px-4 py-3">Tipe</th><th className="px-4 py-3">Nullable</th><th className="px-4 py-3">Default</th></tr></thead><tbody className="divide-y divide-slate-100">{active.columns.map((column) => <tr key={column.name} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-medium text-slate-800">{column.primary_key && <KeyRound className="mr-1 inline size-3.5 text-amber-500" />}{column.name}</td><td className="px-4 py-3 font-mono text-xs text-slate-600">{column.type || "—"}</td><td className="px-4 py-3 text-slate-600">{column.nullable ? "Ya" : "Tidak"}</td><td className="max-w-[260px] truncate px-4 py-3 font-mono text-xs text-slate-500">{column.default || "—"}</td></tr>)}</tbody></table></div></> : <div className="flex h-full items-center justify-center text-sm text-slate-500">Pilih tabel untuk melihat kolomnya.</div>}</section>
        </div>
      </div>
    </div>
  );
}

export default function DocTypePage() { return <WorkspaceModuleLayout slug="framework"><DocTypeBrowser /></WorkspaceModuleLayout>; }
