import React, { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const fieldHelp: Record<string, string> = {
  item_code: "Kode unik untuk membedakan item di transaksi, pencarian, stok, dan laporan.",
  item_name: "Nama item yang akan terlihat oleh pengguna pada katalog dan dokumen transaksi.",
  item_group: "Kelompok atau kategori item untuk pengelompokan, filter, dan pelaporan.",
  stock_uom: "Satuan dasar item, misalnya Pcs, Box, Kg, atau Unit.",
  disabled: "Menonaktifkan item sehingga tidak dapat dipilih pada transaksi baru.",
  allow_alternative_item: "Mengizinkan pengguna memilih item pengganti ketika item utama tidak tersedia.",
  is_stock_item: "Tentukan apakah jumlah item ini perlu dicatat dan dikurangi dari stok gudang.",
  has_variants: "Aktifkan untuk item induk yang memiliki variasi. Item induk dengan variasi tidak dapat dipilih langsung pada Sales Order.",
  is_fixed_asset: "Tandai jika item merupakan aset tetap yang perlu dicatat untuk penyusutan dan pelacakan aset.",
  opening_stock: "Jumlah stok awal saat item mulai digunakan di sistem.",
  standard_rate: "Harga jual standar yang digunakan sebagai acuan ketika belum ada harga khusus.",
  brand: "Merek atau produsen item untuk ditampilkan pada katalog dan membantu pencarian.",
  description: "Keterangan tambahan mengenai fungsi, spesifikasi, atau cara penggunaan item.",
  valuation_method: "Metode yang digunakan untuk menghitung nilai persediaan, seperti FIFO atau Moving Average.",
  valuation_rate: "Nilai biaya per satuan yang digunakan dalam perhitungan persediaan.",
  shelf_life_in_days: "Masa simpan item dalam hari sejak tanggal penerimaan atau produksi.",
  end_of_life: "Tanggal setelah item tidak boleh digunakan atau dijual lagi.",
  default_material_request_type: "Jenis permintaan yang dipakai secara otomatis ketika stok item perlu dipenuhi.",
  warranty_period: "Lama garansi item dalam hari.",
  weight_per_unit: "Berat satu satuan item untuk perhitungan pengiriman dan logistik.",
  weight_uom: "Satuan berat yang digunakan pada nilai berat per unit.",
  allow_negative_stock: "Mengizinkan transaksi ketika jumlah stok tercatat kurang dari nol.",
  purchase_uom: "Satuan yang digunakan saat item dibeli dari supplier.",
  min_order_qty: "Jumlah pembelian minimum yang disarankan atau diizinkan.",
  safety_stock: "Jumlah stok pengaman untuk mengurangi risiko kehabisan barang.",
};

function FieldHelp({ label, name, help }: { label: string; name?: string; help?: string }) {
  const message = help || (name ? fieldHelp[name] : undefined) || `Penjelasan untuk kolom ${label}.`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Info ${label}`}
          className="inline-flex size-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-xs text-xs leading-relaxed">
        {message}
      </TooltipContent>
    </Tooltip>
  );
}

export function Field({ label, name, children, required }: { label: string; name?: string; children: React.ReactNode; required?: boolean }) {
  return <div className="space-y-1.5"><div className="flex items-center gap-1.5"><Label>{label}{required && <span className="text-red-500"> *</span>}</Label><FieldHelp label={label} name={name} /></div>{children}</div>;
}
export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="space-y-4 border-t pt-6 first:border-0 first:pt-0"><div><h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>{description && <p className="mt-1 text-xs text-slate-500">{description}</p>}</div>{children}</section>;
}
export function Combo({ value, values, onChange }: { value: string; values: string[]; onChange: (value: string) => void }) {
  const id = useMemo(() => `buying-${Math.random().toString(36).slice(2)}`, []);
  return <><Input list={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Begin typing for results." /><datalist id={id}>{values.map((v) => <ERPSelectOption key={v} value={v} />)}</datalist></>;
}
export function Check({ checked, onChange, label, name, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; name: string; description?: string }) {
  return <div className="flex items-start gap-2 pt-2"><Checkbox id={name} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} /><div><div className="flex items-center gap-1.5"><Label htmlFor={name} className="cursor-pointer">{label}</Label><FieldHelp label={label} name={name} help={description} /></div></div></div>;
}
