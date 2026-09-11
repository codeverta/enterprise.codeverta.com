import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  BadgePercent,
  Building2,
  CreditCard,
  FileClock,
  LayoutDashboard,
  Mail,
  ShoppingCart,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { ImpersonationBanner } from "../components/ImpersonationBanner";
import { clearImpersonationStorage } from "../lib/impersonation";

const navigation = [
  { name: "Dashboard", href: "", icon: LayoutDashboard },
  { name: "Pengguna", href: "/users", icon: Users },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Langganan", href: "/subscriptions", icon: CreditCard },
  { name: "Promo", href: "/promo", icon: BadgePercent },
  { name: "Keuangan", href: "/finance", icon: Wallet },
  { name: "Tenant", href: "/tenants", icon: Building2 },
  {
    name: "Email",
    href: "/email-templates",
    icon: Mail,
    items: [
      { name: "Template", href: "/email-templates", icon: Mail },
      { name: "Broadcast", href: "/email-broadcast", icon: Mail },
    ],
  },
  { name: "Audit Log", href: "/audit-logs", icon: FileClock },
  { name: "Pengaturan", href: "/settings", icon: Settings },
];

export default function DashboardLayout(PageComponent, options = {}) {
  return function CoreDashboardLayout(props) {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
      try {
        setUser(JSON.parse(localStorage.getItem("user") || "null"));
      } catch {
        setUser(null);
      }
    }, []);

    const logout = () => {
      clearImpersonationStorage();
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      navigate("/");
    };

    const resolvedNavigation =
      typeof options.navigation === "function"
        ? options.navigation(props)
        : options.navigation || navigation;
    const resolvedModuleLabel =
      typeof options.moduleLabel === "function"
        ? options.moduleLabel(props)
        : options.moduleLabel || "Core";

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <ImpersonationBanner />
        <div className="lg:hidden">
          <Navbar
            user={user}
            items={resolvedNavigation}
            basePath={options.basePath ?? "/dashboard"}
            homePath={options.homePath || "/dashboard"}
            navigationState={options.navigationState?.(props)}
            onLogout={logout}
          />
        </div>
        <div className="flex flex-1 min-w-0">
          <div className="hidden lg:block">
            <Sidebar
              user={user}
              items={resolvedNavigation}
              basePath={options.basePath ?? "/dashboard"}
              navigationState={options.navigationState?.(props)}
              defaultOpenAll={Boolean(options.defaultOpenAll)}
              openMenusStorageKey={
                options.openMenusStorageKey?.(props) || "sidebarOpenMenus"
              }
              moduleLabel={resolvedModuleLabel}
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen((open) => !open)}
              onLogout={logout}
            />
          </div>
          <main className="min-w-0 flex-1">
            <PageComponent {...props} />
          </main>
        </div>
      </div>
    );
  };
}
