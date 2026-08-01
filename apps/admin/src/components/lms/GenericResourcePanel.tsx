import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "switch"
  | "datetime"
  | "json";

export type FieldConfig = {
  key: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  options?: string[];
};

export type ResourceConfig = {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: FieldConfig[];
  columns: string[];
  defaults?: Record<string, unknown>;
};

const initialForm = (resource: ResourceConfig) => ({
  ...(resource.defaults || {}),
});

const formatDateTimeInput = (value: unknown) => {
  if (!value) return "";
  const date = dayjs(String(value));
  if (!date.isValid()) return "";
  return date.format("YYYY-MM-DDTHH:mm");
};

const toDisplayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
};

const normalizePayload = (
  form: Record<string, unknown>,
  fields: FieldConfig[]
) => {
  const payload: Record<string, unknown> = {};
  fields.forEach((field) => {
    const value = form[field.key];
    if (value === "" || value === undefined || value === null) return;
    if (field.type === "number") {
      payload[field.key] = Number(value);
      return;
    }
    if (field.type === "datetime") {
      payload[field.key] = dayjs(String(value)).toISOString();
      return;
    }
    if (field.type === "json") {
      payload[field.key] =
        typeof value === "string" ? JSON.parse(value) : value;
      return;
    }
    payload[field.key] = value;
  });
  return payload;
};


export function ResourcePanel({ resource }: { resource: ResourceConfig }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(initialForm(resource));

  const Icon = resource.icon;

  const fetchRows = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/subscriptions/admin/resources/${resource.key}?limit=100`);
      setRows(response.data?.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Gagal memuat ${resource.label}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.key]);

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm(resource));
    setOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...row };
    resource.fields.forEach((field) => {
      if (field.type === "datetime") next[field.key] = formatDateTimeInput(row[field.key]);
      if (field.type === "json") next[field.key] = JSON.stringify(row[field.key] || field.placeholder || {}, null, 2);
    });
    setEditing(row);
    setForm(next);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = normalizePayload(form, resource.fields);
      if (editing?.id) {
        await api.put(`/subscriptions/admin/resources/${resource.key}/${editing.id}`, payload);
        toast.success(`${resource.label} diperbarui`);
      } else {
        await api.post(`/subscriptions/admin/resources/${resource.key}`, payload);
        toast.success(`${resource.label} dibuat`);
      }
      setOpen(false);
      fetchRows();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || "Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Record<string, unknown>) => {
    if (!row.id || !confirm(`Hapus data ${resource.label} ini?`)) return;
    try {
      await api.delete(`/subscriptions/admin/resources/${resource.key}/${row.id}`);
      toast.success(`${resource.label} dihapus`);
      fetchRows();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menghapus data");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border bg-white text-slate-700">
            <Icon className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{resource.label}</h2>
            <p className="text-sm text-slate-500">{resource.description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRows} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            Add
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Records</CardTitle>
            <Badge variant="outline">{rows.length} rows</Badge>
          </div>
          <CardDescription>Data terbaru dari {resource.label}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {resource.columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={resource.columns.length + 1} className="h-24 text-center text-slate-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={resource.columns.length + 1} className="h-24 text-center text-slate-500">
                    No records yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={String(row.id)}>
                    {resource.columns.map((column) => (
                      <TableCell key={column} className="max-w-[280px] truncate">
                        {toDisplayValue(row[column])}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-600" onClick={() => remove(row)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add"} {resource.label}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {resource.fields.map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                value={form[field.key]}
                onChange={(value) => setForm((prev) => ({ ...prev, [field.key]: value }))}
              />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}




function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const type = field.type || "text";
  const id = `lms-${field.key}`;

  if (type === "switch") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border p-3">
        <Label htmlFor={id}>{field.label}</Label>
        <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} />
      </div>
    );
  }

  if (type === "select") {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{field.label}</Label>
        <Select value={String(value || "")} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (type === "textarea" || type === "json") {
    return (
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={id}>{field.label}</Label>
        <Textarea
          id={id}
          value={String(value || "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-24"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        type={type === "datetime" ? "datetime-local" : type}
        value={String(value || "")}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}