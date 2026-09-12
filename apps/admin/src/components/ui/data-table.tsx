"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDownWideNarrow, ChevronDown, ListFilter, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DataTableColumnMeta = {
  label?: string;
  headerClassName?: string;
  cellClassName?: string;
};

type FilterOperator = "contains" | "equals" | "startsWith" | "greaterThan" | "lessThan";
type FilterValue = { operator: FilterOperator; value: string };

export interface DataTableProps<TData, TValue = unknown> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  toolbar?: boolean;
  pagination?: boolean;
  pageSize?: number;
  className?: string;
  tableClassName?: string;
  getRowId?: (row: TData, index: number) => string;
  onRowClick?: (row: TData) => void;
}

const smartFilter = (row: any, columnId: string, filter: FilterValue | string) => {
  const raw = row.getValue(columnId);
  const actual = String(raw ?? "").toLocaleLowerCase();
  const config: FilterValue = typeof filter === "string" ? { operator: "contains", value: filter } : filter;
  const expected = String(config?.value ?? "").toLocaleLowerCase();
  if (!expected) return true;
  if (config.operator === "equals") return actual === expected;
  if (config.operator === "startsWith") return actual.startsWith(expected);
  if (config.operator === "greaterThan") return Number(raw) > Number(config.value);
  if (config.operator === "lessThan") return Number(raw) < Number(config.value);
  return actual.includes(expected);
};

