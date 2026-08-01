import {
  BadgeDollarSign,
  Banknote,
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  ContactRound,
  CreditCard,
  Factory,
  FileChartColumn,
  Landmark,
  Package,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tags,
  Users,
  WalletCards,
} from "lucide-react";

export const ADMIN_ROLE = 99;

export const isAdminRole = (role: unknown) => Number(role || 0) >= ADMIN_ROLE;

export const getAuthenticatedLandingPath = (user: { role?: unknown } | null | undefined) =>
  isAdminRole(user?.role) ? "/desk" : "/dashboard";

export const deskModules = [
  { name: "CRM", slug: "crm", icon: ContactRound, muted: false },
  { name: "Framework", slug: "framework", icon: Package, muted: true },
  { name: "Organization", slug: "organization", icon: Building2, muted: false },
  { name: "Accounting", slug: "accounting", icon: WalletCards, muted: false },
  { name: "Assets", slug: "assets", icon: Boxes, muted: false },
  { name: "Buying", slug: "buying", icon: Tags, muted: false },
  { name: "Manufacturing", slug: "manufacturing", icon: Factory, muted: false },
  { name: "Projects", slug: "projects", icon: ClipboardCheck, muted: false },
  { name: "Quality", slug: "quality", icon: ShieldCheck, muted: false },
  { name: "Selling", slug: "selling", icon: ShoppingBag, muted: false },
  { name: "Stock", slug: "stock", icon: Package, muted: false },
  { name: "Subcontracting", slug: "subcontracting", icon: RefreshCw, muted: false },
  { name: "Settings", slug: "erpnext-settings", icon: Settings, muted: false },
] as const;

export const accountingMenus = [
  { name: "Invoicing", href: "/desk/invoicing?sidebar=Invoicing", icon: ReceiptText },
  { name: "Payments", href: "/desk/dashboard-view/Payments?sidebar=Payments", icon: CreditCard },
  { name: "Financial Reports", href: "/desk/query-report/Balance%20Sheet", icon: FileChartColumn },
  { name: "Accounts Setup", href: "/desk/account?sidebar=Accounts%20Setup", icon: CircleDollarSign },
  { name: "Taxes", href: "/desk/sales-taxes-and-charges-template?sidebar=Taxes", icon: BadgeDollarSign },
  { name: "Banking", href: "/desk/bank-clearance/Bank%20Clearance?sidebar=Banking", icon: Landmark },
  { name: "Budget", href: "/desk/budget?sidebar=Budget", icon: PiggyBank },
  { name: "Share Management", href: "/desk/shareholder?sidebar=Share%20Management", icon: Users },
  { name: "Subscription", href: "/desk/subscription?sidebar=Subscription", icon: Banknote },
] as const;
