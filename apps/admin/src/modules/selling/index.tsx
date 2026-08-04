import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import OrdersPage from "./pages/orders";
import PromoDashboard from "./pages/promotions";
import SubscriptionsPage from "./pages/subscriptions";
import LoyaltyProgramListPage from "./pages/LoyaltyProgramListPage";
import LoyaltyProgramFormPage from "./pages/LoyaltyProgramFormPage";
import LoyaltyPointEntryListPage from "./pages/LoyaltyPointEntryListPage";
import PointOfSalePage from "./pages/PointOfSalePage";
import POSOpeningEntryPage from "./pages/POSOpeningEntryPage";
import POSOpeningFormPage from "./pages/POSOpeningFormPage";
import POSClosingEntryPage from "./pages/POSClosingEntryPage";
import POSInvoicePage from "./pages/POSInvoicePage";
import SalesOrderFormPage, { SalesOrderListPage } from "./pages/SalesOrderPage";
import SalesRegisterPage from "./pages/SalesRegisterPage";
import PriceListPage from "./pages/PriceListPage";
import MasterListPage from "../buying/pages/MasterListPage";
import ItemFormPage from "../buying/pages/ItemFormPage";

export default function SellingModule() {
  const { pathname } = useLocation();

  let content: React.ReactNode;

  if (pathname.startsWith("/desk/price-list")) {
    content = <PriceListPage />;
  } else if (pathname.startsWith("/desk/item")) {
    const isItemForm = pathname === "/desk/item/new" || /^\/desk\/item\/[^/]+$/.test(pathname);
    content = isItemForm ? <ItemFormPage /> : <MasterListPage type="item" />;
  } else if (pathname.startsWith("/desk/sales-order")) {
    const isForm = pathname === "/desk/sales-order/new" || /^\/desk\/sales-order\/[^/]+$/.test(pathname);
    content = isForm ? <SalesOrderFormPage /> : <SalesOrderListPage />;
  } else if (pathname === "/desk/query-report/Sales%20Register" || pathname === "/desk/query-report/Sales Register") {
    content = <SalesRegisterPage />;
  } else if (pathname === "/desk/point-of-sale" || pathname.startsWith("/desk/point-of-sale/")) {
    content = <PointOfSalePage />;
  } else if (pathname === "/desk/pos-opening-entry/new") {
    content = <POSOpeningFormPage />;
  } else if (pathname.startsWith("/desk/pos-opening-entry")) {
    content = <POSOpeningEntryPage />;
  } else if (pathname.startsWith("/desk/pos-closing-entry")) {
    content = <POSClosingEntryPage />;
  } else if (pathname.startsWith("/desk/pos-invoice")) {
    content = <POSInvoicePage />;
  } else if (pathname.startsWith("/desk/loyalty-point-entry")) {
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
