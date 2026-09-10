import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import ShipmentListPage from "./pages/ShipmentListPage";
import ShipmentFormPage from "./pages/ShipmentFormPage";
import DeliveryNoteListPage from "./pages/DeliveryNoteListPage";
import DeliveryNoteFormPage from "./pages/DeliveryNoteFormPage";
import UOMPage from "./pages/UOMPage";
import WarehousePage from "./pages/WarehousePage";
import StockEntryListPage from "./pages/StockEntryListPage";
import StockEntryFormPage from "./pages/StockEntryFormPage";
import PurchaseReceiptListPage from "./pages/PurchaseReceiptListPage";
import PurchaseReceiptFormPage from "./pages/PurchaseReceiptFormPage";
import SerialNoListPage from "./pages/SerialNoListPage";
import SerialNoFormPage from "./pages/SerialNoFormPage";
import BatchListPage from "./pages/BatchListPage";
import StockLedgerPage from "./pages/StockLedgerPage";
import StockEntryTypeListPage from "./pages/StockEntryTypeListPage";
import StockEntryTypeFormPage from "./pages/StockEntryTypeFormPage";

export default function StockModule() {
  const { pathname } = useLocation();

  let content: React.ReactNode;

  if (pathname.startsWith("/desk/stock-entry-type")) {
    const isForm = pathname === "/desk/stock-entry-type/new" || /^\/desk\/stock-entry-type\/[^/]+$/.test(pathname);
    content = isForm ? <StockEntryTypeFormPage /> : <StockEntryTypeListPage />;
  } else if (
    pathname.startsWith("/desk/stock-ledger") ||
    pathname === "/desk/query-report/Stock%20Ledger" ||
    pathname === "/desk/query-report/Stock Ledger"
  ) {
    content = <StockLedgerPage />;
  } else if (pathname.startsWith("/desk/serial-no")) {
    const isForm = pathname === "/desk/serial-no/new" || /^\/desk\/serial-no\/[^/]+$/.test(pathname);
    content = isForm ? <SerialNoFormPage /> : <SerialNoListPage />;
  } else if (pathname.startsWith("/desk/batch-no")) {
    const isForm = pathname === "/desk/batch-no/new" || /^\/desk\/batch-no\/[^/]+$/.test(pathname);
    content = isForm ? <BatchFormPage /> : <BatchListPage />;
  } else if (pathname.startsWith("/desk/purchase-receipt")) {
    const isForm = pathname === "/desk/purchase-receipt/new" || /^\/desk\/purchase-receipt\/[^/]+$/.test(pathname);
    content = isForm ? <PurchaseReceiptFormPage /> : <PurchaseReceiptListPage />;
  } else if (pathname.startsWith("/desk/stock-entry")) {
    const isForm = pathname === "/desk/stock-entry/new" || /^\/desk\/stock-entry\/[^/]+$/.test(pathname);
    content = isForm ? <StockEntryFormPage /> : <StockEntryListPage />;
  } else if (pathname.startsWith("/desk/delivery-note")) {
    const isForm = pathname === "/desk/delivery-note/new" || /^\/desk\/delivery-note\/[^/]+$/.test(pathname);
    content = isForm ? <DeliveryNoteFormPage /> : <DeliveryNoteListPage />;
  } else if (pathname.startsWith("/desk/shipment")) {
    const isForm = pathname === "/desk/shipment/new" || /^\/desk\/shipment\/[^/]+$/.test(pathname);
    content = isForm ? <ShipmentFormPage /> : <ShipmentListPage />;
  } else if (pathname.startsWith("/desk/uom")) {
    content = <UOMPage />;
  } else if (pathname.startsWith("/desk/warehouse")) {
    content = <WarehousePage />;
  } else {
    content = <ShipmentListPage />;
  }

  return <WorkspaceModuleLayout slug="stock">{content}</WorkspaceModuleLayout>;
}
