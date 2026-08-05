import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, Search, Truck, Package, ArrowUpDown, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { stockApi, type Shipment, type ShipmentStatus } from "../api";
import { toast } from "sonner";

const statusVariants: Record<ShipmentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "secondary",
  Submitted: "default",
  "In Transit": "outline",
  Delivered: "default",
  Cancelled: "destructive",
};

export default function ShipmentListPage() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const loadShipments = async () => {
    setLoading(true);
    try {
      const data = await stockApi.shipmentList({
        q: search,
        status: statusFilter === "All" ? undefined : statusFilter,
      });
      setShipments(data);
    } catch {
      toast.error("Gagal mengambil daftar Shipment");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadShipments();
  };

  const handleDelete = async (id: string, number?: string) => {
    if (!confirm(`Hapus Shipment ${number || id}?`)) return;
    try {
      await stockApi.shipmentRemove(id);
      toast.success("Shipment berhasil dihapus");
      loadShipments();
    } catch {
      toast.error("Gagal menghapus Shipment");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <p className="text-sm font-semibold text-blue-600">Stock / Logistics</p>
          <h1 className="text-2xl font-bold tracking-tight">Shipment</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola pengiriman barang, parcel, kurir ekspedisi, dan nomor resi AWB.
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" asChild>
          <Link to="/desk/shipment/new">
            <Plus className="mr-2 size-4" /> New Shipment
          </Link>
        </Button>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            placeholder="Cari No Shipment, Resi/AWB, Kurir, Customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search className="size-4" />
          </Button>
        </form>

        <div className="flex items-center gap-2 overflow-x-auto">
          {["All", "Draft", "Submitted", "In Transit", "Delivered", "Cancelled"].map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="p-4">Shipment Number</th>
              <th className="p-4">Status</th>
              <th className="p-4">Pickup From</th>
              <th className="p-4">Delivery To</th>
              <th className="p-4">Provider / Carrier</th>
              <th className="p-4">AWB / Resi</th>
              <th className="p-4 text-right">Total Weight</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Memuat data Shipment...
                </td>
              </tr>
            ) : shipments.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Belum ada dokumen Shipment.
                </td>
              </tr>
            ) : (
              shipments.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="p-4 font-mono font-semibold text-blue-600">
                    <Link to={`/desk/shipment/${row.id}`} className="hover:underline">
                      {row.number}
                    </Link>
                  </td>
                  <td className="p-4">
                    <Badge variant={statusVariants[row.status] || "outline"}>{row.status}</Badge>
                  </td>
                  <td className="p-4">
                    <div className="font-medium">{row.pickup_company || "-"}</div>
                    <div className="text-xs text-slate-400">{row.pickup_from_type}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium">{row.delivery_customer || "-"}</div>
                    <div className="text-xs text-slate-400">{row.delivery_to_type}</div>
                  </td>
                  <td className="p-4">
                    <div>{row.service_provider || row.carrier || "-"}</div>
                    <div className="text-xs text-slate-400">{row.carrier_service}</div>
                  </td>
                  <td className="p-4 font-mono text-xs font-medium">
                    {row.awb_number || "-"}
                  </td>
                  <td className="p-4 text-right font-medium">
                    {row.total_weight || 0} kg
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/desk/shipment/${row.id}`)}>
                        Edit
                      </Button>
                      {row.id && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id!, row.number)}>
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
