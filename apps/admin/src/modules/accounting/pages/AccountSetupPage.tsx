import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Folder,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCompanies } from "@/context/CompanyContext";
import { accountApi, type Account, type AccountInput, type CompanyOption } from "../accountApi";

const emptyAccount = (companyId = "", currency = "IDR"): AccountInput => ({
  company_id: companyId,
  parent_account_id: null,
  account_name: "",
  account_number: "",
  is_group: false,
  account_type: "",
  account_category: "",
  account_currency: currency,
  disabled: false,
});

function money(value: number, currency: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currency || "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

type TreeRowProps = {
  account: Account;
  childrenByParent: Map<string, Account[]>;
  company: CompanyOption;
  expanded: Set<string>;
  visibleIds: Set<string> | null;
  depth?: number;
  onToggle: (id: string) => void;
  onEdit: (account: Account) => void;
  onAddChild: (account: Account) => void;
};

function AccountTreeRow({
  account,
  childrenByParent,
  company,
  expanded,
  visibleIds,
  depth = 0,
  onToggle,
  onEdit,
  onAddChild,
}: TreeRowProps) {
  const children = childrenByParent.get(account.id) || [];
  const open = expanded.has(account.id) || visibleIds !== null;
  if (visibleIds && !visibleIds.has(account.id)) return null;

  return (
    <>
      <div
        className="group grid min-w-[760px] grid-cols-[minmax(360px,1fr)_150px_180px_88px] items-center border-b border-slate-100 px-3 py-1.5 text-sm transition hover:bg-blue-50/50 dark:border-slate-800 dark:hover:bg-slate-900"
        data-testid={`account-${account.account_number}`}
      >
        <div className="flex min-w-0 items-center" style={{ paddingLeft: `${depth * 22}px` }}>
          <button
            type="button"
            aria-label={open ? `Tutup ${account.account_name}` : `Buka ${account.account_name}`}
            onClick={() => account.is_group && onToggle(account.id)}
            className={cn(
              "mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-blue-600",
              !account.is_group && "pointer-events-none opacity-0",
            )}
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {account.is_group ? (
            open ? <FolderOpen className="mr-2 size-4.5 shrink-0 text-amber-500" /> : <Folder className="mr-2 size-4.5 shrink-0 text-amber-500" />
          ) : (
            <CircleDollarSign className="mr-2 size-4.5 shrink-0 text-slate-400" />
          )}
          <button type="button" onClick={() => onEdit(account)} className="min-w-0 truncate text-left font-medium text-slate-800 hover:text-blue-700 dark:text-slate-200">
            <span className="font-mono text-xs text-slate-500">{account.account_number}</span>
            <span className="mx-1.5 text-slate-300">—</span>
            {account.account_name}
            <span className="ml-1.5 text-xs text-slate-400">— {company.abbreviation}</span>
          </button>
          {account.disabled && <Badge variant="outline" className="ml-2 text-[10px]">Disabled</Badge>}
        </div>
        <div className="truncate text-xs text-slate-500">{account.account_type || "—"}</div>
        <div className={cn("text-right font-medium", account.balance < 0 ? "text-rose-600" : "text-slate-700 dark:text-slate-300")}>{money(account.balance, account.account_currency)}</div>
        <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          {account.is_group && (
            <Button type="button" variant="ghost" size="icon" title="Tambah child account" onClick={() => onAddChild(account)}>
              <Plus className="size-4 text-blue-600" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" title="Edit account" onClick={() => onEdit(account)}>
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>
      {account.is_group && open && children.map((child) => (
        <AccountTreeRow
          key={child.id}
          account={child}
          childrenByParent={childrenByParent}
          company={company}
          expanded={expanded}
          visibleIds={visibleIds}
          depth={depth + 1}
          onToggle={onToggle}
          onEdit={onEdit}
          onAddChild={onAddChild}
        />
      ))}
    </>
  );
}

export default function AccountSetupPage() {
  const { activeCompany, recordCompanySelection } = useCompanies();
  const companyChangedByUser = useRef(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<string[]>(["IDR"]);
  const [accountTypes, setAccountTypes] = useState<string[]>([]);
  const [accountCategories, setAccountCategories] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountInput>(emptyAccount());

  const selectedCompany = companies.find((company) => company.id === companyId);

  const loadAccounts = async (nextCompanyId = companyId) => {
    if (!nextCompanyId) return setAccounts([]);
    setLoading(true);
    try {
      const rows = await accountApi.list(nextCompanyId);
      setAccounts(rows);
      setExpanded((current) => current.size ? current : new Set(rows.filter((row) => !row.parent_account_id || row.is_group).map((row) => row.id)));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal memuat Chart of Accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([accountApi.companies(), accountApi.currencies(), accountApi.options()])
      .then(([companyRows, currencyRows, options]) => {
        if (!active) return;
        setCompanies(companyRows);
        setCurrencies(currencyRows.length ? currencyRows : ["IDR"]);
        setAccountTypes(options.account_types || []);
        setAccountCategories(options.account_categories || []);
        const firstCompany = companyRows[0];
        if (firstCompany) {
          setCompanyId(firstCompany.id);
          void loadAccounts(firstCompany.id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
        toast.error("Gagal memuat Accounts Setup");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!activeCompany || companyChangedByUser.current) return;
    const preferred = companies.find((company) => company.id === activeCompany.id || company.name === activeCompany.name);
    if (preferred && preferred.id !== companyId) {
      setCompanyId(preferred.id);
      void loadAccounts(preferred.id);
    }
  }, [activeCompany, companies, companyId]);

  const childrenByParent = useMemo(() => {
    const result = new Map<string, Account[]>();
    accounts.forEach((account) => {
      const key = account.parent_account_id || "root";
      result.set(key, [...(result.get(key) || []), account]);
    });
    return result;
  }, [accounts]);

  const visibleIds = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return null;
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const ids = new Set<string>();
    accounts.forEach((account) => {
      if (`${account.account_number} ${account.account_name} ${account.account_type}`.toLowerCase().includes(query)) {
        ids.add(account.id);
        let parentId = account.parent_account_id;
        while (parentId) {
          ids.add(parentId);
          parentId = byId.get(parentId)?.parent_account_id || null;
        }
      }
    });
    return ids;
  }, [accounts, search]);

  const roots = childrenByParent.get("root") || [];
  const groups = accounts.filter((account) => account.is_group && account.id !== editingId);

  const openNew = (parent?: Account) => {
    const company = companies.find((item) => item.id === (parent?.company_id || companyId));
    setEditingId(null);
    setForm({
      ...emptyAccount(company?.id || companyId, company?.currency || "IDR"),
      parent_account_id: parent?.id || null,
    });
    setDialogOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditingId(account.id);
    setForm({
      company_id: account.company_id,
      parent_account_id: account.parent_account_id,
      account_name: account.account_name,
      account_number: account.account_number,
      is_group: account.is_group,
      account_type: account.account_type,
      account_category: account.account_category,
      account_currency: account.account_currency,
      disabled: account.disabled,
    });
    setDialogOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.account_name.trim() || !form.account_number.trim() || !form.company_id) {
      toast.error("Nama, nomor akun, dan company wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (editingId) await accountApi.update(editingId, form);
      else await accountApi.create(form);
      toast.success(editingId ? "Account berhasil diperbarui" : "Account berhasil dibuat");
      setDialogOpen(false);
      await loadAccounts(form.company_id);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal menyimpan Account");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editingId || !confirm(`Hapus account ${form.account_number} - ${form.account_name}?`)) return;
    setSaving(true);
    try {
      await accountApi.remove(editingId);
      toast.success("Account berhasil dihapus");
      setDialogOpen(false);
      await loadAccounts(form.company_id);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Account tidak dapat dihapus");
    } finally {
      setSaving(false);
    }
  };

  const expandAll = () => setExpanded(new Set(accounts.filter((account) => account.is_group).map((account) => account.id)));

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 p-4 lg:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Link to="/desk/accounting" className="hover:text-blue-600 hover:underline">Accounting</Link>
            <span>/</span><span>Accounts Setup</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola struktur akun, group, tipe, mata uang, dan saldo untuk setiap company.</p>
        </div>
        <Button onClick={() => openNew()} disabled={!companyId} className="bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="mr-1.5 size-4" /> New Account
        </Button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center dark:border-slate-800">
          <div className="w-full lg:max-w-md">
            <Label className="mb-1.5 block text-xs text-slate-500">Company</Label>
            <SearchableSelect
              value={companyId}
              options={companies.map((company) => ({ value: company.id, label: company.name, sublabel: company.abbreviation, badge: company.currency }))}
              onChange={(value) => { const selected = companies.find((company) => company.id === value); companyChangedByUser.current = true; setCompanyId(value); setSearch(""); setExpanded(new Set()); void loadAccounts(value); if (selected) void recordCompanySelection(selected.name); }}
              placeholder="Pilih company..."
              searchPlaceholder="Cari company..."
              buttonClassName="h-10 text-sm"
            />
          </div>
          <div className="relative flex-1 lg:mt-5">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor, nama, atau tipe akun..." className="h-10 pl-9" />
          </div>
          <div className="flex gap-2 lg:mt-5">
            <Button variant="outline" onClick={expandAll}>Expand All</Button>
            <Button variant="outline" size="icon" title="Refresh" onClick={() => void loadAccounts()}><RefreshCw className="size-4" /></Button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-sm sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center gap-2"><Building2 className="size-4 text-blue-500" /><span className="text-slate-500">Company</span><strong className="truncate">{selectedCompany?.name || "—"}</strong></div>
          <div className="flex items-center gap-2"><Folder className="size-4 text-amber-500" /><span className="text-slate-500">Group</span><strong>{accounts.filter((account) => account.is_group).length}</strong></div>
          <div className="flex items-center gap-2"><WalletCards className="size-4 text-emerald-500" /><span className="text-slate-500">Total Account</span><strong>{accounts.length}</strong></div>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-[minmax(360px,1fr)_150px_180px_88px] border-b bg-slate-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <span>Account</span><span>Type</span><span className="text-right">Balance</span><span />
          </div>
          {loading ? (
            <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="size-5 animate-spin text-blue-600" /> Memuat Chart of Accounts...</div>
          ) : !companyId ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-center"><Building2 className="mb-3 size-10 text-slate-300" /><p className="font-semibold">Belum ada company</p><p className="mt-1 text-sm text-slate-500">Buat company terlebih dahulu di workspace Organization.</p></div>
          ) : roots.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-center"><CircleDollarSign className="mb-3 size-10 text-slate-300" /><p className="font-semibold">Chart of Accounts belum tersedia</p><Button className="mt-4" onClick={() => openNew()}><Plus className="mr-1 size-4" /> New Account</Button></div>
          ) : (
            roots.map((account) => (
              <AccountTreeRow key={account.id} account={account} childrenByParent={childrenByParent} company={selectedCompany!} expanded={expanded} visibleIds={visibleIds} onToggle={(id) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; })} onEdit={openEdit} onAddChild={openNew} />
            ))
          )}
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Account" : "New Account"}</DialogTitle>
              <DialogDescription>
                Jangan membuat account khusus untuk Customer atau Supplier. Gunakan master party dan akun Receivable/Payable.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="account_name">New Account Name <span className="text-rose-500">*</span></Label>
                <Input id="account_name" value={form.account_name} onChange={(event) => setForm({ ...form, account_name: event.target.value })} placeholder="Nama account baru" autoFocus />
                <p className="text-xs text-slate-500">Name of new Account. Note: Please don&apos;t create accounts for Customers and Suppliers.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number <span className="text-rose-500">*</span></Label>
                <Input id="account_number" value={form.account_number} onChange={(event) => setForm({ ...form, account_number: event.target.value })} placeholder="Contoh: 1111.003" className="font-mono" />
                <p className="text-xs text-slate-500">Nomor akan ditampilkan sebagai prefix nama akun.</p>
              </div>
              <div className="space-y-2">
                <Label>Company <span className="text-rose-500">*</span></Label>
                <SearchableSelect value={form.company_id} options={companies.map((company) => ({ value: company.id, label: company.name, sublabel: company.abbreviation }))} onChange={(value) => { const company = companies.find((item) => item.id === value); setForm({ ...form, company_id: value, parent_account_id: null, account_currency: company?.currency || form.account_currency }); }} disabled={Boolean(editingId)} placeholder="Begin typing for results." searchPlaceholder="Cari company..." buttonClassName="h-9 text-sm" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Parent Account</Label>
                <SearchableSelect value={form.parent_account_id || ""} options={groups.filter((account) => account.company_id === form.company_id).map((account) => ({ value: account.id, label: `${account.account_number} - ${account.account_name}` }))} onChange={(value) => setForm({ ...form, parent_account_id: value || null })} placeholder="Root account (tanpa parent)" searchPlaceholder="Cari group account..." buttonClassName="h-9 text-sm" />
                <p className="text-xs text-slate-500">Child account hanya dapat dibuat di bawah account bertipe Group.</p>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-3 sm:col-span-2 dark:border-slate-800">
                <div><Label htmlFor="is_group">Is Group</Label><p className="mt-1 text-xs text-slate-500">Further accounts can be made under Groups, but entries can be made against non-Groups.</p></div>
                <Switch id="is_group" checked={form.is_group} onCheckedChange={(checked) => setForm({ ...form, is_group: checked })} />
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <SearchableSelect value={form.account_type} options={accountTypes} onChange={(value) => setForm({ ...form, account_type: value })} placeholder="Pilih Account Type" searchPlaceholder="Cari Account Type..." buttonClassName="h-9 text-sm" />
                <p className="text-xs text-slate-500">Opsional. Digunakan untuk filter berbagai transaksi.</p>
              </div>
              <div className="space-y-2">
                <Label>Account Category</Label>
                <SearchableSelect value={form.account_category} options={accountCategories} onChange={(value) => setForm({ ...form, account_category: value })} placeholder="Begin typing for results." searchPlaceholder="Cari Account Category..." buttonClassName="h-9 text-sm" />
                <p className="text-xs text-slate-500">Opsional. Digunakan bersama Financial Report Template.</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Currency</Label>
                <SearchableSelect value={form.account_currency} options={currencies} onChange={(value) => setForm({ ...form, account_currency: value })} placeholder="Begin typing for results." searchPlaceholder="Cari currency..." buttonClassName="h-9 text-sm" />
                <p className="text-xs text-slate-500">Opsional. Menggunakan default currency company jika tidak ditentukan.</p>
              </div>
            </div>
            <DialogFooter className="flex-row justify-between sm:justify-between">
              {editingId ? <Button type="button" variant="outline" onClick={remove} disabled={saving} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="mr-1.5 size-4" /> Delete</Button> : <span />}
              <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">{saving && <Loader2 className="mr-1.5 size-4 animate-spin" />} Save</Button></div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
