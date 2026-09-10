import React, { useEffect } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation, useNavigate } from "react-router";
import { LanguageProvider } from "./context/LanguageContext";
import { setNavigate } from "./lib/navigation";
import { useNotificationStore } from "./store/useNotificationStore";

import Login from "./pages/auth/login";
import ForgotPasswordPage from "./pages/auth/forgot-password";
import ResetPasswordPage from "./pages/auth/reset-password";
import Dashboard from "./pages/dashboard";
import NotFound from "./pages/not-found";
import DeskPage from "./pages/desk";
import ErpWorkspacePage from "./pages/desk/workspace";
import CRMPage from "./modules/crm";
import BuyingModule from "./modules/buying";
import OrganizationModule from "./modules/organization";
import SellingModule from "./modules/selling";
import StockModule from "./modules/stock";
import AccountingModule from "./modules/accounting";
import CommunicationModule from "./modules/communication";
import AdministrationModule from "./modules/administration";
import SettingsModule from "./modules/settings";
import PrintingModule from "./modules/printing";
import { isAdminRole } from "./lib/erp-desk";
import { isTauri } from "@tauri-apps/api/core";
import DesktopTitleBar from "./components/DesktopTitleBar";
import { DesktopBootstrap } from "./components/DesktopSetup";

const LegacyDashboardHome = () => {
  let user = null;
  try { user = JSON.parse(localStorage.getItem("user") || "null"); } catch { user = null; }
  return isAdminRole(user?.role) ? <Navigate to="/desk" replace /> : <Dashboard />;
};

const SharedItemRoute = () => {
  const location = useLocation();
  const workspace = new URLSearchParams(location.search).get("workspace") || location.state?.workspace;
  return workspace === "buying" ? <BuyingModule /> : <SellingModule />;
};

const ProtectedRoute = () => {
  const authenticated = Boolean(localStorage.getItem("accessToken"));

  useEffect(() => {
    if (!authenticated) return undefined;
    const notifications = useNotificationStore.getState();
    notifications.fetchNotifications();
    notifications.initializeWebSocket();
    return () => notifications.disconnectWebSocket();
  }, [authenticated]);

  return authenticated ? <Outlet /> : <Navigate to="/" replace />;
};

