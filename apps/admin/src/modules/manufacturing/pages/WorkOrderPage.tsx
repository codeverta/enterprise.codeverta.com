import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Plus, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import {
  manufacturingApi,
  type ManufacturingOptions,
  type WorkOrder,
} from "../api";

const blank: WorkOrder = {
  company: "PT ZENIT TECHNOLOGY SOLUTION",
  naming_series: "MFG-WO-.YYYY.-",
  production_item: "",
  item_name: "",
  bom_no: "",
  qty: 1,
  sales_order: "",
  track_semi_finished_goods: false,
  source_warehouse: "",
  wip_warehouse: "",
  fg_warehouse: "",
  scrap_warehouse: "",
  allow_alternative_item: false,
  use_multi_level_bom: false,
  skip_transfer: false,
  update_consumed_material_cost_in_project: false,
  lead_time: 0,
  project: "",
  required_items: [],
};
const columns: ColumnDef<WorkOrder>[] = [
  {
    accessorKey: "work_order_no",
    header: "Work Order",
    cell: ({ row }) => (
      <Link
        className="font-semibold text-blue-600"
        to={`/desk/work-order/${row.original.id}`}
      >
        {row.original.work_order_no}
      </Link>
    ),
  },
  {
    accessorKey: "production_item",
    header: "Production Item",
    cell: ({ row }) =>
      `${row.original.production_item} — ${row.original.item_name}`,
  },
  { accessorKey: "qty", header: "Qty" },
  { accessorKey: "status", header: "Status" },
];
function CheckField({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  help?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />
      <span>
        {label}
        {help && (
          <small className="mt-0.5 block text-xs text-slate-500">{help}</small>
        )}
      </span>
    </label>
  );
}

