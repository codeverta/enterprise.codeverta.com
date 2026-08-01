import React from 'react'

/** Stat card */
function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className={`rounded-xl border bg-card p-4 flex items-center gap-3 ${accent}`}>
      <div className="rounded-lg bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default StatCard