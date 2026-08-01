import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  AreaChart,
  ArrowLeftRight,
  ArrowRightLeft,
  Award,
  BadgeCheck,
  BarChart,
  BarChart2,
  BarChart3,
  Barcode,
  BookMarked,
  BookOpen,
  Bookmark,
  Box,
  Boxes,
  Building,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  CheckSquare,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cog,
  Coins,
  Contact,
  Copy,
  Cpu,
  CreditCard,
  Database,
  DollarSign,
  Download,
  Edit3,
  Factory,
  FileBarChart,
  FileCheck,
  FileCode,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  Filter,
  Folder,
  FolderKanban,
  Gauge,
  Gift,
  GitBranch,
  GitCompare,
  GitFork,
  GitMerge,
  Globe,
  Grid,
  Hammer,
  Handshake,
  HelpCircle,
  History,
  Home,
  Kanban,
  Landmark,
  Layers,
  Layout,
  LayoutGrid,
  LineChart,
  ListChecks,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Maximize,
  Medal,
  Megaphone,
  MessageSquare,
  Monitor,
  Network,
  Package,
  PackageCheck,
  PackagePlus,
  Percent,
  PieChart,
  PiggyBank,
  Receipt,
  RefreshCw,
  Repeat,
  RotateCcw,
  Route,
  Ruler,
  Scale,
  Scroll,
  Search,
  Send,
  Settings,
  Settings2,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Store,
  Sun,
  Tag,
  Tags,
  Target,
  Ticket,
  TrendingUp,
  Truck,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Warehouse,
  Wrench,
  Zap,
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

const documentIconMap: Record<string, LucideIcon> = {
  "Quotation": FileQuestion,
  "Sales Order": ShoppingCart,
  "Sales Invoice": Receipt,
  "POS": Store,
  "POS Profile": UserCheck,
  "POS Invoice": Receipt,
  "POS Opening Entry": LogIn,
  "POS Closing Entry": LogOut,
  "POS Invoice Merge Log": GitMerge,
  "POS Settings": Sliders,
  "Loyalty Program": Award,
  "Loyalty Point Entry": Coins,
  "Item": Package,
  "Item Group": Boxes,
  "Price List": Tags,
  "Item Price": Tag,
  "Pricing Rule": Percent,
  "Promotional Scheme": Gift,
  "Coupon Code": Ticket,
  "Blanket Order": Scroll,
  "Customer": Users,
  "Customer Group": UserCheck,
  "Address": MapPin,
  "Contact": Contact,
  "Contacts": Contact,
  "Territory": Globe,
  "Campaign": Megaphone,
  "Sales Person": UserCheck,
  "Sales Partner": Handshake,
  "Monthly Distribution": Calendar,
  "Terms Template": FileCheck,
  "Tax Template": Percent,
  "Product Bundle": PackagePlus,
  "UTM Source": Share2,
  "Shipping Rule": Truck,
  "Selling Settings": SlidersHorizontal,
  "Material Request": FileSpreadsheet,
  "Request for Quotation": HelpCircle,
  "Supplier Quotation": FileText,
  "Purchase Order": ShoppingBag,
  "Purchase Invoice": Receipt,
  "Supplier": Factory,
  "Supplier Group": Building2,
  "Supplier Scorecard": Award,
  "Supplier Scorecard Criteria": ListChecks,
  "Supplier Scorecard Variable": Sliders,
  "Supplier Scorecard Standing": Medal,
  "Buying Settings": Settings2,
  "Stock Entry": Boxes,
  "Purchase Receipt": Receipt,
  "Delivery Note": Truck,
  "Pick List": ClipboardList,
  "Stock Reconciliation": Scale,
  "Landed Cost Voucher": Coins,
  "Repost Item Valuation": RefreshCw,
  "Packing Slip": Box,
  "Quality Inspection": ShieldCheck,
  "Item Attribute": Sliders,
  "Brand": Bookmark,
  "Warehouse": Warehouse,
  "Unit of Measure (UOM)": Ruler,
  "UOM Conversion Factor": Calculator,
  "Serial No": Barcode,
  "Batch No": Layers,
  "Serial and Batch Bundle": PackageCheck,
  "Inventory Dimension": Maximize,
  "Item Alternative": Copy,
  "Quality Inspection Template": ShieldAlert,
  "Delivery Trip": Route,
  "Stock Settings": Settings,
  "Item Variant Settings": SlidersHorizontal,
  "Stock Reposting Settings": RotateCcw,
  "Delivery Settings": Truck,
  "Invoicing": Receipt,
  "Payments": CreditCard,
  "Financial Reports": PieChart,
  "Accounts Setup": Building,
  "Taxes": Percent,
  "Banking": Landmark,
  "Budget": PiggyBank,
  "Share Management": Share2,
  "Subscription": Repeat,
  "Asset": Building,
  "Asset Movement": ArrowRightLeft,
  "Asset Repair": Wrench,
  "Asset Capitalization": CircleDollarSign,
  "Asset Maintenance": Hammer,
  "Asset Maintenance Log": History,
  "Asset Category": Grid,
  "Asset Location": MapPin,
  "Asset Finance Book": BookOpen,
  "Depreciation Schedule": Calendar,
  "Asset Settings": Settings2,
  "Bill of Materials": Layers,
  "Production Plan": Calendar,
  "Work Order": ClipboardList,
  "Job Card": BadgeCheck,
  "Operation": Cog,
  "Routing": Route,
  "Workstation": Cpu,
  "Workstation Type": Monitor,
  "BOM Update Tool": RefreshCw,
  "Manufacturing Settings": Settings,
  "Project": FolderKanban,
  "Task": CheckSquare,
  "Timesheet": Clock,
  "Project Template": Layout,
  "Activity Type": Activity,
  "Activity Cost": DollarSign,
  "Project Type": Kanban,
  "Projects Settings": Settings2,
  "Quality Goal": Target,
  "Quality Procedure": ShieldCheck,
  "Quality Review": ClipboardCheck,
  "Quality Action": Zap,
  "Non Conformance": AlertTriangle,
  "Quality Feedback": MessageSquare,
  "Subcontracting Order": Handshake,
  "Subcontracting Receipt": Package,
  "Send to Subcontractor": Send,
  "Company": Building2,
  "Branch": GitFork,
  "Department": Network,
  "Cost Center": Calculator,
  "People": Users,
  "Employee": Users,
  "Designation": BadgeCheck,
  "Employment Type": UserCheck,
  "Fiscal Year": Calendar,
  "Holiday List": Sun,
  "Global Defaults": Globe,
  "System Settings": Settings,
  "Domain Settings": Globe,
  "Session Default Settings": Clock,
  "Accounts Settings": DollarSign,
  "Data Import": Upload,
  "Data Export": Download,
  "Customize Form": Edit3,
  "Role Permission Manager": Shield,
  "User": User,
  "Role": Shield,
  "DocType": FileCode,
  "Workspace": LayoutGrid,
  "Module Def": Boxes,
  "Error Log": AlertCircle,
  "Activity Log": Activity,
  "Scheduled Job Type": Clock,
  "Website Settings": Globe,
  "Email Account": Mail,
};

