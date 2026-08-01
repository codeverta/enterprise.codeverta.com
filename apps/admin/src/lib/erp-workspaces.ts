import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Circle,
  FileText,
  Folder,
  Gauge,
  Home,
  Settings,
  Wrench,
} from "lucide-react";

export type WorkspaceNavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  items?: WorkspaceNavigationItem[];
};

export type ErpWorkspace = {
  name: string;
  slug: string;
  navigation: WorkspaceNavigationItem[];
};

type LinkDefinition = string | readonly [name: string, href: string];

const slugify = (label: string) =>
  label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const link = (name: string, href: string, icon: LucideIcon = FileText): WorkspaceNavigationItem => ({
  name,
  href,
  icon,
});

const documentLinks = (definitions: readonly LinkDefinition[]): WorkspaceNavigationItem[] =>
  definitions.map((definition) => {
    const [name, href] = typeof definition === "string"
      ? [definition, `/desk/${slugify(definition)}`]
      : definition;
    return link(name, href);
  });

const reportLinks = (names: readonly string[]): WorkspaceNavigationItem[] =>
  names.map((name) => link(name, `/desk/query-report/${encodeURIComponent(name)}`, BarChart3));

const group = (
  name: string,
  workspaceHome: string,
  items: WorkspaceNavigationItem[],
  icon: LucideIcon = Folder,
): WorkspaceNavigationItem => ({ name, href: workspaceHome, icon, items });

const workspace = (
  name: string,
  slug: string,
  primary: readonly LinkDefinition[],
  groups: WorkspaceNavigationItem[],
): ErpWorkspace => {
  const home = `/desk/${slug}`;
  return {
    name,
    slug,
    navigation: [
      link("Home", home, Home),
      link("Dashboard", `/desk/dashboard-view/${encodeURIComponent(name)}`, Gauge),
      ...documentLinks(primary),
      ...groups,
    ],
  };
};

const sellingHome = "/desk/selling";
const selling = workspace(
  "Selling",
  "selling",
  ["Quotation", "Sales Order", "Sales Invoice", ["POS", "/desk/point-of-sale"]],
  [
    group("POS", sellingHome, documentLinks([
      "POS Profile", "POS Invoice", "POS Opening Entry", "POS Closing Entry",
      "POS Invoice Merge Log", "POS Settings", "Loyalty Program", "Loyalty Point Entry",
    ])),
    group("Items & Pricing", sellingHome, documentLinks([
      "Item", "Item Group", "Price List", "Item Price", "Pricing Rule", "Promotional Scheme",
      "Coupon Code", "Blanket Order",
    ])),
    group("Setup", sellingHome, documentLinks([
      "Customer", "Customer Group", "Address", "Contact", "Territory", "Campaign", "Sales Person",
      "Sales Partner", "Monthly Distribution", "Terms Template", ["Tax Template", "/desk/sales-taxes-and-charges-template"],
      "Product Bundle", "UTM Source", "Shipping Rule",
    ]), Wrench),
    group("Reports", sellingHome, reportLinks([
      "Sales Register", "Item-wise Sales Register", "Sales Analytics", "Customer Addresses And Contacts",
      "Sales Invoice Trends", "Customer Credit Balance", "Customers Without Any Sales Transactions",
      "Sales Partners Commission", "Available Stock for Packing Items",
      "Territory Target Variance Based On Item Group", "Sales Person Target Variance Based On Item Group",
      "Sales Partner Target Variance Based On Item Group", "Pending SO Items For Purchase Request", "Sales Funnel",
      "Sales Order Analysis", "Customer Acquisition and Loyalty", "Quotation Trends", "Sales Order Trends",
      "Item-wise Sales History", "Sales Person-wise Transaction Summary",
    ]), BarChart3),
    group("Settings", sellingHome, documentLinks(["Selling Settings"]), Settings),
  ],
);

