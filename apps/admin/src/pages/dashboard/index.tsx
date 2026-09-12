import React, { useEffect, useState } from "react";
import { Activity, BadgePercent, Bell, CreditCard, Users } from "lucide-react";
import DashboardLayout from "../../layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/lib/api";

const cards = [
  { key: "users", label: "Pengguna", icon: Users },
  { key: "subscriptions", label: "Langganan", icon: CreditCard },
  { key: "promos", label: "Promo aktif", icon: BadgePercent },
  { key: "notifications", label: "Notifikasi", icon: Bell },
];

function DashboardPage() {
  const [summary, setSummary] = useState({});
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    api.get("/core/dashboard").then((response) => {
      setSummary(response.data?.data || response.data || {});
    }).catch(() => setSummary({}));
  }, []);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-6 lg:p-8">
      <div>
        <p className="text-sm font-medium text-blue-600">Codeverta Enterprise System</p>
        <h1 className="text-3xl font-bold tracking-tight">Selamat bekerja, {user.display_name || user.username || "Pengguna"}</h1>
        <p className="mt-2 text-slate-500">Kelola layanan inti lintas modul ERP dari satu tempat.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ key, label, icon: Icon }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="size-4 text-slate-500" />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{summary[key] ?? "—"}</div></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-sm text-slate-600">
          <Activity className="size-5 text-emerald-600" />
          Fondasi ERP aktif. Tambahkan modul inventory, purchasing, accounting, atau HR sebagai modul terpisah.
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardLayout(DashboardPage);
