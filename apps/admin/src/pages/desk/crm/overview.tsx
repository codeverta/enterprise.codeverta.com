import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, CircleAlert, Sparkles, Target, UserCheck, UsersRound } from "lucide-react";
import { crmApi, CRMDashboard, CRMLead } from "@/lib/crm-api";
import { CRMPageHeader, leadStatuses, statusStyle } from "./shared";

const emptyDashboard: CRMDashboard = { total: 0, unassigned: 0, high_score: 0, by_status: [] };

export default function CRMDashboardPage() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([crmApi.dashboard(), crmApi.leads({ page_size: 100 })])
      .then(([summary, result]) => {
        setDashboard({ ...emptyDashboard, ...summary, by_status: summary?.by_status || [] });
        setLeads(result?.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const sources = useMemo(() => {
    const counts = leads.reduce<Record<string, number>>((result, lead) => {
      const source = lead.source || "unknown";
      result[source] = (result[source] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [leads]);

  const statusCount = (status: string) => (dashboard.by_status || []).find((item) => item.status === status)?.count || 0;
  const conversion = dashboard.total ? Math.round((statusCount("converted") / dashboard.total) * 100) : 0;
  const cards = [
    { label: "Total leads", value: dashboard.total, icon: UsersRound, tone: "bg-blue-50 text-blue-600" },
    { label: "High intent", value: dashboard.high_score, icon: Sparkles, tone: "bg-amber-50 text-amber-600" },
    { label: "Converted", value: statusCount("converted"), icon: UserCheck, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Unassigned", value: dashboard.unassigned, icon: CircleAlert, tone: "bg-rose-50 text-rose-600" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <CRMPageHeader title="CRM Overview" description="Pantau funnel prospek, kualitas lead, sumber akuisisi, dan kesiapan follow-up sales." actions={
        <Link to="/desk/crm/leads" className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Kelola leads <ArrowRight className="size-4" /></Link>
      } />
      <main className="space-y-6 p-6 lg:p-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon, tone }) => (
            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{loading ? "—" : value}</p></div>
                <span className={`flex size-11 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" /></span>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Lead funnel</h2><p className="mt-1 text-sm text-slate-500">Distribusi lead berdasarkan tahapan saat ini.</p></div><div className="text-right"><p className="text-2xl font-bold text-emerald-600">{conversion}%</p><p className="text-xs text-slate-500">conversion</p></div></div>
            <div className="mt-7 space-y-4">
              {leadStatuses.map(({ value, label }) => {
                const count = statusCount(value);
                const width = dashboard.total ? Math.max(3, (count / dashboard.total) * 100) : 0;
                return <div key={value}><div className="mb-1.5 flex justify-between text-sm"><span className="font-medium text-slate-700">{label}</span><span className="text-slate-500">{count}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${statusStyle[value].split(" ")[0].replace("50", "500")}`} style={{ width: `${width}%` }} /></div></div>;
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Target className="size-5" /></span><div><h2 className="font-bold text-slate-900">Top lead sources</h2><p className="text-sm text-slate-500">Dari 100 lead terbaru.</p></div></div>
            <div className="mt-6 space-y-4">
              {sources.length ? sources.map(([source, count], index) => <div key={source} className="flex items-center gap-3"><span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-medium capitalize text-slate-700">{source.replaceAll("_", " ")}</span><span className="text-sm font-bold text-slate-900">{count}</span></div>) : <p className="py-10 text-center text-sm text-slate-400">Belum ada data sumber lead.</p>}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