const buyingHome = "/desk/buying";
const buying = workspace(
  "Buying",
  "buying",
  ["Material Request", "Request for Quotation", "Supplier Quotation", "Purchase Order", "Purchase Invoice"],
  [
    group("Setup", buyingHome, documentLinks([
      "Supplier", "Supplier Group", "Item", "Price List", "Address", ["Contacts", "/desk/contact"],
      "Supplier Scorecard", "Supplier Scorecard Criteria", "Supplier Scorecard Variable", "Supplier Scorecard Standing",
    ]), Wrench),
    group("Reports", buyingHome, reportLinks([
      "Purchase Analytics", "Purchase Order Analysis", "Requested Items to Order and Receive", "Items To Be Requested",
      "Item-wise Purchase History", "Purchase Receipt Trends", "Purchase Invoice Trends", "Purchase Order Trends",
      "Procurement Tracker", "Supplier-Wise Sales Analytics", "Supplier Quotation Comparison",
      "Supplier Addresses And Contacts",
    ]), BarChart3),
    group("Settings", buyingHome, [link("Buying Settings", "/desk/buying-settings/Buying%20Settings", Settings)], Settings),
  ],
);

const stockHome = "/desk/stock";
const stock = workspace(
  "Stock",
  "stock",
  ["Stock Entry", "Purchase Receipt", "Delivery Note", "Material Request", "Pick List"],
  [
    group("Tools", stockHome, documentLinks([
      "Stock Reconciliation", "Landed Cost Voucher", "Repost Item Valuation", "Packing Slip", "Quality Inspection",
    ]), Wrench),
    group("Setup", stockHome, documentLinks([
      "Item", "Item Group", "Item Attribute", "Brand", "Warehouse", ["Unit of Measure (UOM)", "/desk/uom"],
      "UOM Conversion Factor", "Serial No", "Batch No", "Serial and Batch Bundle", "Inventory Dimension",
      "Shipping Rule", "Item Alternative", "Quality Inspection Template", "Delivery Trip",
    ]), Wrench),
    group("Reports", stockHome, reportLinks([
      "Stock Ledger", "Stock Balance", "Quick Stock Balance", "Stock Projected Qty", "Stock Analytics", "Stock Ageing",
      "Purchase Receipt Trends", "Delivery Note Trends", "Item Price Stock", "Warehouse Wise Stock Balance",
      "Item Shortage Report", "Serial No and Batch Traceability", "Serial No Status", "Serial No Ledger",
      "Serial No Warranty Expiry", "Batch-Wise Balance History", "Batch Item Expiry Status",
      "Requested Items To Be Transferred", "Itemwise Recommended Reorder Level", "Item Variant Details",
    ]), BarChart3),
    group("Settings", stockHome, documentLinks([
      "Stock Settings", "Item Variant Settings", "Stock Reposting Settings", "Delivery Settings",
    ]), Settings),
  ],
);

const accountingHome = "/desk/accounting";
const accounting = workspace("Accounting", "accounting", [], [
  group("Accounting", accountingHome, [
    link("Invoicing", "/desk/invoicing?sidebar=Invoicing"),
    link("Payments", "/desk/dashboard-view/Payments?sidebar=Payments"),
    link("Financial Reports", "/desk/query-report/Balance%20Sheet", BarChart3),
    link("Accounts Setup", "/desk/account?sidebar=Accounts%20Setup"),
    link("Taxes", "/desk/sales-taxes-and-charges-template?sidebar=Taxes"),
    link("Banking", "/desk/bank-clearance/Bank%20Clearance?sidebar=Banking"),
    link("Budget", "/desk/budget?sidebar=Budget"),
    link("Share Management", "/desk/shareholder?sidebar=Share%20Management"),
    link("Subscription", "/desk/subscription?sidebar=Subscription"),
  ]),
]);

const assetsHome = "/desk/assets";
const assets = workspace("Assets", "assets", ["Asset", "Asset Movement", "Asset Repair", "Asset Capitalization"], [
  group("Maintenance", assetsHome, documentLinks(["Asset Maintenance", "Asset Maintenance Log"]), Wrench),
  group("Setup", assetsHome, documentLinks(["Asset Category", "Asset Location", "Asset Finance Book", "Depreciation Schedule"])),
  group("Reports", assetsHome, reportLinks(["Asset Register", "Asset Depreciation Ledger", "Fixed Asset Register"]), BarChart3),
  group("Settings", assetsHome, documentLinks(["Asset Settings"]), Settings),
]);

const manufacturingHome = "/desk/manufacturing";
const manufacturing = workspace("Manufacturing", "manufacturing", ["Bill of Materials", "Production Plan", "Work Order", "Job Card", "Stock Entry"], [
  group("Setup", manufacturingHome, documentLinks(["Operation", "Routing", "Workstation", "Workstation Type", "BOM Update Tool"])),
  group("Reports", manufacturingHome, reportLinks(["Production Analytics", "Work Order Summary", "BOM Stock Report", "BOM Explorer"]), BarChart3),
  group("Settings", manufacturingHome, documentLinks(["Manufacturing Settings"]), Settings),
]);