const reportIconMap: Record<string, LucideIcon> = {
  "Sales Register": FileBarChart,
  "Item-wise Sales Register": BarChart2,
  "Sales Analytics": LineChart,
  "Customer Addresses And Contacts": Contact,
  "Sales Invoice Trends": TrendingUp,
  "Customer Credit Balance": Scale,
  "Customers Without Any Sales Transactions": UserX,
  "Sales Partners Commission": Coins,
  "Available Stock for Packing Items": PackageCheck,
  "Territory Target Variance Based On Item Group": Target,
  "Sales Person Target Variance Based On Item Group": Target,
  "Sales Partner Target Variance Based On Item Group": Target,
  "Pending SO Items For Purchase Request": Clock,
  "Sales Funnel": Filter,
  "Sales Order Analysis": PieChart,
  "Customer Acquisition and Loyalty": UserPlus,
  "Quotation Trends": TrendingUp,
  "Sales Order Trends": AreaChart,
  "Item-wise Sales History": History,
  "Sales Person-wise Transaction Summary": FileText,
  "Purchase Analytics": PieChart,
  "Purchase Order Analysis": BarChart3,
  "Requested Items to Order and Receive": PackagePlus,
  "Items To Be Requested": FileQuestion,
  "Item-wise Purchase History": History,
  "Purchase Receipt Trends": TrendingUp,
  "Purchase Invoice Trends": LineChart,
  "Purchase Order Trends": AreaChart,
  "Procurement Tracker": Search,
  "Supplier-Wise Sales Analytics": PieChart,
  "Supplier Quotation Comparison": GitCompare,
  "Supplier Addresses And Contacts": MapPin,
  "Stock Ledger": FileBarChart,
  "Stock Balance": Scale,
  "Quick Stock Balance": Gauge,
  "Stock Projected Qty": TrendingUp,
  "Stock Analytics": PieChart,
  "Stock Ageing": Clock,
  "Delivery Note Trends": LineChart,
  "Item Price Stock": Tag,
  "Warehouse Wise Stock Balance": Warehouse,
  "Item Shortage Report": AlertTriangle,
  "Serial No and Batch Traceability": GitBranch,
  "Serial No Status": Activity,
  "Serial No Ledger": FileText,
  "Serial No Warranty Expiry": Calendar,
  "Batch-Wise Balance History": History,
  "Batch Item Expiry Status": AlertCircle,
  "Requested Items To Be Transferred": ArrowRightLeft,
  "Itemwise Recommended Reorder Level": BarChart,
  "Item Variant Details": Layers,
  "Asset Register": FileSpreadsheet,
  "Asset Depreciation Ledger": BookMarked,
  "Fixed Asset Register": ClipboardList,
  "Production Analytics": PieChart,
  "Work Order Summary": FileText,
  "BOM Stock Report": Boxes,
  "BOM Explorer": Search,
  "Project Billing Summary": Receipt,
  "Project Profitability": DollarSign,
  "Delayed Tasks Summary": Clock,
  "Project Summary": FileText,
  "Quality Inspection Summary": ClipboardCheck,
  "Subcontracted Item To Be Received": Package,
  "Subcontract Order Summary": FileText,
};

