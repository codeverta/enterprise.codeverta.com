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
  Mail,
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
  { name: "CRM (Pelanggan)", slug: "crm", icon: ContactRound, muted: false },
  { name: "SDM (HR)", slug: "hr", icon: Users, muted: false },
  { name: "Framework", slug: "framework", icon: Package, muted: true },
  { name: "Organisasi", slug: "organization", icon: Building2, muted: false },
  { name: "Akuntansi & Keuangan", slug: "accounting", icon: WalletCards, muted: false },
  { name: "Aset", slug: "assets", icon: Boxes, muted: false },
  { name: "Pembelian (Buying)", slug: "buying", icon: Tags, muted: false },
  { name: "Manufaktur & Produksi", slug: "manufacturing", icon: Factory, muted: false },
  { name: "Manajemen Proyek", slug: "projects", icon: ClipboardCheck, muted: false },
  { name: "Kualitas (QC)", slug: "quality", icon: ShieldCheck, muted: false },
  { name: "Penjualan (Selling)", slug: "selling", icon: ShoppingBag, muted: false },
  { name: "Stok & Logistik", slug: "stock", icon: Package, muted: false },
  { name: "Subkontrak", slug: "subcontracting", icon: RefreshCw, muted: false },
  { name: "Komunikasi", slug: "communication", icon: Mail, muted: false },
  { name: "Administrasi", slug: "administration", icon: ShieldCheck, muted: false },
  { name: "Pengaturan Sistem", slug: "erpnext-settings", icon: Settings, muted: false },
] as const;

export const hrSubmodules = [
  { name: "Klaim Biaya (Expenses)", slug: "expenses", href: "/desk/expenses?sidebar=Expenses", icon: ReceiptText },
  { name: "Penilaian Kinerja", slug: "performance", href: "/desk/performance?sidebar=Performance", icon: FileChartColumn },
  { name: "Masa Kerja & Karyawan", slug: "tenure", href: "/desk/tenure?sidebar=Tenure", icon: Users },
  { name: "Pengaturan HR", slug: "hr-setup", href: "/desk/hr-setup?sidebar=HR%20Setup", icon: Building2 },
  { name: "Perekrutan (Recruitment)", slug: "recruitment", href: "/desk/recruitment?sidebar=Recruitment", icon: ContactRound },
  { name: "Cuti & Izin (Leaves)", slug: "leaves", href: "/desk/leaves?sidebar=Leaves", icon: RefreshCw },
  { name: "Shift & Kehadiran", slug: "shift-and-attendance", href: "/desk/shift-and-attendance?sidebar=Shift%20%26%20Attendance", icon: ClipboardCheck },
  { name: "Penggajian (Payroll)", slug: "payroll", href: "/desk/payroll?sidebar=Payroll", icon: Banknote },
  { name: "Pajak & Tunjangan", slug: "tax-and-benefits", href: "/desk/tax-and-benefits?sidebar=Tax%20%26%20Benefits", icon: CircleDollarSign },
] as const;

export const accountingMenus = [
  { name: "Faktur & Penagihan", href: "/desk/invoicing?sidebar=Invoicing", icon: ReceiptText },
  { name: "Pembayaran", href: "/desk/dashboard-view/Payments?sidebar=Payments", icon: CreditCard },
  { name: "Laporan Keuangan", href: "/desk/query-report/Balance%20Sheet", icon: FileChartColumn },
  { name: "Pengaturan Akun (COA)", href: "/desk/account?sidebar=Accounts%20Setup", icon: CircleDollarSign },
  { name: "Pajak & Tarif", href: "/desk/sales-taxes-and-charges-template?sidebar=Taxes", icon: BadgeDollarSign },
  { name: "Perbankan", href: "/desk/bank-clearance/Bank%20Clearance?sidebar=Banking", icon: Landmark },
  { name: "Anggaran (Budget)", href: "/desk/budget?sidebar=Budget", icon: PiggyBank },
  { name: "Manajemen Saham", href: "/desk/shareholder?sidebar=Share%20Management", icon: Users },
  { name: "Langganan", href: "/desk/subscription?sidebar=Subscription", icon: Banknote },
] as const;

