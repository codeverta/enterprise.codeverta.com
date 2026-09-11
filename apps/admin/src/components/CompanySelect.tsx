import React, { useEffect } from "react";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCompanies } from "@/context/CompanyContext";

type CompanySelectProps = {
  value?: string;
  onChange: (companyName: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  fallbackOptions?: string[];
  "aria-label"?: string;
};

/**
 * Shared company field. Empty new forms inherit the current user's active
 * company; explicit user choices are recorded to improve their future default.
 */
export function CompanySelect({
  value = "",
  onChange,
  disabled,
  className,
  placeholder = "Pilih company...",
  fallbackOptions = [],
  "aria-label": ariaLabel = "Company",
}: CompanySelectProps) {
  const { companies, activeCompany, loading, recordCompanySelection } = useCompanies();

  useEffect(() => {
    const defaultName = activeCompany?.name || (!loading ? fallbackOptions.find(Boolean) : "");
    if (!value && defaultName && !disabled) onChange(defaultName);
  }, [activeCompany?.name, disabled, fallbackOptions, loading, onChange, value]);

  const handleChange = (companyName: string) => {
    onChange(companyName);
    void recordCompanySelection(companyName);
  };

  return (
    <SearchableSelect
      aria-label={ariaLabel}
      value={value}
      disabled={disabled || loading}
      onChange={handleChange}
      options={companies.length > 0
        ? companies.map((company) => ({ value: company.name, label: company.name, badge: company.abbreviation }))
        : fallbackOptions.filter(Boolean)}
      placeholder={loading ? "Memuat company..." : placeholder}
      searchPlaceholder="Cari company..."
      emptyText="Belum ada company aktif"
      className={className}
    />
  );
}