export default function WorkOrderPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const id = pathname.split("/").filter(Boolean)[2];
  const isList = !id;
  const isNew = id === "new" || id?.startsWith("new-");
  const [form, setForm] = useState<WorkOrder>(blank);
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [options, setOptions] = useState<ManufacturingOptions | null>(null);
  const [boms, setBoms] = useState<
    Awaited<ReturnType<typeof manufacturingApi.listBOM>>
  >([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    manufacturingApi
      .options()
      .then(setOptions)
      .catch(() => toast.error("Gagal memuat opsi Work Order"));
    manufacturingApi
      .listBOM()
      .then(setBoms)
      .catch(() => undefined);
    if (isList)
      manufacturingApi
        .listWorkOrders()
        .then(setRows)
        .catch(() => toast.error("Gagal memuat Work Order"));
    else if (!isNew && id)
      manufacturingApi
        .getWorkOrder(id)
        .then(setForm)
        .catch(() => toast.error("Work Order tidak ditemukan"));
  }, [id, isList, isNew]);
  const update = <K extends keyof WorkOrder>(key: K, value: WorkOrder[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const itemOptions = (options?.items ?? []).map((item) => ({
    value: item.item_code,
    label: `${item.item_code} — ${item.item_name}`,
  }));
  const warehouseOptions = (options?.warehouses ?? []).map(
    (warehouse) => warehouse.warehouse_name,
  );
  const bomOptions = useMemo(
    () =>
      boms
        .filter((bom) => bom.bom_no)
        .map((bom) => ({
          value: bom.bom_no!,
          label: `${bom.bom_no} — ${bom.item_name}`,
        })),
    [boms],
  );
  const selectItem = (code: string) => {
    const item = options?.items.find((entry) => entry.item_code === code);
    setForm((current) => ({
      ...current,
      production_item: code,
      item_name: item?.item_name ?? "",
    }));
  };
  const selectBom = (bomNo: string) => {
    const bom = boms.find((entry) => entry.bom_no === bomNo);
    if (!bom) return update("bom_no", bomNo);
    setForm((current) => ({
      ...current,
      bom_no: bomNo,
      production_item: bom.item_code,
      item_name: bom.item_name,
      required_items: bom.items.map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        source_warehouse: current.source_warehouse,
        required_qty: item.qty * current.qty,
        transferred_qty: 0,
        consumed_qty: 0,
        returned_qty: 0,
      })),
    }));
  };
  const save = async () => {
    setSaving(true);
    try {
      const result = isNew
        ? await manufacturingApi.createWorkOrder(form)
        : await manufacturingApi.updateWorkOrder(id!, form);
      toast.success("Work Order disimpan");
      navigate(`/desk/work-order/${result.id}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal menyimpan Work Order");
    } finally {
      setSaving(false);
    }
  };
  if (isList)
    return (
      <ERPPage>
        <ERPPageHeader
          title="Work Order"
          description="Kelola perintah produksi, material, operasi, dan target barang jadi."
          breadcrumbs={[
            { label: "Manufacturing", href: "/desk/manufacturing" },
            { label: "Work Order" },
          ]}
          actions={
            <Button asChild>
              <Link to="/desk/work-order/new">
                <Plus />
                New Work Order
              </Link>
            </Button>
          }
        />
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id || row.work_order_no || "work-order"}
          onRowClick={(row) => navigate(`/desk/work-order/${row.id}`)}
          searchPlaceholder="Cari Work Order, item, atau status..."
          emptyMessage="Belum ada Work Order."
        />
      </ERPPage>
    );
  const warehouses = [
    ["source_warehouse", "Source Warehouse", "Lokasi bahan baku tersedia."],
    [
      "wip_warehouse",
      "Work-in-Progress Warehouse",
      "Lokasi operasi dikerjakan.",
    ],
    ["fg_warehouse", "Target Warehouse", "Lokasi penyimpanan produk jadi."],
    ["scrap_warehouse", "Scrap Warehouse", "Lokasi material scrap."],
  ] as const;
  return (
    <ERPPage>
      <ERPPageHeader
        title={isNew ? "New Work Order" : form.work_order_no || "Work Order"}
        description="Perintah produksi berdasarkan Bill of Materials."
        breadcrumbs={[
          { label: "Manufacturing", href: "/desk/manufacturing" },
          { label: "Work Order", href: "/desk/work-order" },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => navigate("/desk/work-order")}
            >
              <ArrowLeft />
              Back
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save />
              {saving ? "Saving..." : "Save"}
            </Button>
            {!isNew && (
              <Button
                onClick={() =>
                  manufacturingApi
                    .submitWorkOrder(id!)
                    .then(() => {
                      update("status", "Submitted");
                      toast.success("Work Order submitted");
                    })
                    .catch(() => toast.error("Gagal submit Work Order"))
                }
              >
                <Send />
                Submit
              </Button>
            )}
          </>
        }
      />
      <Tabs defaultValue="production">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="production">Production Item</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="more">More Info</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
        </TabsList>
        <TabsContent value="production" className="space-y-6">
          <section className="grid gap-5 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-2">
            <div>
              <Label>Company</Label>
              <SearchableSelect
                value={form.company}
                onChange={(value) => update("company", value)}
                options={(options?.companies ?? []).map(
                  (company) => company.name,
                )}
              />
            </div>
            <div>
              <Label>Series</Label>
              <Input
                value={form.naming_series}
                onChange={(event) =>
                  update("naming_series", event.target.value)
                }
              />
            </div>
            <div>
              <Label>Item To Manufacture</Label>
              <SearchableSelect
                value={form.production_item}
                onChange={selectItem}
                options={itemOptions}
              />
            </div>
            <div>
              <Label>BOM No</Label>
              <SearchableSelect
                value={form.bom_no}
                onChange={selectBom}
                options={bomOptions}
              />
            </div>
            <div>
              <Label>Qty To Manufacture</Label>
              <Input
                type="number"
                min={1}
                value={form.qty}
                onChange={(event) =>
                  update("qty", Number(event.target.value) || 1)
                }
              />
            </div>
            <div>
              <Label>Sales Order</Label>
              <Input
                value={form.sales_order}
                onChange={(event) => update("sales_order", event.target.value)}
              />
            </div>
            <CheckField
              label="Track Semi Finished Goods"
              checked={form.track_semi_finished_goods}
              onChange={(value) => update("track_semi_finished_goods", value)}
            />
          </section>
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold">Required Items</h2>
            <DataTable
              columns={[
                {
                  accessorKey: "item_code",
                  header: "Item Code",
                  cell: ({ row }) =>
                    `${row.original.item_code} — ${row.original.item_name}`,
                },
                { accessorKey: "source_warehouse", header: "Source Warehouse" },
                { accessorKey: "required_qty", header: "Required Qty" },
                { accessorKey: "transferred_qty", header: "Transferred Qty" },
                { accessorKey: "consumed_qty", header: "Consumed Qty" },
                { accessorKey: "returned_qty", header: "Returned Qty" },
              ]}
              data={form.required_items}
              getRowId={(row, index) => row.id || `required-${index}`}
              pagination={false}
              toolbar={false}
              emptyMessage="No rows"
            />
          </section>
        </TabsContent>
        <TabsContent value="configuration">
          <section className="grid gap-5 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-2">
            <CheckField
              label="Allow Alternative Item"
              checked={form.allow_alternative_item}
              onChange={(value) => update("allow_alternative_item", value)}
            />
            <CheckField
              label="Use Multi-Level BOM"
              help="Plan material for sub-assemblies"
              checked={form.use_multi_level_bom}
              onChange={(value) => update("use_multi_level_bom", value)}
            />
            <CheckField
              label="Skip Material Transfer to WIP Warehouse"
              checked={form.skip_transfer}
              onChange={(value) => update("skip_transfer", value)}
            />
            <CheckField
              label="Update Consumed Material Cost In Project"
              checked={form.update_consumed_material_cost_in_project}
              onChange={(value) =>
                update("update_consumed_material_cost_in_project", value)
              }
            />
            {warehouses.map(([key, label, help]) => (
              <div key={key}>
                <Label>{label}</Label>
                <SearchableSelect
                  value={form[key]}
                  onChange={(value) => update(key, value)}
                  options={warehouseOptions}
                />
                <p className="text-xs text-slate-500">{help}</p>
              </div>
            ))}
          </section>
        </TabsContent>
        <TabsContent value="more">
          <section className="grid gap-5 rounded-2xl border bg-white p-5 shadow-sm sm:grid-cols-2">
            {(
              [
                ["planned_start_date", "Planned Start Date"],
                ["planned_end_date", "Planned End Date"],
                ["expected_delivery_date", "Expected Delivery Date"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  type="date"
                  value={form[key]?.slice(0, 10) || ""}
                  onChange={(event) => update(key, event.target.value)}
                />
              </div>
            ))}
            <div>
              <Label>Lead Time (In Mins)</Label>
              <Input
                type="number"
                value={form.lead_time}
                onChange={(event) =>
                  update("lead_time", Number(event.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>Project</Label>
              <Input
                value={form.project}
                onChange={(event) => update("project", event.target.value)}
              />
            </div>
          </section>
        </TabsContent>
        <TabsContent value="connections">
          <section className="rounded-2xl border bg-white p-5">
            <p>Sales Order: {form.sales_order || "Belum terhubung"}</p>
            <p>BOM: {form.bom_no || "Belum terhubung"}</p>
          </section>
        </TabsContent>
      </Tabs>
    </ERPPage>
  );
}
