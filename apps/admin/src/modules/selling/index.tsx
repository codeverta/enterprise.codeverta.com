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
import POSClosingFormPage from "./pages/POSClosingFormPage";
import POSProfileListPage from "./pages/POSProfileListPage";
import POSProfileFormPage from "./pages/POSProfileFormPage";
import POSInvoicePage from "./pages/POSInvoicePage";
import POSInvoiceFormPage from "./pages/POSInvoiceFormPage";
import SalesOrderFormPage, { SalesOrderListPage } from "./pages/SalesOrderPage";
import SalesRegisterPage from "./pages/SalesRegisterPage";
import PriceListPage from "./pages/PriceListPage";
import ItemPricePage from "./pages/ItemPricePage";
import PricingRulePage from "./pages/PricingRulePage";
import MasterListPage from "../buying/pages/MasterListPage";
import ItemFormPage from "../buying/pages/ItemFormPage";
import SalesInvoiceFormPage, { SalesInvoiceListPage } from "./pages/SalesInvoicePage";
import CustomerPage from "./pages/CustomerPage";
import CustomerMasterPage from "./pages/CustomerMasterPage";
import TerritoryFormPage, { TerritoryListPage } from "./pages/TerritoryPage";
import SalesPartnerFormPage, { SalesPartnerListPage } from "./pages/SalesPartnerPage";
import ItemGroupFormPage, { ItemGroupListPage } from "./pages/ItemGroupPage";
import QuotationPage from "./pages/QuotationPage";
import TaxCategoryPage from "./pages/TaxCategoryPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import SubscriptionPlanPage from "./pages/SubscriptionPlanPage";

