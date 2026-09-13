import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderTree,
  GitFork,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";

const NONE = "__none__";

type Company = {
  id: string;
  name: string;
  abbreviation: string;
  tax_id?: string;
  domain?: string;
  email?: string;
  phone?: string;
  address?: string;
  currency: string;
  is_group: boolean;
  is_active: boolean;
};

type Branch = {
  id: string;
  company_id: string;
  company?: Company;
  name: string;
  branch_code?: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
};

type Department = {
  id: string;
  company_id?: string | null;
  company?: Company;
  branch_id?: string | null;
  branch?: Branch;
  name: string;
  department_code?: string;
  parent_department_id?: string | null;
  parent_department?: Department;
  is_group: boolean;
  is_active: boolean;
};

type LetterHead = {
  id: string;
  company_id?: string | null;
  company?: Company;
  name: string;
  header_html?: string;
  footer_html?: string;
  logo_url?: string;
  is_default: boolean;
  is_active: boolean;
};

type ActiveTab = "department" | "company" | "branch" | "letter-head";
type Entity = "department" | "company" | "branch" | "letter-head";

type DeleteTarget = {
  entity: Entity;
  id: string;
  label: string;
} | null;

const emptyDepartment = () => ({
  id: "",
  name: "",
  department_code: "",
  company_id: "",
  branch_id: "",
  parent_department_id: "",
  is_group: false,
  is_active: true,
});

const emptyCompany = () => ({
  id: "",
  name: "",
  abbreviation: "",
  tax_id: "",
  domain: "",
  email: "",
  phone: "",
  address: "",
  currency: "IDR",
  is_group: false,
  is_active: true,
});

const emptyBranch = () => ({
  id: "",
  name: "",
  branch_code: "",
  company_id: "",
  address: "",
  phone: "",
  email: "",
  is_active: true,
});

const emptyLetterHead = () => ({
  id: "",
  name: "",
  company_id: "",
  header_html: "",
  footer_html: "",
  logo_url: "",
  is_default: false,
  is_active: true,
});

