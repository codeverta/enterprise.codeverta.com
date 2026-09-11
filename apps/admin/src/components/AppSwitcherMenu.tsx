import React from "react";
import { useNavigate } from "react-router";
import {
  CircleHelp,
  Globe2,
  LayoutGrid,
  LogOut,
  Maximize2,
  MonitorUp,
  Moon,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deskModules } from "@/lib/erp-desk";
import { useLanguage } from "@/context/LanguageContext";
import { getNavigationLabel } from "@/lib/navigation-i18n";

type AppSwitcherMenuProps = {
  children: React.ReactElement;
  onLogout: () => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
};

const moduleIconStyles = [
  "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300",
];

export default function AppSwitcherMenu({
  children,
  onLogout,
  side = "bottom",
  align = "start",
}: AppSwitcherMenuProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const toggleFullWidth = () => {
    const enabled = document.documentElement.classList.toggle("erp-full-width");
    localStorage.setItem("erpFullWidth", String(enabled));
  };

  const toggleTheme = () => {
    const enabled = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", enabled ? "dark" : "light");
  };

  const websiteURL = String(
    import.meta.env.VITE_WEBSITE_URL || window.location.origin,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={8}
        className="z-[80] w-64 rounded-2xl p-2 shadow-xl"
      >
        <DropdownMenuItem
          onSelect={() => navigate("/desk")}
          className="gap-3 rounded-xl px-3 py-2.5 text-base"
        >
          <LayoutGrid className="size-5" /> {t("appSwitcher.dashboard")}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-3 rounded-xl px-3 py-2.5 text-base hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:text-blue-700 data-[state=open]:bg-blue-50 data-[state=open]:text-blue-700">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 transition-colors">
              <MonitorUp className="size-4 text-blue-700" />
            </span>
            <span className="truncate">{t("appSwitcher.modules")}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            sideOffset={10}
            className="z-[90] max-h-[70vh] w-64 overflow-y-auto rounded-2xl p-2 shadow-xl"
          >
            {deskModules
              .filter((module) => !module.muted)
              .map(({ name, slug, icon: Icon }, index) => (
                <DropdownMenuItem
                  key={slug}
                  onSelect={() => navigate(`/desk/${slug}`)}
                  className="group gap-3 rounded-xl px-3 py-2.5 text-base"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm transition-transform group-focus:scale-105 ${moduleIconStyles[index % moduleIconStyles.length]}`}
                  >
                    <Icon className="size-4 text-current" />
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={getNavigationLabel(t, name)}>
                    {getNavigationLabel(t, name)}
                  </span>
                </DropdownMenuItem>
              ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          onSelect={() =>
            window.open(websiteURL, "_blank", "noopener,noreferrer")
          }
          className="gap-3 rounded-xl px-3 py-2.5 text-base"
        >
          <Globe2 className="size-5" /> {t("appSwitcher.website")}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem
          onSelect={() => navigate("/desk/erpnext-settings")}
          className="gap-3 rounded-xl px-3 py-2.5 text-base"
        >
          <SlidersHorizontal className="size-5" /> {t("appSwitcher.sessionDefaults")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => window.location.reload()}
          className="gap-3 rounded-xl px-3 py-2.5 text-base"
        >
          <RotateCcw className="size-5" /> {t("appSwitcher.reload")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={toggleFullWidth}
          className="gap-3 rounded-xl px-3 py-2.5 text-base"
        >
          <Maximize2 className="size-5" /> {t("appSwitcher.width")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={toggleTheme}
          className="gap-3 rounded-xl px-3 py-2.5 text-base"
        >
          <Moon className="size-5" /> {t("appSwitcher.theme")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => navigate("/desk/erpnext-settings/system-settings")}
          className="gap-3 rounded-xl px-3 py-2.5 text-base"
        >
          <CircleHelp className="size-5" /> {t("appSwitcher.help")}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem
          variant="destructive"
          onSelect={onLogout}
          className="gap-3 rounded-xl px-3 py-2.5 text-base"
        >
          <LogOut className="size-5" /> {t("appSwitcher.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
