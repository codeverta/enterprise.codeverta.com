import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge"; import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input"; import { Textarea } from "@/components/ui/textarea"; import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buyingApi, type MasterOptions, type Supplier } from "../api"; import { Check, Combo, Field, Section } from "../components/MasterUI";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { currencyApi, countryApi } from "@/modules/accounting/currencyApi";

type Tab = "details" | "address" | "tax" | "accounting" | "settings" | "portal";
const empty = (): Supplier => ({ supplier_name:"",supplier_type:"Company",supplier_group:"All Supplier Groups",country:"Indonesia",is_transporter:false,default_currency:"IDR",default_bank_account:"",default_price_list:"Standard Buying",supplier_details:"",website:"",language:"English",allow_purchase_invoice_creation_without_purchase_order:false,allow_purchase_invoice_creation_without_purchase_receipt:false,disabled:false,is_frozen:false,block_supplier:false,tax_id:"",tax_category:"",tax_withholding_category:"",tax_withholding_group:"",supplier_address:"",contact_person:"",contact_email:"",contact_phone:"",accounts_payable:"",portal_users:"",customer_numbers:[] });
const opts: MasterOptions = { supplier_groups:["All Supplier Groups","Distributor","Electrical","Hardware","Local","Pharmaceutical","Raw Material","Services"],suppliers:[],items:[],item_groups:[],countries:["Indonesia"],currencies:["IDR"],price_lists:["Standard Buying"],languages:["English","Bahasa Indonesia"],uoms:[],weight_uoms:[],warehouses:[] };
export default function SupplierFormPage() {
  const {id}=useParams(); const navigate=useNavigate(); const isNew=!id||id==="new"; const [tab,setTab]=useState<Tab>("details"); const [row,setRow]=useState<Supplier>(empty); const [options,setOptions]=useState(opts); const [saving,setSaving]=useState(false); const [loading,setLoading]=useState(!isNew);
  useEffect(() => {
    Promise.all([
      buyingApi.masterOptions().catch(() => opts),
      buyingApi.groupList().catch(() => []),
      currencyApi.list({ enabled: true }).catch(() => []),
      countryApi.list().catch(() => []),
    ]).then(([masterOpts, groups, currs, countries]) => {
      const groupNames = groups.map((g) => g.group_name).filter(Boolean);
      const currCodes = currs.map((c) => c.id).filter(Boolean);
      const countryNames = countries.map((c) => c.country_name).filter(Boolean);
      setOptions((prev) => ({
        ...prev,
        ...masterOpts,
        supplier_groups:
          groupNames.length > 0
            ? groupNames
            : masterOpts.supplier_groups?.length
            ? masterOpts.supplier_groups
            : prev.supplier_groups,
        currencies:
          currCodes.length > 0
            ? currCodes
            : masterOpts.currencies?.length
            ? masterOpts.currencies
            : prev.currencies,
        countries:
          countryNames.length > 0
            ? countryNames
            : masterOpts.countries?.length
            ? masterOpts.countries
            : prev.countries,
      }));
    });
    if (!isNew && id)
      buyingApi
        .supplierGet(id)
        .then((v) =>
          setRow({
            ...empty(),
            ...v,
            customer_numbers: v.customer_numbers || [],
          }),
        )
        .catch(() => {
          toast.error("Supplier tidak ditemukan");
          navigate("/desk/supplier");
        })
        .finally(() => setLoading(false));
  }, [id, isNew, navigate]);
  const update=<K extends keyof Supplier>(key:K,value:Supplier[K])=>setRow((v)=>({...v,[key]:value})); const save=async()=>{if(!row.supplier_name.trim()||!row.supplier_group.trim())return toast.error("Supplier Name dan Supplier Group wajib diisi");setSaving(true);try{const saved=isNew?await buyingApi.supplierCreate(row):await buyingApi.supplierUpdate(id!,row);toast.success("Supplier berhasil disimpan");navigate(`/desk/supplier/${saved.id}`,{replace:true});setRow(saved)}catch(e:any){toast.error(e?.response?.data?.error||"Gagal menyimpan Supplier")}finally{setSaving(false)}};
  if(loading)return <div className="p-12 text-center">Memuat Supplier...</div>; const tabs:Array<[Tab,string]>=[["details","Details"],["address","Address & Contact"],["tax","Tax"],["accounting","Accounting"],["settings","Settings"],["portal","Portal Users"]];
  return <div className="mx-auto max-w-screen-2xl p-4 lg:p-7"><header className="mb-5 flex items-center justify-between rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950"><div className="flex gap-3"><Button variant="ghost" size="icon" asChild><Link to="/desk/supplier"><ArrowLeft className="size-4"/></Link></Button><div><p className="text-sm text-slate-500">Buying / Supplier</p><div className="flex items-center gap-3"><h1 className="text-2xl font-bold">{isNew?"New Supplier":row.supplier_name}</h1><Badge variant="secondary">{isNew?"Not Saved":row.disabled?"Disabled":"Active"}</Badge></div></div></div><Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700"><Save className="size-4"/>{saving?"Saving...":"Save"}</Button></header><div className="rounded-2xl border bg-white shadow-sm dark:bg-slate-950"><Tabs value={tab} onValueChange={(v)=>setTab(v as Tab)}><TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">{tabs.map(([v,l])=><TabsTrigger className="rounded-none px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600" key={v} value={v}>{l}</TabsTrigger>)}</TabsList></Tabs><div className="space-y-8 p-5 lg:p-7">
  {tab==="details"&&<><Section title="Supplier Type"><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4"><Field label="Supplier Type" name="supplier_type"><ERPSelect className="h-9 w-full rounded-md border bg-transparent px-3" value={row.supplier_type} onChange={(e)=>update("supplier_type",e.target.value as Supplier["supplier_type"])}><ERPSelectOption>Company</ERPSelectOption><ERPSelectOption>Individual</ERPSelectOption></ERPSelect></Field><Field label="Supplier Name" name="supplier_name" required><Input value={row.supplier_name} onChange={(e)=>update("supplier_name",e.target.value)}/></Field><Field label="Supplier Group" name="supplier_group" required><Combo value={row.supplier_group} values={options.supplier_groups} onChange={(v)=>update("supplier_group",v)}/></Field><Field label="Country" name="country"><Combo value={row.country} values={options.countries} onChange={(v)=>update("country",v)}/></Field><Check checked={row.is_transporter} onChange={(v)=>update("is_transporter",v)} label="Is Transporter" name="is_transporter"/></div></Section><Section title="Defaults"><div className="grid gap-5 md:grid-cols-3"><Field label="Billing Currency" name="default_currency"><Combo value={row.default_currency} values={options.currencies} onChange={(v)=>update("default_currency",v)}/></Field><Field label="Default Company Bank Account" name="default_bank_account"><Input value={row.default_bank_account} onChange={(e)=>update("default_bank_account",e.target.value)}/></Field><Field label="Price List" name="default_price_list"><Combo value={row.default_price_list} values={options.price_lists} onChange={(v)=>update("default_price_list",v)}/></Field></div></Section><Section title="More Information" description="Statutory info and other general information about your Supplier"><div className="grid gap-5 md:grid-cols-2"><Field label="Supplier Details" name="supplier_details"><Textarea className="min-h-28" value={row.supplier_details} onChange={(e)=>update("supplier_details",e.target.value)}/></Field><div className="space-y-5"><Field label="Website" name="website"><Input type="url" value={row.website} onChange={(e)=>update("website",e.target.value)}/></Field><Field label="Print Language" name="language"><Combo value={row.language} values={options.languages} onChange={(v)=>update("language",v)}/></Field></div></div><h3 className="text-sm font-semibold">Customer Numbers</h3><div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-3">No.</th><th className="p-3 text-left">Company</th><th className="p-3 text-left">Customer Number</th><th/></tr></thead><tbody>{row.customer_numbers.length===0?<tr><td colSpan={4} className="p-6 text-center text-slate-500">No rows</td></tr>:row.customer_numbers.map((n,i)=><tr className="border-t" key={i}><td className="p-2 text-center">{i+1}</td><td className="p-2"><Input value={n.company} onChange={(e)=>update("customer_numbers",row.customer_numbers.map((x,j)=>j===i?{...x,company:e.target.value}:x))}/></td><td className="p-2"><Input value={n.customer_number} onChange={(e)=>update("customer_numbers",row.customer_numbers.map((x,j)=>j===i?{...x,customer_number:e.target.value}:x))}/></td><td><Button variant="ghost" size="icon" onClick={()=>update("customer_numbers",row.customer_numbers.filter((_,j)=>j!==i))}><Trash2 className="size-4 text-red-500"/></Button></td></tr>)}</tbody></table></div><Button variant="outline" onClick={()=>update("customer_numbers",[...row.customer_numbers,{company:"",customer_number:""}])}><Plus className="size-4"/> Add Row</Button></Section></>}
  {tab==="address"&&<><Section title="Address"><Field label="Supplier Address" name="supplier_address"><Textarea className="min-h-32" value={row.supplier_address} onChange={(e)=>update("supplier_address",e.target.value)}/></Field></Section><Section title="Contact"><div className="grid gap-5 md:grid-cols-3"><Field label="Contact Person" name="contact_person"><Input value={row.contact_person} onChange={(e)=>update("contact_person",e.target.value)}/></Field><Field label="Email" name="contact_email"><Input type="email" value={row.contact_email} onChange={(e)=>update("contact_email",e.target.value)}/></Field><Field label="Phone" name="contact_phone"><Input value={row.contact_phone} onChange={(e)=>update("contact_phone",e.target.value)}/></Field></div></Section></>}
  {tab==="tax"&&<Section title="Tax"><div className="grid gap-5 md:grid-cols-2"><Field label="Tax ID" name="tax_id"><Input value={row.tax_id} onChange={(e)=>update("tax_id",e.target.value)}/></Field><Field label="Tax Category" name="tax_category"><Input value={row.tax_category} onChange={(e)=>update("tax_category",e.target.value)}/></Field><Field label="Tax Withholding Category" name="tax_withholding_category"><Input value={row.tax_withholding_category} onChange={(e)=>update("tax_withholding_category",e.target.value)}/></Field><Field label="Tax Withholding Group" name="tax_withholding_group"><Input value={row.tax_withholding_group} onChange={(e)=>update("tax_withholding_group",e.target.value)}/></Field></div></Section>}
  {tab==="accounting"&&<Section title="Accounting"><Field label="Accounts Payable" name="accounts_payable"><Input value={row.accounts_payable} onChange={(e)=>update("accounts_payable",e.target.value)}/></Field></Section>}
  {tab==="settings"&&<><Section title="Purchase Invoice Settings"><div className="space-y-4"><Check checked={row.allow_purchase_invoice_creation_without_purchase_order} onChange={(v)=>update("allow_purchase_invoice_creation_without_purchase_order",v)} label="Allow Purchase Invoice Creation Without Purchase Order" name="allow_purchase_invoice_creation_without_purchase_order"/><Check checked={row.allow_purchase_invoice_creation_without_purchase_receipt} onChange={(v)=>update("allow_purchase_invoice_creation_without_purchase_receipt",v)} label="Allow Purchase Invoice Creation Without Purchase Receipt" name="allow_purchase_invoice_creation_without_purchase_receipt"/><Check checked={row.disabled} onChange={(v)=>update("disabled",v)} label="Disabled" name="disabled"/></div></Section><Section title="RFQ and Purchase Order Settings"><Check checked={row.is_frozen} onChange={(v)=>update("is_frozen",v)} label="Is Frozen" name="is_frozen"/></Section><Section title="Block Supplier"><Check checked={row.block_supplier} onChange={(v)=>update("block_supplier",v)} label="Block Supplier" name="block_supplier"/></Section></>}
  {tab==="portal"&&<Section title="Portal Users"><Field label="Portal User Emails" name="portal_users"><Textarea className="min-h-40" placeholder="Satu email per baris" value={row.portal_users} onChange={(e)=>update("portal_users",e.target.value)}/></Field></Section>}
  </div></div></div>;
}
