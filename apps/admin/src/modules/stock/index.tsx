import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import ShipmentListPage from "./pages/ShipmentListPage";
import ShipmentFormPage from "./pages/ShipmentFormPage";
import DeliveryNoteListPage from "./pages/DeliveryNoteListPage";
import DeliveryNoteFormPage from "./pages/DeliveryNoteFormPage";

export default function StockModule() {
  const { pathname } = useLocation();

  let content: React.ReactNode;

  if (pathname.startsWith("/desk/delivery-note")) {
    const isForm = pathname === "/desk/delivery-note/new" || /^\/desk\/delivery-note\/[^/]+$/.test(pathname);
    content = isForm ? <DeliveryNoteFormPage /> : <DeliveryNoteListPage />;
  } else if (pathname.startsWith("/desk/shipment")) {
    const isForm = pathname === "/desk/shipment/new" || /^\/desk\/shipment\/[^/]+$/.test(pathname);
    content = isForm ? <ShipmentFormPage /> : <ShipmentListPage />;
  } else {
    content = <ShipmentListPage />;
  }

  return <WorkspaceModuleLayout slug="stock">{content}</WorkspaceModuleLayout>;
}