export default function OrganizationDeskPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const activeTab: ActiveTab = pathname.includes("/company")
    ? "company"
    : pathname.includes("/branch")
      ? "branch"
      : pathname.includes("/letter-head")
        ? "letter-head"
        : "department";

  const [searchQuery, setSearchQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [letterHeads, setLetterHeads] = useState<LetterHead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");

  const [deptOpen, setDeptOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [letterHeadOpen, setLetterHeadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [deptForm, setDeptForm] = useState(emptyDepartment);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [branchForm, setBranchForm] = useState(emptyBranch);
  const [letterHeadForm, setLetterHeadForm] = useState(emptyLetterHead);

  const request = async <T,>(path: string, init?: { method?: string; body?: string }): Promise<T> => {
    const response = await api.request<T>({
      url: path.replace(/^\/api/, ""),
      method: init?.method || "GET",
      data: init?.body ? JSON.parse(init.body) : undefined,
    });
    return response.data;
  };

  const fetchOrganizationData = async () => {
    setLoading(true);
    setError("");
    try {
      const [compData, branchData, deptData, lhData] = await Promise.all([
        request<{ data: Company[] }>("/api/organization/companies"),
        request<{ data: Branch[] }>("/api/organization/branches"),
        request<{ data: Department[] }>("/api/organization/departments"),
        request<{ data: LetterHead[] }>("/api/organization/letter-heads"),
      ]);
      setCompanies(compData.data || []);
      setBranches(branchData.data || []);
      setDepartments(deptData.data || []);
      setLetterHeads(lhData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data organisasi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const filteredDepartments = useMemo(
    () =>
      departments.filter((item) => {
        const haystack = [item.name, item.department_code, item.company?.name, item.branch?.name, item.parent_department?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(searchQuery.toLowerCase());
      }),
    [departments, searchQuery],
  );

  const filteredCompanies = useMemo(
    () =>
      companies.filter((item) =>
        [item.name, item.abbreviation, item.tax_id, item.email, item.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      ),
    [companies, searchQuery],
  );

  const filteredBranches = useMemo(
    () =>
      branches.filter((item) =>
        [item.name, item.branch_code, item.company?.name, item.email, item.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      ),
    [branches, searchQuery],
  );

  const filteredLetterHeads = useMemo(
    () =>
      letterHeads.filter((item) =>
        [item.name, item.company?.name, item.logo_url]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      ),
    [letterHeads, searchQuery],
  );

  const deptCompanyBranches = deptForm.company_id
    ? branches.filter((item) => item.company_id === deptForm.company_id)
    : branches;
  const parentDepartmentOptions = departments.filter((item) => item.id !== deptForm.id);

  const seedOrganization = async () => {
    setSeeding(true);
    setError("");
    try {
      await request("/api/organization/seed", { method: "POST" });
      await fetchOrganizationData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat data default");
    } finally {
      setSeeding(false);
    }
  };

  const saveCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveEntity(
      "company",
      companyForm.id,
      "/api/organization/companies",
      cleanPayload(companyForm),
      () => {
        setCompanyOpen(false);
        setCompanyForm(emptyCompany());
      },
    );
  };

  const saveBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveEntity(
      "branch",
      branchForm.id,
      "/api/organization/branches",
      cleanPayload(branchForm),
      () => {
        setBranchOpen(false);
        setBranchForm(emptyBranch());
      },
    );
  };

  const saveDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveEntity(
      "department",
      deptForm.id,
      "/api/organization/departments",
      cleanPayload({
        ...deptForm,
        company_id: nullable(deptForm.company_id),
        branch_id: nullable(deptForm.branch_id),
        parent_department_id: nullable(deptForm.parent_department_id),
      }),
      () => {
        setDeptOpen(false);
        setDeptForm(emptyDepartment());
      },
    );
  };

  const saveLetterHead = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveEntity(
      "letter-head",
      letterHeadForm.id,
      "/api/organization/letter-heads",
      cleanPayload({
        ...letterHeadForm,
        company_id: nullable(letterHeadForm.company_id),
      }),
      () => {
        setLetterHeadOpen(false);
        setLetterHeadForm(emptyLetterHead());
      },
    );
  };

  const saveEntity = async (
    entity: Entity,
    id: string,
    collectionPath: string,
    payload: Record<string, unknown>,
    onSuccess: () => void,
  ) => {
    setSaving(true);
    setError("");
    try {
      await request(id ? `${collectionPath}/${id}` : collectionPath, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      onSuccess();
      await fetchOrganizationData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Gagal menyimpan ${entity}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteEntity = async () => {
    if (!deleteTarget) return;
    const pathByEntity: Record<Entity, string> = {
      company: "/api/organization/companies",
      branch: "/api/organization/branches",
      department: "/api/organization/departments",
      "letter-head": "/api/organization/letter-heads",
    };
    setSaving(true);
    setError("");
    try {
      await request(`${pathByEntity[deleteTarget.entity]}/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await fetchOrganizationData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus data");
    } finally {
      setSaving(false);
    }
  };

  const openCompanyForm = (row?: Company) => {
    setCompanyForm(row ? { ...emptyCompany(), ...row } : emptyCompany());
    setCompanyOpen(true);
  };

  const openBranchForm = (row?: Branch) => {
    setBranchForm(row ? { ...emptyBranch(), ...row } : emptyBranch());
    setBranchOpen(true);
  };

  const openDepartmentForm = (row?: Department) => {
    setDeptForm(
      row
        ? {
            ...emptyDepartment(),
            ...row,
            company_id: row.company_id || "",
            branch_id: row.branch_id || "",
            parent_department_id: row.parent_department_id || "",
          }
        : emptyDepartment(),
    );
    setDeptOpen(true);
  };

  const openLetterHeadForm = (row?: LetterHead) => {
    setLetterHeadForm(row ? { ...emptyLetterHead(), ...row, company_id: row.company_id || "" } : emptyLetterHead());
    setLetterHeadOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
            <Building2 className="size-4" />
            <span>Organization Module</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Struktur Organisasi & Multi-Company
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola perusahaan, cabang, departemen, dan kop surat resmi dalam satu workspace.
          </p>
        </div>
        <Button variant="outline" onClick={seedOrganization} disabled={seeding}>
          <RefreshCw className={seeding ? "animate-spin" : ""} />
          Seed Default
        </Button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => navigate(`/desk/${value}`)} className="mb-6">
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs">
          <TabButton value="department" icon={FolderTree} label={`Department (${departments.length})`} />
          <TabButton value="company" icon={Building2} label={`Company (${companies.length})`} />
          <TabButton value="branch" icon={GitFork} label={`Branch (${branches.length})`} />
          <TabButton value="letter-head" icon={FileText} label={`Letter Head (${letterHeads.length})`} />
        </TabsList>
      </Tabs>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={`Cari ${activeTab.replace("-", " ")}...`}
            className="pl-10"
          />
        </label>
        <Button onClick={() => {
          if (activeTab === "department") openDepartmentForm();
          if (activeTab === "company") navigate("/desk/company/new");
          if (activeTab === "branch") openBranchForm();
          if (activeTab === "letter-head") openLetterHeadForm();
        }}>
          <Plus />
          Tambah {tabLabel(activeTab)}
        </Button>
      </div>

      {activeTab === "department" && (
        <DataShell loading={loading} empty={filteredDepartments.length === 0} emptyText="Belum ada department. Tambahkan department baru atau seed data default.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDepartments.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FolderTree className="size-4 text-slate-400" />
                      <span>{row.name}</span>
                      {row.is_group && <Badge variant="outline">Group</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{row.company?.name || "-"}</TableCell>
                  <TableCell>{row.branch?.name || "-"}</TableCell>
                  <TableCell>{row.parent_department?.name || "-"}</TableCell>
                  <TableCell><Status active={row.is_active} /></TableCell>
                  <TableCell>
                    <RowActions onEdit={() => openDepartmentForm(row)} onDelete={() => setDeleteTarget({ entity: "department", id: row.id, label: row.name })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      )}

      {activeTab === "company" && (
        <CardGrid loading={loading} empty={filteredCompanies.length === 0} emptyText="Belum ada company. Tambahkan company untuk mengaktifkan master cabang dan kop surat.">
          {filteredCompanies.map((row) => (
            <Card key={row.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div
                  className="flex size-12 cursor-pointer items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                  onClick={() => navigate(`/desk/company/${encodeURIComponent(row.name)}`)}
                >
                  <Building2 className="size-6" />
                </div>
                <RowActions
                  onEdit={() => navigate(`/desk/company/${encodeURIComponent(row.name)}`)}
                  onDelete={() => setDeleteTarget({ entity: "company", id: row.id, label: row.name })}
                />
              </CardHeader>
              <CardContent>
                <Badge className="mb-3">{row.abbreviation}</Badge>
                <CardTitle
                  className="cursor-pointer text-lg hover:text-blue-600 hover:underline"
                  onClick={() => navigate(`/desk/company/${encodeURIComponent(row.name)}`)}
                >
                  {row.name}
                </CardTitle>
                <div className="mt-4 space-y-1.5 border-t pt-4 text-xs text-slate-600">
                  <p>Tax ID: {row.tax_id || "-"}</p>
                  <p>Email: {row.email || "-"}</p>
                  <p>Telepon: {row.phone || "-"}</p>
                  <p>Mata Uang: {row.currency}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Status active={row.is_active} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    onClick={() => navigate(`/desk/company/${encodeURIComponent(row.name)}`)}
                  >
                    Detail & Edit →
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardGrid>
      )}

      {activeTab === "branch" && (
        <CardGrid loading={loading} empty={filteredBranches.length === 0} emptyText="Belum ada branch. Tambahkan branch untuk setiap company yang memiliki lokasi operasional.">
          {filteredBranches.map((row) => (
            <Card key={row.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="flex size-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <GitFork className="size-6" />
                </div>
                <RowActions onEdit={() => openBranchForm(row)} onDelete={() => setDeleteTarget({ entity: "branch", id: row.id, label: row.name })} />
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="mb-3">{row.branch_code || "BRANCH"}</Badge>
                <CardTitle className="text-lg">{row.name}</CardTitle>
                <p className="mt-1 text-xs font-medium text-blue-600">{row.company?.name || "-"}</p>
                <div className="mt-4 space-y-1.5 border-t pt-4 text-xs text-slate-600">
                  <p>Alamat: {row.address || "-"}</p>
                  <p>Email: {row.email || "-"}</p>
                  <p>Telepon: {row.phone || "-"}</p>
                </div>
                <div className="mt-4"><Status active={row.is_active} /></div>
              </CardContent>
            </Card>
          ))}
        </CardGrid>
      )}

      {activeTab === "letter-head" && (
        <CardGrid loading={loading} empty={filteredLetterHeads.length === 0} emptyText="Belum ada letter head. Tambahkan kop surat untuk dokumen resmi.">
          {filteredLetterHeads.map((row) => (
            <Card key={row.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <FileText className="size-6" />
                </div>
                <RowActions onEdit={() => openLetterHeadForm(row)} onDelete={() => setDeleteTarget({ entity: "letter-head", id: row.id, label: row.name })} />
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex gap-2">
                  {row.is_default && <Badge>Default</Badge>}
                  <Badge variant="secondary">{row.company?.name || "All Companies"}</Badge>
                </div>
                <CardTitle className="text-lg">{row.name}</CardTitle>
                <div className="mt-4 space-y-1.5 border-t pt-4 text-xs text-slate-600">
                  <p>Logo: {row.logo_url || "-"}</p>
                  <p>Header: {row.header_html ? "Configured" : "-"}</p>
                  <p>Footer: {row.footer_html ? "Configured" : "-"}</p>
                </div>
                <div className="mt-4"><Status active={row.is_active} /></div>
              </CardContent>
            </Card>
          ))}
        </CardGrid>
      )}

      <Dialog open={deptOpen} onOpenChange={setDeptOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{deptForm.id ? "Edit Department" : "Tambah Department"}</DialogTitle>
            <DialogDescription>Hubungkan department ke company, branch, dan parent tree.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveDepartment} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Department" required>
                <Input required value={deptForm.name} onChange={(event) => setDeptForm({ ...deptForm, name: event.target.value })} />
              </Field>
              <Field label="Kode Department">
                <Input value={deptForm.department_code} onChange={(event) => setDeptForm({ ...deptForm, department_code: event.target.value })} />
              </Field>
              <Field label="Company">
                <EntitySelect value={deptForm.company_id} placeholder="Pilih company" noneLabel="All Companies" onChange={(value) => setDeptForm({ ...deptForm, company_id: value, branch_id: "" })}>
                  {companies.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} ({item.abbreviation})</SelectItem>)}
                </EntitySelect>
              </Field>
              <Field label="Branch">
                <EntitySelect value={deptForm.branch_id} placeholder="Pilih branch" noneLabel="Tanpa branch" onChange={(value) => setDeptForm({ ...deptForm, branch_id: value })}>
                  {deptCompanyBranches.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </EntitySelect>
              </Field>
              <Field label="Parent Department">
                <EntitySelect value={deptForm.parent_department_id} placeholder="Pilih parent" noneLabel="Tanpa parent" onChange={(value) => setDeptForm({ ...deptForm, parent_department_id: value })}>
                  {parentDepartmentOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </EntitySelect>
              </Field>
            </div>
            <SwitchRow label="Group Department" checked={deptForm.is_group} onCheckedChange={(value) => setDeptForm({ ...deptForm, is_group: value })} />
            <SwitchRow label="Enabled" checked={deptForm.is_active} onCheckedChange={(value) => setDeptForm({ ...deptForm, is_active: value })} />
            <FormActions saving={saving} onCancel={() => setDeptOpen(false)} />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={companyOpen} onOpenChange={setCompanyOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{companyForm.id ? "Edit Company" : "Tambah Company"}</DialogTitle>
            <DialogDescription>Data legal multi-company untuk transaksi dan dokumen ERP.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveCompany} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Company" required>
                <Input required value={companyForm.name} onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })} />
              </Field>
              <Field label="Abbreviation" required>
                <Input required value={companyForm.abbreviation} onChange={(event) => setCompanyForm({ ...companyForm, abbreviation: event.target.value })} />
              </Field>
              <Field label="Tax ID">
                <Input value={companyForm.tax_id} onChange={(event) => setCompanyForm({ ...companyForm, tax_id: event.target.value })} />
              </Field>
              <Field label="Domain">
                <Input value={companyForm.domain} onChange={(event) => setCompanyForm({ ...companyForm, domain: event.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={companyForm.email} onChange={(event) => setCompanyForm({ ...companyForm, email: event.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={companyForm.phone} onChange={(event) => setCompanyForm({ ...companyForm, phone: event.target.value })} />
              </Field>
              <Field label="Currency">
                <Select value={companyForm.currency} onValueChange={(value) => setCompanyForm({ ...companyForm, currency: value })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["IDR", "USD", "SGD", "EUR"].map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Address">
                <Textarea value={companyForm.address} onChange={(event) => setCompanyForm({ ...companyForm, address: event.target.value })} />
              </Field>
            </div>
            <SwitchRow label="Group Company" checked={companyForm.is_group} onCheckedChange={(value) => setCompanyForm({ ...companyForm, is_group: value })} />
            <SwitchRow label="Enabled" checked={companyForm.is_active} onCheckedChange={(value) => setCompanyForm({ ...companyForm, is_active: value })} />
            <FormActions saving={saving} onCancel={() => setCompanyOpen(false)} />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={branchOpen} onOpenChange={setBranchOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{branchForm.id ? "Edit Branch" : "Tambah Branch"}</DialogTitle>
            <DialogDescription>Branch wajib terhubung ke company.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveBranch} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Branch" required>
                <Input required value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} />
              </Field>
              <Field label="Kode Branch">
                <Input value={branchForm.branch_code} onChange={(event) => setBranchForm({ ...branchForm, branch_code: event.target.value })} />
              </Field>
              <Field label="Company" required>
                <Select value={branchForm.company_id} onValueChange={(value) => setBranchForm({ ...branchForm, company_id: value })} required>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Pilih company" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} ({item.abbreviation})</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Email">
                <Input type="email" value={branchForm.email} onChange={(event) => setBranchForm({ ...branchForm, email: event.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={branchForm.phone} onChange={(event) => setBranchForm({ ...branchForm, phone: event.target.value })} />
              </Field>
              <Field label="Address">
                <Textarea value={branchForm.address} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} />
              </Field>
            </div>
            <SwitchRow label="Enabled" checked={branchForm.is_active} onCheckedChange={(value) => setBranchForm({ ...branchForm, is_active: value })} />
            <FormActions saving={saving} onCancel={() => setBranchOpen(false)} />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={letterHeadOpen} onOpenChange={setLetterHeadOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{letterHeadForm.id ? "Edit Letter Head" : "Tambah Letter Head"}</DialogTitle>
            <DialogDescription>Kop surat untuk dokumen resmi, invoice, dan purchase document.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveLetterHead} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Letter Head" required>
                <Input required value={letterHeadForm.name} onChange={(event) => setLetterHeadForm({ ...letterHeadForm, name: event.target.value })} />
              </Field>
              <Field label="Company">
                <EntitySelect value={letterHeadForm.company_id} placeholder="Pilih company" noneLabel="All Companies" onChange={(value) => setLetterHeadForm({ ...letterHeadForm, company_id: value })}>
                  {companies.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} ({item.abbreviation})</SelectItem>)}
                </EntitySelect>
              </Field>
              <Field label="Logo URL">
                <Input value={letterHeadForm.logo_url} onChange={(event) => setLetterHeadForm({ ...letterHeadForm, logo_url: event.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Header HTML">
                  <Textarea className="min-h-28 font-mono text-xs" value={letterHeadForm.header_html} onChange={(event) => setLetterHeadForm({ ...letterHeadForm, header_html: event.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Footer HTML">
                  <Textarea className="min-h-28 font-mono text-xs" value={letterHeadForm.footer_html} onChange={(event) => setLetterHeadForm({ ...letterHeadForm, footer_html: event.target.value })} />
                </Field>
              </div>
            </div>
            <SwitchRow label="Default Letter Head" checked={letterHeadForm.is_default} onCheckedChange={(value) => setLetterHeadForm({ ...letterHeadForm, is_default: value })} />
            <SwitchRow label="Enabled" checked={letterHeadForm.is_active} onCheckedChange={(value) => setLetterHeadForm({ ...letterHeadForm, is_active: value })} />
            <FormActions saving={saving} onCancel={() => setLetterHeadOpen(false)} />
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {deleteTarget ? tabLabel(deleteTarget.entity) : "data"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Data "{deleteTarget?.label}" akan dihapus. Pastikan tidak sedang dipakai oleh transaksi atau master lain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={saving} onClick={deleteEntity}>
              {saving ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TabButton({ value, icon: Icon, label }: { value: string; icon: typeof Building2; label: string }) {
  return (
    <TabsTrigger value={value} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
      <Icon className="size-4" />
      <span>{label}</span>
    </TabsTrigger>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-600">*</span>}
      </Label>
      {children}
    </div>
  );
}

function EntitySelect({ value, placeholder, noneLabel, onChange, children }: { value?: string | null; placeholder: string; noneLabel: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? "" : next)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  );
}

function SwitchRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function FormActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Batal</Button>
      <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
    </DialogFooter>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}><Pencil className="size-4" /> Edit</DropdownMenuItem>
        <DropdownMenuItem className="text-red-600" onClick={onDelete}><Trash2 className="size-4" /> Hapus</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Status({ active }: { active: boolean }) {
  return active ? (
    <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
      <CheckCircle2 className="size-3.5" /> Enabled
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1.5">
      <XCircle className="size-3.5" /> Disabled
    </Badge>
  );
}

function DataShell({ loading, empty, emptyText, children }: { loading: boolean; empty: boolean; emptyText: string; children: React.ReactNode }) {
  if (loading) {
    return <LoadingState />;
  }
  if (empty) {
    return <EmptyState text={emptyText} />;
  }
  return <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">{children}</div>;
}

function CardGrid({ loading, empty, emptyText, children }: { loading: boolean; empty: boolean; emptyText: string; children: React.ReactNode }) {
  if (loading) {
    return <LoadingState />;
  }
  if (empty) {
    return <EmptyState text={emptyText} />;
  }
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function LoadingState() {
  return (
    <div className="flex h-56 items-center justify-center rounded-2xl border bg-white text-slate-500">
      <Loader2 className="mr-2 size-5 animate-spin text-blue-600" />
      Memuat data...
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
      <p className="font-semibold text-slate-700">{text}</p>
      <p className="mt-1 text-sm text-slate-500">Gunakan tombol tambah di kanan atas untuk membuat data baru.</p>
    </div>
  );
}

function tabLabel(tab: ActiveTab | Entity) {
  return tab === "letter-head" ? "Letter Head" : tab.charAt(0).toUpperCase() + tab.slice(1);
}

function nullable(value: string) {
  return value.trim() ? value : null;
}

function cleanPayload(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => key !== "id" && value !== ""));
}
