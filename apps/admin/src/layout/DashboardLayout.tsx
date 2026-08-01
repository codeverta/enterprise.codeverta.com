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

export default function DashboardLayout(PageComponent) {
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

    return (
      <div className="min-h-screen bg-slate-50">
        <ImpersonationBanner />
        <div className="hidden lg:flex">
          <Sidebar
            user={user}
            items={navigation}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen((open) => !open)}
            onLogout={logout}
          />
          <main className="min-w-0 flex-1"><PageComponent {...props} /></main>
        </div>
        <div className="lg:hidden">
          <Navbar user={user} items={navigation} onLogout={logout} />
          <main><PageComponent {...props} /></main>
        </div>
      </div>
    );
  };
}
