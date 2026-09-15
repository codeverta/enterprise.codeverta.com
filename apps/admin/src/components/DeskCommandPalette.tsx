import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  accountingMenus,
  accountingSubmodules,
  deskModules,
  hrSubmodules,
} from "@/lib/erp-desk";
import { erpWorkspaces, type WorkspaceNavigationItem } from "@/lib/erp-workspaces";
import { useLanguage } from "@/context/LanguageContext";
import { getNavigationLabel } from "@/lib/navigation-i18n";
import { useCommandPaletteStore } from "@/store/useCommandPaletteStore";
import { canAccessModule, canSeeDeskMenu, useMyPermissions } from "@/lib/dynamic-permissions";

const normalize = (value: string) => value.trim().toLocaleLowerCase("id-ID");

export type SearchResult = {
  type: "module" | "feature";
  name: string;
  href: string;
  moduleName: string;
  moduleSlug: string;
  icon: any;
};

function collectNavigationItems(items: WorkspaceNavigationItem[]): WorkspaceNavigationItem[] {
  return items.flatMap((item) => [item, ...(item.items ? collectNavigationItems(item.items) : [])]);
}

export function buildSearchResults(): SearchResult[] {
  const modules = deskModules.map((module) => ({
    type: "module" as const,
    name: module.name,
    href: module.slug === "hr" ? "/desk/hr" : `/desk/${module.slug}`,
    moduleName: module.name,
    moduleSlug: module.slug,
    icon: module.icon,
  }));

  const workspaceFeatures = Object.values(erpWorkspaces).flatMap((workspace) =>
    collectNavigationItems(workspace.navigation)
      .filter((item) => item.name !== "Home")
      .map((item) => ({
        type: "feature" as const,
        name: item.name,
        href: item.href,
        moduleName: workspace.name,
        moduleSlug: workspace.slug,
        icon: item.icon,
      })),
  );

  const hrFeatures = hrSubmodules.map((item) => ({
    type: "feature" as const,
    name: item.name,
    href: item.href,
    moduleName: "Human Resources (HR)",
    moduleSlug: "hr",
    icon: item.icon,
  }));

  const accountingFeatures = [
    ...accountingMenus.map((item) => ({
      type: "feature" as const,
      name: item.name,
      href: item.href,
      moduleName: "Akuntansi & Keuangan",
      moduleSlug: "accounting",
      icon: item.icon,
    })),
    ...accountingSubmodules.map((item) => ({
      type: "feature" as const,
      name: item.name,
      href: item.href,
      moduleName: "Akuntansi & Keuangan",
      moduleSlug: "accounting",
      icon: item.icon,
    })),
  ];

  const deduped = new Map<string, SearchResult>();
  [...modules, ...workspaceFeatures, ...hrFeatures, ...accountingFeatures].forEach((item) => {
    const key = `${item.type}:${item.moduleSlug}:${item.href}:${item.name}`;
    if (!deduped.has(key)) deduped.set(key, item);
  });
  return [...deduped.values()];
}

export interface DeskCommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeskCommandPalette({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: DeskCommandPaletteProps = {}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const navigationLabel = (item: { name: string } | string) => getNavigationLabel(t, item);

  const store = useCommandPaletteStore();
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : store.isOpen;
  const onOpenChange = controlledOnOpenChange || store.setOpen;

  const [query, setQuery] = useState("");
  let user = null;
  try { user = JSON.parse(localStorage.getItem("user") || "null"); } catch { user = null; }
  const legacyAdmin = Number(user?.role || 0) >= 99;
  const { data: permissions } = useMyPermissions(!legacyAdmin);
  const searchResults = useMemo(() => buildSearchResults(), []);
  const allowedSearchResults = searchResults.filter((item) => legacyAdmin || (item.type === "module"
    ? canAccessModule(permissions, item.moduleSlug, erpWorkspaces[item.moduleSlug])
    : canSeeDeskMenu(permissions, item.href)));
  const term = normalize(query);

  const matches = (item: SearchResult) =>
    [
      navigationLabel(item.name),
      navigationLabel(item.moduleName),
      item.name,
      item.moduleName,
      item.moduleSlug,
      item.type === "module"
        ? "modul workspace aplikasi"
        : "fitur menu laporan dokumen master data transaksi",
    ]
      .map(normalize)
      .some((value) => value.includes(term));

  const visibleModules = allowedSearchResults.filter(
    (item) => item.type === "module" && (!term || matches(item)),
  );
  const visibleFeatures = allowedSearchResults
    .filter((item) => item.type === "feature" && (term ? matches(item) : false))
    .slice(0, 36);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  const goTo = (href: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(href);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <DialogContent
        className="!top-[12%] max-w-[calc(100%-1.5rem)] !translate-y-0 gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-2xl sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Pencarian cepat</DialogTitle>
          <DialogDescription>Cari dan buka modul atau fitur ERP.</DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false} className="rounded-2xl bg-white">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Ketik nama modul, dokumen, atau laporan..."
            className="h-14 text-[15px]"
          />
          <CommandList className="max-h-[min(58vh,520px)] p-2">
            <CommandEmpty className="py-14 text-center text-sm">
              <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Search className="size-5" />
              </div>
              <p className="font-medium text-slate-700">Tidak ada hasil ditemukan</p>
              <p className="mt-1 text-xs text-slate-400">
                Coba gunakan kata kunci yang lebih singkat.
              </p>
            </CommandEmpty>

            {visibleModules.length > 0 && (
              <CommandGroup
                heading={term ? "Modul" : "Semua modul"}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {visibleModules.map(({ name, href, icon: Icon }) => (
                  <CommandItem
                    key={`module-${href}`}
                    value={`module-${href}-${name}`}
                    onSelect={() => goTo(href)}
                    className="group rounded-xl px-3 py-3 data-[selected=true]:bg-violet-50 data-[selected=true]:text-violet-950"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-violet-600 shadow-xs group-data-[selected=true]:border-violet-200">
                      <Icon className="size-4.5" />
                    </span>
                    <span className="font-medium">{navigationLabel(name)}</span>
                    <CommandShortcut className="normal-case tracking-normal text-slate-400">
                      Modul
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {visibleModules.length > 0 && visibleFeatures.length > 0 && (
              <CommandSeparator className="my-2" />
            )}

            {visibleFeatures.length > 0 && (
              <CommandGroup
                heading="Fitur & dokumen"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {visibleFeatures.map(
                  ({ name, href, icon: Icon, moduleName }, index) => (
                    <CommandItem
                      key={`feature-${href}-${name}-${index}`}
                      value={`feature-${href}-${name}-${moduleName}-${index}`}
                      onSelect={() => goTo(href)}
                      className="group rounded-xl px-3 py-3 data-[selected=true]:bg-violet-50 data-[selected=true]:text-violet-950"
                    >
                      <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-data-[selected=true]:bg-white group-data-[selected=true]:text-violet-600">
                        <Icon className="size-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {navigationLabel(name)}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {navigationLabel(moduleName)}
                        </span>
                      </span>
                    </CommandItem>
                  ),
                )}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[11px] text-slate-400">
            <span>
              {term
                ? `${visibleModules.length + visibleFeatures.length} hasil`
                : "Ketik untuk mencari semua fitur"}
            </span>
            <span className="hidden items-center gap-3 sm:flex">
              <span>↑↓ navigasi</span>
              <span>↵ buka</span>
              <span>esc tutup</span>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export default DeskCommandPalette;
