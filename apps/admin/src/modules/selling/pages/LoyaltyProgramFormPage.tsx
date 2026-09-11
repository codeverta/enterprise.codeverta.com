import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Gift, Info, Plus, Save, Trash2, Award, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { CompanySelect } from "@/components/CompanySelect";
import {
  loyaltyApi,
  type CollectionRule,
  type LoyaltyOptions,
  type LoyaltyProgram,
  type LoyaltyProgramType,
} from "../loyaltyApi";

const blankRule = (index: number): CollectionRule => ({
  tier_name: `Tier ${index + 1}`,
  min_spent: index === 0 ? 0 : index * 5000000,
  collection_factor: 10,
});

const emptyProgram = (): LoyaltyProgram => ({
  loyalty_program_name: "",
  loyalty_program_type: "Single Tier Program",
  from_date: "",
  to_date: "",
  customer_group: "All Customer Groups",
  customer_territory: "All Territories",
  auto_opt_in: true,
  collection_rules: [blankRule(0)],
  conversion_factor: 1,
  expiry_duration: 365,
  expense_account: "5112 - Loyalty Program Expense",
  company: "",
  cost_center: "",
  project: "",
});

function Field({
  label,
  name,
  children,
  required,
}: {
  label: string;
  name?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
      {name && <p className="text-[11px] text-slate-400 font-mono">{name}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-slate-200 pt-6 first:border-0 first:pt-0 dark:border-slate-800">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <Sparkles className="size-4 text-blue-500" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Combo({
  value,
  values,
  onChange,
  placeholder,
}: {
  value: string;
  values: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useMemo(() => `list-${Math.random().toString(36).slice(2)}`, []);
  return (
    <>
      <Input
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Begin typing for results."}
      />
      <datalist id={id}>
        {values.map((option) => (
          <ERPSelectOption key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}

function Check({
  checked,
  onChange,
  label,
  name,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  name: string;
}) {
  return (
    <div className="flex items-start gap-2.5 pt-2">
      <Checkbox
        id={name}
        checked={checked}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />
      <div>
        <Label htmlFor={name} className="cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
          {label}
        </Label>
        <p className="text-[11px] text-slate-400 font-mono">{name}</p>
      </div>
    </div>
  );
}

export default function LoyaltyProgramFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [program, setProgram] = useState<LoyaltyProgram>(emptyProgram);
  const [options, setOptions] = useState<LoyaltyOptions>({
    customer_groups: [],
    customer_territories: [],
    expense_accounts: [],
    companies: [],
    cost_centers: [],
    projects: [],
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loyaltyApi.options().then(setOptions);
    if (!isNew && id) {
      setLoading(true);
      loyaltyApi
        .get(id)
        .then((data) => {
          setProgram(data);
        })
        .catch((err) => {
          toast.error(err?.message || "Loyalty Program tidak ditemukan");
          navigate("/desk/loyalty-program");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const update = <K extends keyof LoyaltyProgram>(key: K, value: LoyaltyProgram[K]) =>
    setProgram((curr) => ({ ...curr, [key]: value }));

  const updateRule = (index: number, patch: Partial<CollectionRule>) => {
    setProgram((curr) => ({
      ...curr,
      collection_rules: curr.collection_rules.map((rule, i) =>
        i === index ? { ...rule, ...patch } : rule
      ),
    }));
  };

  const addRuleRow = () => {
    setProgram((curr) => ({
      ...curr,
      collection_rules: [
        ...curr.collection_rules,
        blankRule(curr.collection_rules.length),
      ],
    }));
  };

  const removeRuleRow = (index: number) => {
    setProgram((curr) => ({
      ...curr,
      collection_rules: curr.collection_rules.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    if (!program.loyalty_program_name.trim()) return "Loyalty Program Name wajib diisi";
    if (program.collection_rules.length === 0) return "Wajib menambahkan minimal 1 Collection Rule";
    for (const rule of program.collection_rules) {
      if (!rule.tier_name.trim()) return "Semua Tier Name wajib diisi";
      if (rule.collection_factor <= 0) return "Collection Factor harus lebih besar dari 0";
    }
    return "";
  };

  const save = async () => {
    const error = validate();
    if (error) return toast.error(error);

    setSaving(true);
    try {
      if (isNew) {
        const saved = await loyaltyApi.create(program);
        toast.success("Loyalty Program berhasil dibuat");
        navigate(`/desk/loyalty-program/${saved.id}`, { replace: true });
      } else {
        await loyaltyApi.update(id!, program);
        toast.success("Loyalty Program berhasil diperbarui");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan Loyalty Program");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm("Hapus Loyalty Program ini?")) return;
    try {
      await loyaltyApi.remove(id);
      toast.success("Loyalty Program berhasil dihapus");
      navigate("/desk/loyalty-program");
    } catch {
      toast.error("Gagal menghapus Loyalty Program");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Memuat Loyalty Program...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/desk/loyalty-program">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600">Selling</span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs text-slate-500">Loyalty Program</span>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Gift className="size-6 text-blue-600" />
                {isNew ? "New Loyalty Program" : program.loyalty_program_name}
              </h1>
              <Badge variant={isNew ? "secondary" : "default"}>
                {isNew ? "Not Saved" : "Active"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:bg-red-50">
              <Trash2 className="size-4 mr-1" /> Delete
            </Button>
          )}
          <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="size-4 mr-1.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      {/* Main Content Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 space-y-8">
        {/* Section 1: Loyalty Program Details */}
        <Section title="Loyalty Program Details">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Loyalty Program Name" name="loyalty_program_name" required>
              <Input
                value={program.loyalty_program_name}
                onChange={(e) => update("loyalty_program_name", e.target.value)}
                placeholder="e.g. VIP Member Loyalty"
              />
            </Field>

            <Field label="Loyalty Program Type" name="loyalty_program_type">
              <ERPSelect
                className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 dark:border-slate-800 dark:text-slate-100"
                value={program.loyalty_program_type}
                onChange={(e) =>
                  update("loyalty_program_type", e.target.value as LoyaltyProgramType)
                }
              >
                <ERPSelectOption value="Single Tier Program">Single Tier Program</ERPSelectOption>
                <ERPSelectOption value="Multiple Tier Program">Multiple Tier Program</ERPSelectOption>
              </ERPSelect>
            </Field>

            <Field label="From Date" name="from_date">
              <Input
                type="date"
                value={program.from_date || ""}
                onChange={(e) => update("from_date", e.target.value)}
              />
            </Field>

            <Field label="To Date" name="to_date">
              <Input
                type="date"
                value={program.to_date || ""}
                onChange={(e) => update("to_date", e.target.value)}
              />
            </Field>

            <Field label="Customer Group" name="customer_group">
              <Combo
                value={program.customer_group || ""}
                values={options.customer_groups}
                onChange={(v) => update("customer_group", v)}
              />
            </Field>

            <Field label="Customer Territory" name="customer_territory">
              <Combo
                value={program.customer_territory || ""}
                values={options.customer_territories}
                onChange={(v) => update("customer_territory", v)}
              />
            </Field>

            <div className="col-span-full">
              <Check
                checked={program.auto_opt_in}
                onChange={(v) => update("auto_opt_in", v)}
                label="Auto Opt In (For all customers)"
                name="auto_opt_in"
              />
            </div>
          </div>
        </Section>

        {/* Section 2: Collection Rules Table */}
        <Section title="Collection Rules">
          <p className="text-xs text-slate-500">
            Tentukan tier reward berdasarkan total belanja pelanggan serta rasio perolehan poin (Collection Factor).
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="w-12 p-3 text-center">No.</th>
                  <th className="p-3">Tier Name</th>
                  <th className="p-3">Minimum Total Spent (Rp)</th>
                  <th className="p-3">Collection Factor (=1 LP)</th>
                  <th className="w-16 p-3 text-center" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {program.collection_rules.map((rule, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <td className="p-3 text-center text-xs font-medium text-slate-400">
                      {index + 1}
                    </td>
                    <td className="p-2">
                      <Input
                        value={rule.tier_name}
                        onChange={(e) => updateRule(index, { tier_name: e.target.value })}
                        placeholder="Tier Name"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="0"
                        value={rule.min_spent}
                        onChange={(e) => updateRule(index, { min_spent: Number(e.target.value) })}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Rp</span>
                        <Input
                          type="number"
                          min="1"
                          value={rule.collection_factor}
                          onChange={(e) =>
                            updateRule(index, { collection_factor: Number(e.target.value) })
                          }
                        />
                        <span className="text-xs text-slate-500 whitespace-nowrap">spent = 1 LP</span>
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={program.collection_rules.length === 1}
                        onClick={() => removeRuleRow(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {program.loyalty_program_type === "Multiple Tier Program" && (
            <Button type="button" variant="outline" size="sm" onClick={addRuleRow}>
              <Plus className="size-4 mr-1" /> Add Tier Row
            </Button>
          )}
        </Section>

        {/* Section 3: Redemption */}
        <Section title="Redemption">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Conversion Factor (1 LP = Rp Base Currency)"
              name="conversion_factor"
            >
              <Input
                type="number"
                min="0.01"
                step="any"
                value={program.conversion_factor}
                onChange={(e) => update("conversion_factor", Number(e.target.value))}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                1 Loyalty Point = {program.conversion_factor || 1} IDR base currency pada penukaran.
              </p>
            </Field>

            <Field label="Expiry Duration (in days)" name="expiry_duration">
              <Input
                type="number"
                min="0"
                value={program.expiry_duration}
                onChange={(e) => update("expiry_duration", Number(e.target.value))}
                placeholder="0 for unlimited"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {program.expiry_duration > 0
                  ? `Poin kadaluarsa dalam ${program.expiry_duration} hari.`
                  : "Biarkan 0 untuk masa berlaku poin tanpa batas (unlimited)."}
              </p>
            </Field>

            <Field label="Expense Account" name="expense_account">
              <Combo
                value={program.expense_account}
                values={options.expense_accounts}
                onChange={(v) => update("expense_account", v)}
              />
            </Field>

            <Field label="Company" name="company">
              <CompanySelect
                value={program.company}
                onChange={(v) => update("company", v)}
              />
            </Field>
          </div>
        </Section>

        {/* Section 4: Accounting Dimensions */}
        <Section title="Accounting Dimensions">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Cost Center" name="cost_center">
              <Combo
                value={program.cost_center || ""}
                values={options.cost_centers}
                onChange={(v) => update("cost_center", v)}
              />
            </Field>

            <Field label="Project" name="project">
              <Combo
                value={program.project || ""}
                values={options.projects}
                onChange={(v) => update("project", v)}
              />
            </Field>
          </div>
        </Section>

        {/* Section 5: Help Section / Notes */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5 dark:border-blue-900/40 dark:bg-blue-950/30 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-200">
            <Info className="size-4 text-blue-600" />
            Help Section & Rules
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-disc list-inside">
            <li>
              Loyalty Points will be calculated from the spent done (via the Sales Invoice), based on collection factor mentioned.
            </li>
            <li>
              There can be multiple tiered collection factor based on the total spent. But the conversion factor for redemption will always be same for all the tier.
            </li>
            <li>
              In the case of multi-tier program, Customers will be auto assigned to the concerned tier as per their spent.
            </li>
            <li>
              If unlimited expiry for the Loyalty Points, keep the Expiry Duration empty or 0.
            </li>
            <li>
              If Auto Opt In is checked, then the customers will be automatically linked with the concerned Loyalty Program (on save).
            </li>
            <li>
              One customer can be part of only single Loyalty Program.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
