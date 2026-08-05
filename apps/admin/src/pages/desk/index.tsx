import React, { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { Bell, ChevronLeft, LogOut, Search, Users } from "lucide-react";
import { accountingMenus, deskModules, hrSubmodules, isAdminRole } from "@/lib/erp-desk";
import { clearImpersonationStorage } from "@/lib/impersonation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const normalize = (value: string) => value.trim().toLocaleLowerCase("id-ID");

type DeskUser = {
  display_name?: string;
  username?: string;
  email?: string;
  role?: number;
};

type DeskHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  user: DeskUser | null;
  onLogout: () => void;
};

function BrandMark() {
  return (
    <Link to="/desk" aria-label="Codeverta ERP home" className="flex items-center gap-0.5">
      <span className="h-3 w-2 skew-x-[-24deg] rounded-sm bg-sky-600" />
      <span className="h-4 w-2 skew-x-[24deg] rounded-sm bg-blue-400" />
      <span className="h-2.5 w-2 skew-x-[-24deg] rounded-sm bg-sky-300" />
    </Link>
  );
}

function DeskHeader({ query, onQueryChange, user, onLogout }: DeskHeaderProps) {
  const initial = (user?.display_name || user?.username || user?.email || "A").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200 bg-white px-5 md:px-8">
      <BrandMark />
      <div className="mx-auto w-full max-w-sm px-6">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Cari modul, transaksi, master data..."
            aria-label="Cari modul"
            className="h-10 w-full rounded-xl border-0 bg-slate-100 pl-9 pr-14 text-sm text-slate-800 outline-none ring-blue-500 placeholder:text-slate-500 focus:ring-2"
          />
          <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 text-xs text-slate-400 sm:block">⌘K</span>
        </label>
      </div>
      <div className="flex items-center gap-4">
        <button type="button" aria-label="Notifications" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
          <Bell className="size-5" />
        </button>
        <button
          type="button"
          onClick={onLogout}
          title="Logout"
          aria-label="Logout"
          className="group relative flex size-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-medium text-emerald-700"
        >
          <span className="group-hover:hidden">{initial}</span>
          <LogOut className="hidden size-4 group-hover:block" />
        </button>
      </div>
    </header>
  );
}

function ModuleLauncher({ query }: { query: string }) {
  const navigate = useNavigate();
  const [selectedModuleDialog, setSelectedModuleDialog] = useState<string | null>(null);

  const visibleModules = useMemo(() => {
    const term = normalize(query);
    return term ? deskModules.filter((module) => normalize(module.name).includes(term)) : deskModules;
  }, [query]);

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10 md:py-14">
        {visibleModules.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {visibleModules.map(({ name, slug, icon: Icon, muted }) => (
              <button
                key={slug}
                type="button"
                onClick={() => {
                  if (slug === "hr") {
                    setSelectedModuleDialog("hr");
                  } else {
                    navigate(`/desk/${slug}`);
                  }
                }}
                className="group flex min-w-0 flex-col items-center gap-2 text-center cursor-pointer"
              >
                <span
                  className={`flex size-16 items-center justify-center rounded-2xl transition group-hover:-translate-y-1 group-hover:shadow-lg ${
                    muted ? "bg-slate-500" : "bg-blue-500"
                  }`}
                >
                  <Icon className="size-8 text-white" strokeWidth={2.2} />
                </span>
                <span className="text-sm font-semibold leading-tight text-slate-700 group-hover:text-blue-600">
                  {name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="py-20 text-center text-sm text-slate-500">No modules match “{query}”.</p>
        )}
      </main>

      <Dialog open={selectedModuleDialog === "hr"} onOpenChange={(open) => !open && setSelectedModuleDialog(null)}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 sm:p-8">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Users className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">Human Resources (HR)</DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  Pilih item/module HR untuk membuka desk & sidebar workspace
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {hrSubmodules.map(({ name, href, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setSelectedModuleDialog(null);
                  navigate(href);
                }}
                className="group flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm cursor-pointer"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-xs transition group-hover:bg-blue-600 group-hover:text-white">
                  <Icon className="size-5" />
                </span>
                <span className="text-sm font-semibold text-slate-800 transition group-hover:text-blue-600">
                  {name}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HRLauncher({ query }: { query: string }) {
  const visibleMenus = useMemo(() => {
    const term = normalize(query);
    return term ? hrSubmodules.filter((menu) => normalize(menu.name).includes(term)) : hrSubmodules;
  }, [query]);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
      <Link to="/desk" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600">
        <ChevronLeft className="size-4" /> All modules
      </Link>
      <div className="mb-10">
        <p className="text-sm font-medium text-blue-600">Module</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Human Resources (HR)</h1>
      </div>
      {visibleMenus.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleMenus.map(({ name, href, icon: Icon }) => (
            <Link
              key={name}
              to={href}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-500 group-hover:text-white">
                <Icon className="size-6" />
              </span>
              <span className="font-semibold text-slate-800 group-hover:text-blue-600">{name}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-20 text-center text-sm text-slate-500">No HR items match “{query}”.</p>
      )}
    </main>
  );
}

function AccountingLauncher({ query }: { query: string }) {
  const visibleMenus = useMemo(() => {
    const term = normalize(query);
    return term ? accountingMenus.filter((menu) => normalize(menu.name).includes(term)) : accountingMenus;
  }, [query]);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
      <Link to="/desk" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600">
        <ChevronLeft className="size-4" /> All modules
      </Link>
      <div className="mb-10">
        <p className="text-sm font-medium text-blue-600">Module</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Accounting</h1>
      </div>
      {visibleMenus.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleMenus.map(({ name, href, icon: Icon }) => (
            <a key={name} href={href} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-500 group-hover:text-white">
                <Icon className="size-6" />
              </span>
              <span className="font-semibold text-slate-800 group-hover:text-blue-600">{name}</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="py-20 text-center text-sm text-slate-500">No Accounting menus match “{query}”.</p>
      )}
    </main>
  );
}

function ModulePlaceholder({ slug }: { slug: string }) {
  const module = deskModules.find((item) => item.slug === slug);
  if (!module) return <Navigate to="/desk" replace />;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14">
      <Link to="/desk" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600">
        <ChevronLeft className="size-4" /> All modules
      </Link>
      <h1 className="text-3xl font-bold text-slate-900">{module.name}</h1>
      <p className="mt-2 text-slate-500">This ERP module is ready to be configured.</p>
    </main>
  );
}

export default function DeskPage() {
  const { "*": slug = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  let user: DeskUser | null = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }

  if (!isAdminRole(user?.role)) return <Navigate to="/dashboard" replace />;

  const logout = () => {
    clearImpersonationStorage();
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    navigate("/");
  };

  const activeSlug = slug.split("/")[0];
  const isHR = activeSlug === "hr";
  const isAccounting = activeSlug === "accounting";
  const isRoot = location.pathname === "/desk" || location.pathname === "/desk/";

  return (
    <div className="min-h-screen bg-white">
      <DeskHeader query={query} onQueryChange={setQuery} user={user} onLogout={logout} />
      {isRoot ? (
        <ModuleLauncher query={query} />
      ) : isHR ? (
        <HRLauncher query={query} />
      ) : isAccounting ? (
        <AccountingLauncher query={query} />
      ) : (
        <ModulePlaceholder slug={activeSlug} />
      )}
    </div>
  );
}
