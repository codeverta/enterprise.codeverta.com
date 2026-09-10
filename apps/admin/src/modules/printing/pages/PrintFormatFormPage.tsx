import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Check, ChevronRight, Code2, FileText, Loader2, Palette, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { emptyPrintFormat, getPrintFormat, savePrintFormat, type PrintFormat } from "../printingApi";

const docTypes = ["Sales Invoice", "Purchase Invoice", "Sales Order", "Purchase Order", "Delivery Note", "Purchase Receipt", "Quotation", "Customer", "Supplier", "Item", "Stock Entry", "Employee", "Expense Claim"];
const modules = ["Selling", "Buying", "Stock", "Accounting", "CRM", "Human Resources", "Assets", "Manufacturing", "Projects"];
const languages = [{ value: "id", label: "Bahasa Indonesia" }, { value: "en", label: "English" }];
const fonts = ["", "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Noto Sans"];
const pageNumbers = ["Hide", "Top Left", "Top Center", "Top Right", "Bottom Left", "Bottom Center", "Bottom Right"];

export default function PrintFormatFormPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathPart = location.pathname.split("/").filter(Boolean).at(-1) || "";
  const isNew = pathPart === "new" || pathPart.startsWith("new-print-format");
  const [form, setForm] = useState<PrintFormat>(emptyPrintFormat);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getPrintFormat(pathPart)
      .then((value) => { setForm(value); setDirty(false); })
      .catch(() => { toast.error("Print Format tidak ditemukan"); navigate("/desk/print-format", { replace: true }); })
      .finally(() => setLoading(false));
  }, [isNew, navigate, pathPart]);

  const title = form.name.trim() || "New Print Format";
  const update = <K extends keyof PrintFormat>(key: K, value: PrintFormat[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const canSave = useMemo(() => Boolean(form.name.trim() && form.doc_type.trim()), [form.doc_type, form.name]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name wajib diisi");
    if (!form.doc_type.trim()) return toast.error("DocType wajib dipilih");
    setSaving(true);
    try {
      const saved = await savePrintFormat(form);
      setForm(saved);
      setDirty(false);
      toast.success(isNew ? "Print Format berhasil dibuat" : "Print Format berhasil disimpan");
      if (saved.id) navigate(`/desk/print-format/${saved.id}`, { replace: true });
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal menyimpan Print Format");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-80 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 size-4 animate-spin" /> Memuat Print Format...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-12 lg:p-7">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Link to="/desk/printing" className="hover:text-indigo-600">Printing</Link><ChevronRight className="size-3" />
        <Link to="/desk/print-format" className="hover:text-indigo-600">Print Format</Link><ChevronRight className="size-3" />
        <span className="font-medium text-slate-600">{title}</span>
      </div>

      <header className="sticky top-0 z-20 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => navigate("/desk/print-format")} className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><ArrowLeft className="size-4" /></button>
          <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-xl font-bold text-slate-950">{title}</h1><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${dirty ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{dirty ? "Not Saved" : "Saved"}</span></div><p className="mt-0.5 text-xs text-slate-400">Print Format</p></div>
        </div>
        <Button disabled={saving || !canSave} onClick={() => void submit()} className="h-10 rounded-xl bg-indigo-600 px-5 hover:bg-indigo-700"><Save className="mr-2 size-4" />{saving ? "Menyimpan..." : "Save"}</Button>
      </header>

      <FormSection icon={FileText} title="General" description="Tentukan dokumen dan perilaku dasar format cetak.">
        <FormGrid>
          <Field label="Name" required fieldName="__newname"><Input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Contoh: Sales Invoice Standard" className="h-10 rounded-lg" /></Field>
          <Field label="Print Format For" fieldName="print_format_for"><Segmented value={form.print_format_for} options={["DocType", "Report"]} onChange={(value) => update("print_format_for", value as PrintFormat["print_format_for"])} /></Field>
          <Field label="DocType" required fieldName="doc_type"><SearchableSelect value={form.doc_type} options={docTypes} onChange={(value) => update("doc_type", value)} placeholder="Begin typing for results." searchPlaceholder="Cari DocType..." /></Field>
          <Field label="Module" fieldName="module"><SearchableSelect value={form.module} options={modules} onChange={(value) => update("module", value)} placeholder="Begin typing for results." searchPlaceholder="Cari module..." /></Field>
          <Field label="Default Print Language" fieldName="default_print_language"><SearchableSelect value={form.default_print_language} options={languages} onChange={(value) => update("default_print_language", value)} placeholder="Begin typing for results." /></Field>
          <div className="grid grid-cols-2 gap-3"><Toggle label="Custom Format" fieldName="custom_format" checked={form.custom_format} onChange={(value) => update("custom_format", value)} /><Toggle label="Disabled" fieldName="disabled" checked={form.disabled} onChange={(value) => update("disabled", value)} /></div>
          <div className="sm:col-span-2"><Field label="PDF Generator" fieldName="pdf_generator"><Segmented value={form.pdf_generator} options={["wkhtmltopdf", "chrome"]} labels={{ wkhtmltopdf: "wkhtmltopdf", chrome: "Chrome" }} onChange={(value) => update("pdf_generator", value as PrintFormat["pdf_generator"])} /></Field></div>
        </FormGrid>
      </FormSection>

      <FormSection icon={Palette} title="Style Settings" description="Atur ruang halaman dan struktur visual dokumen.">
        <FormGrid>
          <MarginField label="Margin Top" fieldName="margin_top" value={form.margin_top} onChange={(value) => update("margin_top", value)} />
          <MarginField label="Margin Bottom" fieldName="margin_bottom" value={form.margin_bottom} onChange={(value) => update("margin_bottom", value)} />
          <MarginField label="Margin Left" fieldName="margin_left" value={form.margin_left} onChange={(value) => update("margin_left", value)} />
          <MarginField label="Margin Right" fieldName="margin_right" value={form.margin_right} onChange={(value) => update("margin_right", value)} />
          <Toggle label="Align Labels to the Right" fieldName="align_labels_right" checked={form.align_labels_right} onChange={(value) => update("align_labels_right", value)} />
          <Toggle label="Show Section Headings" fieldName="show_section_headings" checked={form.show_section_headings} onChange={(value) => update("show_section_headings", value)} />
          <Toggle label="Show Line Breaks after Sections" fieldName="line_breaks" checked={form.line_breaks} onChange={(value) => update("line_breaks", value)} />
          <Field label="Google Font" fieldName="font"><SearchableSelect value={form.font} options={fonts} onChange={(value) => update("font", value)} placeholder="Pilih font atau gunakan default" /></Field>
          <div className="sm:col-span-2"><Field label="Page Number" fieldName="page_number"><SearchableSelect value={form.page_number} options={pageNumbers} onChange={(value) => update("page_number", value)} /></Field></div>
        </FormGrid>
      </FormSection>

      <FormSection icon={Code2} title="Custom CSS" description="Tambahkan aturan CSS khusus untuk format cetak ini.">
        <Field label="Custom CSS" fieldName="css"><textarea value={form.css} onChange={(event) => update("css", event.target.value)} spellCheck={false} placeholder={'[data-fieldtype="Int"] .value {\n  text-align: left;\n}'} className="min-h-60 w-full resize-y rounded-xl border border-slate-200 bg-[#111827] p-4 font-mono text-[13px] leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100" /></Field>
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-6 text-slate-600">
          <p className="font-bold text-slate-800">Custom CSS Help</p>
          <ul className="mt-2 list-disc space-y-1 pl-5"><li>Semua field group memiliki atribut <code>data-fieldtype</code> dan <code>data-fieldname</code>.</li><li>Semua value menggunakan class <code>value</code>.</li><li>Section Break menggunakan class <code>section-break</code>.</li><li>Column Break menggunakan class <code>column-break</code>.</li></ul>
          <div className="mt-3 rounded-lg bg-white/80 p-3 font-mono text-[11px] text-slate-700"><p>{'[data-fieldtype="Int"] .value { text-align: left; }'}</p><p className="mt-2">{'.section-break { padding: 30px 0; border-bottom: 1px solid #eee; }'}</p></div>
        </div>
      </FormSection>

      <div className="flex justify-end"><Button disabled={saving || !canSave} onClick={() => void submit()} className="h-10 rounded-xl bg-indigo-600 px-5 hover:bg-indigo-700">{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}Save Print Format</Button></div>
    </div>
  );
}

function FormSection({ icon: Icon, title, description, children }: { icon: typeof Settings2; title: string; description: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6"><div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="size-4.5" /></span><div><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p></div></div>{children}</section>;
}

function FormGrid({ children }: { children: ReactNode }) { return <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">{children}</div>; }

function Field({ label, fieldName, required, children }: { label: string; fieldName: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-700">{label}{required && <span className="text-rose-500">*</span>}</span>{children}<span className="mt-1 block font-mono text-[10px] text-slate-300">{fieldName}</span></label>;
}

function Segmented({ value, options, labels, onChange }: { value: string; options: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">{options.map((option) => <button key={option} type="button" onClick={() => onChange(option)} className={`h-8 rounded-lg text-xs font-semibold transition ${value === option ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}>{labels?.[option] || option}</button>)}</div>;
}

function Toggle({ label, fieldName, checked, onChange }: { label: string; fieldName: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} className={`flex min-h-15 w-full items-center justify-between rounded-xl border p-3 text-left transition ${checked ? "border-indigo-200 bg-indigo-50/60" : "border-slate-200 bg-white hover:bg-slate-50"}`}><span><span className="block text-xs font-semibold text-slate-700">{label}</span><span className="mt-0.5 block font-mono text-[9px] text-slate-300">{fieldName}</span></span><span className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-indigo-600" : "bg-slate-200"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} /></span></button>;
}

function MarginField({ label, fieldName, value, onChange }: { label: string; fieldName: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label} fieldName={fieldName}><div className="relative"><Input type="number" min={0} step={0.5} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-10 rounded-lg pr-11" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">mm</span></div></Field>;
}
