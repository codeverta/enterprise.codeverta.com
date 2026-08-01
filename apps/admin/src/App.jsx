import React, { useEffect } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useNavigate } from "react-router";
import { LanguageProvider } from "./context/LanguageContext";
import { setNavigate } from "./lib/navigation";
import { useNotificationStore } from "./store/useNotificationStore";

import Login from "./pages/auth/login";
import ForgotPasswordPage from "./pages/auth/forgot-password";
import ResetPasswordPage from "./pages/auth/reset-password";
import Dashboard from "./pages/dashboard";
import Users from "./pages/dashboard/users";
import PromoDashboard from "./pages/dashboard/promo";
import SubscriptionsPage from "./pages/dashboard/subscriptions";
import FinancePage from "./pages/dashboard/finance";
import TenantPage from "./pages/dashboard/tenants";
import LogsPage from "./pages/dashboard/activity-log";
import Emails from "./pages/dashboard/emails";
import EmailManagement from "./pages/dashboard/sending-email";
import Settings from "./pages/dashboard/settings";
import OrdersPage from "./pages/dashboard/orders";
import NotFound from "./pages/not-found";

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
  useEffect(() => setNavigate(navigate), [navigate]);
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
          { path: "dashboard", element: <Dashboard /> },
          { path: "dashboard/users", element: <Users /> },
          { path: "dashboard/orders", element: <OrdersPage /> },
          { path: "dashboard/promo", element: <PromoDashboard /> },
          { path: "dashboard/subscriptions", element: <SubscriptionsPage /> },
          { path: "dashboard/finance", element: <FinancePage /> },
          { path: "dashboard/tenants", element: <TenantPage /> },
          { path: "dashboard/audit-logs", element: <LogsPage /> },
          { path: "dashboard/email-templates", element: <Emails /> },
          { path: "dashboard/email-broadcast", element: <EmailManagement /> },
          { path: "dashboard/settings", element: <Settings /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
