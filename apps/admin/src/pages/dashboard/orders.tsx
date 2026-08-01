import React, { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const money = (value, currency = "IDR") => new Intl.NumberFormat("id-ID", { style: "currency", currency }).format(Number(value || 0));

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subtotal: "", discount_total: "0", tax_total: "0", currency: "IDR", reference_type: "", reference_id: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/orders");
      setOrders(response.data?.data || []);
    } catch { toast.error("Gagal memuat order"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await api.post("/orders", { ...form, subtotal: Number(form.subtotal), discount_total: Number(form.discount_total), tax_total: Number(form.tax_total) });
      toast.success("Order berhasil dibuat"); setOpen(false); await load();
    } catch (error) { toast.error(error.response?.data?.error || "Gagal membuat order"); }
  };

  const updateStatus = async (id, status) => {
    try { await api.patch(`/orders/${id}/status`, { status }); await load(); }
    catch { toast.error("Gagal memperbarui status"); }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Orders</h1><p className="text-sm text-slate-500">Transaksi generik yang dapat dipakai semua modul ERP.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-2 size-4" />Refresh</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 size-4" />Order Baru</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Buat Order</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div><Label>Subtotal</Label><Input type="number" min="0" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Diskon</Label><Input type="number" min="0" value={form.discount_total} onChange={(e) => setForm({ ...form, discount_total: e.target.value })} /></div>
                  <div><Label>Pajak</Label><Input type="number" min="0" value={form.tax_total} onChange={(e) => setForm({ ...form, tax_total: e.target.value })} /></div>
                </div>
                <div><Label>Jenis referensi</Label><Input placeholder="purchase_order, invoice, dll." value={form.reference_type} onChange={(e) => setForm({ ...form, reference_type: e.target.value })} /></div>
                <div><Label>ID referensi</Label><Input value={form.reference_id} onChange={(e) => setForm({ ...form, reference_id: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={create} disabled={!form.subtotal}>Simpan</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card><CardHeader><CardTitle>Daftar Order</CardTitle></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead>Nomor</TableHead><TableHead>Referensi</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Dibuat</TableHead></TableRow></TableHeader>
          <TableBody>{orders.map((order) => <TableRow key={order.id}>
            <TableCell className="font-mono text-xs">{order.number}</TableCell>
            <TableCell>{order.reference_type ? `${order.reference_type}: ${order.reference_id || "-"}` : "-"}</TableCell>
            <TableCell>{money(order.grand_total, order.currency)}</TableCell>
            <TableCell><Select value={order.status} onValueChange={(status) => updateStatus(order.id, status)}><SelectTrigger className="w-36"><SelectValue><Badge variant="outline">{order.status}</Badge></SelectValue></SelectTrigger><SelectContent>{["draft", "pending", "paid", "cancelled", "refunded"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></TableCell>
            <TableCell>{new Date(order.created_at).toLocaleString("id-ID")}</TableCell>
          </TableRow>)}</TableBody></Table>
      </CardContent></Card>
    </div>
  );
}

export default DashboardLayout(OrdersPage);
