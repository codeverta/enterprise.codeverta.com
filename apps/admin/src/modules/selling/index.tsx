import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import OrdersPage from "./pages/orders";
import PromoDashboard from "./pages/promotions";
import SubscriptionsPage from "./pages/subscriptions";
import LoyaltyProgramListPage from "./pages/LoyaltyProgramListPage";
import LoyaltyProgramFormPage from "./pages/LoyaltyProgramFormPage";
import LoyaltyPointEntryListPage from "./pages/LoyaltyPointEntryListPage";

export default function SellingModule() {
  const { pathname } = useLocation();

  let content: React.ReactNode;

  if (pathname.startsWith("/desk/loyalty-point-entry")) {
    content = <LoyaltyPointEntryListPage />;
  } else if (pathname.startsWith("/desk/loyalty-program")) {
    const isForm =
      pathname === "/desk/loyalty-program/new" ||
      /^\/desk\/loyalty-program\/[^/]+$/.test(pathname);
    content = isForm ? <LoyaltyProgramFormPage /> : <LoyaltyProgramListPage />;
  } else if (pathname.includes("/promotions")) {
    content = <PromoDashboard />;
  } else if (pathname.includes("/subscriptions")) {
    content = <SubscriptionsPage />;
  } else {
    content = <OrdersPage />;
  }

  return <WorkspaceModuleLayout slug="selling">{content}</WorkspaceModuleLayout>;
}
