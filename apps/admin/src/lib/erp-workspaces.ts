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
  Banknote,
  BarChart,
  BarChart2,
  BarChart3,
  Barcode,
  BookMarked,
  BookOpen,
  Bookmark,
  Box,
  Boxes,
  Brain,
  Briefcase,
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
  Compass,
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
  GraduationCap,
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
  Plane,
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
  "Roster": Calendar,
  "Employee Attendance Tool": UserCheck,
  "Employee Checkin": LogIn,
  "Shift Request": Clock,
  "Attendance Request": ClipboardCheck,
  "Overtime": Clock,
  "Overtime Type": Sliders,
  "Overtime Slip": Receipt,
  "Shift Type": Clock,
  "Shift Location": MapPin,
  "Shift Schedule": Calendar,
  "Employee Advance": Coins,
  "Expense Claim": Receipt,
  "Purpose of Travel": MapPin,
  "Travel Request": Plane,
  "Vehicle Log": FileText,
  "Payment Entry": CreditCard,
  "Journal Entry": BookOpen,
  "Expense Claim Type": Tags,
  "Driver": User,
  "Vehicle": Truck,
  "Hiring Pipeline": GitMerge,
  "Job Opening": Briefcase,
  "Job Applicant": Users,
  "Interview": MessageSquare,
  "Job Offer": FileCheck,
  "Appointment Letter": Scroll,
  "Job Requisition": FileText,
  "Staffing Plan": Layers,
  "Employee Referral": UserPlus,
  "Interview Type": Sliders,
  "Job Opening Template": FileCode,
  "Appointment Letter Template": FileCheck,
  "Job Offer Term Template": FileCheck,
  "Job Portal": Globe,
  "Organizational Chart": Network,
  "Employee Group": Users,
  "Employee Grade": Award,
  "Payroll Entry": Banknote,
  "Salary Structure Assignment": FileCheck,
  "Salary Slip": Receipt,
  "Additional Salary": Coins,
  "Salary Withholding": ShieldAlert,
  "Salary Component": Grid,
  "Salary Structure": Layers,
  "Goal": Target,
  "Appraisal Cycle": RotateCcw,
  "Appraisal": Award,
  "Employee Performance Feedback": MessageSquare,
  "Employee Promotion": TrendingUp,
  "Appraisal Template": FileText,
  "KRA": Target,
  "Employee Feedback Criteria": ListChecks,
  "Employee Onboarding": UserPlus,
  "Employee Separation": UserX,
  "Employee Grievance": AlertCircle,
  "Employee Skill Map": Brain,
  "Grievance Type": AlertTriangle,
  "Training Program": GraduationCap,
  "Training Event": Calendar,
  "Training Feedback": MessageSquare,
  "Training Result": Award,
  "Leave Application": FileText,
  "Leave Allocation": PieChart,
  "Leave Policy": Scroll,
  "Leave Block List": ShieldAlert,
  "Leave Type": Tag,
  "Leave Period": Calendar,
  "Leave Policy Assignment": FileCheck,
  "Employee Tax Exemption Proof Submission": Upload,
  "Employee Tax Exemption Declaration": FileCheck,
  "Employee Benefit Claim": Gift,
  "Employee Benefit Application": FileText,
  "Employee Tax Exemption Category": Grid,
  "Employee Tax Exemption Sub Category": Layers,
  "Benefit Scheme": Sparkles,
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
  "Monthly Attendance Sheet": FileSpreadsheet,
  "Shift Attendance": BarChart2,
  "Employee Hours Utilization": LineChart,
  "Unpaid Expense Claim": AlertCircle,
  "Vehicle Expenses": BarChart3,
  "Accounts Receivable": PieChart,
  "Accounts Payable": PieChart,
  "General Ledger": BookOpen,
  "Recruitment Analytics": LineChart,
  "Employee CTC Break-up": PieChart,
  "Salary Register": FileSpreadsheet,
  "Income Tax Deductions": Percent,
  "Professional Tax Deductions": Percent,
  "Appraisal Overview": PieChart,
  "Employee Exits": UserX,
  "Employee Birthday": Gift,
  "Employee Information": FileText,
  "Employee Analytics": LineChart,
  "Leave Ledger": FileBarChart,
  "Employee Leave Balance": Scale,
  "Employee Tax Exemption Report": FileBarChart,
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
  "Travel": Compass,
  "Accounting Entries": Landmark,
  "Planning": Layers,
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
    ["Loyalty Program", "/desk/loyalty-program"],
  ],
  [
    group("Point of Sale (Kasir)", sellingHome, documentLinks([
      ["Open POS", "/desk/point-of-sale"], "POS Profile", "POS Invoice", "POS Opening Entry", "POS Closing Entry",
      "POS Invoice Merge Log", "POS Settings", "Loyalty Program", "Loyalty Point Entry",
    ]), Store),
    group("Item & Harga", sellingHome, documentLinks([
      "Item", "Item Group", "Price List", "Item Price", "Pricing Rule", "Promotional Scheme",
      "Coupon Code", "Blanket Order",
    ]), Tags),
    group("Pengaturan & Master Data", sellingHome, documentLinks([
      "Customer", "Customer Group", "Address", "Contact", "Territory", "Campaign", "Sales Person",
      "Sales Partner", "Monthly Distribution", "Terms Template", ["Tax Template", "/desk/sales-taxes-and-charges-template"],
      "Product Bundle", "UTM Source", "Shipping Rule",
    ]), UserCheck),
    group("Laporan & Analisis", sellingHome, reportLinks([
      "Sales Register", 
    ]), LineChart),
    group("Pengaturan", sellingHome, documentLinks(["Selling Settings"]), SlidersHorizontal),
  ],
);

