import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";

export interface ReportViewProps<TData> {
  title: string;
  description?: string;
  data: TData[];
  columns: ColumnDef<TData>[];
  loading?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  onRefresh?: () => void;
  getRowId?: (row: TData, index: number) => string;
}

export function ReportView<TData>({
  title,
  description,
  data,
  columns,
  loading = false,
  searchPlaceholder,
  emptyMessage,
  filters,
  actions,
  onRefresh,
  getRowId,
}: ReportViewProps<TData>) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
      <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>}
          {actions}
        </div>
      </header>
      {filters && <div className="border-b bg-slate-50/60 px-5 py-4 dark:bg-slate-900/40">{filters}</div>}
      <div className="p-5">
        <DataTable columns={columns} data={data} loading={loading} getRowId={getRowId} searchPlaceholder={searchPlaceholder} emptyMessage={emptyMessage} />
      </div>
    </section>
  );
}

export default ReportView;
