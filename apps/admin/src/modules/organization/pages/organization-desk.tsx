import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Building2,
  GitFork,
  Network,
  FileText,
  Users,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  ChevronRight,
  FolderTree,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  company_id?: string;
  company?: Company;
  branch_id?: string;
  branch?: Branch;
  name: string;
  department_code?: string;
  parent_department_id?: string;
  parent_department?: Department;
  is_group: boolean;
  is_active: boolean;
};

type LetterHead = {
  id: string;
  company_id?: string;
  company?: Company;
  name: string;
  header_html?: string;
  footer_html?: string;
  logo_url?: string;
  is_default: boolean;
  is_active: boolean;
};

export default function OrganizationDeskPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Determine active tab
  const activeTab = pathname.includes("/company")
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
  const [seeding, setSeeding] = useState(false);

  // Modal forms
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isLetterHeadModalOpen, setIsLetterHeadModalOpen] = useState(false);

  // Department form state
  const [deptForm, setDeptForm] = useState({
    name: "",
    department_code: "",
    company_id: "",
    branch_id: "",
    parent_department_id: "",
    is_group: false,
    is_active: true,
  });

  // Company form state
  const [companyForm, setCompanyForm] = useState({
    name: "",
    abbreviation: "",
    tax_id: "",
    email: "",
    phone: "",
    address: "",
    currency: "IDR",
    is_group: false,
    is_active: true,
  });

  // Branch form state
  const [branchForm, setBranchForm] = useState({
    name: "",
    branch_code: "",
    company_id: "",
    address: "",
    phone: "",
    email: "",
    is_active: true,
  });

  // LetterHead form state
  const [letterHeadForm, setLetterHeadForm] = useState({
    name: "",
    company_id: "",
    header_html: "",
    footer_html: "",
    is_default: false,
    is_active: true,
  });

  const getAuthToken = () => localStorage.getItem("accessToken") || "";

  const fetchOrganizationData = async () => {
    setLoading(true);
    const token = getAuthToken();
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [compRes, branchRes, deptRes, lhRes] = await Promise.all([
        fetch("/api/organization/companies", { headers }),
        fetch("/api/organization/branches", { headers }),
        fetch("/api/organization/departments", { headers }),
        fetch("/api/organization/letter-heads", { headers }),
      ]);

      if (compRes.ok) {
        const compData = await compRes.json();
        setCompanies(compData.data || []);
      }
      if (branchRes.ok) {
        const branchData = await branchRes.json();
        setBranches(branchData.data || []);
      }
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.data || []);
      }
      if (lhRes.ok) {
        const lhData = await lhRes.json();
        setLetterHeads(lhData.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch organization data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const handleSeedOrganization = async () => {
    setSeeding(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/organization/seed", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchOrganizationData();
      }
    } catch (err) {
      console.error("Failed to seed organization:", err);
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getAuthToken();
      const payload: Record<string, unknown> = {
        name: deptForm.name,
        department_code: deptForm.department_code,
        is_group: deptForm.is_group,
        is_active: deptForm.is_active,
      };
      if (deptForm.company_id) payload.company_id = deptForm.company_id;
      if (deptForm.branch_id) payload.branch_id = deptForm.branch_id;
      if (deptForm.parent_department_id) payload.parent_department_id = deptForm.parent_department_id;

      const res = await fetch("/api/organization/departments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsDeptModalOpen(false);
        setDeptForm({
          name: "",
          department_code: "",
          company_id: "",
          branch_id: "",
          parent_department_id: "",
          is_group: false,
          is_active: true,
        });
        await fetchOrganizationData();
      }
    } catch (err) {
      console.error("Failed to create department:", err);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getAuthToken();
      const res = await fetch("/api/organization/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(companyForm),
      });

      if (res.ok) {
        setIsCompanyModalOpen(false);
        setCompanyForm({
          name: "",
          abbreviation: "",
          tax_id: "",
          email: "",
          phone: "",
          address: "",
          currency: "IDR",
          is_group: false,
          is_active: true,
        });
        await fetchOrganizationData();
      }
    } catch (err) {
      console.error("Failed to create company:", err);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getAuthToken();
      const res = await fetch("/api/organization/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branchForm),
      });

      if (res.ok) {
        setIsBranchModalOpen(false);
        setBranchForm({
          name: "",
          branch_code: "",
          company_id: "",
          address: "",
          phone: "",
          email: "",
          is_active: true,
        });
        await fetchOrganizationData();
      }
    } catch (err) {
      console.error("Failed to create branch:", err);
    }
  };

  const filteredDepartments = departments.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.company?.name && d.company.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.abbreviation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.company?.name && b.company.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
      {/* Header */}
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
            Kelola Perusahaan (Multi-Company), Cabang (Multi-Branch), Departemen (Multi-Department Tree), dan Kop Surat Resmi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeedOrganization}
            disabled={seeding}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`size-4 ${seeding ? "animate-spin" : ""}`} />
            <span>{seeding ? "Seeding..." : "Seed Dept & Companies"}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs">
        <button
          type="button"
          onClick={() => navigate("/desk/department")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
            activeTab === "department"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FolderTree className="size-4" />
          <span>Department ({departments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/desk/company")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
            activeTab === "company"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Building2 className="size-4" />
          <span>Company ({companies.length})</span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/desk/branch")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
            activeTab === "branch"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <GitFork className="size-4" />
          <span>Branch ({branches.length})</span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/desk/letter-head")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
            activeTab === "letter-head"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="size-4" />
          <span>Letter Head ({letterHeads.length})</span>
        </button>
      </div>

      {/* Toolbar Search & Action */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Cari ${activeTab}...`}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none ring-blue-500 focus:ring-2"
          />
        </div>

        <div>
          {activeTab === "department" && (
            <button
              type="button"
              onClick={() => setIsDeptModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Tambah Department</span>
            </button>
          )}
          {activeTab === "company" && (
            <button
              type="button"
              onClick={() => setIsCompanyModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Tambah Company</span>
            </button>
          )}
          {activeTab === "branch" && (
            <button
              type="button"
              onClick={() => setIsBranchModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Tambah Branch</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Section */}
      {activeTab === "department" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-4">Department Name</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">Parent Department</th>
                  <th className="px-6 py-4">Is Group</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Memuat data department...
                    </td>
                  </tr>
                ) : filteredDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Tidak ada department ditemukan. Klik "Seed Dept & Companies" untuk membuat data default.
                    </td>
                  </tr>
                ) : (
                  filteredDepartments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                          {dept.is_group ? (
                            <FolderTree className="size-4 text-blue-600" />
                          ) : (
                            <ChevronRight className="size-3.5 text-slate-400" />
                          )}
                          <span>{dept.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {dept.company?.name || "All Companies"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {dept.parent_department?.name || "-"}
                      </td>
                      <td className="px-6 py-4">
                        {dept.is_group ? (
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200/60">
                            Group
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            Leaf
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {dept.is_active ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 className="size-3.5" /> Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            <XCircle className="size-3.5" /> Disabled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "company" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCompanies.map((comp) => (
            <div
              key={comp.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Building2 className="size-6" />
                </div>
                <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                  {comp.abbreviation}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{comp.name}</h3>
              <p className="mt-1 text-xs text-slate-500">Tax ID: {comp.tax_id || "NPWP Not Set"}</p>
              <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-600">
                <p>Email: {comp.email || "-"}</p>
                <p>Telepon: {comp.phone || "-"}</p>
                <p>Mata Uang: {comp.currency}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "branch" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBranches.map((branch) => (
            <div
              key={branch.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex size-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <GitFork className="size-6" />
                </div>
                <span className="inline-flex items-center rounded-md bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-800">
                  {branch.branch_code || "BRANCH"}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{branch.name}</h3>
              <p className="mt-1 text-xs font-medium text-blue-600">{branch.company?.name}</p>
              <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-600">
                <p>Alamat: {branch.address || "-"}</p>
                <p>Telepon: {branch.phone || "-"}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add Department */}
      <Dialog open={isDeptModalOpen} onOpenChange={setIsDeptModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Tambah Department Baru</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Buat unit departemen baru dan hubungkan ke perusahaan serta parent department.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDepartment} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Nama Department</label>
              <input
                type="text"
                required
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="contoh: Accounts - PZTS"
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Perusahaan (Company)</label>
              <select
                value={deptForm.company_id}
                onChange={(e) => setDeptForm({ ...deptForm, company_id: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none ring-blue-500 focus:ring-2 bg-white"
              >
                <option value="">Pilih Company...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.abbreviation})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Parent Department</label>
              <select
                value={deptForm.parent_department_id}
                onChange={(e) => setDeptForm({ ...deptForm, parent_department_id: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none ring-blue-500 focus:ring-2 bg-white"
              >
                <option value="">Tanpa Parent (Root)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deptForm.is_group}
                  onChange={(e) => setDeptForm({ ...deptForm, is_group: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Is Group Department</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deptForm.is_active}
                  onChange={(e) => setDeptForm({ ...deptForm, is_active: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Enabled</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsDeptModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
