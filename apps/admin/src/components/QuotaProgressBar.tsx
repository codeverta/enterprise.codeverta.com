"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

export default function QuotaProgressBar(settings) {
  const data = settings.data;

  // Hindari pembagian dengan 0
  const percentage =
    data.email_quota > 0
      ? Math.round((data.email_used / data.email_quota) * 100)
      : 0;
  console.log(percentage);

  // Tentukan warna bar berdasarkan level
  const getProgressColor = (pct: number) => {
    if (pct >= 90) return "bg-red-500"; // Kritis
    if (pct >= 75) return "bg-yellow-500"; // Warning
    return "bg-blue-600"; // Aman - TAMBAHKAN RETURN INI
  };

  if (data.loading)
    return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-sm font-medium text-gray-700">
        <span>Email Quota Usage</span>
        <span>{percentage}%</span>
      </div>

      {/* Component Progress Shadcn */}
      <Progress
        value={percentage}
        className="h-2 w-full bg-gray-200"
        indicatorClassName={getProgressColor(percentage)}
      />

      <div className="flex justify-between text-xs text-gray-500">
        <span>Terpakai: {data.email_used}</span>
        <span>Limit: {data.email_quota}</span>
      </div>
    </div>
  );
}
