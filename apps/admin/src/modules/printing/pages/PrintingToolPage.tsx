import { FileType2, Heading, Settings2, Wrench } from "lucide-react";
import { useLocation } from "react-router";

const variants = {
  "/desk/print-heading": { title: "Print Heading", description: "Kelola heading dan identitas yang digunakan pada dokumen cetak.", icon: Heading },
  "/desk/print-format-builder": { title: "Print Format Builder", description: "Susun layout format cetak secara visual berdasarkan DocType.", icon: Wrench },
  "/desk/print-settings": { title: "Print Settings", description: "Atur default global untuk PDF, ukuran halaman, dan hasil cetak.", icon: Settings2 },
};

export default function PrintingToolPage() {
  const { pathname } = useLocation();
  const key = Object.keys(variants).find((item) => pathname.startsWith(item)) as keyof typeof variants | undefined;
  const item = key ? variants[key] : { title: "Printing", description: "Kelola kebutuhan pencetakan dokumen.", icon: FileType2 };
  const Icon = item.icon;
  return <div className="mx-auto max-w-screen-xl p-4 lg:p-7"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8"><span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Icon className="size-5" /></span><p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600">Framework / Printing</p><h1 className="mt-2 text-2xl font-bold text-slate-950">{item.title}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{item.description}</p><div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-400">Menu sudah tersedia. Implementasi detail akan mengikuti tahap Printing berikutnya.</div></section></div>;
}
