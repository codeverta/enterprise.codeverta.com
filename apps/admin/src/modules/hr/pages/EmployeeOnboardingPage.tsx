import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Info,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { CompanySelect } from "@/components/CompanySelect";
import {
  onboardingApi,
  type EmployeeOnboarding,
  type OnboardingActivity,
  type OnboardingOptions,
} from "../onboardingApi";

const today = () => new Date().toISOString().slice(0, 10);

const defaultActivities: OnboardingActivity[] = [
  {
    activity_name: "Perform a legal and professional background check",
    role: "HR Manager",
    begin_on: 0,
    duration: 3,
    required: true,
    status: "Pending",
  },
  {
    activity_name: "Create an Employee master",
    role: "HR Manager",
    begin_on: 0,
    duration: 1,
    required: true,
    status: "Pending",
  },
  {
    activity_name: "Create an Email Account",
    role: "IT Support",
    begin_on: 0,
    duration: 1,
    required: true,
    status: "Pending",
  },
  {
    activity_name: "Create an identity card",
    role: "Office Admin",
    begin_on: 1,
    duration: 2,
    required: false,
    status: "Pending",
  },
  {
    activity_name: "Allocate leaves",
    role: "HR Manager",
    begin_on: 1,
    duration: 1,
    required: true,
    status: "Pending",
  },
];

const defaultOnboarding = (): EmployeeOnboarding => ({
  job_applicant: "",
  applicant_name: "",
  applicant_email: "",
  applicant_phone: "",
  employee: "",
  employee_name: "",
  company: "",
  department: "Human Resources",
  designation: "Software Engineer",
  employee_grade: "Grade C (Mid-Level)",
  employee_onboarding_template: "Standard Employee Onboarding",
  date_of_joining: today(),
  status: "Pending",
  project: "",
  notes: "",
  activities: defaultActivities,
});

