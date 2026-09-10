import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { FileText, MoreHorizontal, Plus, Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { deletePrintFormat, listPrintFormats, type PrintFormat } from "../printingApi";

export default function PrintFormatListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PrintFormat[]>([]);
  const [query, setQuery] = useState("");
  const [docType, setDocType] = useState("");
  const [report, setReport] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listPrintFormats());
    } catch {
      toast.error("Gagal memuat Print Format");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesName = !term || row.name.toLowerCase().includes(term);
      const matchesDocType = !docType || row.doc_type === docType;
      const matchesReport = !report || row.report === report;
      const matchesStatus = !status || (status === "Enabled" ? !row.disabled : row.disabled);
      return matchesName && matchesDocType && matchesReport && matchesStatus;
    });
  }, [docType, query, report, rows, status]);

  const docTypeOptions = useMemo(() => [...new Set(rows.map((row) => row.doc_type).filter(Boolean))].sort(), [rows]);
  const reportOptions = useMemo(() => [...new Set(rows.map((row) => row.report).filter(Boolean))].sort(), [rows]);

  const remove = async (row: PrintFormat) => {
    if (!row.id || !window.confirm(`Hapus Print Format “${row.name}”?`)) return;
    try {
      await deletePrintFormat(row.id);
      toast.success("Print Format berhasil dihapus");
      await load();
    } catch {
      toast.error("Gagal menghapus Print Format");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Printer className="size-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600">Framework / Printing</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Print Format</h1>
              <p className="mt-1 text-sm text-slate-500">Atur layout, style, dan generator PDF untuk dokumen.</p>
            </div>
          </div>
          <Button onClick={() => navigate("/desk/print-format/new-print-format")} className="h-10 rounded-xl bg-indigo-600 px-4 hover:bg-indigo-700">
            <Plus className="mr-2 size-4" /> New Print Format
          </Button>
        </div>
        <div className="grid gap-2 bg-slate-50/70 px-5 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_220px_220px_150px_auto] lg:px-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name — Begin typing for results." className="h-10 rounded-xl border-slate-200 bg-white pl-9" />
          </div>
          <SearchableSelect value={docType} options={[{ value: "", label: "Semua DocType" }, ...docTypeOptions]} onChange={setDocType} placeholder="DocType — Begin typing" searchPlaceholder="Cari DocType..." className="[&_button]:h-10 [&_button]:rounded-xl" />
          <SearchableSelect value={report} options={[{ value: "", label: "Semua Report" }, ...reportOptions]} onChange={setReport} placeholder="Report — Begin typing" searchPlaceholder="Cari report..." className="[&_button]:h-10 [&_button]:rounded-xl" />
          <SearchableSelect value={status} options={[{ value: "", label: "Semua Status" }, "Enabled", "Disabled"]} onChange={setStatus} placeholder="Status" className="[&_button]:h-10 [&_button]:rounded-xl" />
          <span className="self-center whitespace-nowrap text-right text-xs text-slate-400">{filtered.length} of {rows.length}</span>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-3.5">ID</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">DocType</th><th className="px-5 py-3.5">Report</th><th className="px-5 py-3.5">PDF Generator</th><th className="w-24 px-5 py-3.5 text-right">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-400">Memuat Print Format...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-16 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><FileText className="size-5" /></span><p className="mt-4 font-semibold text-slate-700">Belum ada Print Format</p><p className="mt-1 text-xs text-slate-400">Buat format pertama untuk mulai mengatur hasil cetak.</p></td></tr>
              ) : filtered.map((row) => (
                <tr key={row.id} onClick={() => navigate(`/desk/print-format/${encodeURIComponent(row.name)}`)} className="cursor-pointer transition hover:bg-indigo-50/30">
                  <td className="px-5 py-4 font-semibold text-slate-900">{row.name}</td>
                  <td className="px-5 py-4"><Badge variant={row.disabled ? "secondary" : "default"} className={row.disabled ? "" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"}>{row.disabled ? "Disabled" : "Enabled"}</Badge></td>
                  <td className="px-5 py-4 text-slate-700">{row.doc_type || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{row.report || "—"}</td>
                  <td className="px-5 py-4"><Badge variant="outline" className="font-medium">{row.pdf_generator}</Badge></td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" title="Detail" onClick={(event) => { event.stopPropagation(); navigate(`/desk/print-format/${encodeURIComponent(row.name)}`); }} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><MoreHorizontal className="size-4" /></button><button type="button" title="Hapus" onClick={(event) => { event.stopPropagation(); void remove(row); }} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
