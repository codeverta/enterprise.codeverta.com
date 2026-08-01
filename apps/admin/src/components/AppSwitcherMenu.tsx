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

type AppSwitcherMenuProps = {
  children: React.ReactElement;
  onLogout: () => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
};

export default function AppSwitcherMenu({ children, onLogout, side = "bottom", align = "start" }: AppSwitcherMenuProps) {
  const navigate = useNavigate();

  const toggleFullWidth = () => {
    const enabled = document.documentElement.classList.toggle("erp-full-width");
    localStorage.setItem("erpFullWidth", String(enabled));
  };

  const toggleTheme = () => {
    const enabled = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", enabled ? "dark" : "light");
  };

  const websiteURL = String(import.meta.env.VITE_WEBSITE_URL || window.location.origin);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} sideOffset={8} className="z-[80] w-64 rounded-2xl p-2 shadow-xl">
        <DropdownMenuItem onSelect={() => navigate("/desk")} className="gap-3 rounded-xl px-3 py-2.5 text-base">
          <LayoutGrid className="size-5" /> Desktop
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-3 rounded-xl px-3 py-2.5 text-base">
            <MonitorUp className="size-5" /> Workspaces
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={10} className="z-[90] max-h-[70vh] w-64 overflow-y-auto rounded-2xl p-2 shadow-xl">
            {deskModules.filter((module) => !module.muted).map(({ name, slug, icon: Icon }) => (
              <DropdownMenuItem key={slug} onSelect={() => navigate(`/desk/${slug}`)} className="gap-3 rounded-xl px-3 py-2.5 text-base">
                <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500 text-white"><Icon className="size-4" /></span>
                {name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => window.open(websiteURL, "_blank", "noopener,noreferrer")} className="gap-3 rounded-xl px-3 py-2.5 text-base">
          <Globe2 className="size-5" /> Website
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem onSelect={() => navigate("/desk/erpnext-settings")} className="gap-3 rounded-xl px-3 py-2.5 text-base">
          <SlidersHorizontal className="size-5" /> Session Defaults
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.location.reload()} className="gap-3 rounded-xl px-3 py-2.5 text-base">
          <RotateCcw className="size-5" /> Reload
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleFullWidth} className="gap-3 rounded-xl px-3 py-2.5 text-base">
          <Maximize2 className="size-5" /> Toggle Full Width
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleTheme} className="gap-3 rounded-xl px-3 py-2.5 text-base">
          <Moon className="size-5" /> Toggle Theme
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/desk/erpnext-settings/system-settings")} className="gap-3 rounded-xl px-3 py-2.5 text-base">
          <CircleHelp className="size-5" /> Help
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem variant="destructive" onSelect={onLogout} className="gap-3 rounded-xl px-3 py-2.5 text-base">
          <LogOut className="size-5" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
