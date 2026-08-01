import React from "react";
import { useLocation } from "react-router";
import BuyingLayout from "./layout";
import PurchaseOrderFormPage from "./pages/PurchaseOrderFormPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import PurchaseInvoiceFormPage from "./pages/PurchaseInvoiceFormPage";
import PurchaseInvoicesPage from "./pages/PurchaseInvoicesPage";

export default function BuyingModule() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/desk/purchase-invoice")) {
    const isInvoiceForm = pathname === "/desk/purchase-invoice/new" || /^\/desk\/purchase-invoice\/[^/]+$/.test(pathname);
    return <BuyingLayout>{isInvoiceForm ? <PurchaseInvoiceFormPage /> : <PurchaseInvoicesPage />}</BuyingLayout>;
  }
  const isForm = pathname === "/desk/purchase-order/new" || /^\/desk\/purchase-order\/[^/]+$/.test(pathname);
  return <BuyingLayout>{isForm ? <PurchaseOrderFormPage /> : <PurchaseOrdersPage />}</BuyingLayout>;
}
