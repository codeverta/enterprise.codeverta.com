import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  FilePlus2,
  FolderTree,
  MapPin,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { customerApi, type Customer } from "../customerApi";
import {
  customerMasterApi,
  type Address,
  type Contact,
  type CustomerGroup,
  type CustomerMaster,
  type CustomerMasterKind,
} from "../customerMasterApi";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";

const emptyGroup: CustomerGroup = {
  group_name: "",
  parent_group: "",
  is_group: false,
  default_price_list: "Standard Selling",
  payment_terms: "",
  default_receivable_account: "",
  advance_account: "",
  credit_limit: 0,
  bypass_credit_limit_sales_order: false,
};
const emptyAddress: Address = {
  address_title: "",
  address_type: "Billing",
  address_line1: "",
  address_line2: "",
  city: "",
  county: "",
  state: "",
  country: "Indonesia",
  postal_code: "",
  phone: "",
  fax: "",
  email: "",
  tax_category: "",
  linked_doctype: "Customer",
  linked_name: "",
  is_primary_address: false,
  is_shipping_address: false,
  is_your_company_address: false,
  disabled: false,
};
const emptyContact: Contact = {
  first_name: "",
  middle_name: "",
  last_name: "",
  status: "Open",
  designation: "",
  company_name: "",
  email_id: "",
  alternate_email_id: "",
  phone: "",
  mobile_no: "",
  linked_doctype: "Customer",
  linked_name: "",
  user_id: "",
  is_primary_contact: false,
  disabled: false,
  notes: "",
};
const config = {
  "customer-group": {
    title: "Customer Group",
    description:
      "Kelola segmentasi dan hierarki customer beserta default penjualannya.",
    Icon: FolderTree,
  },
  address: {
    title: "Address",
    description:
      "Kelola alamat billing, shipping, kantor, dan alamat utama customer.",
    Icon: MapPin,
  },
  contact: {
    title: "Contact",
    description:
      "Kelola narahubung customer, informasi komunikasi, dan kontak utama.",
    Icon: UserRound,
  },
} as const;
function Field({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-1.5 text-sm font-medium ${className}`}>
      <span>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
function Check({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        className="mt-1 size-4"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-6">
        {label}
      </label>
    </div>
  );
}
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm";

export default function CustomerMasterPage({
  kind,
}: {
  kind: CustomerMasterKind;
}) {
  const location = useLocation(),
    navigate = useNavigate(),
    meta = config[kind];
  const segments = location.pathname.split("/").filter(Boolean),
    id = segments[2],
    isForm = id === "new" || Boolean(id);
  const [rows, setRows] = useState<CustomerMaster[]>([]),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [groups, setGroups] = useState<CustomerGroup[]>([]),
    [customers, setCustomers] = useState<Customer[]>([]);
  const initial = useMemo<CustomerMaster>(
    () =>
      kind === "customer-group"
        ? { ...emptyGroup }
        : kind === "address"
          ? { ...emptyAddress }
          : { ...emptyContact },
    [kind],
  );
  const [form, setForm] = useState<CustomerMaster>(initial);
  const base = `/desk/${kind}`;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await customerMasterApi.list(kind));
    } catch (e: any) {
      toast.error(e?.response?.data?.error || `Gagal mengambil ${meta.title}`);
    } finally {
      setLoading(false);
    }
  }, [kind, meta.title]);
  useEffect(() => {
    if (!isForm) {
      const timer = window.setTimeout(load, 250);
      return () => window.clearTimeout(timer);
    }
  }, [isForm, load]);
  useEffect(() => {
    if (!isForm) return;
    setForm(initial);
    if (id && id !== "new")
      customerMasterApi
        .get(kind, id)
        .then(setForm)
        .catch((e: any) =>
          toast.error(
            e?.response?.data?.error || `Gagal mengambil ${meta.title}`,
          ),
        );
  }, [id, initial, isForm, kind, meta.title]);
  useEffect(() => {
    if (!isForm) return;
    if (kind === "customer-group")
      customerMasterApi
        .list<CustomerGroup>("customer-group")
        .then(setGroups)
        .catch(() => {});
    else
      Promise.all([
        customerApi.list(),
        customerMasterApi.list<CustomerGroup>("customer-group"),
      ])
        .then(([customerRows, groupRows]) => {
          setCustomers(customerRows);
          setGroups(groupRows);
        })
        .catch(() => {});
  }, [isForm, kind]);
  const set = (key: string, value: any) =>
    setForm((current) => ({ ...current, [key]: value }) as CustomerMaster);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (id && id !== "new") await customerMasterApi.update(kind, id, form);
      else await customerMasterApi.create(kind, form);
      toast.success(`${meta.title} berhasil disimpan`);
      navigate(base);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || `Gagal menyimpan ${meta.title}`);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (row: CustomerMaster) => {
    if (!row.id || !window.confirm(`Hapus ${displayName(kind, row)}?`)) return;
    try {
      await customerMasterApi.remove(kind, row.id);
      toast.success(`${meta.title} berhasil dihapus`);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || `Gagal menghapus ${meta.title}`);
    }
  };
  if (isForm)
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-5 lg:p-8">
        <Button variant="ghost" onClick={() => navigate(base)}>
          <ArrowLeft className="mr-2 size-4" />
          Kembali
        </Button>
        <header>
          <p className="text-sm font-semibold text-blue-600">Selling</p>
          <h1 className="mt-1 text-3xl font-bold">
            {id === "new" ? `${meta.title} Baru` : `Edit ${meta.title}`}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{meta.description}</p>
        </header>
        <form
          onSubmit={submit}
          className="grid gap-5 rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 md:grid-cols-2"
        >
          {kind === "customer-group" ? (
            <GroupFields
              value={form as CustomerGroup}
              groups={groups.filter((g) => g.id !== id)}
              set={set}
            />
          ) : kind === "address" ? (
            <AddressFields
              value={form as Address}
              customers={customers}
              set={set}
            />
          ) : (
            <ContactFields
              value={form as Contact}
              customers={customers}
              set={set}
            />
          )}
          <div className="flex justify-end gap-2 border-t pt-5 md:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(base)}
            >
              Batal
            </Button>
            <Button
              disabled={saving}
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </div>
    );
  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-5 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">Selling</p>
          <h1 className="mt-1 text-3xl font-bold">{meta.title}</h1>
          <p className="mt-2 text-sm text-slate-500">{meta.description}</p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to={`${base}/new`}>
            <FilePlus2 className="mr-2 size-4" />
            Tambah {meta.title}
          </Link>
        </Button>
      </header>
        <MasterTable kind={kind} rows={rows} base={base} remove={remove} loading={loading} />
    </div>
  );
}

function GroupFields({
  value,
  groups,
  set,
}: {
  value: CustomerGroup;
  groups: CustomerGroup[];
  set: (k: string, v: any) => void;
}) {
  return (
    <>
      <Field label="Nama Customer Group" required>
        <Input
          required
          value={value.group_name}
          onChange={(e) => set("group_name", e.target.value)}
        />
      </Field>
      <Field label="Parent Customer Group">
        <select
          className={selectClass}
          value={value.parent_group}
          onChange={(e) => set("parent_group", e.target.value)}
        >
          <option value="">Tanpa induk</option>
          {groups
            .filter((g) => g.is_group)
            .map((g) => (
              <option key={g.id} value={g.group_name}>
                {g.group_name}
              </option>
            ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Check
          id="group-is-group"
          label="Is Group — grup ini menjadi induk dan tidak dapat dipilih langsung pada transaksi"
          checked={value.is_group}
          onChange={(v) => set("is_group", v)}
        />
      </div>
      <Field label="Default Price List">
        <Input
          value={value.default_price_list}
          onChange={(e) => set("default_price_list", e.target.value)}
        />
      </Field>
      <Field label="Default Payment Terms">
        <Input
          value={value.payment_terms}
          onChange={(e) => set("payment_terms", e.target.value)}
        />
      </Field>
      <Field label="Default Receivable Account">
        <Input
          value={value.default_receivable_account}
          onChange={(e) => set("default_receivable_account", e.target.value)}
        />
      </Field>
      <Field label="Advance Account">
        <Input
          value={value.advance_account}
          onChange={(e) => set("advance_account", e.target.value)}
        />
      </Field>
      <Field label="Credit Limit">
        <Input
          min={0}
          type="number"
          value={value.credit_limit}
          onChange={(e) => set("credit_limit", Number(e.target.value))}
        />
      </Field>
      <div className="self-end">
        <Check
          id="group-bypass-credit"
          label="Lewati pengecekan credit limit pada Sales Order"
          checked={value.bypass_credit_limit_sales_order}
          onChange={(v) => set("bypass_credit_limit_sales_order", v)}
        />
      </div>
    </>
  );
}
function PartyFields({
  doctype,
  name,
  customers,
  set,
}: {
  doctype: string;
  name: string;
  customers: Customer[];
  set: (k: string, v: any) => void;
}) {
  return (
    <>
      <Field label="Tautkan ke">
        <select
          className={selectClass}
          value={doctype}
          onChange={(e) => {
            set("linked_doctype", e.target.value);
            set("linked_name", "");
          }}
        >
          <option value="Customer">Customer</option>
          <option value="Supplier">Supplier</option>
          <option value="">Tidak ditautkan</option>
        </select>
      </Field>
      <Field label="Nama Pihak">
        {doctype === "Customer" ? (
          <select
            className={selectClass}
            value={name}
            onChange={(e) => set("linked_name", e.target.value)}
          >
            <option value="">Pilih customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.customer_name}>
                {c.customer_name}
              </option>
            ))}
          </select>
        ) : (
          <Input
            disabled={!doctype}
            value={name}
            onChange={(e) => set("linked_name", e.target.value)}
            placeholder={doctype ? `Nama ${doctype}` : "Tidak ada tautan"}
          />
        )}
      </Field>
    </>
  );
}
function AddressFields({
  value,
  customers,
  set,
}: {
  value: Address;
  customers: Customer[];
  set: (k: string, v: any) => void;
}) {
  return (
    <>
      <Field label="Judul Alamat" required>
        <Input
          required
          value={value.address_title}
          onChange={(e) => set("address_title", e.target.value)}
        />
      </Field>
      <Field label="Tipe Alamat">
        <select
          className={selectClass}
          value={value.address_type}
          onChange={(e) => set("address_type", e.target.value)}
        >
          <option>Billing</option>
          <option>Shipping</option>
          <option>Office</option>
          <option>Personal</option>
          <option>Other</option>
        </select>
      </Field>
      <Field label="Alamat Baris 1" required className="md:col-span-2">
        <Input
          required
          value={value.address_line1}
          onChange={(e) => set("address_line1", e.target.value)}
        />
      </Field>
      <Field label="Alamat Baris 2" className="md:col-span-2">
        <Input
          value={value.address_line2}
          onChange={(e) => set("address_line2", e.target.value)}
        />
      </Field>
      <Field label="Kota/Kabupaten" required>
        <Input
          required
          value={value.city}
          onChange={(e) => set("city", e.target.value)}
        />
      </Field>
      <Field label="Provinsi">
        <Input
          value={value.state}
          onChange={(e) => set("state", e.target.value)}
        />
      </Field>
      <Field label="Kecamatan/County">
        <Input
          value={value.county}
          onChange={(e) => set("county", e.target.value)}
        />
      </Field>
      <Field label="Kode Pos">
        <Input
          value={value.postal_code}
          onChange={(e) => set("postal_code", e.target.value)}
        />
      </Field>
      <Field label="Negara">
        <Input
          value={value.country}
          onChange={(e) => set("country", e.target.value)}
        />
      </Field>
      <Field label="Tax Category">
        <Input
          value={value.tax_category}
          onChange={(e) => set("tax_category", e.target.value)}
        />
      </Field>
      <Field label="Telepon">
        <Input
          value={value.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={value.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </Field>
      <PartyFields
        doctype={value.linked_doctype}
        name={value.linked_name}
        customers={customers}
        set={set}
      />
      <div className="space-y-2 md:col-span-2">
        <Check
          id="address-primary"
          label="Preferred Billing Address"
          checked={value.is_primary_address}
          onChange={(v) => set("is_primary_address", v)}
        />
        <Check
          id="address-shipping"
          label="Preferred Shipping Address"
          checked={value.is_shipping_address}
          onChange={(v) => set("is_shipping_address", v)}
        />
        <Check
          id="address-company"
          label="Alamat milik perusahaan sendiri"
          checked={value.is_your_company_address}
          onChange={(v) => set("is_your_company_address", v)}
        />
        <Check
          id="address-disabled"
          label="Nonaktif"
          checked={value.disabled}
          onChange={(v) => set("disabled", v)}
        />
      </div>
    </>
  );
}
function ContactFields({
  value,
  customers,
  set,
}: {
  value: Contact;
  customers: Customer[];
  set: (k: string, v: any) => void;
}) {
  return (
    <>
      <Field label="Nama Depan" required>
        <Input
          required
          value={value.first_name}
          onChange={(e) => set("first_name", e.target.value)}
        />
      </Field>
      <Field label="Nama Tengah">
        <Input
          value={value.middle_name}
          onChange={(e) => set("middle_name", e.target.value)}
        />
      </Field>
      <Field label="Nama Belakang">
        <Input
          value={value.last_name}
          onChange={(e) => set("last_name", e.target.value)}
        />
      </Field>
      <Field label="Status">
        <select
          className={selectClass}
          value={value.status}
          onChange={(e) => set("status", e.target.value)}
        >
          <option>Open</option>
          <option>Replied</option>
          <option>Passive</option>
        </select>
      </Field>
      <Field label="Jabatan">
        <Input
          value={value.designation}
          onChange={(e) => set("designation", e.target.value)}
        />
      </Field>
      <Field label="Perusahaan">
        <Input
          value={value.company_name}
          onChange={(e) => set("company_name", e.target.value)}
        />
      </Field>
      <Field label="Email Utama">
        <Input
          type="email"
          value={value.email_id}
          onChange={(e) => set("email_id", e.target.value)}
        />
      </Field>
      <Field label="Email Alternatif">
        <Input
          type="email"
          value={value.alternate_email_id}
          onChange={(e) => set("alternate_email_id", e.target.value)}
        />
      </Field>
      <Field label="No. HP">
        <Input
          value={value.mobile_no}
          onChange={(e) => set("mobile_no", e.target.value)}
        />
      </Field>
      <Field label="Telepon">
        <Input
          value={value.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </Field>
      <PartyFields
        doctype={value.linked_doctype}
        name={value.linked_name}
        customers={customers}
        set={set}
      />
      <Field label="User ID">
        <Input
          value={value.user_id}
          onChange={(e) => set("user_id", e.target.value)}
          placeholder="Opsional untuk akses portal"
        />
      </Field>
      <Field label="Catatan">
        <Textarea
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>
      <div className="space-y-2 md:col-span-2">
        <Check
          id="contact-primary"
          label="Kontak utama untuk pihak yang ditautkan"
          checked={value.is_primary_contact}
          onChange={(v) => set("is_primary_contact", v)}
        />
        <Check
          id="contact-disabled"
          label="Nonaktif"
          checked={value.disabled}
          onChange={(v) => set("disabled", v)}
        />
      </div>
    </>
  );
}
function displayName(kind: CustomerMasterKind, row: CustomerMaster) {
  if (kind === "customer-group") return (row as CustomerGroup).group_name;
  if (kind === "address") return (row as Address).address_title;
  const c = row as Contact;
  return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ");
}
function MasterTable({
  kind,
  rows,
  base,
  remove,
  loading,
}: {
  kind: CustomerMasterKind;
  rows: CustomerMaster[];
  base: string;
  remove: (row: CustomerMaster) => void;
  loading?: boolean;
}) {
  const columns: ColumnDef<CustomerMaster>[] = [
    {
      id: "name",
      header: "Nama",
      accessorFn: (row) => displayName(kind, row),
      cell: ({ row }) => (
        <Link
          className="font-semibold text-blue-600 hover:underline"
          to={`${base}/${row.original.id}`}
        >
          {displayName(kind, row.original)}
        </Link>
      ),
    },
    {
      id: "secondary",
      header:
        kind === "customer-group"
          ? "Parent"
          : kind === "address"
            ? "Lokasi"
            : "Kontak",
      accessorFn: (row) => {
        const group = row as CustomerGroup,
          address = row as Address,
          contact = row as Contact;
        return kind === "customer-group"
          ? group.parent_group || "-"
          : kind === "address"
            ? [address.city, address.state].filter(Boolean).join(", ")
            : contact.email_id || contact.mobile_no || "-";
      },
    },
    {
      id: "linked",
      header: kind === "customer-group" ? "Tipe" : "Terhubung ke",
      accessorFn: (row) => {
        const group = row as CustomerGroup,
          address = row as Address,
          contact = row as Contact;
        return kind === "customer-group"
          ? group.is_group
            ? "Group"
            : "Leaf"
          : address.linked_name || contact.linked_name || "-";
      },
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => {
        const address = row as Address,
          contact = row as Contact;
        return kind === "customer-group" ||
          !(kind === "address" ? address.disabled : contact.disabled)
          ? "Aktif"
          : "Nonaktif";
      },
      cell: ({ row }) => (
        <Badge
          variant={
            (
              kind === "address"
                ? (row.original as Address).disabled
                : kind === "contact"
                  ? (row.original as Contact).disabled
                  : false
            )
              ? "secondary"
              : "default"
          }
        >
          {(
            kind === "address"
              ? (row.original as Address).disabled
              : kind === "contact"
                ? (row.original as Contact).disabled
                : false
          )
            ? "Nonaktif"
            : "Aktif"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Aksi",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button size="icon" variant="ghost" asChild>
            <Link to={`${base}/${row.original.id}`}>
              <Pencil className="size-4" />
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => remove(row.original)}
          >
            <Trash2 className="size-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id || displayName(kind, row)}
      searchPlaceholder={`Cari ${kind.replace("-", " ")}...`}
      emptyMessage={loading ? "Memuat data..." : "Tidak ada data."}
    />
  );
}
