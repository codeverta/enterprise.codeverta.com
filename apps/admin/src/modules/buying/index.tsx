import React from "react";
import { useLocation } from "react-router";
import BuyingLayout from "./layout";
import PurchaseOrderFormPage from "./pages/PurchaseOrderFormPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import PurchaseInvoiceFormPage from "./pages/PurchaseInvoiceFormPage";
import PurchaseInvoicesPage from "./pages/PurchaseInvoicesPage";
import MasterListPage from "./pages/MasterListPage";
import SupplierFormPage from "./pages/SupplierFormPage";
import SupplierGroupsPage from "./pages/SupplierGroupsPage";
import ItemFormPage from "./pages/ItemFormPage";

export default function BuyingModule() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/desk/supplier-group")) return <BuyingLayout><SupplierGroupsPage /></BuyingLayout>;
  if (pathname.startsWith("/desk/supplier")) {
    const isSupplierForm = pathname === "/desk/supplier/new" || /^\/desk\/supplier\/[^/]+$/.test(pathname);
    return <BuyingLayout>{isSupplierForm ? <SupplierFormPage /> : <MasterListPage type="supplier" />}</BuyingLayout>;
  }
  if (pathname.startsWith("/desk/item")) {
    const isItemForm = pathname === "/desk/item/new" || /^\/desk\/item\/[^/]+$/.test(pathname);
    return <BuyingLayout>{isItemForm ? <ItemFormPage /> : <MasterListPage type="item" />}</BuyingLayout>;
  }
  if (pathname.startsWith("/desk/purchase-invoice")) {
    const isInvoiceForm = pathname === "/desk/purchase-invoice/new" || /^\/desk\/purchase-invoice\/[^/]+$/.test(pathname);
    return <BuyingLayout>{isInvoiceForm ? <PurchaseInvoiceFormPage /> : <PurchaseInvoicesPage />}</BuyingLayout>;
  }
  const isForm = pathname === "/desk/purchase-order/new" || /^\/desk\/purchase-order\/[^/]+$/.test(pathname);
  return <BuyingLayout>{isForm ? <PurchaseOrderFormPage /> : <PurchaseOrdersPage />}</BuyingLayout>;
}