const groupIconMap: Record<string, LucideIcon> = {
  "POS": Store,
  "Items & Pricing": Tags,
  "Setup": Sliders,
  "Reports": LineChart,
  "Settings": Settings2,
  "Tools": Wrench,
  "Accounting": Landmark,
  "Maintenance": Hammer,
  "People": Users,
  "Defaults": Globe,
  "Modules": Grid,
  "Data": Database,
  "Administration": Shield,
  "Stock": Boxes,
};

const fallbackIcons: LucideIcon[] = [
  FileText,
  FileSpreadsheet,
  FileCheck,
  ClipboardList,
  Bookmark,
  Layers,
  Box,
  Sparkles,
];

const fallbackReportIcons: LucideIcon[] = [
  BarChart3,
  BarChart2,
  BarChart,
  LineChart,
  PieChart,
  AreaChart,
  FileBarChart,
  TrendingUp,
];

const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getDocumentIcon = (name: string): LucideIcon => {
  if (documentIconMap[name]) return documentIconMap[name];
  const idx = simpleHash(name) % fallbackIcons.length;
  return fallbackIcons[idx];
};

const getReportIcon = (name: string): LucideIcon => {
  if (reportIconMap[name]) return reportIconMap[name];
  const idx = simpleHash(name) % fallbackReportIcons.length;
  return fallbackReportIcons[idx];
};

const getGroupIcon = (name: string): LucideIcon => {
  if (groupIconMap[name]) return groupIconMap[name];
  return Folder;
};

const link = (
  name: string,
  href: string,
  icon?: LucideIcon,
): WorkspaceNavigationItem => ({
  name,
  href,
  icon: icon || getDocumentIcon(name),
});

const documentLinks = (definitions: readonly LinkDefinition[]): WorkspaceNavigationItem[] =>
  definitions.map((definition) => {
    const [name, href] = typeof definition === "string"
      ? [definition, `/desk/${slugify(definition)}`]
      : definition;
    return link(name, href);
  });

const reportLinks = (names: readonly string[]): WorkspaceNavigationItem[] =>
  names.map((name) => link(name, `/desk/query-report/${encodeURIComponent(name)}`, getReportIcon(name)));