const AppLayout = () => {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate(navigate);
    document.documentElement.classList.toggle("dark", localStorage.getItem("theme") === "dark");
    document.documentElement.classList.toggle("erp-full-width", localStorage.getItem("erpFullWidth") === "true");
  }, [navigate]);
  return <LanguageProvider><Outlet /></LanguageProvider>;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Login /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "desk", element: <DeskPage /> },
          { path: "desk/crm/*", element: <CRMPage /> },
          { path: "desk/purchase-order/*", element: <BuyingModule /> },
          { path: "desk/purchase-invoice/*", element: <BuyingModule /> },
          { path: "desk/supplier/*", element: <BuyingModule /> },
          { path: "desk/supplier-group/*", element: <BuyingModule /> },
          { path: "desk/customer/*", element: <SellingModule /> },
          { path: "desk/customer-group/*", element: <SellingModule /> },
          { path: "desk/address/*", element: <SellingModule /> },
          { path: "desk/contact/*", element: <SellingModule /> },
          { path: "desk/item/*", element: <SharedItemRoute /> },
          { path: "desk/organization/users/*", element: <OrganizationModule /> },
          { path: "desk/organization/tenants/*", element: <OrganizationModule /> },
          { path: "desk/organization/permissions/*", element: <OrganizationModule /> },
          { path: "desk/company/*", element: <OrganizationModule /> },
          { path: "desk/branch/*", element: <OrganizationModule /> },
          { path: "desk/department/*", element: <OrganizationModule /> },
          { path: "desk/letter-head/*", element: <OrganizationModule /> },
          { path: "desk/selling/orders/*", element: <SellingModule /> },
          { path: "desk/selling/subscriptions/*", element: <SellingModule /> },
          { path: "desk/selling/promotions/*", element: <SellingModule /> },
          { path: "desk/point-of-sale/*", element: <SellingModule /> },
          { path: "desk/pos-opening-entry/*", element: <SellingModule /> },
          { path: "desk/pos-closing-entry/*", element: <SellingModule /> },
          { path: "desk/pos-invoice/*", element: <SellingModule /> },
          { path: "desk/sales-order/*", element: <SellingModule /> },
          { path: "desk/sales-invoice/*", element: <SellingModule /> },
          { path: "desk/item-price/*", element: <SellingModule /> },
          { path: "desk/price-list/*", element: <SellingModule /> },
          { path: "desk/shipment/*", element: <StockModule /> },
          { path: "desk/delivery-note/*", element: <StockModule /> },
          { path: "desk/uom/*", element: <StockModule /> },
          { path: "desk/warehouse/*", element: <StockModule /> },
          { path: "desk/stock-entry/*", element: <StockModule /> },
          { path: "desk/stock-entry-type/*", element: <StockModule /> },
          { path: "desk/purchase-receipt/*", element: <StockModule /> },
          { path: "desk/serial-no/*", element: <StockModule /> },
          { path: "desk/batch-no/*", element: <StockModule /> },
          { path: "desk/stock-ledger/*", element: <StockModule /> },
          { path: "desk/query-report/Stock%20Ledger", element: <StockModule /> },
          { path: "desk/query-report/Stock Ledger", element: <StockModule /> },
          { path: "desk/query-report/Sales%20Register", element: <SellingModule /> },
          { path: "desk/query-report/*", element: <SellingModule /> },
          { path: "desk/loyalty-program/*", element: <SellingModule /> },
          { path: "desk/loyalty-point-entry/*", element: <SellingModule /> },
          { path: "desk/accounting/finance/*", element: <AccountingModule /> },
          { path: "desk/communication/*", element: <CommunicationModule /> },
          { path: "desk/administration/*", element: <AdministrationModule /> },
          { path: "desk/erpnext-settings/system-settings/*", element: <SettingsModule /> },
          { path: "desk/printing/*", element: <PrintingModule /> },
          { path: "desk/print-format/*", element: <PrintingModule /> },
          { path: "desk/print-heading/*", element: <PrintingModule /> },
          { path: "desk/print-format-builder/*", element: <PrintingModule /> },
          { path: "desk/print-settings/*", element: <PrintingModule /> },
          { path: "desk/*", element: <ErpWorkspacePage /> },
          { path: "dashboard", element: <LegacyDashboardHome /> },
          { path: "dashboard/users/*", element: <Navigate to="/desk/organization/users" replace /> },
          { path: "dashboard/orders/*", element: <Navigate to="/desk/selling/orders" replace /> },
          { path: "dashboard/promo/*", element: <Navigate to="/desk/selling/promotions" replace /> },
          { path: "dashboard/subscriptions/*", element: <Navigate to="/desk/selling/subscriptions" replace /> },
          { path: "dashboard/finance/*", element: <Navigate to="/desk/accounting/finance" replace /> },
          { path: "dashboard/tenants/*", element: <Navigate to="/desk/organization/tenants" replace /> },
          { path: "dashboard/audit-logs/*", element: <Navigate to="/desk/administration/audit-log" replace /> },
          { path: "dashboard/email-templates/*", element: <Navigate to="/desk/communication/email-templates" replace /> },
          { path: "dashboard/email-broadcast/*", element: <Navigate to="/desk/communication/broadcast" replace /> },
          { path: "dashboard/settings/*", element: <Navigate to="/desk/erpnext-settings/system-settings" replace /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export default function App() {
  if (!isTauri()) return <RouterProvider router={router} />;

  return (
    <div className="tauri-shell h-screen overflow-hidden bg-background">
      <DesktopTitleBar />
      <main className="tauri-app-content">
        <DesktopBootstrap>
          <RouterProvider router={router} />
        </DesktopBootstrap>
      </main>
    </div>
  );
}
