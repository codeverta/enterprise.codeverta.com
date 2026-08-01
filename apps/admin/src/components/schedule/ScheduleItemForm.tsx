import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronsUpDown,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Pastikan path import shadcn dialog sesuai
import { cn } from "@/lib/utils";
import {
  scheduleApi,
  type ScheduleItem,
  type ScheduleItemPayload,
  type ScheduleResourceOption,
  type ScheduleResourceType,
} from "@/lib/schedule-api";

const colors = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
];

function toLocalInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string) {
  return new Date(value).toISOString();
}

function defaultStart() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date;
}

function ResourceCombobox({
  resourceType,
  value,
  onChange,
}: {
  resourceType: ScheduleResourceType;
  value: string;
  onChange: (resourceId: string, resource?: ScheduleResourceOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ScheduleResourceOption[]>([]);
  const [selected, setSelected] = useState<ScheduleResourceOption | null>(null);

  useEffect(() => {
    setSelected(null);
    setOptions([]);
    setQuery("");
  }, [resourceType]);

  useEffect(() => {
    if (!resourceType) return;
    let alive = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await scheduleApi.searchResourceOptions(
          resourceType as Exclude<ScheduleResourceType, "">,
          query
        );
        if (alive) {
          setOptions(rows);
          const current = rows.find((row) => row.id === value);
          if (current) setSelected(current);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [resourceType, query, value]);

  const label =
    selected?.title ||
    (value ? `Resource terpilih (${value.slice(0, 8)}...)` : "Pilih resource");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={!resourceType}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {resourceType ? label : "Pilih tipe resource dulu"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={`Cari ${resourceType || "resource"}...`}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat resource...
                </span>
              ) : (
                "Resource tidak ditemukan."
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    setSelected(option);
                    onChange(option.id, option);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === option.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {option.title}
                    </p>
                    {option.subtitle && (
                      <p className="truncate text-xs text-slate-500">
                        {option.subtitle}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function ScheduleItemForm({
  item,
  title = "Item Jadwal",
  onSubmit,
  onDelete,
  onOpenResource,
  onClose,
  saving,
}: {
  item?: Partial<ScheduleItem> | null;
  title?: string;
  onSubmit: (payload: ScheduleItemPayload) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onOpenResource?: () => void;
  onClose: () => void;
  saving?: boolean;
}) {
  const savedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const initial = useMemo(() => {
    const start = item?.start_time ? new Date(item.start_time) : defaultStart();
    const end = item?.end_time
      ? new Date(item.end_time)
      : new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  }, [item]);

  const [form, setForm] = useState({
    title: item?.title || "",
    description: item?.description || "",
    start_time: toLocalInput(initial.start.toISOString()),
    end_time: toLocalInput(initial.end.toISOString()),
    all_day: Boolean(item?.all_day),
    color: item?.color || "#2563eb",
    resource_type: (item?.resource_type || "") as ScheduleResourceType,
    resource_id: item?.resource_id || "",
  });

  useEffect(() => {
    setForm({
      title: item?.title || "",
      description: item?.description || "",
      start_time: toLocalInput(initial.start.toISOString()),
      end_time: toLocalInput(initial.end.toISOString()),
      all_day: Boolean(item?.all_day),
      color: item?.color || "#2563eb",
      resource_type: (item?.resource_type || "") as ScheduleResourceType,
      resource_id: item?.resource_id || "",
    });
  }, [item, initial]);

  const update = (key: string, value: any) =>
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "resource_type" ? { resource_id: "" } : {}),
    }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      start_time: fromLocalInput(form.start_time),
      end_time: fromLocalInput(form.end_time),
      all_day: form.all_day,
      color: form.color,
      resource_type: form.resource_type,
      resource_id: form.resource_type ? form.resource_id || null : null,
    });
  };

  return (
    <Dialog
      open={item !== undefined}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden border border-slate-200 bg-white shadow-xl">
        <form onSubmit={submit} className="flex flex-col max-h-[92vh]">
          <DialogHeader className="flex flex-row items-center gap-3 border-b px-5 py-4 space-y-0 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-slate-950">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Atur waktu, warna, dan link resource LMS.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="grid max-h-[68vh] gap-4 overflow-y-auto px-5 py-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Judul</Label>
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Mulai</Label>
              <Input
                type="datetime-local"
                value={form.start_time}
                onChange={(e) => update("start_time", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Selesai</Label>
              <Input
                type="datetime-local"
                value={form.end_time}
                onChange={(e) => update("end_time", e.target.value)}
                required
              />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.all_day}
                onChange={(e) => update("all_day", e.target.checked)}
              />
              All day
            </label>
            <div className="flex items-center gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => update("color", color)}
                  className="h-7 w-7 rounded-full ring-offset-2"
                  style={{
                    backgroundColor: color,
                    boxShadow:
                      form.color === color
                        ? "0 0 0 2px white, 0 0 0 4px #0f172a"
                        : undefined,
                  }}
                  aria-label={color}
                />
              ))}
            </div>
            {savedUser.role != 20 && (
              <>
                <div className="space-y-2">
                  <Label>Resource</Label>
                  <select
                    value={form.resource_type}
                    onChange={(e) => update("resource_type", e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">Tanpa link</option>
                    <option value="course">Course</option>
                    <option value="module">Module</option>
                    <option value="lesson">Lesson</option>
                    <option value="quiz">Quiz</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Pilih Resource</Label>
                  <ResourceCombobox
                    resourceType={form.resource_type}
                    value={form.resource_id}
                    onChange={(resourceId) => update("resource_id", resourceId)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t bg-slate-50 px-5 py-3">
            <div className="flex gap-2">
              {onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDelete}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </Button>
              )}
              {onOpenResource && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onOpenResource}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Buka Halaman
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" disabled={saving || !form.title.trim()}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
