import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Truck,
  Package,
  Building2,
  User,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanySelect } from "@/components/CompanySelect";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  stockApi,
  type Shipment,
  type ShipmentParcel,
  type ShipmentDeliveryNote,
  type StockMasterOptions,
  type StockMasterUser,
  type StockMasterCustomer,
  type StockMasterDeliveryNote,
} from "../api";
import { warehouseApi, type CompanyOption } from "../warehouseApi";
import { toast } from "sonner";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import api from "@/lib/api";

const emptyShipment = (): Shipment => ({
  status: "Draft",
  pickup_from_type: "Company",
  pickup_company: "",
  pickup_address_name: "Head Office",
  pickup_address: "Gg. Melati 08E Jl Kapten Haryadi, Sleman Yogyakarta 55581 - Email: contact@codeverta.com",
  pickup_contact_person: "Administrator",
  pickup_contact: "admin@example.com",

  delivery_to_type: "Customer",
  delivery_customer: "",
  delivery_address_name: "",
  delivery_address: "",
  delivery_contact_person: "",
  delivery_contact: "",

  total_weight: 0,
  parcels: [],
  delivery_notes: [],

  pallets: false,
  value_of_goods: 0,
  pickup_date: new Date().toISOString().slice(0, 10),
  pickup_from: "09:00",
  pickup_to: "17:00",
  shipment_type: "Goods",
  pickup_type: "Pickup",
  incoterm: "EXW",
  description_of_content: "",

  service_provider: "JNE",
  shipment_id: "",
  shipment_amount: 0,
  carrier: "JNE Express",
  carrier_service: "Reguler",
  awb_number: "",
  tracking_status: "Pending Pickup",
});

