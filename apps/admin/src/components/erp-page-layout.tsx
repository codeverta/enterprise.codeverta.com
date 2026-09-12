import React from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

export function ERPPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-full bg-slate-50/60">
      <div className={cn("mx-auto w-full max-w-screen-2xl space-y-6 p-4 lg:p-7", className)}>{children}</div>
    </div>
  );
}

export function ERPPageHeader({
  title,
  description,
  breadcrumbs,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950", className)}>
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && <span aria-hidden="true">/</span>}
                {crumb.href ? <Link to={crumb.href} className="hover:text-blue-600">{crumb.label}</Link> : <span className="font-semibold text-slate-900 dark:text-slate-100">{crumb.label}</span>}
              </React.Fragment>
            ))}
          </nav>
        ) : eyebrow ? <p className="mb-1 text-sm font-medium text-slate-500">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">{title}</h1>
        {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
