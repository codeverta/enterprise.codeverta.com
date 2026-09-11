import React, { useState, useMemo, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  LogOut,
  UserCircle,
  Menu,
  X,
  History,
  Settings,
  Lock,
  Search,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";
import clsx from "clsx";
import { useSettingsStore } from "../store/useSettingsStore";
import { useCommandPaletteStore } from "../store/useCommandPaletteStore";
import { version } from "../../package.json";
import RightSidebar from "./RightSidebar";
import NotificationBell from "./dashboard/NotificationBell";
import { ROLES } from "../lib/constants";
import { DEFAULT_APP_LOGO, getStorageUrl } from "../lib/utils";
import SystemSettings from "./dashboard/SystemSettings";
import { toast } from "sonner";
import AppSwitcherMenu from "./AppSwitcherMenu";
import { useLanguage } from "@/context/LanguageContext";
import { getNavigationLabel } from "@/lib/navigation-i18n";

const Navbar = ({
  user,
  onLogout,
  items,
  basePath = "/dashboard",
  homePath = "/dashboard",
  navigationState,
}) => {
  const location = useLocation();
  const resolveHref = (href) => `${basePath}${href}`;
  const { settings, fetchSettings } = useSettingsStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useLanguage();
  const navigationLabel = (item) => getNavigationLabel(t, item);

  const handleLockedNavigation = (event, item) => {
    if (item.locked && !item.allowWhenLocked) {
      event.preventDefault();
      toast.info(item.lockReason);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Mapping Role ID to Label & Color
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

  const rightSidebarItems = [
    {
      name: navigationLabel("Changelog"),
      href: "/dashboard/changelog",
      icon: History,
    },
  ];

  const limit = 4;
  const showMore = items.length > 5;
  const visibleItems = showMore ? items.slice(0, limit) : items;
  const overflowItems = showMore ? items.slice(limit) : [];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 relative">
        {/* Left Side: Brand Logo */}
        <div className="flex items-center gap-4 z-10">
          <AppSwitcherMenu onLogout={onLogout} side="bottom" align="start">
          <button type="button" data-onboarding-href="/" className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-1.5 text-left outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500">
            <img
              src={settings?.app_logo ? getStorageUrl(settings.app_logo) : DEFAULT_APP_LOGO}
              alt={settings?.app_name || "Codeverta ERP"}
              className="size-9 shrink-0 rounded-[10px] object-contain shadow-sm"
            />
            <span className="hidden max-w-56 truncate text-sm font-semibold text-slate-800 sm:block">
              {settings?.app_name || "Codeverta Enterprise System"}
            </span>
            <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 md:inline">
              v{version}
            </span>
          </button>
          </AppSwitcherMenu>
          {user?.active_subscription && (
            <div className="hidden md:flex items-center">
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-100" title={user.active_subscription}>
                Plan: {user.active_subscription}
              </span>
            </div>
          )}
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-1 absolute left-1/2 -translate-x-1/2">
          {visibleItems.map((item) => {
            if (item.items) {
              // Dropdown for sub-menus
              const isSubActive = item.items.some(
                (sub) => location.pathname === resolveHref(sub.href)
              );
              return (
                <DropdownMenu key={item.name}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-onboarding-href={item.href}
                      data-onboarding-child-hrefs={item.items.map((subItem) => subItem.href).join(" ")}
                      className={clsx(
                        "gap-1 text-sm font-medium h-9 px-3 transition-colors",
                        isSubActive
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {navigationLabel(item)}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 z-[50]">
                    {item.items.map((subItem) => (
                      <DropdownMenuItem key={subItem.name} asChild>
                        <NavLink
                          to={resolveHref(subItem.href)}
                          state={navigationState}
                          data-onboarding-href={subItem.href}
                          title={subItem.locked ? subItem.lockReason : undefined}
                          aria-disabled={subItem.locked && !subItem.allowWhenLocked}
                          onClick={(event) => handleLockedNavigation(event, subItem)}
                          className={({ isActive }) =>
                            clsx(
                              "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded transition-colors cursor-pointer",
                              subItem.locked && !subItem.allowWhenLocked &&
                                "cursor-not-allowed opacity-60",
                              subItem.locked && subItem.allowWhenLocked && "bg-amber-50",
                              isActive
                                ? "bg-blue-100 text-blue-700 font-semibold"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            )
                          }
                        >
                          {subItem.icon && <subItem.icon className="h-4 w-4" />}
                          {navigationLabel(subItem)}
                          {subItem.locked && <Lock className="ml-auto h-3.5 w-3.5 text-amber-600" />}
                        </NavLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            // Simple Link
            return (
              <NavLink
                key={item.name}
                to={resolveHref(item.href)}
                state={navigationState}
                data-onboarding-href={item.href}
                end={item.href === "/"}
                title={item.locked ? item.lockReason : undefined}
                aria-disabled={item.locked && !item.allowWhenLocked}
                onClick={(event) => handleLockedNavigation(event, item)}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-1.5 text-sm font-medium h-9 px-3 rounded-md transition-colors",
                    item.locked && !item.allowWhenLocked &&
                      "cursor-not-allowed opacity-60",
                    item.locked && item.allowWhenLocked && "bg-amber-50",
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {navigationLabel(item)}
                {item.locked && <Lock className="h-3.5 w-3.5 text-amber-600" />}
              </NavLink>
            );
          })}

          {/* Overflow 'Lainnya' Dropdown */}
          {showMore && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  data-onboarding="more-menu"
                  data-onboarding-child-hrefs={overflowItems
                    .flatMap((overflowItem) =>
                      overflowItem.items
                        ? overflowItem.items.map((subItem) => subItem.href)
                        : [overflowItem.href]
                    )
                    .filter(Boolean)
                    .join(" ")}
                  className="gap-1 text-sm font-medium h-9 px-3 transition-colors text-gray-600 hover:text-gray-900"
                >
                  {t("navigation.more", { fallback: "Lainnya" })}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 z-[50]">
                {overflowItems.map((item) => {
                  if (item.items) {
                    const isSubActive = item.items.some(
                      (sub) => location.pathname === resolveHref(sub.href)
                    );
                    return (
                      <DropdownMenuSub key={item.name}>
                        <DropdownMenuSubTrigger
                          data-onboarding-href={item.href}
                          data-onboarding-child-hrefs={item.items.map((subItem) => subItem.href).join(" ")}
                          className={clsx(
                            "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded cursor-pointer",
                            isSubActive
                              ? "bg-blue-50 text-blue-700 font-semibold"
                              : "text-gray-600 hover:text-gray-900"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{navigationLabel(item)}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48 z-[55]">
                          {item.items.map((subItem) => (
                            <DropdownMenuItem key={subItem.name} asChild>
                              <NavLink
                                to={resolveHref(subItem.href)}
                                state={navigationState}
                                data-onboarding-href={subItem.href}
                                title={subItem.locked ? subItem.lockReason : undefined}
                                aria-disabled={subItem.locked && !subItem.allowWhenLocked}
                                onClick={(event) => handleLockedNavigation(event, subItem)}
                                className={({ isActive }) =>
                                  clsx(
                                    "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded transition-colors cursor-pointer",
                                    subItem.locked && !subItem.allowWhenLocked &&
                                      "cursor-not-allowed opacity-60",
                                    subItem.locked && subItem.allowWhenLocked && "bg-amber-50",
                                    isActive
                                      ? "bg-blue-100 text-blue-700 font-semibold"
                                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                  )
                                }
                              >
                                {subItem.icon && <subItem.icon className="h-4 w-4" />}
                                {navigationLabel(subItem)}
                                {subItem.locked && <Lock className="ml-auto h-3.5 w-3.5 text-amber-600" />}
                              </NavLink>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  }

                  const isActive = location.pathname === resolveHref(item.href);
                  return (
                    <DropdownMenuItem key={item.name} asChild>
                      <NavLink
                        to={resolveHref(item.href)}
                        state={navigationState}
                        data-onboarding-href={item.href}
                        title={item.locked ? item.lockReason : undefined}
                        aria-disabled={item.locked && !item.allowWhenLocked}
                        onClick={(event) => handleLockedNavigation(event, item)}
                        className={clsx(
                          "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded transition-colors cursor-pointer",
                          item.locked && !item.allowWhenLocked &&
                            "cursor-not-allowed opacity-60",
                          isActive
                            ? "bg-blue-100 text-blue-700 font-semibold"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {navigationLabel(item)}
                        {item.locked && <Lock className="ml-auto h-3.5 w-3.5 text-amber-600" />}
                      </NavLink>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        {/* Right Side: Quick Actions & Profile */}
        <div className="flex items-center gap-1 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => useCommandPaletteStore.getState().open()}
            aria-label="Cari fitur atau modul (⌘K)"
            title="Cari (⌘K)"
            className="text-gray-600 hover:text-gray-900"
          >
            <Search className="h-4 w-4" />
          </Button>
          <SystemSettings isSidebarOpen={false}/>
          <NotificationBell isSidebarOpen={false} />

          <div className="hidden sm:block">
            <RightSidebar
              user={user}
              roleInfo={roleInfo}
              rightSidebarItems={rightSidebarItems}
              onLogout={onLogout}
              isOpen={true}
            />
          </div>

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            data-onboarding="mobile-menu"
            data-onboarding-child-hrefs={items
              .flatMap((item) =>
                item.items ? item.items.map((subItem) => subItem.href) : [item.href]
              )
              .filter(Boolean)
              .join(" ")}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Drawer/Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t bg-white px-4 py-4 space-y-3 shadow-lg">
          <nav className="flex flex-col space-y-1">
            {items.map((item) => {
              if (item.items) {
                return (
                  <div key={item.name} className="space-y-1 py-1">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 px-3 py-1.5">
                      <item.icon className="h-3.5 w-3.5" />
                      {navigationLabel(item)}
                    </div>
                    {item.items.map((subItem) => (
                      <NavLink
                        key={subItem.name}
                        to={resolveHref(subItem.href)}
                        state={navigationState}
                        data-onboarding-href={subItem.href}
                        title={subItem.locked ? subItem.lockReason : undefined}
                        aria-disabled={subItem.locked && !subItem.allowWhenLocked}
                        onClick={(event) => {
                          handleLockedNavigation(event, subItem);
                          if (!subItem.locked || subItem.allowWhenLocked) {
                            setIsMobileMenuOpen(false);
                          }
                        }}
                        className={({ isActive }) =>
                          clsx(
                            "flex items-center gap-2 text-sm font-medium h-9 px-6 rounded-md transition-colors",
                            subItem.locked && !subItem.allowWhenLocked &&
                              "cursor-not-allowed opacity-60",
                            subItem.locked && subItem.allowWhenLocked && "bg-amber-50",
                            isActive
                              ? "bg-blue-50 text-blue-700 font-semibold"
                              : "text-gray-600 hover:bg-gray-50"
                          )
                        }
                      >
                        {subItem.icon && <subItem.icon className="h-4 w-4" />}
                        {navigationLabel(subItem)}
                        {subItem.locked && <Lock className="ml-auto h-3.5 w-3.5 text-amber-600" />}
                      </NavLink>
                    ))}
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.name}
                  to={resolveHref(item.href)}
                  state={navigationState}
                  data-onboarding-href={item.href}
                  end={item.href === "/"}
                  title={item.locked ? item.lockReason : undefined}
                  aria-disabled={item.locked && !item.allowWhenLocked}
                  onClick={(event) => {
                    handleLockedNavigation(event, item);
                    if (!item.locked || item.allowWhenLocked) {
                      setIsMobileMenuOpen(false);
                    }
                  }}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-2 text-sm font-medium h-9 px-3 rounded-md transition-colors",
                      item.locked && !item.allowWhenLocked &&
                        "cursor-not-allowed opacity-60",
                      item.locked && item.allowWhenLocked && "bg-amber-50",
                      isActive
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {navigationLabel(item)}
                  {item.locked && <Lock className="ml-auto h-3.5 w-3.5 text-amber-600" />}
                </NavLink>
              );
            })}
          </nav>
          <div className="border-t pt-4 sm:hidden flex justify-end">
            <RightSidebar
              user={user}
              roleInfo={roleInfo}
              rightSidebarItems={rightSidebarItems}
              onLogout={onLogout}
              isOpen={true}
            />
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