const group = (
  name: string,
  workspaceHome: string,
  items: WorkspaceNavigationItem[],
  icon?: LucideIcon,
): WorkspaceNavigationItem => ({ name, href: workspaceHome, icon: icon || getGroupIcon(name), items });

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
  [
    "Quotation", "Sales Order", "Sales Invoice", ["POS", "/desk/point-of-sale"],
    ["Orders", "/desk/selling/orders"],
    ["Subscriptions", "/desk/selling/subscriptions"],
    ["Promotions", "/desk/selling/promotions"],
  ],
  [
    group("POS", sellingHome, documentLinks([
      "POS Profile", "POS Invoice", "POS Opening Entry", "POS Closing Entry",
      "POS Invoice Merge Log", "POS Settings", "Loyalty Program", "Loyalty Point Entry",
    ]), Store),
    group("Items & Pricing", sellingHome, documentLinks([
      "Item", "Item Group", "Price List", "Item Price", "Pricing Rule", "Promotional Scheme",
      "Coupon Code", "Blanket Order",
    ]), Tags),
    group("Setup", sellingHome, documentLinks([
      "Customer", "Customer Group", "Address", "Contact", "Territory", "Campaign", "Sales Person",
      "Sales Partner", "Monthly Distribution", "Terms Template", ["Tax Template", "/desk/sales-taxes-and-charges-template"],
      "Product Bundle", "UTM Source", "Shipping Rule",
    ]), UserCheck),
    group("Reports", sellingHome, reportLinks([
      "Sales Register", "Item-wise Sales Register", "Sales Analytics", "Customer Addresses And Contacts",
      "Sales Invoice Trends", "Customer Credit Balance", "Customers Without Any Sales Transactions",
      "Sales Partners Commission", "Available Stock for Packing Items",
      "Territory Target Variance Based On Item Group", "Sales Person Target Variance Based On Item Group",
      "Sales Partner Target Variance Based On Item Group", "Pending SO Items For Purchase Request", "Sales Funnel",
      "Sales Order Analysis", "Customer Acquisition and Loyalty", "Quotation Trends", "Sales Order Trends",
      "Item-wise Sales History", "Sales Person-wise Transaction Summary",
    ]), LineChart),
    group("Settings", sellingHome, documentLinks(["Selling Settings"]), SlidersHorizontal),
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
    ]), Building2),
    group("Reports", buyingHome, reportLinks([
      "Purchase Analytics", "Purchase Order Analysis", "Requested Items to Order and Receive", "Items To Be Requested",
      "Item-wise Purchase History", "Purchase Receipt Trends", "Purchase Invoice Trends", "Purchase Order Trends",
      "Procurement Tracker", "Supplier-Wise Sales Analytics", "Supplier Quotation Comparison",
      "Supplier Addresses And Contacts",
    ]), PieChart),
    group("Settings", buyingHome, [link("Buying Settings", "/desk/buying-settings/Buying%20Settings", Settings2)], Settings2),
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
    ]), PackageCheck),
    group("Setup", stockHome, documentLinks([
      "Item", "Item Group", "Item Attribute", "Brand", "Warehouse", ["Unit of Measure (UOM)", "/desk/uom"],
      "UOM Conversion Factor", "Serial No", "Batch No", "Serial and Batch Bundle", "Inventory Dimension",
      "Shipping Rule", "Item Alternative", "Quality Inspection Template", "Delivery Trip",
    ]), Warehouse),
    group("Reports", stockHome, reportLinks([
      "Stock Ledger", "Stock Balance", "Quick Stock Balance", "Stock Projected Qty", "Stock Analytics", "Stock Ageing",
      "Purchase Receipt Trends", "Delivery Note Trends", "Item Price Stock", "Warehouse Wise Stock Balance",
      "Item Shortage Report", "Serial No and Batch Traceability", "Serial No Status", "Serial No Ledger",
      "Serial No Warranty Expiry", "Batch-Wise Balance History", "Batch Item Expiry Status",
      "Requested Items To Be Transferred", "Itemwise Recommended Reorder Level", "Item Variant Details",
    ]), AreaChart),
    group("Settings", stockHome, documentLinks([
      "Stock Settings", "Item Variant Settings", "Stock Reposting Settings", "Delivery Settings",
    ]), Sliders),
  ],
);

const accountingHome = "/desk/accounting";
const accounting = workspace("Accounting", "accounting", [["Core Finance", "/desk/accounting/finance"]], [
  group("Accounting", accountingHome, [
    link("Invoicing", "/desk/invoicing?sidebar=Invoicing"),
    link("Payments", "/desk/dashboard-view/Payments?sidebar=Payments"),
    link("Financial Reports", "/desk/query-report/Balance%20Sheet", PieChart),
    link("Accounts Setup", "/desk/account?sidebar=Accounts%20Setup"),
    link("Taxes", "/desk/sales-taxes-and-charges-template?sidebar=Taxes"),
    link("Banking", "/desk/bank-clearance/Bank%20Clearance?sidebar=Banking"),
    link("Budget", "/desk/budget?sidebar=Budget"),
    link("Share Management", "/desk/shareholder?sidebar=Share%20Management"),
    link("Subscription", "/desk/subscription?sidebar=Subscription"),
  ], Landmark),
]);

const assetsHome = "/desk/assets";
const assets = workspace("Assets", "assets", ["Asset", "Asset Movement", "Asset Repair", "Asset Capitalization"], [
  group("Maintenance", assetsHome, documentLinks(["Asset Maintenance", "Asset Maintenance Log"]), Hammer),
  group("Setup", assetsHome, documentLinks(["Asset Category", "Asset Location", "Asset Finance Book", "Depreciation Schedule"]), Building),
  group("Reports", assetsHome, reportLinks(["Asset Register", "Asset Depreciation Ledger", "Fixed Asset Register"]), FileBarChart),
  group("Settings", assetsHome, documentLinks(["Asset Settings"]), Settings2),
]);

