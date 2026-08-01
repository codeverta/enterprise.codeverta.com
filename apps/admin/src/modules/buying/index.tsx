import React from "react";
import { useLocation } from "react-router";
import BuyingLayout from "./layout";
import PurchaseOrderFormPage from "./pages/PurchaseOrderFormPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";

export default function BuyingModule() {
  const { pathname } = useLocation();
  const isForm = pathname === "/desk/purchase-order/new" || /^\/desk\/purchase-order\/[^/]+$/.test(pathname);
  return <BuyingLayout>{isForm ? <PurchaseOrderFormPage /> : <PurchaseOrdersPage />}</BuyingLayout>;
}