const projectsHome = "/desk/projects";
const projects = workspace("Projects", "projects", ["Project", "Task", "Timesheet", "Project Template"], [
  group("Setup", projectsHome, documentLinks(["Activity Type", "Activity Cost", "Project Type"])),
  group("Reports", projectsHome, reportLinks(["Project Billing Summary", "Project Profitability", "Delayed Tasks Summary", "Project Summary"]), BarChart3),
  group("Settings", projectsHome, documentLinks(["Projects Settings"]), Settings),
]);

const qualityHome = "/desk/quality";
const quality = workspace("Quality", "quality", ["Quality Goal", "Quality Procedure", "Quality Review", "Quality Action"], [
  group("Setup", qualityHome, documentLinks(["Quality Inspection", "Quality Inspection Template", "Non Conformance", "Quality Feedback"])),
  group("Reports", qualityHome, reportLinks(["Quality Inspection Summary"]), BarChart3),
]);

const subcontractingHome = "/desk/subcontracting";
const subcontracting = workspace("Subcontracting", "subcontracting", ["Subcontracting Order", "Subcontracting Receipt"], [
  group("Stock", subcontractingHome, documentLinks(["Send to Subcontractor", "Stock Entry"])),
  group("Reports", subcontractingHome, reportLinks(["Subcontracted Item To Be Received", "Subcontract Order Summary"]), BarChart3),
  group("Settings", subcontractingHome, documentLinks(["Buying Settings", "Stock Settings"]), Settings),
]);

const organizationHome = "/desk/organization";
const organization = workspace("Organization", "organization", ["Company", "Branch", "Department", "Cost Center"], [
  group("People", organizationHome, documentLinks(["Employee", "Designation", "Employment Type"])),
  group("Setup", organizationHome, documentLinks(["Fiscal Year", "Holiday List", "Global Defaults", "System Settings"]), Settings),
]);

const settingsHome = "/desk/erpnext-settings";
const erpnextSettings = workspace("ERPNext Settings", "erpnext-settings", [], [
  group("Defaults", settingsHome, documentLinks(["Global Defaults", "System Settings", "Domain Settings", "Session Default Settings"]), Settings),
  group("Modules", settingsHome, documentLinks(["Selling Settings", "Buying Settings", "Stock Settings", "Accounts Settings", "Manufacturing Settings"]), Settings),
  group("Data", settingsHome, documentLinks(["Data Import", "Data Export", "Customize Form", "Role Permission Manager"]), Wrench),
]);

const frameworkHome = "/desk/framework";
const framework = workspace("Framework", "framework", [], [
  group("Administration", frameworkHome, documentLinks(["User", "Role", "DocType", "Workspace", "Module Def"]), Wrench),
  group("Tools", frameworkHome, documentLinks(["Data Import", "Error Log", "Activity Log", "Scheduled Job Type"]), Wrench),
  group("Settings", frameworkHome, documentLinks(["System Settings", "Website Settings", "Email Account"]), Settings),
]);

export const erpWorkspaces: Record<string, ErpWorkspace> = {
  framework,
  organization,
  accounting,
  assets,
  buying,
  manufacturing,
  projects,
  quality,
  selling,
  stock,
  subcontracting,
  "erpnext-settings": erpnextSettings,
};

export const getWorkspaceFromPath = (
  pathname: string,
  preferredSlug?: string,
): ErpWorkspace | undefined => {
  if (preferredSlug && erpWorkspaces[preferredSlug]) return erpWorkspaces[preferredSlug];
  const directSlug = pathname.split("/").filter(Boolean)[1];
  if (directSlug && erpWorkspaces[directSlug]) return erpWorkspaces[directSlug];

  return Object.values(erpWorkspaces).find((candidate) =>
    candidate.navigation.some((item) =>
      item.href.split("?")[0] === pathname || item.items?.some((child) => child.href.split("?")[0] === pathname)
    )
  );
};

export const flattenWorkspaceNavigation = (workspaceConfig: ErpWorkspace) =>
  workspaceConfig.navigation.flatMap((item) => item.items || [item]);

