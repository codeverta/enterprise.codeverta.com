import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import OrdersPage from "./pages/orders";
import PromoDashboard from "./pages/promotions";
import SubscriptionsPage from "./pages/subscriptions";

export default function SellingModule() {
  const { pathname } = useLocation();
  const content = pathname.includes("/promotions") ? <PromoDashboard />
    : pathname.includes("/subscriptions") ? <SubscriptionsPage />
      : <OrdersPage />;
  return <WorkspaceModuleLayout slug="selling">{content}</WorkspaceModuleLayout>;
}