export default function EmployeeOnboardingPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  const isNew = pathname === "/desk/employee-onboarding/new" || pathname.includes("/new-employee-onboarding");
  const isDetail = !isNew && /^\/desk\/employee-onboarding\/[^/]+$/.test(pathname);
  const onboardingId = params["*"] || (pathname.split("/desk/employee-onboarding/")[1] ?? "");

  // Options State
  const [options, setOptions] = useState<OnboardingOptions>({
    job_applicants: [],
    employees: [],
    companies: [],
    departments: ["Human Resources", "Engineering & IT", "Finance & Accounting", "Sales & Marketing", "Operations & Logistics"],
    designations: ["Software Engineer", "HR Manager", "Accountant", "Sales Executive", "Operations Staff", "Product Designer"],
    employee_grades: ["Grade A (Executive)", "Grade B (Senior / Lead)", "Grade C (Mid-Level)", "Grade D (Junior / Associate)", "Grade E (Intern / Trainee)"],
    roles: ["HR Manager", "IT Support", "Office Admin", "Tech Lead", "Department Head", "Legal"],
    templates: [],
  });

  // List State
  const [list, setList] = useState<EmployeeOnboarding[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");

  // Form State
  const [formData, setFormData] = useState<EmployeeOnboarding>(defaultOnboarding());
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingEmployee, setCreatingEmployee] = useState(false);

  useEffect(() => {
    onboardingApi
      .options()
      .then((res) => {
        if (res) setOptions(res);
      })
      .catch(() => {});
  }, []);

  const fetchList = async () => {
    setLoadingList(true);
    try {
      const data = await onboardingApi.list({
        q: searchQuery,
        status: statusFilter !== "All" ? statusFilter : undefined,
        department: deptFilter !== "All" ? deptFilter : undefined,
      });
      setList(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal memuat data Employee Onboarding");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!isNew && !isDetail) {
      fetchList();
    }
  }, [isNew, isDetail, searchQuery, statusFilter, deptFilter]);

  useEffect(() => {
    if (isNew) {
      setFormData(defaultOnboarding());
    } else if (isDetail && onboardingId) {
      setLoadingForm(true);
      onboardingApi
        .get(onboardingId)
        .then((data) => {
          if (data) {
            setFormData({
              ...defaultOnboarding(),
              ...data,
              activities: data.activities || [],
            });
          }
        })
        .catch((err: any) => {
          toast.error(err?.response?.data?.error || "Gagal memuat detail Onboarding");
          navigate("/desk/employee-onboarding");
        })
        .finally(() => setLoadingForm(false));
    }
  }, [isNew, isDetail, onboardingId]);

  // Applicant Selection Handling
  const handleApplicantChange = (applicantId: string) => {
    const selected = options.job_applicants.find((a) => a.id === applicantId || a.name === applicantId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        job_applicant: selected.id,
        applicant_name: selected.name,
        applicant_email: selected.email,
        applicant_phone: selected.phone,
        department: selected.department || prev.department,
        designation: selected.designation || prev.designation,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        job_applicant: applicantId,
        applicant_name: applicantId,
      }));
    }
  };

  // Template Selection Handling
  const handleTemplateChange = (tmplName: string) => {
    const found = options.templates.find((t) => t.template_name === tmplName);
    if (found) {
      const loadedActs: OnboardingActivity[] = found.activities.map((a) => ({
        activity_name: a.activity_name,
        role: a.role,
        begin_on: a.begin_on,
        duration: a.duration,
        required: a.required,
        status: "Pending",
      }));

      setFormData((prev) => ({
        ...prev,
        employee_onboarding_template: tmplName,
        department: found.department || prev.department,
        designation: found.designation || prev.designation,
        employee_grade: found.employee_grade || prev.employee_grade,
        activities: loadedActs,
      }));
      toast.info(`Aktivitas dari template "${tmplName}" berhasil dimuat`);
    } else {
      setFormData((prev) => ({ ...prev, employee_onboarding_template: tmplName }));
    }
  };

  // Activity Handlers
  const handleAddActivity = () => {
    setFormData((prev) => ({
      ...prev,
      activities: [
        ...prev.activities,
        {
          activity_name: "",
          role: "HR Manager",
          begin_on: 0,
          duration: 1,
          required: true,
          status: "Pending",
        },
      ],
    }));
  };

  const handleUpdateActivity = (index: number, field: keyof OnboardingActivity, val: any) => {
    setFormData((prev) => {
      const next = [...prev.activities];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, activities: next };
    });
  };

  const handleRemoveActivity = (index: number) => {
    setFormData((prev) => {
      const next = [...prev.activities];
      next.splice(index, 1);
      return { ...prev, activities: next };
    });
  };

  const handleToggleActivity = async (index: number) => {
    const target = formData.activities[index];
    if (!target) return;

    if (!isNew && (formData.id || onboardingId) && target.id) {
      try {
        const updated = await onboardingApi.toggleActivity(formData.id || onboardingId, target.id);
        if (updated.data) {
          setFormData((prev) => ({
            ...prev,
            status: updated.data.status,
            activities: updated.data.activities,
          }));
          toast.success(updated.message || "Status aktivitas berhasil diperbarui");
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.error || "Gagal mengubah status aktivitas");
      }
    } else {
      // Local state toggle for new form
      const nextStatus = target.status === "Completed" ? "Pending" : "Completed";
      handleUpdateActivity(index, "status", nextStatus);
    }
  };

  const handleCreateEmployee = async () => {
    const targetId = formData.id || onboardingId;
    if (!targetId) return;

    setCreatingEmployee(true);
    try {
      const res = await onboardingApi.createEmployee(targetId);
      if (res.data) {
        setFormData((prev) => ({
          ...prev,
          employee: res.data.employee,
          employee_name: res.data.employee_name,
        }));
        toast.success(res.message || "Employee master berhasil dibuat");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal membuat employee master");
    } finally {
      setCreatingEmployee(false);
    }
  };

  const handleSave = async () => {
    if (!formData.applicant_name.trim() && !formData.job_applicant.trim()) {
      toast.error("Job Applicant / Nama Pelamar wajib diisi");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const res = await onboardingApi.create(formData);
        toast.success(res.message || "Employee Onboarding berhasil dibuat");
        navigate("/desk/employee-onboarding");
      } else {
        const targetId = formData.id || onboardingId;
        const res = await onboardingApi.update(targetId, formData);
        toast.success(res.message || "Employee Onboarding berhasil diperbarui");
        navigate("/desk/employee-onboarding");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Employee Onboarding");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus Employee Onboarding ini?")) return;
    try {
      const targetId = formData.id || onboardingId;
      const res = await onboardingApi.delete(targetId);
      toast.success(res.message || "Employee Onboarding berhasil dihapus");
      navigate("/desk/employee-onboarding");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus Employee Onboarding");
    }
  };

  // Select Options Mappings
  const applicantOptions: SearchableSelectOption[] = useMemo(() => {
    return options.job_applicants.map((a) => ({
      value: a.id,
      label: `${a.id} - ${a.name}`,
      sublabel: `${a.designation} (${a.department})`,
    }));
  }, [options.job_applicants]);

  const employeeOptions: SearchableSelectOption[] = useMemo(() => {
    return options.employees.map((e) => ({
      value: e.id,
      label: e.name,
      sublabel: e.email,
    }));
  }, [options.employees]);

  const templateOptions: SearchableSelectOption[] = useMemo(() => {
    return (options.templates.length > 0
      ? options.templates.map((t) => t.template_name)
      : ["Standard Employee Onboarding", "Engineering Onboarding"]
    ).map((t) => ({ value: t, label: t }));
  }, [options.templates]);

  // RENDER FORM (NEW OR DETAIL)
  if (isNew || isDetail) {
    if (loadingForm) {
      return (
        <div className="p-8 text-center text-sm text-slate-500">
          Memuat data Employee Onboarding...
        </div>
      );
    }

    const badgeStatus = isNew ? "Not Saved" : formData.status || "Pending";
    const completedCount = formData.activities.filter((a) => a.status === "Completed").length;
    const totalCount = formData.activities.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
      <div className="space-y-6 pb-24">
        {/* Top Sticky Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/desk/employee-onboarding"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {isNew
                    ? formData.applicant_name
                      ? `New Onboarding - ${formData.applicant_name}`
                      : "New Employee Onboarding"
                    : formData.onboarding_number || formData.applicant_name}
                </h1>
                <Badge
                  variant={
                    badgeStatus === "Not Saved"
                      ? "secondary"
                      : badgeStatus === "Completed"
                      ? "default"
                      : "outline"
                  }
                  className={
                    badgeStatus === "Not Saved"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : badgeStatus === "Completed"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  }
                >
                  {badgeStatus}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <Link to="/desk/employee-onboarding" className="hover:underline">
                  Employee Onboarding
                </Link>{" "}
                / {isNew ? "New Employee Onboarding" : formData.onboarding_number || onboardingId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isNew && !formData.employee && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateEmployee}
                disabled={creatingEmployee}
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300"
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                {creatingEmployee ? "Memproses..." : "Create Employee"}
              </Button>
            )}
            {!isNew && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:bg-red-50 dark:text-red-400"
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Check className="mr-1.5 h-4 w-4" />
              {saving ? "Menyimpan..." : "Save & Submit"}
            </Button>
          </div>
        </div>

        {/* Form Body Container */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-6">
          {/* Progress Bar Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Onboarding Progress: {progressPercent}% Selesai
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {completedCount} dari {totalCount} aktivitas telah diselesaikan
                </p>
              </div>
              {formData.employee ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  <UserCheck className="h-4 w-4" />
                  <span>Linked to Employee: <strong>{formData.employee}</strong> ({formData.employee_name})</span>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Employee Master belum dibuat
                </div>
              )}
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Section 1: Candidate & Hiring Information */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 pb-3 dark:border-slate-800">
              Candidate & Hiring Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Job Applicant */}
              <div className="space-y-1.5">
                <Label htmlFor="job_applicant" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Job Applicant <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  value={formData.job_applicant}
                  options={applicantOptions}
                  onChange={handleApplicantChange}
                  placeholder="Begin typing for results."
                  searchPlaceholder="Cari kandidat pelamar..."
                />
                <span className="text-[11px] text-slate-400">job_applicant</span>
              </div>

              {/* Applicant Name */}
              <div className="space-y-1.5">
                <Label htmlFor="applicant_name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Applicant Name
                </Label>
                <Input
                  id="applicant_name"
                  value={formData.applicant_name}
                  onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                  placeholder="Nama pelamar / kandidat"
                  className="h-9"
                />
                <span className="text-[11px] text-slate-400">applicant_name</span>
              </div>

              {/* Linked Employee */}
              <div className="space-y-1.5">
                <Label htmlFor="employee" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Employee (Link if already created)
                </Label>
                <SearchableSelect
                  value={formData.employee || ""}
                  options={employeeOptions}
                  onChange={(val, opt) =>
                    setFormData({
                      ...formData,
                      employee: val,
                      employee_name: opt?.label || val,
                    })
                  }
                  placeholder="Begin typing for results."
                  searchPlaceholder="Cari employee..."
                />
                <span className="text-[11px] text-slate-400">employee</span>
              </div>

              {/* Company */}
              <div className="space-y-1.5">
                <Label htmlFor="company" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Company
                </Label>
                <CompanySelect
                  value={formData.company}
                  onChange={(company) => setFormData((current) => ({ ...current, company }))}
                  placeholder="Begin typing for results."
                />
                <span className="text-[11px] text-slate-400">company</span>
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <Label htmlFor="department" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Department
                </Label>
                <SearchableSelect
                  value={formData.department || ""}
                  options={options.departments.map((d) => ({ value: d, label: d }))}
                  onChange={(val) => setFormData({ ...formData, department: val })}
                  placeholder="Begin typing for results."
                />
                <span className="text-[11px] text-slate-400">department</span>
              </div>

              {/* Designation */}
              <div className="space-y-1.5">
                <Label htmlFor="designation" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Designation
                </Label>
                <SearchableSelect
                  value={formData.designation || ""}
                  options={options.designations.map((d) => ({ value: d, label: d }))}
                  onChange={(val) => setFormData({ ...formData, designation: val })}
                  placeholder="Begin typing for results."
                />
                <span className="text-[11px] text-slate-400">designation</span>
              </div>

              {/* Employee Grade */}
              <div className="space-y-1.5">
                <Label htmlFor="employee_grade" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Employee Grade
                </Label>
                <SearchableSelect
                  value={formData.employee_grade || ""}
                  options={options.employee_grades.map((g) => ({ value: g, label: g }))}
                  onChange={(val) => setFormData({ ...formData, employee_grade: val })}
                  placeholder="Begin typing for results."
                />
                <span className="text-[11px] text-slate-400">employee_grade</span>
              </div>

              {/* Date of Joining */}
              <div className="space-y-1.5">
                <Label htmlFor="date_of_joining" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Date of Joining <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="date_of_joining"
                  type="date"
                  value={formData.date_of_joining}
                  onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                  className="h-9"
                />
                <span className="text-[11px] text-slate-400">date_of_joining</span>
              </div>
            </div>
          </div>

          {/* Section 2: Onboarding Template */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 pb-3 dark:border-slate-800">
              Onboarding Template & Project
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Employee Onboarding Template */}
              <div className="space-y-1.5">
                <Label htmlFor="employee_onboarding_template" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Employee Onboarding Template
                </Label>
                <SearchableSelect
                  value={formData.employee_onboarding_template || ""}
                  options={templateOptions}
                  onChange={handleTemplateChange}
                  placeholder="Begin typing for results."
                  searchPlaceholder="Pilih template onboarding..."
                />
                <p className="text-xs text-slate-500">
                  Memilih template akan otomatis mengisi departemen, jabatan, dan daftar aktivitas onboarding standar.
                </p>
                <span className="text-[11px] text-slate-400">employee_onboarding_template</span>
              </div>

              {/* Project */}
              <div className="space-y-1.5">
                <Label htmlFor="project" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Project
                </Label>
                <Input
                  id="project"
                  value={formData.project || ""}
                  onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                  placeholder="e.g. PROJ-ONB-2026-01"
                  className="h-9"
                />
                <p className="text-xs text-slate-500">
                  Proyek dan Task yang terasosiasi untuk memantau pekerjaan onboarding.
                </p>
                <span className="text-[11px] text-slate-400">project</span>
              </div>
            </div>
          </div>

          {/* Section 3: Activities Table */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Activities & Tasks
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Daftar aktivitas yang harus diselesaikan untuk proses onboarding karyawan baru.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddActivity}
                className="text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Baris
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                  <tr>
                    <th className="w-12 px-3 py-2.5 text-center">No.</th>
                    <th className="px-3 py-2.5">Activity Name</th>
                    <th className="w-40 px-3 py-2.5">Role</th>
                    <th className="w-28 px-3 py-2.5">Begin On (Days)</th>
                    <th className="w-28 px-3 py-2.5">Duration (Days)</th>
                    <th className="w-24 px-3 py-2.5 text-center">Mandatory</th>
                    <th className="w-28 px-3 py-2.5 text-center">Status</th>
                    <th className="w-20 px-3 py-2.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {formData.activities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-xs text-slate-500">
                        Belum ada aktivitas. Klik Tambah Baris atau pilih Template Onboarding di atas.
                      </td>
                    </tr>
                  ) : (
                    formData.activities.map((act, idx) => {
                      const isCompleted = act.status === "Completed";
                      return (
                        <tr
                          key={act.id || idx}
                          className={isCompleted ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}
                        >
                          <td className="px-3 py-2 text-center text-xs font-medium text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={act.activity_name}
                              onChange={(e) =>
                                handleUpdateActivity(idx, "activity_name", e.target.value)
                              }
                              placeholder="Deskripsi aktivitas..."
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={act.role || "HR Manager"}
                              onChange={(e) => handleUpdateActivity(idx, "role", e.target.value)}
                              className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                            >
                              {options.roles.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={act.begin_on ?? 0}
                              onChange={(e) =>
                                handleUpdateActivity(idx, "begin_on", Number(e.target.value) || 0)
                              }
                              className="h-8 text-xs text-center"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="1"
                              value={act.duration ?? 1}
                              onChange={(e) =>
                                handleUpdateActivity(idx, "duration", Math.max(1, Number(e.target.value) || 1))
                              }
                              className="h-8 text-xs text-center"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Checkbox
                              checked={act.required ?? true}
                              onCheckedChange={(checked) =>
                                handleUpdateActivity(idx, "required", Boolean(checked))
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleActivity(idx)}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                                isCompleted
                                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
                              }`}
                            >
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" /> Completed
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3" /> Pending
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveActivity(idx)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <Label htmlFor="notes" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Notes & Special Instructions
            </Label>
            <Textarea
              id="notes"
              rows={3}
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Catatan tambahan seputar orientasi, berkas yang dibutuhkan, dll."
              className="text-xs"
            />
          </div>
        </div>
      </div>
    );
  }

  // RENDER LIST VIEW
  return (
    <div className="space-y-6 p-6">
      {/* List Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Employee Onboarding
            </h1>
            <Badge variant="outline" className="text-xs font-semibold">
              {list.length}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pelacakan aktivitas dan tugas standar penerimaan karyawan baru
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Link to="/desk/employee-onboarding/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Employee Onboarding
            </Link>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari ID, Pelamar, Departemen..."
            className="h-9 pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1">
            {["All", "Pending", "In Progress", "Completed"].map((tab) => (
              <Button
                key={tab}
                variant={statusFilter === tab ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(tab)}
                className="h-8 text-xs"
              >
                {tab}
              </Button>
            ))}
          </div>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-8 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="All">All Departments</option>
            {options.departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Onboarding ID</th>
              <th className="px-4 py-3">Job Applicant</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Date of Joining</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {loadingList ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                  Memuat data Employee Onboarding...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                  Belum ada data Employee Onboarding. Klik{" "}
                  <Link
                    to="/desk/employee-onboarding/new"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Add Employee Onboarding
                  </Link>{" "}
                  untuk membuat baru.
                </td>
              </tr>
            ) : (
              list.map((row) => {
                const acts = row.activities || [];
                const completed = acts.filter((a) => a.status === "Completed").length;
                const total = acts.length;
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <tr
                    key={row.id || row.onboarding_number}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => navigate(`/desk/employee-onboarding/${row.id || row.onboarding_number}`)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {row.onboarding_number || row.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {row.applicant_name}
                      </div>
                      {row.applicant_email && (
                        <div className="text-xs text-slate-400">{row.applicant_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.employee ? (
                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[11px]">
                          {row.employee}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{row.department || "-"}</td>
                    <td className="px-4 py-3 text-xs">{row.designation || "-"}</td>
                    <td className="px-4 py-3 text-xs">{row.date_of_joining || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="w-28 space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>{completed}/{total}</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          row.status === "Completed"
                            ? "default"
                            : row.status === "In Progress"
                            ? "outline"
                            : "secondary"
                        }
                        className={
                          row.status === "Completed"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : row.status === "In Progress"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
