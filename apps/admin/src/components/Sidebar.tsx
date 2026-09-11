import React, { useState, useMemo, useEffect } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  LogOut,
  UserCircle,
  PanelLeftClose,
  PanelRightClose,
  Info,
  Eye,
  EyeOff,
  History,
  Settings,
  Lock,
  Boxes,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";
import clsx from "clsx";
import { Badge } from "../components/ui/badge";
import { version } from "../../package.json";
import { Helmet } from "react-helmet";
import useReportStore from "../store/useReportStore";
import api from "@/lib/api";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useSettingsStore } from "../store/useSettingsStore";
import RightSidebar from "./RightSidebar";
import { BASE_STORAGE_URL, DEFAULT_APP_LOGO, getStorageUrl } from "@/lib/utils";
import NotificationBell from "./dashboard/NotificationBell";
import SystemSettings from "./dashboard/SystemSettings";
import AppSwitcherMenu from "./AppSwitcherMenu";
import { useLanguage } from "@/context/LanguageContext";
import { getNavigationLabel } from "@/lib/navigation-i18n";

// --- MODAL EDIT PROFIL ---
const EditProfileModal = ({ user, isOpen, onClose, onSave }) => {
  const [username, setUsername] = useState(user?.display_name || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSave = () => {
    onSave({ name: username, email: user?.email, password });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profil</DialogTitle>
          <DialogDescription>
            Perbarui informasi akun Anda. Klik simpan setelah selesai.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="email" className="text-right">
              Email
            </label>
            <Input
              id="email"
              value={user?.email || ""}
              className="col-span-3"
              disabled
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="username" className="text-right">
              Username
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="password" className="text-right">
              Password
            </label>
            <div className="relative col-span-3">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave}>Simpan Perubahan</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AppVersion = () => {
  return (
    <div>
      <Badge variant="outline">v{version}</Badge>
    </div>
  );
};

// --- KOMPONEN SIDEBAR ---
const Sidebar = ({
  user,
  onLogout,
  isOpen,
  onToggle,
  items,
  basePath = "/dashboard",
  navigationState,
  defaultOpenAll = false,
  openMenusStorageKey = "sidebarOpenMenus",
  moduleLabel = "Core",
}) => {
  const [openMenus, setOpenMenus] = useState(() => {
    try {
      const saved = localStorage.getItem(openMenusStorageKey);
      return saved
        ? JSON.parse(saved)
        : defaultOpenAll
          ? items.filter((item) => item.items).map((item) => item.name)
          : [];
    } catch {
      return [];
    }
  });
  const location = useLocation();
  const resolveHref = (href) => `${basePath}${href}`;
  const { newReportsCount } = useReportStore();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { settings, fetchSettings } = useSettingsStore();
  const { t } = useLanguage();
  const navigationLabel = (item) => getNavigationLabel(t, item);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(openMenusStorageKey, JSON.stringify(openMenus));
    } catch {}
  }, [openMenus, openMenusStorageKey]);

  useEffect(() => {
    const currentPath = location.pathname;
    const activeParentMenu = items.find((item) =>
      item.items?.some((subItem) =>
        currentPath.startsWith(resolveHref(subItem.href)),
      ),
    );
    if (activeParentMenu) {
      setOpenMenus((prev) =>
        prev.includes(activeParentMenu.name)
          ? prev
          : [...prev, activeParentMenu.name],
      );
    }
  }, [location.pathname, items]);

  // Mapping Role ID ke Label & Warna
  const roleInfo = useMemo(() => {
    switch (user?.role) {
      case 100:
        return {
          label: "Superadmin",
          color: "bg-purple-100 text-purple-700 border-purple-200",
        };
      case 99:
        return {
          label: "Admin",
          color: "bg-blue-100 text-blue-700 border-blue-200",
        };
      case 40:
        return {
          label: "Mentor",
          color: "bg-emerald-100 text-emerald-700 border-emerald-200",
        };
      case 30:
        return {
          label: "Mentor Internal",
          color: "bg-emerald-100 text-emerald-700 border-emerald-200",
        };
      case 20:
        return {
          label: "Partner",
          color: "bg-sky-100 text-sky-700 border-sky-200",
        };
      case 10:
        return {
          label: "Merchant",
          color: "bg-amber-100 text-amber-700 border-amber-200",
        };
      default:
        return {
          label: "Guest",
          color: "bg-gray-100 text-gray-600 border-gray-200",
        };
    }
  }, [user?.role]);

  const toggleMenu = (name) => {
    setOpenMenus((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name],
    );
  };

  const handleSaveProfile = async (data) => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const response = await api.put(`/users/${storedUser.id}`, data);
      if (response) {
        toast.success("Profil berhasil diperbarui!");
        setIsEditModalOpen(false);
      } else {
        toast.error("Gagal memperbarui profil.");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat memperbarui profil.");
    }
  };

  const rightSidebarItems = [
    {
      name: navigationLabel("Changelog"),
      href: "/dashboard/changelog",
      icon: History,
    },
  ];

  return (
    <TooltipProvider>
      <Helmet>
        <title>{settings?.app_name || "Codeverta Enterprise System"}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div
        className={`print:hidden bg-gray-50 border-r border-gray-200 h-screen sticky top-0 p-4 flex flex-col relative z-30 transition-all duration-300 ${
          isOpen ? "w-72" : "w-20"
        }`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          data-onboarding="sidebar-toggle"
          className="absolute -right-4 top-8 z-50 bg-white border shadow-md rounded-full text-gray-600 hover:bg-gray-100 transition-transform active:scale-95"
        >
          {isOpen ? (
            <PanelLeftClose size={20} />
          ) : (
            <PanelRightClose size={20} />
          )}
        </Button>

        {settings?.app_name && (
          <AppSwitcherMenu onLogout={onLogout} side="right" align="start">
            <button
              type="button"
              className="mb-6 flex w-full flex-col gap-2 rounded-xl p-1 text-left outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div
                className={clsx(
                  "flex items-center gap-3",
                  !isOpen && "justify-center",
                )}
              >
                {settings?.app_logo ? (
                  <img
                    src={getStorageUrl(settings.app_logo)}
                    alt="App Logo"
                    className="w-9 h-9 rounded-lg object-cover shadow-sm flex-shrink-0"
                  />
                ) : (
                  <img
                    src={DEFAULT_APP_LOGO}
                    alt="Codeverta ERP"
                    className="w-9 h-9 rounded-[10px] object-contain shadow-sm flex-shrink-0"
                  />
                )}

                {isOpen && (
                  <>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-semibold text-gray-800 truncate">
                        {settings.app_name}
                      </h2>
                      <p className="text-xs text-gray-500 truncate">
                        {settings?.app_tagline ||
                          settings?.banner_text ||
                          "Future of Homeschooling"}
                      </p>
                    </div>

                    <AppVersion />
                  </>
                )}
              </div>

              {isOpen && user?.active_subscription && (
                <div className="px-1 mt-0.5">
                  <span
                    className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-100 block text-center truncate"
                    title={user.active_subscription}
                  >
                    Plan: {user.active_subscription}
                  </span>
                </div>
              )}
            </button>
          </AppSwitcherMenu>
        )}

        {isOpen ? (
          <div className="mb-3 px-1 flex items-center">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 shadow-xs">
              <Boxes className="size-3.5 text-blue-600" />
              {navigationLabel(moduleLabel)}
            </span>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mb-3 flex h-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
                <Boxes className="size-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t("navigation.module", {
                fallback: "Modul: {name}",
                values: { name: navigationLabel(moduleLabel) },
              })}
            </TooltipContent>
          </Tooltip>
        )}

        <nav className="flex-grow overflow-y-auto pr-2">
          {items.map((item) =>
            item.items ? (
              <Collapsible
                key={item.name}
                open={openMenus.includes(item.name)}
                onOpenChange={() => toggleMenu(item.name)}
                className="mb-1"
              >
                <Tooltip disableHoverableContent={isOpen}>
                  <TooltipTrigger asChild>
                    <CollapsibleTrigger
                      className="w-full"
                      data-onboarding-href={item.href}
                      data-onboarding-child-hrefs={item.items
                        .map((subItem) => subItem.href)
                        .join(" ")}
                    >
                      <div
                        className={`flex items-center w-full py-2 px-3 rounded-md hover:bg-gray-100 ${
                          !isOpen && "justify-center"
                        }`}
                      >
                        <item.icon
                          className={`h-5 w-5 text-gray-600 ${
                            isOpen ? "mr-3" : "mr-0"
                          }`}
                        />
                        {isOpen && (
                          <span
                            className={clsx(
                              "min-w-0 flex-1 truncate text-sm font-semibold text-left",
                            )}
                            title={navigationLabel(item)}
                          >
                            {navigationLabel(item)}
                          </span>
                        )}
                        {isOpen && (
                          <div className="ml-auto">
                            {openMenus.includes(item.name) ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                          </div>
                        )}
                      </div>
                    </CollapsibleTrigger>
                  </TooltipTrigger>
                  {!isOpen && (
                    <TooltipContent side="right">{navigationLabel(item)}</TooltipContent>
                  )}
                </Tooltip>

                <CollapsibleContent
                  className={`mt-1 ${isOpen ? "pl-8" : "pl-0"}`}
                >
                  {item.items.map((subItem) => (
                    <Tooltip
                      key={subItem.href}
                      disableHoverableContent={isOpen}
                    >
                      <TooltipTrigger asChild>
                        <NavLink
                          to={resolveHref(subItem.href)}
                          state={navigationState}
                          data-onboarding-href={subItem.href}
                          aria-disabled={
                            subItem.locked && !subItem.allowWhenLocked
                          }
                          onClick={(event) => {
                            if (subItem.locked && !subItem.allowWhenLocked) {
                              event.preventDefault();
                              toast.info(subItem.lockReason);
                            }
                          }}
                        >
                          {({ isActive }) => (
                            <div
                              className={clsx(
                                "flex items-center w-full my-1 text-sm h-9 px-3 py-2 rounded-md transition-colors hover:bg-gray-100",
                                isActive
                                  ? "bg-blue-100 text-blue-700 font-semibold"
                                  : "text-gray-600",
                                subItem.locked &&
                                  !subItem.allowWhenLocked &&
                                  "cursor-not-allowed opacity-60 hover:bg-transparent",
                                subItem.locked &&
                                  subItem.allowWhenLocked &&
                                  "bg-amber-50/60",
                                !isOpen && "justify-center",
                              )}
                            >
                              {subItem.icon && (
                                <subItem.icon
                                  className={`h-4 w-4 ${
                                    isOpen ? "mr-2" : "mr-0"
                                  }`}
                                />
                              )}
                              {isOpen && (
                                <span
                                  className="min-w-0 flex-1 truncate"
                                  title={navigationLabel(subItem)}
                                >
                                  {navigationLabel(subItem)}
                                </span>
                              )}
                              {subItem.locked && (
                                <Lock
                                  className={clsx(
                                    "h-3.5 w-3.5 shrink-0 text-amber-600",
                                    isOpen
                                      ? "ml-auto"
                                      : "absolute ml-5 -mt-4 rounded-full bg-white p-0.5",
                                  )}
                                  aria-label={t("navigation.locked", { fallback: "Menu terkunci" })}
                                />
                              )}
                            </div>
                          )}
                        </NavLink>
                      </TooltipTrigger>
                      {(!isOpen || subItem.locked) && (
                        <TooltipContent side="right">
                          {subItem.locked ? subItem.lockReason : navigationLabel(subItem)}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <Tooltip key={item.href} disableHoverableContent={isOpen}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={resolveHref(item.href)}
                    state={navigationState}
                    data-onboarding-href={item.href}
                    end={item.href === "/"}
                    aria-disabled={item.locked && !item.allowWhenLocked}
                    onClick={(event) => {
                      if (item.locked && !item.allowWhenLocked) {
                        event.preventDefault();
                        toast.info(item.lockReason);
                      }
                    }}
                  >
                    {({ isActive }) => (
                      <div
                        className={clsx(
                          "flex items-center w-full my-1 text-sm h-9 px-3 py-2 rounded-md transition-colors hover:bg-gray-100",
                          isActive
                            ? "bg-blue-100 text-blue-700 font-semibold"
                            : "text-gray-600",
                          item.locked &&
                            !item.allowWhenLocked &&
                            "cursor-not-allowed opacity-60 hover:bg-transparent",
                          item.locked &&
                            item.allowWhenLocked &&
                            "bg-amber-50/60",
                          !isOpen && "justify-center",
                        )}
                      >
                        <item.icon
                          className={clsx(
                            `h-5 w-5 text-gray-600 ${isOpen ? "mr-3" : "mr-0"}`,
                            item.style || "",
                          )}
                        />
                        {isOpen && (
                          <span
                            className={clsx(
                              "min-w-0 flex-1 truncate font-semibold text-gray-700",
                              item.style || "",
                            )}
                            title={navigationLabel(item)}
                          >
                            {navigationLabel(item)}
                          </span>
                        )}
                        {item.locked && (
                          <Lock
                            className={clsx(
                              "h-3.5 w-3.5 shrink-0 text-amber-600",
                              isOpen
                                ? "ml-auto"
                                : "absolute ml-5 -mt-4 rounded-full bg-white p-0.5",
                            )}
                            aria-label={t("navigation.locked", { fallback: "Menu terkunci" })}
                          />
                        )}
                      </div>
                    )}
                  </NavLink>
                </TooltipTrigger>
                {(!isOpen || item.locked) && (
                  <TooltipContent
                    side="right"
                    className="max-w-xs leading-relaxed"
                  >
                    {item.locked ? item.lockReason : navigationLabel(item)}
                  </TooltipContent>
                )}
              </Tooltip>
            ),
          )}
        </nav>
        <div className="mb-2 px-1 flex flex-col gap-1">
          <NotificationBell isSidebarOpen={isOpen} />
          <SystemSettings isSidebarOpen={isOpen} />
        </div>
        <RightSidebar
          user={user}
          roleInfo={roleInfo}
          rightSidebarItems={rightSidebarItems}
          onLogout={onLogout}
          isOpen={isOpen}
          onEditProfile={() => setIsEditModalOpen(true)}
        />
      </div>
      <EditProfileModal
        user={user}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveProfile}
      />
    </TooltipProvider>
  );
};

export default Sidebar;