export default function ShipmentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [row, setRow] = useState<Shipment>(emptyShipment());
  const [options, setOptions] = useState<StockMasterOptions>({
    companies: [],
    incoterms: ["EXW", "FOB", "CIF", "DDP"],
    service_providers: ["JNE", "J&T Express", "SiCepat", "DHL"],
    parcel_templates: ["Small Box (20x15x10 cm)", "Medium Box (30x20x15 cm)", "Large Box (40x30x20 cm)"],
  });

  const [initialCompanies, setInitialCompanies] = useState<SearchableSelectOption[]>([]);
  const [initialUsers, setInitialUsers] = useState<SearchableSelectOption[]>([]);
  const [initialCustomers, setInitialCustomers] = useState<SearchableSelectOption[]>([]);
  const [initialDeliveryNotes, setInitialDeliveryNotes] = useState<SearchableSelectOption[]>([]);
  const [dnDetailMap, setDnDetailMap] = useState<Map<string, { total: number; customer?: string }>>(new Map());

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Initial load from backend DB via stockApi.masterOptions()
  useEffect(() => {
    stockApi
      .masterOptions()
      .then((opts) => {
        setOptions(opts);

        if (opts.companies && opts.companies.length > 0) {
          setInitialCompanies(opts.companies.map((c) => ({ value: c, label: c })));
        }

        if (opts.users && opts.users.length > 0) {
          const userOpts: SearchableSelectOption[] = opts.users.map((u) => ({
            value: u.display_name || u.username || u.email,
            label: u.display_name || u.username,
            sublabel: u.email,
          }));
          setInitialUsers(userOpts);
        }

        if (opts.customers && opts.customers.length > 0) {
          const custOpts: SearchableSelectOption[] = opts.customers.map((c) => ({
            value: c.customer_name,
            label: c.customer_name,
            sublabel: c.email || c.phone || (c.customer_type ? `Type: ${c.customer_type}` : undefined),
          }));
          setInitialCustomers(custOpts);
        }

        if (opts.delivery_notes && opts.delivery_notes.length > 0) {
          const newMap = new Map<string, { total: number; customer?: string }>();
          const dnOpts: SearchableSelectOption[] = opts.delivery_notes.map((dn) => {
            newMap.set(dn.number, { total: dn.total || 0, customer: dn.customer });
            return {
              value: dn.number,
              label: dn.number,
              sublabel: dn.customer ? `${dn.customer} - Rp ${(dn.total || 0).toLocaleString("id-ID")}` : undefined,
              badge: dn.status,
            };
          });
          setInitialDeliveryNotes(dnOpts);
          setDnDetailMap(newMap);
        }
      })
      .catch((err) => console.error("Error loading master options:", err));

    if (!isNew && id) {
      stockApi
        .shipmentGet(id)
        .then((v) => {
          setRow({
            ...v,
            parcels: v.parcels || [],
            delivery_notes: v.delivery_notes || [],
          });
        })
        .catch(() => {
          toast.error("Shipment tidak ditemukan");
          navigate("/desk/shipment");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  // Remote Search Handlers directly querying database via API
  const searchCompaniesFromDB = async (query: string): Promise<SearchableSelectOption[]> => {
    try {
      const res = await warehouseApi.listCompanies();
      const list = (res || []).map((c) => ({
        value: c.name,
        label: c.name,
        sublabel: c.abbreviation,
      }));
      if (!query.trim()) return list;
      const q = query.toLowerCase();
      return list.filter((c) => c.value.toLowerCase().includes(q) || (c.sublabel && c.sublabel.toLowerCase().includes(q)));
    } catch {
      return initialCompanies;
    }
  };

  const searchUsersFromDB = async (query: string): Promise<SearchableSelectOption[]> => {
    try {
      const res = await api.get("/users", { params: { q: query, limit: 50 } });
      const raw = res?.data?.data || res?.data || [];
      if (Array.isArray(raw)) {
        return raw.map((u: any) => ({
          value: u.display_name || u.username || u.email,
          label: u.display_name || u.username,
          sublabel: u.email,
        }));
      }
    } catch (err) {
      console.error("Failed to query users from DB:", err);
    }
    return initialUsers;
  };

  const searchCustomersFromDB = async (query: string): Promise<SearchableSelectOption[]> => {
    try {
      const res = await api.get("/selling/customers", { params: { q: query } });
      const raw = res?.data?.data || res?.data || [];
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((c: any) => ({
          value: c.customer_name,
          label: c.customer_name,
          sublabel: c.email || c.phone || (c.customer_type ? `Type: ${c.customer_type}` : undefined),
        }));
      }
    } catch (err) {
      console.error("Failed to query customers from DB:", err);
    }
    return initialCustomers;
  };

  const searchDeliveryNotesFromDB = async (query: string): Promise<SearchableSelectOption[]> => {
    try {
      const notes = await stockApi.deliveryNoteList({ q: query });
      if (Array.isArray(notes)) {
        const nextMap = new Map(dnDetailMap);
        const mapped = notes.map((dn) => {
          const tot = dn.rounded_total || dn.grand_total || dn.total || 0;
          nextMap.set(dn.number, { total: tot, customer: dn.customer });
          return {
            value: dn.number,
            label: dn.number,
            sublabel: dn.customer ? `${dn.customer} - Rp ${tot.toLocaleString("id-ID")}` : undefined,
            badge: dn.status,
          };
        });
        setDnDetailMap(nextMap);
        return mapped;
      }
    } catch (err) {
      console.error("Failed to query delivery notes from DB:", err);
    }
    return initialDeliveryNotes;
  };

  const update = <K extends keyof Shipment>(key: K, value: Shipment[K]) => {
    setRow((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "parcels") {
        const total = (value as ShipmentParcel[]).reduce(
          (sum, p) => sum + Number(p.weight || 0) * Number(p.count || 1),
          0
        );
        updated.total_weight = total;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = isNew ? await stockApi.shipmentCreate(row) : await stockApi.shipmentUpdate(id!, row);
      toast.success("Shipment berhasil disimpan");
      setRow(saved);
      if (isNew && saved.id) {
        navigate(`/desk/shipment/${saved.id}`, { replace: true });
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menyimpan Shipment");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitDoc = async () => {
    if (!id || isNew) return;
    try {
      const saved = await stockApi.shipmentSubmit(id);
      toast.success("Shipment submitted");
      setRow(saved);
    } catch {
      toast.error("Gagal submit Shipment");
    }
  };

  // Parcel helpers
  const addParcelRow = () => {
    const newParcels: ShipmentParcel[] = [
      ...row.parcels,
      { length: 20, width: 15, height: 10, weight: 1, count: 1, parcel_template: options.parcel_templates[0] || "" },
    ];
    update("parcels", newParcels);
  };

  const updateParcelRow = (index: number, key: keyof ShipmentParcel, val: any) => {
    const updated = row.parcels.map((p, i) => (i === index ? { ...p, [key]: val } : p));
    update("parcels", updated);
  };

  const removeParcelRow = (index: number) => {
    update(
      "parcels",
      row.parcels.filter((_, i) => i !== index)
    );
  };

  // Delivery Note helpers
  const addDNRow = () => {
    const firstDN = initialDeliveryNotes[0]?.value || "";
    const firstVal = dnDetailMap.get(firstDN)?.total || 0;
    const newDNs: ShipmentDeliveryNote[] = [
      ...row.delivery_notes,
      { delivery_note: firstDN, value: firstVal },
    ];
    update("delivery_notes", newDNs);
  };

  const updateDNRow = (index: number, key: keyof ShipmentDeliveryNote, val: any) => {
    const updated = row.delivery_notes.map((dn, i) => {
      if (i === index) {
        const next = { ...dn, [key]: val };
        // Auto-fill value from database record if delivery_note chosen
        if (key === "delivery_note") {
          const detail = dnDetailMap.get(val);
          if (detail && detail.total > 0) {
            next.value = detail.total;
          }
        }
        return next;
      }
      return dn;
    });
    update("delivery_notes", updated);
  };

  const removeDNRow = (index: number) => {
    update(
      "delivery_notes",
      row.delivery_notes.filter((_, i) => i !== index)
    );
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Memuat data Shipment dari database...</div>;
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/desk/shipment">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <p className="text-sm text-slate-500">Stock / Shipment</p>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{isNew ? "New Shipment" : row.number}</h1>
              <Badge variant={row.status === "Submitted" ? "default" : "secondary"}>
                {isNew ? "Not Saved" : row.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && row.status === "Draft" && (
            <Button variant="outline" onClick={handleSubmitDoc}>
              <CheckCircle2 className="mr-2 size-4 text-emerald-600" /> Submit
            </Button>
          )}
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 size-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      {/* Main Grid Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pickup from Section */}
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950">
          <div className="flex items-center gap-2 border-b pb-3 font-semibold text-slate-900 dark:text-white">
            <Building2 className="size-5 text-blue-600" /> Pickup from
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Pickup From Type</label>
              <ERPSelect
                className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                value={row.pickup_from_type}
                onChange={(e) => update("pickup_from_type", e.target.value as any)}
              >
                <ERPSelectOption value="Company">Company</ERPSelectOption>
                <ERPSelectOption value="Customer">Customer</ERPSelectOption>
                <ERPSelectOption value="Supplier">Supplier</ERPSelectOption>
              </ERPSelect>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Pickup Company / Sender</label>
              <CompanySelect
                value={row.pickup_company}
                onChange={(val) => update("pickup_company", val)}
                placeholder="Pilih / cari perusahaan di database..."
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Pickup Address Name</label>
              <Input
                value={row.pickup_address_name}
                onChange={(e) => update("pickup_address_name", e.target.value)}
                placeholder="Head Office / Warehouse A"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Pickup Contact Person</label>
              <SearchableSelect
                value={row.pickup_contact_person}
                options={initialUsers}
                onSearch={searchUsersFromDB}
                onChange={(val, rawOpt) => {
                  update("pickup_contact_person", val);
                  if (rawOpt?.sublabel) {
                    update("pickup_contact", rawOpt.sublabel);
                  }
                }}
                placeholder="Pilih / cari user di database..."
                searchPlaceholder="Ketik nama atau email user di DB..."
                addNewLabel="Tambah User Baru"
                addNewHref="/desk/user"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Pickup Address Details</label>
            <Textarea
              value={row.pickup_address}
              onChange={(e) => update("pickup_address", e.target.value)}
              placeholder="Alamat lengkap lokasi penjemputan"
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Pickup Contact Email / Phone</label>
            <Input
              value={row.pickup_contact}
              onChange={(e) => update("pickup_contact", e.target.value)}
              placeholder="No Telepon / Email"
            />
          </div>
        </section>

        {/* Delivery to Section */}
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950">
          <div className="flex items-center gap-2 border-b pb-3 font-semibold text-slate-900 dark:text-white">
            <User className="size-5 text-emerald-600" /> Delivery to
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Delivery To Type</label>
              <ERPSelect
                className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                value={row.delivery_to_type}
                onChange={(e) => update("delivery_to_type", e.target.value as any)}
              >
                <ERPSelectOption value="Customer">Customer</ERPSelectOption>
                <ERPSelectOption value="Company">Company</ERPSelectOption>
                <ERPSelectOption value="Supplier">Supplier</ERPSelectOption>
              </ERPSelect>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Delivery Customer / Receiver</label>
              <SearchableSelect
                value={row.delivery_customer}
                options={initialCustomers}
                onSearch={searchCustomersFromDB}
                onChange={(val) => update("delivery_customer", val)}
                placeholder="Pilih / cari customer di database..."
                searchPlaceholder="Ketik nama customer untuk mencari di DB..."
                addNewLabel="Tambah Customer Baru"
                addNewHref="/desk/customer/new"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Delivery Address Name</label>
              <Input
                value={row.delivery_address_name}
                onChange={(e) => update("delivery_address_name", e.target.value)}
                placeholder="Home / Store Branch"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Delivery Contact Person</label>
              <Input
                value={row.delivery_contact_person}
                onChange={(e) => update("delivery_contact_person", e.target.value)}
                placeholder="Nama Kontak Penerima"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Delivery Address Details</label>
            <Textarea
              value={row.delivery_address}
              onChange={(e) => update("delivery_address", e.target.value)}
              placeholder="Alamat lengkap tujuan pengiriman"
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Delivery Contact Email / Phone</label>
            <Input
              value={row.delivery_contact}
              onChange={(e) => update("delivery_contact", e.target.value)}
              placeholder="No Telepon / Email Penerima"
            />
          </div>
        </section>
      </div>

      {/* Parcels Table Section */}
      <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950">
        <div className="flex items-center justify-between border-b pb-3 font-semibold text-slate-900 dark:text-white">
          <div className="flex items-center gap-2">
            <Package className="size-5 text-indigo-600" /> Parcels (Shipment Parcel)
          </div>
          <div className="text-sm font-normal text-slate-500">
            Total Weight: <span className="font-bold text-slate-900 dark:text-white">{row.total_weight || 0} kg</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="p-3">No</th>
                <th className="p-3">Length (cm)</th>
                <th className="p-3">Width (cm)</th>
                <th className="p-3">Height (cm)</th>
                <th className="p-3">Weight (kg)</th>
                <th className="p-3">Count</th>
                <th className="p-3">Template Parcel</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {row.parcels.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    Belum ada parcel (Klik tombol Tambah Parcel)
                  </td>
                </tr>
              ) : (
                row.parcels.map((p, i) => (
                  <tr key={i}>
                    <td className="p-3 text-center">{i + 1}</td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={p.length}
                        onChange={(e) => updateParcelRow(i, "length", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={p.width}
                        onChange={(e) => updateParcelRow(i, "width", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={p.height}
                        onChange={(e) => updateParcelRow(i, "height", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={p.weight}
                        onChange={(e) => updateParcelRow(i, "weight", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={p.count}
                        onChange={(e) => updateParcelRow(i, "count", parseInt(e.target.value, 10) || 1)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={p.parcel_template}
                        onChange={(e) => updateParcelRow(i, "parcel_template", e.target.value)}
                        placeholder="Small / Medium Box"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeParcelRow(i)}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Button variant="outline" size="sm" onClick={addParcelRow}>
          <Plus className="mr-1 size-4" /> Add Parcel Row
        </Button>
      </section>

      {/* Shipment Delivery Note Section */}
      <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950">
        <div className="flex items-center justify-between border-b pb-3 font-semibold text-slate-900 dark:text-white">
          <div className="flex items-center gap-2">
            <Truck className="size-5 text-amber-600" /> Shipment Delivery Note
          </div>
          <a
            href="/desk/delivery-note/new"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <Plus className="size-3.5" /> Buat Delivery Note Baru
            <ExternalLink className="size-3 opacity-60" />
          </a>
        </div>

        <div className="overflow-visible rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="p-3 w-12">No</th>
                <th className="p-3 min-w-[280px]">Delivery Note Reference</th>
                <th className="p-3 w-48 text-right">Value (Rp)</th>
                <th className="p-3 w-16 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {row.delivery_notes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500">
                    No rows (Klik tombol Add Delivery Note Row)
                  </td>
                </tr>
              ) : (
                row.delivery_notes.map((dn, i) => (
                  <tr key={i}>
                    <td className="p-3 text-center">{i + 1}</td>
                    <td className="p-2">
                      <SearchableSelect
                        value={dn.delivery_note}
                        options={initialDeliveryNotes}
                        onSearch={searchDeliveryNotesFromDB}
                        onChange={(val) => updateDNRow(i, "delivery_note", val)}
                        placeholder="Pilih / cari nomor Surat Jalan di database..."
                        searchPlaceholder="Ketik nomor surat jalan / nama customer..."
                        addNewLabel="Buat Delivery Note Baru"
                        addNewHref="/desk/delivery-note/new"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        className="text-right"
                        value={dn.value}
                        onChange={(e) => updateDNRow(i, "value", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeDNRow(i)}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Button variant="outline" size="sm" onClick={addDNRow}>
          <Plus className="mr-1 size-4" /> Add Delivery Note Row
        </Button>
      </section>

      {/* Shipment Details & Carrier Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Shipment Details */}
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950">
          <div className="border-b pb-3 font-semibold text-slate-900 dark:text-white">Shipment Details</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Value of Goods (Rp)</label>
              <Input
                type="number"
                value={row.value_of_goods}
                onChange={(e) => update("value_of_goods", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Shipment Type</label>
              <ERPSelect
                className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                value={row.shipment_type}
                onChange={(e) => update("shipment_type", e.target.value as any)}
              >
                <ERPSelectOption value="Goods">Goods</ERPSelectOption>
                <ERPSelectOption value="Documents">Documents</ERPSelectOption>
              </ERPSelect>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Pickup Date</label>
              <Input
                type="date"
                value={row.pickup_date}
                onChange={(e) => update("pickup_date", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Pickup From Time</label>
              <Input
                type="time"
                value={row.pickup_from}
                onChange={(e) => update("pickup_from", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Pickup To Time</label>
              <Input
                type="time"
                value={row.pickup_to}
                onChange={(e) => update("pickup_to", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Pickup Type</label>
              <ERPSelect
                className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                value={row.pickup_type}
                onChange={(e) => update("pickup_type", e.target.value as any)}
              >
                <ERPSelectOption value="Pickup">Pickup</ERPSelectOption>
                <ERPSelectOption value="Self delivery">Self delivery</ERPSelectOption>
              </ERPSelect>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Incoterm</label>
              <ERPSelect
                className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                value={row.incoterm}
                onChange={(e) => update("incoterm", e.target.value)}
              >
                {options.incoterms.map((inc) => (
                  <ERPSelectOption key={inc} value={inc}>
                    {inc}
                  </ERPSelectOption>
                ))}
              </ERPSelect>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Description of Content</label>
            <Textarea
              value={row.description_of_content}
              onChange={(e) => update("description_of_content", e.target.value)}
              placeholder="Deskripsi isi muatan kiriman..."
              rows={2}
            />
          </div>
        </section>

        {/* Carrier & Tracking Info */}
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950">
          <div className="border-b pb-3 font-semibold text-slate-900 dark:text-white">Carrier & Tracking Info</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Service Provider</label>
              <ERPSelect
                className="h-10 w-full rounded-md border px-3 text-sm dark:bg-slate-900"
                value={row.service_provider}
                onChange={(e) => update("service_provider", e.target.value)}
              >
                {options.service_providers.map((sp) => (
                  <ERPSelectOption key={sp} value={sp}>
                    {sp}
                  </ERPSelectOption>
                ))}
              </ERPSelect>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Shipment Amount (Ongkir)</label>
              <Input
                type="number"
                value={row.shipment_amount}
                onChange={(e) => update("shipment_amount", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Carrier</label>
              <Input
                value={row.carrier}
                onChange={(e) => update("carrier", e.target.value)}
                placeholder="JNE / SiCepat / Lion Parcel"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Carrier Service</label>
              <Input
                value={row.carrier_service}
                onChange={(e) => update("carrier_service", e.target.value)}
                placeholder="Reguler / YES / Cargo"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">AWB / Resi Number</label>
              <Input
                value={row.awb_number}
                onChange={(e) => update("awb_number", e.target.value)}
                placeholder="Nomor Resi / AWB"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Tracking Status</label>
              <Input
                value={row.tracking_status}
                onChange={(e) => update("tracking_status", e.target.value)}
                placeholder="Status pelacakan"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
