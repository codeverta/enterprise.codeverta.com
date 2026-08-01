import React from "react";
import { CRMLead, LeadStatus } from "@/lib/crm-api";

export const leadStatuses: Array<{ value: LeadStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "unqualified", label: "Unqualified" },
  { value: "converted", label: "Converted" },
];

export const statusStyle: Record<LeadStatus, string> = {
  new: "bg-blue-50 text-blue-700 ring-blue-600/10",
  contacted: "bg-violet-50 text-violet-700 ring-violet-600/10",
  qualified: "bg-amber-50 text-amber-700 ring-amber-600/10",
  unqualified: "bg-slate-100 text-slate-600 ring-slate-500/10",
  converted: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyle[status] || statusStyle.new}`}>{leadStatuses.find((item) => item.value === status)?.label || status}</span>;
}

export function ScoreBadge({ score }: { score: number }) {
  const style = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-slate-400";
  return (
    <div className="flex items-center gap-2" title={`Lead score ${score}/100`}>
      <span className={`flex size-9 items-center justify-center rounded-full text-xs font-bold text-white ${style}`}>{score}</span>
      <div className="hidden w-14 overflow-hidden rounded-full bg-slate-100 xl:block">
        <div className={`h-1.5 ${style}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
    </div>
  );
}

export const emptyLead: Partial<CRMLead> = {
  name: "", email: "", phone: "", company_name: "", source: "website",
  source_detail: "", region: "", product_interest: "", status: "new", notes: "",
  utm_source: "", utm_medium: "", utm_campaign: "", gclid: "", fbclid: "", ttclid: "",
};

export function CRMPageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">{eyebrow || "CRM"}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