const buyingHome = "/desk/buying";
const buying = workspace(
  "Buying",
  "buying",
  ["Material Request", "Request for Quotation", "Supplier Quotation", "Purchase Order", "Purchase Invoice"],
  [
    group("Pengaturan & Master Data", buyingHome, documentLinks([
      "Supplier", "Supplier Group", "Item", "Price List", "Address", ["Contacts", "/desk/contact"],
      "Supplier Scorecard", "Supplier Scorecard Criteria", "Supplier Scorecard Variable", "Supplier Scorecard Standing",
    ]), Building2),
    group("Laporan & Analisis", buyingHome, reportLinks([
      "Purchase Analytics", "Purchase Order Analysis", "Requested Items to Order and Receive", "Items To Be Requested",
      "Item-wise Purchase History", "Purchase Receipt Trends", "Purchase Invoice Trends", "Purchase Order Trends",
      "Procurement Tracker", "Supplier-Wise Sales Analytics", "Supplier Quotation Comparison",
      "Supplier Addresses And Contacts",
    ]), PieChart),
    group("Pengaturan", buyingHome, [link("Buying Settings", "/desk/buying-settings/Buying%20Settings", Settings2)], Settings2),
  ],
);

const stockHome = "/desk/stock";
const stock = workspace(
  "Stock",
  "stock",
  ["Stock Entry", "Purchase Receipt", "Delivery Note", "Material Request", "Pick List", "Shipment"],
  [
    group("Alat & Operasional", stockHome, documentLinks([
      "Stock Reconciliation", "Landed Cost Voucher", "Repost Item Valuation", "Packing Slip", "Quality Inspection",
    ]), PackageCheck),
    group("Pengaturan & Master Data", stockHome, documentLinks([
      "Item", "Item Group", "Item Attribute", "Brand", "Warehouse", ["Unit of Measure (UOM)", "/desk/uom"],
      "UOM Conversion Factor", "Serial No", "Batch No", "Serial and Batch Bundle", "Inventory Dimension",
      "Shipping Rule", "Item Alternative", "Quality Inspection Template", "Delivery Trip",
    ]), Warehouse),
    group("Laporan & Analisis", stockHome, reportLinks([
      "Stock Ledger", "Stock Balance", "Quick Stock Balance", "Stock Projected Qty", "Stock Analytics", "Stock Ageing",
      "Purchase Receipt Trends", "Delivery Note Trends", "Item Price Stock", "Warehouse Wise Stock Balance",
      "Item Shortage Report", "Serial No and Batch Traceability", "Serial No Status", "Serial No Ledger",
      "Serial No Warranty Expiry", "Batch-Wise Balance History", "Batch Item Expiry Status",
      "Requested Items To Be Transferred", "Itemwise Recommended Reorder Level", "Item Variant Details",
    ]), AreaChart),
    group("Pengaturan", stockHome, documentLinks([
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
  ["Users", "/desk/organization/users"], ["Tenants", "/desk/organization/tenants"], ["Role & Permissions", "/desk/organization/permissions"],
  "Company", "Branch", "Department", "Cost Center",
], [
  group("People", organizationHome, documentLinks(["Employee", "Designation", "Employment Type"]), Users),
  group("Setup", organizationHome, documentLinks(["Fiscal Year", "Holiday List", "Global Defaults", "System Settings"]), Building2),
]);

const settingsHome = "/desk/erpnext-settings";
const erpnextSettings = workspace("Settings", "erpnext-settings", [["System Configuration", "/desk/erpnext-settings/system-settings"]], [
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

const shiftAndAttendanceHome = "/desk/shift-and-attendance";
const shiftAndAttendance = workspace(
  "Shift & Attendance",
  "shift-and-attendance",
  [
    ["Roster", "/desk/roster"],
    ["Employee Attendance Tool", "/desk/employee-attendance-tool"],
    ["Employee Checkin", "/desk/employee-checkin"],
    ["Shift Request", "/desk/shift-request"],
    ["Attendance Request", "/desk/attendance-request"],
    ["Overtime", "/desk/overtime"],
    ["Overtime Type", "/desk/overtime-type"],
    ["Overtime Slip", "/desk/overtime-slip"],
  ],
  [
    group("Reports", shiftAndAttendanceHome, reportLinks([
      "Monthly Attendance Sheet",
      "Shift Attendance",
      "Employee Hours Utilization",
      "Project Profitability",
    ]), LineChart),
    group("Setup", shiftAndAttendanceHome, documentLinks([
      "Shift Type",
      "Shift Location",
      "Shift Schedule",
      "Activity Type",
      "Timesheet",
    ]), Sliders),
    group("Settings", shiftAndAttendanceHome, documentLinks([
      ["Shift & Attendance Settings", "/desk/shift-and-attendance-settings"],
    ]), Settings2),
  ],
);

const expensesHome = "/desk/expenses";
const expenses = workspace(
  "Expenses",
  "expenses",
  [
    "Employee Advance",
    "Expense Claim",
  ],
  [
    group("Travel", expensesHome, documentLinks([
      "Purpose of Travel",
      "Travel Request",
      "Vehicle Log",
    ]), Compass),
    group("Accounting Entries", expensesHome, documentLinks([
      "Payment Entry",
      "Journal Entry",
    ]), Landmark),
    group("Reports", expensesHome, reportLinks([
      "Unpaid Expense Claim",
      "Vehicle Expenses",
      "Accounts Receivable",
      "Accounts Payable",
      "General Ledger",
    ]), LineChart),
    group("Setup", expensesHome, documentLinks([
      "Expense Claim Type",
      "Driver",
      "Vehicle",
    ]), Sliders),
    group("Settings", expensesHome, documentLinks([
      ["Expenses Settings", "/desk/expense-settings"],
    ]), Settings2),
  ],
);

const recruitmentHome = "/desk/recruitment";
const recruitment = workspace(
  "Recruitment",
  "recruitment",
  [
    ["Hiring Pipeline", "/desk/hiring-pipeline"],
    "Job Opening",
    "Job Applicant",
    "Interview",
    "Job Offer",
    "Appointment Letter",
  ],
  [
    group("Planning", recruitmentHome, documentLinks([
      "Job Requisition",
      "Staffing Plan",
      "Employee Referral",
    ]), Layers),
    group("Reports", recruitmentHome, reportLinks([
      "Recruitment Analytics",
    ]), PieChart),
    group("Setup", recruitmentHome, documentLinks([
      "Interview Type",
      "Job Opening Template",
      "Appointment Letter Template",
      "Job Offer Term Template",
    ]), Sliders),
    link("Job Portal", "/desk/job-portal", Globe),
    group("Settings", recruitmentHome, documentLinks([
      ["Recruitment Settings", "/desk/recruitment-settings"],
    ]), Settings2),
  ],
);

const hrSetupHome = "/desk/hr-setup";
const hrSetup = workspace(
  "HR Setup",
  "hr-setup",
  [
    "Employee",
    ["Organizational Chart", "/desk/organizational-chart"],
  ],
  [
    group("Setup", hrSetupHome, documentLinks([
      "Company",
      "Branch",
      "Department",
      "Designation",
      "Employee Group",
      "Employee Grade",
    ]), Sliders),
    group("Settings", hrSetupHome, documentLinks([
      ["HR Settings", "/desk/hr-settings"],
    ]), Settings2),
  ],
);

const payrollHome = "/desk/payroll";
const payroll = workspace(
  "Payroll",
  "payroll",
  [
    "Payroll Entry",
    "Salary Structure Assignment",
    "Salary Slip",
    "Additional Salary",
    "Salary Withholding",
  ],
  [
    group("Reports", payrollHome, reportLinks([
      "Employee CTC Break-up",
      "Salary Register",
      "Income Tax Deductions",
      "Professional Tax Deductions",
      "General Ledger",
      "Accounts Payable",
    ]), PieChart),
    group("Setup", payrollHome, documentLinks([
      "Salary Component",
      "Salary Structure",
    ]), Sliders),
    group("Settings", payrollHome, documentLinks([
      ["Payroll Settings", "/desk/payroll-settings"],
    ]), Settings2),
  ],
);

const performanceHome = "/desk/performance";
const performanceWorkspace = workspace(
  "Performance",
  "performance",
  [
    "Goal",
    "Appraisal Cycle",
    "Appraisal",
    "Employee Performance Feedback",
    "Employee Promotion",
  ],
  [
    group("Reports", performanceHome, reportLinks([
      "Appraisal Overview",
    ]), LineChart),
    group("Setup", performanceHome, documentLinks([
      "Appraisal Template",
      "KRA",
      "Employee Feedback Criteria",
    ]), Sliders),
  ],
);

const tenureHome = "/desk/tenure";
const tenure = workspace(
  "Tenure",
  "tenure",
  [
    "Employee Onboarding",
    "Employee Separation",
    "Employee Grievance",
  ],
  [
    group("Reports", tenureHome, reportLinks([
      "Employee Exits",
      "Employee Birthday",
      "Employee Information",
      "Employee Analytics",
    ]), LineChart),
    group("Setup", tenureHome, documentLinks([
      "Employee Skill Map",
      "Grievance Type",
      "Training Program",
      "Training Event",
      "Training Feedback",
      "Training Result",
    ]), Sliders),
    group("Settings", tenureHome, documentLinks([
      ["Tenure Settings", "/desk/tenure-settings"],
    ]), Settings2),
  ],
);

const leavesHome = "/desk/leaves";
const leaves = workspace(
  "Leaves",
  "leaves",
  [
    "Leave Application",
    "Leave Allocation",
    "Leave Policy",
    "Leave Block List",
  ],
  [
    group("Reports", leavesHome, reportLinks([
      "Leave Ledger",
      "Employee Leave Balance",
    ]), LineChart),
    group("Setup", leavesHome, documentLinks([
      "Leave Type",
      "Leave Period",
      "Leave Policy Assignment",
    ]), Sliders),
    group("Settings", leavesHome, documentLinks([
      ["Leave Settings", "/desk/leave-settings"],
    ]), Settings2),
  ],
);

const taxAndBenefitsHome = "/desk/tax-and-benefits";
const taxAndBenefits = workspace(
  "Tax & Benefits",
  "tax-and-benefits",
  [
    "Employee Tax Exemption Proof Submission",
    "Employee Tax Exemption Declaration",
    "Employee Benefit Claim",
    "Employee Benefit Application",
  ],
  [
    group("Reports", taxAndBenefitsHome, reportLinks([
      "Employee Tax Exemption Report",
    ]), LineChart),
    group("Setup", taxAndBenefitsHome, documentLinks([
      "Employee Tax Exemption Category",
      "Employee Tax Exemption Sub Category",
      "Benefit Scheme",
    ]), Sliders),
    group("Settings", taxAndBenefitsHome, documentLinks([
      ["Tax & Benefits Settings", "/desk/tax-and-benefits-settings"],
    ]), Settings2),
  ],
);

const hrHome = "/desk/hr";
const hr = workspace(
  "Human Resources",
  "hr",
  [
    ["Expenses", "/desk/expenses?sidebar=Expenses"],
    ["Performance", "/desk/performance?sidebar=Performance"],
    ["Tenure", "/desk/tenure?sidebar=Tenure"],
    ["HR Setup", "/desk/hr-setup?sidebar=HR%20Setup"],
    ["Recruitment", "/desk/recruitment?sidebar=Recruitment"],
    ["Leaves", "/desk/leaves?sidebar=Leaves"],
    ["Shift & Attendance", "/desk/shift-and-attendance?sidebar=Shift%20%26%20Attendance"],
    ["Payroll", "/desk/payroll?sidebar=Payroll"],
    ["Tax & Benefits", "/desk/tax-and-benefits?sidebar=Tax%20%26%20Benefits"],
  ],
  [],
);

export const erpWorkspaces: Record<string, ErpWorkspace> = {
  hr,
  "shift-and-attendance": shiftAndAttendance,
  "shift-attendance": shiftAndAttendance,
  expenses,
  recruitment,
  "hr-setup": hrSetup,
  payroll,
  performance: performanceWorkspace,
  tenure,
  leaves,
  "tax-and-benefits": taxAndBenefits,
  "tax-and-benef": taxAndBenefits,
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