const manufacturingHome = "/desk/manufacturing";
const manufacturing = workspace("Manufacturing", "manufacturing", ["Bill of Materials", "Production Plan", "Work Order", "Job Card", "Stock Entry"], [
  group("Setup", manufacturingHome, documentLinks(["Operation", "Routing", "Workstation", "Workstation Type", "BOM Update Tool"]), Layers),
  group("Reports", manufacturingHome, reportLinks(["Production Analytics", "Work Order Summary", "BOM Stock Report", "BOM Explorer"]), TrendingUp),
  group("Settings", manufacturingHome, documentLinks(["Manufacturing Settings"]), SlidersHorizontal),
]);

const projectsHome = "/desk/projects";
const projects = workspace("Projects", "projects", ["Project", "Task", "Timesheet", "Project Template"], [
  group("Setup", projectsHome, documentLinks(["Activity Type", "Activity Cost", "Project Type"]), FolderKanban),
  group("Reports", projectsHome, reportLinks(["Project Billing Summary", "Project Profitability", "Delayed Tasks Summary", "Project Summary"]), BarChart2),
  group("Settings", projectsHome, documentLinks(["Projects Settings"]), Settings2),
]);

const qualityHome = "/desk/quality";
const quality = workspace("Quality", "quality", ["Quality Goal", "Quality Procedure", "Quality Review", "Quality Action"], [
  group("Setup", qualityHome, documentLinks(["Quality Inspection", "Quality Inspection Template", "Non Conformance", "Quality Feedback"]), ShieldCheck),
  group("Reports", qualityHome, reportLinks(["Quality Inspection Summary"]), ClipboardCheck),
]);

const subcontractingHome = "/desk/subcontracting";
const subcontracting = workspace("Subcontracting", "subcontracting", ["Subcontracting Order", "Subcontracting Receipt"], [
  group("Stock", subcontractingHome, documentLinks(["Send to Subcontractor", "Stock Entry"]), Boxes),
  group("Reports", subcontractingHome, reportLinks(["Subcontracted Item To Be Received", "Subcontract Order Summary"]), TrendingUp),
  group("Settings", subcontractingHome, documentLinks(["Buying Settings", "Stock Settings"]), Settings2),
]);

const organizationHome = "/desk/organization";
const organization = workspace("Organization", "organization", [
  ["Users", "/desk/organization/users"], ["Tenants", "/desk/organization/tenants"],
  "Company", "Branch", "Department", "Cost Center",
], [
  group("People", organizationHome, documentLinks(["Employee", "Designation", "Employment Type"]), Users),
  group("Setup", organizationHome, documentLinks(["Fiscal Year", "Holiday List", "Global Defaults", "System Settings"]), Building2),
]);

const settingsHome = "/desk/erpnext-settings";
const erpnextSettings = workspace("ERPNext Settings", "erpnext-settings", [["System Configuration", "/desk/erpnext-settings/system-settings"]], [
  group("Defaults", settingsHome, documentLinks(["Global Defaults", "System Settings", "Domain Settings", "Session Default Settings"]), Globe),
  group("Modules", settingsHome, documentLinks(["Selling Settings", "Buying Settings", "Stock Settings", "Accounts Settings", "Manufacturing Settings"]), Grid),
  group("Data", settingsHome, documentLinks(["Data Import", "Data Export", "Customize Form", "Role Permission Manager"]), Database),
]);

const frameworkHome = "/desk/framework";
const framework = workspace("Framework", "framework", [], [
  group("Administration", frameworkHome, documentLinks(["User", "Role", "DocType", "Workspace", "Module Def"]), Shield),
  group("Tools", frameworkHome, documentLinks(["Data Import", "Error Log", "Activity Log", "Scheduled Job Type"]), Wrench),
  group("Settings", frameworkHome, documentLinks(["System Settings", "Website Settings", "Email Account"]), Settings2),
]);

const communication = workspace("Communication", "communication", [
  ["Email Templates", "/desk/communication/email-templates"],
  ["Email Broadcast", "/desk/communication/broadcast"],
], []);

const administration = workspace("Administration", "administration", [
  ["Audit Log", "/desk/administration/audit-log"],
], []);

export const erpWorkspaces: Record<string, ErpWorkspace> = {
  framework,
  administration,
  communication,
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
