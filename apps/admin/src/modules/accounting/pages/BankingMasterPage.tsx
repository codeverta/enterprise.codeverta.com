import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, Building2, Plus, Save, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { bankingApi, Bank, BankAccount, BankAccountType } from "../bankingApi";

const emptyBank: Bank = { id: "", bank_name: "", swift_number: "", website: "" };
const emptyAccount: BankAccount = {
  id: "", account_name: "", bank: "", account_type: "", account_subtype: "", disabled: false,
  is_default: false, is_company_account: false, party_type: "", party: "", iban: "", branch_code: "", bank_account_no: "",
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="space-y-1.5 text-sm font-medium text-slate-700">{label}{children}</label>
);

function Header({ title, isNew, back }: { title: string; isNew: boolean; back: string }) {
  return <header className="flex items-center justify-between rounded-2xl border bg-white p-5 shadow-sm">
    <div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link to={back}><ArrowLeft className="size-4" /></Link></Button><div><p className="text-sm text-slate-500">Banking / {title}</p><h1 className="text-2xl font-bold text-slate-900">{isNew ? `New ${title}` : title}</h1></div></div>
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{isNew ? "Not Saved" : "Saved"}</span>
  </header>;
}

export default function BankingMasterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // The router mounts this page through wildcard routes (`bank/*`), so new
  // records arrive as `new-bank` in `params["*"]` rather than `params.id`.
  const params = useParams<{ id?: string; "*"?: string }>();
  const id = params.id || params["*"]?.split("/").filter(Boolean).pop();
  const kind = location.pathname.startsWith("/desk/bank-account-type") ? "type" : location.pathname.startsWith("/desk/bank-account") ? "account" : "bank";
  const isNew = !id || id.startsWith("new-") || id === "new";
  const [banks, setBanks] = useState<Bank[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [types, setTypes] = useState<BankAccountType[]>([]);
  const [bank, setBank] = useState<Bank>(emptyBank);
  const [account, setAccount] = useState<BankAccount>(emptyAccount);
  const [typeName, setTypeName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOptions = async () => {
    try { const [bankRows, typeRows, accountRows] = await Promise.all([bankingApi.banks(), bankingApi.accountTypes(), bankingApi.bankAccounts()]); setBanks(bankRows); setTypes(typeRows); setAccounts(accountRows); } catch { toast.error("Gagal memuat data Banking"); }
  };
  useEffect(() => { loadOptions(); }, []);
  useEffect(() => {
    if (isNew) return;
    const load = async () => { try { if (kind === "bank") setBank({ ...emptyBank, ...(await bankingApi.bank(id!)) }); else if (kind === "account") setAccount({ ...emptyAccount, ...(await bankingApi.bankAccount(id!)) }); } catch { toast.error("Data tidak ditemukan"); navigate(`/desk/${kind === "bank" ? "bank" : "bank-account"}`); } };
    load();
  }, [id, isNew, kind, navigate]);

  const bankList = useMemo(() => banks, [banks]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      if (kind === "type") { if (!typeName.trim()) throw new Error("Account Type wajib diisi"); await bankingApi.createAccountType({ name: typeName.trim(), disabled: false }); toast.success("Bank Account Type berhasil dibuat"); setTypeName(""); await loadOptions(); return; }
      if (kind === "bank") { if (!bank.bank_name.trim()) throw new Error("Bank Name wajib diisi"); const saved = isNew ? await bankingApi.createBank(bank) : await bankingApi.updateBank(id!, bank); toast.success("Bank berhasil disimpan"); navigate(`/desk/bank/${saved.id}`, { replace: true }); setBank(saved); }
      else { if (!account.account_name.trim()) throw new Error("Account Name wajib diisi"); const saved = isNew ? await bankingApi.createBankAccount(account) : await bankingApi.updateBankAccount(id!, account); toast.success("Bank Account berhasil disimpan"); navigate(`/desk/bank-account/${saved.id}`, { replace: true }); setAccount(saved); }
    } catch (error: any) { toast.error(error?.response?.data?.error || error?.message || "Gagal menyimpan data"); } finally { setSaving(false); }
  };

  if (!id && kind !== "type") {
    const isBankList = kind === "bank";
    const rows = isBankList ? banks : accounts;
    return <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-7"><header className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Banking</p><h1 className="text-3xl font-bold text-slate-900">{isBankList ? "Bank" : "Bank Account"}</h1></div><Button asChild><Link to={`/desk/${isBankList ? "bank" : "bank-account"}/new-${isBankList ? "bank" : "bank-account"}`}><Plus className="mr-2 size-4" />New {isBankList ? "Bank" : "Bank Account"}</Link></Button></header><div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="divide-y">{rows.length ? rows.map((row: any) => <Link key={row.id} to={`/desk/${isBankList ? "bank" : "bank-account"}/${row.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"><span className="font-medium text-slate-800">{isBankList ? row.bank_name : row.account_name}</span><span className="text-xs text-slate-500">{isBankList ? row.swift_number || "—" : row.bank_account_no || "—"}</span></Link>) : <div className="p-12 text-center text-slate-500">Belum ada data {isBankList ? "Bank" : "Bank Account"}.</div>}</div></div></div>;
  }

  if (kind === "type") return <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-7"><Header title="Bank Account Type" isNew back="/desk/banking" /><form onSubmit={save} className="rounded-2xl border bg-white p-6 shadow-sm"><Field label="Account Type"><Input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="Contoh: Current Account" /></Field><Button className="mt-5" disabled={saving}><Save className="mr-2 size-4" />Save</Button></form><div className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="font-semibold">Account Types</h2><div className="mt-4 divide-y">{types.map((item) => <div className="flex justify-between py-3 text-sm" key={item.id}><span>{item.name}</span><span className="text-slate-400">{item.disabled ? "Disabled" : "Enabled"}</span></div>)}</div></div></div>;

  const isBank = kind === "bank";
  const current = isBank ? bank : account;
  const update = (key: string, value: string | boolean) => isBank ? setBank((prev) => ({ ...prev, [key]: value })) : setAccount((prev) => ({ ...prev, [key]: value }));
  return <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-7"><Header title={isBank ? "Bank" : "Bank Account"} isNew={isNew} back="/desk/banking" /><form onSubmit={save} className="space-y-6">
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="mb-5 flex items-center gap-2 font-semibold text-slate-900">{isBank ? <Building2 className="size-4" /> : <WalletCards className="size-4" />} {isBank ? "Bank Details" : "Account Details"}</h2>
      {isBank ? <div className="grid gap-5 md:grid-cols-2"><Field label="Bank Name"><Input value={bank.bank_name} onChange={(e) => update("bank_name", e.target.value)} /></Field><Field label="SWIFT number"><Input value={bank.swift_number} onChange={(e) => update("swift_number", e.target.value)} /></Field><Field label="Website"><Input value={bank.website} onChange={(e) => update("website", e.target.value)} /></Field></div> : <div className="grid gap-5 md:grid-cols-2"><Field label="Account Name"><Input value={account.account_name} onChange={(e) => update("account_name", e.target.value)} /></Field><Field label="Bank"><ERPSelect className="h-9 w-full rounded-md border bg-transparent px-3" value={account.bank} onChange={(e) => update("bank", e.target.value)}><ERPSelectOption value="">Select Bank</ERPSelectOption>{bankList.map((item) => <ERPSelectOption key={item.id} value={item.id}>{item.bank_name}</ERPSelectOption>)}</ERPSelect></Field><Field label="Account Type"><ERPSelect className="h-9 w-full rounded-md border bg-transparent px-3" value={account.account_type} onChange={(e) => update("account_type", e.target.value)}><ERPSelectOption value="">Select Account Type</ERPSelectOption>{types.map((item) => <ERPSelectOption key={item.id} value={item.id}>{item.name}</ERPSelectOption>)}</ERPSelect></Field><Field label="Account Subtype"><Input value={account.account_subtype} onChange={(e) => update("account_subtype", e.target.value)} /></Field></div>}
    </section>
    {!isBank && <><section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="mb-5 font-semibold">Account Details</h2><div className="grid gap-5 md:grid-cols-3"><Field label="IBAN"><Input value={account.iban} onChange={(e) => update("iban", e.target.value)} /></Field><Field label="Branch Code"><Input value={account.branch_code} onChange={(e) => update("branch_code", e.target.value)} /></Field><Field label="Bank Account No"><Input value={account.bank_account_no} onChange={(e) => update("bank_account_no", e.target.value)} /></Field></div></section><section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="mb-5 font-semibold">Settings</h2><div className="flex flex-wrap gap-6 text-sm"><label><input type="checkbox" checked={account.disabled} onChange={(e) => update("disabled", e.target.checked)} /> <span className="ml-2">Disabled</span></label><label><input type="checkbox" checked={account.is_default} onChange={(e) => update("is_default", e.target.checked)} /> <span className="ml-2">Is Default Account</span></label><label><input type="checkbox" checked={account.is_company_account} onChange={(e) => update("is_company_account", e.target.checked)} /> <span className="ml-2">Is Company Account</span></label></div></section></>}
    <div className="flex justify-end"><Button disabled={saving}><Save className="mr-2 size-4" />Save</Button></div>
  </form></div>;
}