export default function SellingModule() {
  const { pathname } = useLocation();

  let content: React.ReactNode;

  if (pathname.startsWith("/desk/item-group")) {
    const isList =
      pathname === "/desk/item-group" ||
      pathname === "/desk/item-group/view/Tree" ||
      pathname === "/desk/item-group/view/List" ||
      pathname.startsWith("/desk/item-group/view");
    const isForm =
      !isList &&
      (pathname === "/desk/item-group/new" ||
        pathname.includes("/desk/item-group/new-item-group") ||
        /^\/desk\/item-group\/[^/]+$/.test(pathname));
    content = isForm ? <ItemGroupFormPage /> : <ItemGroupListPage />;
  } else if (pathname.startsWith("/desk/sales-partner")) {
    const isList =
      pathname === "/desk/sales-partner" ||
      pathname === "/desk/sales-partner/view/List" ||
      pathname.startsWith("/desk/sales-partner/view");
    const isForm =
      !isList &&
      (pathname === "/desk/sales-partner/new" ||
        pathname.includes("/desk/sales-partner/new-sales-partner") ||
        /^\/desk\/sales-partner\/[^/]+$/.test(pathname));
    content = isForm ? <SalesPartnerFormPage /> : <SalesPartnerListPage />;
  } else if (pathname.startsWith("/desk/territory")) {
    const isList =
      pathname === "/desk/territory" ||
      pathname === "/desk/territory/view/List" ||
      pathname.startsWith("/desk/territory/view");
    const isForm =
      !isList &&
      (pathname === "/desk/territory/new" ||
        pathname.includes("/desk/territory/new-territory") ||
        /^\/desk\/territory\/[^/]+$/.test(pathname));
    content = isForm ? <TerritoryFormPage /> : <TerritoryListPage />;
  } else if (pathname.startsWith("/desk/customer-group")) {
    content = <CustomerMasterPage kind="customer-group" />;
  } else if (pathname.startsWith("/desk/address")) {
    content = <CustomerMasterPage kind="address" />;
  } else if (pathname.startsWith("/desk/contact")) {
    content = <CustomerMasterPage kind="contact" />;
  } else if (pathname.startsWith("/desk/customer")) {
    content = <CustomerPage />;
  } else if (pathname.startsWith("/desk/item-price")) {
    content = <ItemPricePage />;
  } else if (pathname.startsWith("/desk/pricing-rule")) {
    content = <PricingRulePage />;
  } else if (pathname.startsWith("/desk/price-list")) {
    content = <PriceListPage />;
  } else if (pathname.startsWith("/desk/item")) {
    const isItemForm = pathname === "/desk/item/new" || /^\/desk\/item\/[^/]+$/.test(pathname);
    content = isItemForm ? <ItemFormPage workspace="selling" /> : <MasterListPage type="item" workspace="selling" />;
  } else if (pathname.startsWith("/desk/quotation")) {
    content = <QuotationPage />;
  } else if (pathname.startsWith("/desk/tax-category")) {
    content = <TaxCategoryPage />;
  } else if (pathname.startsWith("/desk/sales-order")) {
    const isForm = pathname === "/desk/sales-order/new" || /^\/desk\/sales-order\/[^/]+$/.test(pathname);
    content = isForm ? <SalesOrderFormPage /> : <SalesOrderListPage />;
  } else if (pathname.startsWith("/desk/sales-invoice")) {
    const isForm = pathname === "/desk/sales-invoice/new" || /^\/desk\/sales-invoice\/[^/]+$/.test(pathname);
    content = isForm ? <SalesInvoiceFormPage /> : <SalesInvoiceListPage />;
  } else if (pathname === "/desk/query-report/Sales%20Register" || pathname === "/desk/query-report/Sales Register") {
    content = <SalesRegisterPage />;
  } else if (pathname === "/desk/point-of-sale" || pathname.startsWith("/desk/point-of-sale/")) {
    content = <PointOfSalePage />;
  } else if (pathname.startsWith("/desk/pos-profile")) {
    const isForm = pathname === "/desk/pos-profile/new" || /^\/desk\/pos-profile\/[^/]+$/.test(pathname);
    content = isForm ? <POSProfileFormPage /> : <POSProfileListPage />;
  } else if (pathname.startsWith("/desk/pos-opening-entry")) {
    const isForm = pathname === "/desk/pos-opening-entry/new" || /^\/desk\/pos-opening-entry\/[^/]+$/.test(pathname);
    content = isForm ? <POSOpeningFormPage /> : <POSOpeningEntryPage />;
  } else if (pathname.startsWith("/desk/pos-closing-entry")) {
    const isForm = pathname === "/desk/pos-closing-entry/new" || /^\/desk\/pos-closing-entry\/[^/]+$/.test(pathname);
    content = isForm ? <POSClosingFormPage /> : <POSClosingEntryPage />;
  } else if (pathname.startsWith("/desk/pos-invoice")) {
    const isForm =
      pathname === "/desk/pos-invoice/new" ||
      pathname.includes("/desk/pos-invoice/new-pos-invoice") ||
      /^\/desk\/pos-invoice\/[^/]+$/.test(pathname);
    content = isForm ? <POSInvoiceFormPage /> : <POSInvoicePage />;
  } else if (pathname.startsWith("/desk/loyalty-point-entry")) {
    content = <LoyaltyPointEntryListPage />;
  } else if (pathname.startsWith("/desk/loyalty-program")) {
    const isForm =
      pathname === "/desk/loyalty-program/new" ||
      /^\/desk\/loyalty-program\/[^/]+$/.test(pathname);
    content = isForm ? <LoyaltyProgramFormPage /> : <LoyaltyProgramListPage />;
  } else if (pathname.includes("/promotions")) {
    content = <PromoDashboard />;
  } else if (pathname.startsWith("/desk/subscription-plan")) {
    content = <SubscriptionPlanPage />;
  } else if (pathname.startsWith("/desk/subscription")) {
    content = <SubscriptionPage />;
  } else if (pathname.includes("/subscriptions")) {
    content = <SubscriptionsPage />;
  } else {
    content = <OrdersPage />;
  }

  const workspaceSlug = pathname.startsWith("/desk/subscription") ? "subscription" : "selling";
  return <WorkspaceModuleLayout slug={workspaceSlug}>{content}</WorkspaceModuleLayout>;
}