export function DataTable<TData, TValue = unknown>({
  columns,
  data,
  searchPlaceholder = "Cari di semua kolom...",
  emptyMessage = "Tidak ada data.",
  toolbar = true,
  pagination = true,
  pageSize = 10,
  className,
  tableClassName,
  getRowId,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [filterOpen, setFilterOpen] = React.useState(false);

  const filterableColumns = React.useMemo(
    () => columns.filter((column: any) => column.enableColumnFilter !== false && (column.accessorKey || column.id)),
    [columns],
  );
  const sortableColumns = React.useMemo(
    () => columns.filter((column: any) => column.enableSorting !== false && (column.accessorKey || column.id)),
    [columns],
  );
  const normalizedColumns = React.useMemo(() => columns.map((column) => ({ filterFn: smartFilter, ...column })), [columns]);

  const table = useReactTable({
    data,
    columns: normalizedColumns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(pagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    initialState: { pagination: { pageSize } },
    state: { sorting, columnFilters, globalFilter },
  });

  const addFilter = () => {
    const first = filterableColumns.find((column: any) => !columnFilters.some((filter) => filter.id === (column.accessorKey || column.id))) as any;
    const id = first?.accessorKey || first?.id;
    if (id) setColumnFilters((current) => [...current, { id, value: { operator: "contains", value: "" } }]);
  };
  const updateFilter = (index: number, patch: Partial<FilterValue> & { id?: string }) => {
    setColumnFilters((current) => current.map((filter, filterIndex) => {
      if (filterIndex !== index) return filter;
      const value = (filter.value || { operator: "contains", value: "" }) as FilterValue;
      return { id: patch.id || filter.id, value: { ...value, ...patch } };
    }));
  };
  const hasFooter = table.getFooterGroups().some((group) => group.headers.some((header) => Boolean(header.column.columnDef.footer)));

  return (
    <div className={cn("space-y-3", className)}>
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input aria-label="Search table" value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder={searchPlaceholder} className="h-10 rounded-xl bg-slate-50 pl-9" />
          </div>
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button aria-label="Filter" variant="outline" className="h-10 rounded-xl bg-slate-50" onClick={() => { if (columnFilters.length === 0) addFilter(); }}>
                <ListFilter className="size-4" /> Filter
                {columnFilters.length > 0 && <span className="rounded-full bg-slate-900 px-1.5 text-[10px] text-white">{columnFilters.length}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(520px,calc(100vw-2rem))] rounded-xl p-3 shadow-lg">
              <div className="space-y-3">
                {columnFilters.map((filter, index) => {
                  const value = filter.value as FilterValue;
                  return (
                    <div key={`${filter.id}-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_32px]">
                      <Select value={filter.id} onValueChange={(selected) => updateFilter(index, { id: selected })}>
                        <SelectTrigger aria-label="Filter column" className="h-9 min-w-0 rounded-lg bg-slate-50 px-2.5"><SelectValue /></SelectTrigger>
                        <SelectContent>{filterableColumns.map((column: any) => { const id = column.accessorKey || column.id; return <SelectItem key={id} value={id}>{column.meta?.label || (typeof column.header === "string" ? column.header : id)}</SelectItem>; })}</SelectContent>
                      </Select>
                      <Select value={value.operator} onValueChange={(selected) => updateFilter(index, { operator: selected as FilterOperator })}>
                        <SelectTrigger aria-label="Filter operator" className="h-9 min-w-0 rounded-lg bg-slate-50 px-2.5"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="contains">Contains</SelectItem><SelectItem value="equals">Equals</SelectItem><SelectItem value="startsWith">Starts with</SelectItem><SelectItem value="greaterThan">Greater than</SelectItem><SelectItem value="lessThan">Less than</SelectItem></SelectContent>
                      </Select>
                      <Input aria-label="Filter value" value={value.value} onChange={(event) => updateFilter(index, { value: event.target.value })} className="h-9 min-w-0 rounded-lg bg-slate-50" placeholder="Nilai filter" />
                      <Button aria-label="Hapus filter" size="icon" variant="ghost" className="size-8" onClick={() => setColumnFilters((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X className="size-4" /></Button>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between border-t pt-3">
                  <Button variant="ghost" onClick={addFilter} disabled={columnFilters.length >= filterableColumns.length}><Plus className="size-4" /> Add a Filter</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setColumnFilters([])}>Clear Filters</Button>
                    <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => setFilterOpen(false)}>Apply Filters</Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex h-10 items-center rounded-xl border bg-slate-50">
            <ArrowDownWideNarrow className="ml-3 size-4 text-slate-600" />
            <Select value={sorting[0]?.id || "none"} onValueChange={(selected) => setSorting(selected === "none" ? [] : [{ id: selected, desc: sorting[0]?.desc ?? true }])}>
              <SelectTrigger aria-label="Sort table" className="h-full min-w-32 border-0 bg-transparent px-2 shadow-none"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent align="end"><SelectItem value="none">Sort</SelectItem>{sortableColumns.map((column: any) => { const id = column.accessorKey || column.id; return <SelectItem key={id} value={id}>{column.meta?.label || (typeof column.header === "string" ? column.header : id)}</SelectItem>; })}</SelectContent>
            </Select>
            {sorting[0] && <Button aria-label="Ubah arah sort" size="icon" variant="ghost" className="size-9 border-l" onClick={() => setSorting([{ ...sorting[0], desc: !sorting[0].desc }])}><ChevronDown className={cn("size-4 transition", !sorting[0].desc && "rotate-180")} /></Button>}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border">
        <Table className={cn("text-left text-xs", tableClassName)}>
          <TableHeader className="bg-slate-50 text-slate-600 dark:bg-slate-900">
            {table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id} disableHover>{headerGroup.headers.map((header) => {
              const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
              return <TableHead key={header.id} className={cn("h-10 px-3 text-xs font-semibold", meta?.headerClassName)}>{header.isPlaceholder ? null : <button type="button" disabled={!header.column.getCanSort()} onClick={header.column.getToggleSortingHandler()} className="inline-flex items-center gap-1.5 disabled:cursor-default">{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() && <ChevronDown className={cn("size-3.5", header.column.getIsSorted() === "asc" && "rotate-180")} />}</button>}</TableHead>;
            })}</TableRow>)}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id} onClick={() => onRowClick?.(row.original)} className={cn(onRowClick && "cursor-pointer")}>{row.getVisibleCells().map((cell) => {
              const meta = cell.column.columnDef.meta as DataTableColumnMeta | undefined;
              return <TableCell key={cell.id} className={cn("px-3 py-2.5", meta?.cellClassName)}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>;
            })}</TableRow>) : <TableRow disableHover><TableCell colSpan={columns.length} className="h-24 text-center text-slate-500">{emptyMessage}</TableCell></TableRow>}
          </TableBody>
          {hasFooter && <TableFooter>{table.getFooterGroups().map((footerGroup) => <TableRow key={footerGroup.id} disableHover>{footerGroup.headers.map((header) => <TableCell key={header.id} className="px-3 py-3">{header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}</TableCell>)}</TableRow>)}</TableFooter>}
        </Table>
      </div>
      {pagination && table.getPageCount() > 1 && <div className="flex items-center justify-between text-xs text-slate-500"><span>{table.getFilteredRowModel().rows.length} data</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button><span>{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span><Button size="sm" variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button></div></div>}
    </div>
  );
}

export type { ColumnDef };
