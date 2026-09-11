import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import api from "@/lib/api";

export type CompanyOption = {
  id: string;
  name: string;
  abbreviation: string;
  currency: string;
};

type CompanyContextValue = {
  companies: CompanyOption[];
  activeCompany: CompanyOption | null;
  loading: boolean;
  refreshCompanies: () => Promise<void>;
  recordCompanySelection: (companyName: string) => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);
const standaloneCompanyContext: CompanyContextValue = {
  companies: [],
  activeCompany: null,
  loading: false,
  refreshCompanies: async () => undefined,
  recordCompanySelection: async () => undefined,
};

function readPayload(response: any) {
  return response?.data?.data ?? response?.data ?? {};
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [activeCompany, setActiveCompany] = useState<CompanyOption | null>(null);
  const [loading, setLoading] = useState(true);

  const applyPayload = useCallback((payload: any) => {
    setCompanies(Array.isArray(payload?.companies) ? payload.companies : []);
    setActiveCompany(payload?.active_company ?? null);
  }, []);

  const refreshCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/organization/company-context");
      applyPayload(readPayload(response));
    } catch {
      setCompanies([]);
      setActiveCompany(null);
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void refreshCompanies();
  }, [refreshCompanies]);

  const recordCompanySelection = useCallback(async (companyName: string) => {
    const selected = companies.find((company) => company.name === companyName);
    if (!selected) return;
    const response = await api.post("/organization/company-context/select", {
      company_id: selected.id,
    });
    applyPayload(readPayload(response));
  }, [applyPayload, companies]);

  const value = useMemo(() => ({
    companies,
    activeCompany,
    loading,
    refreshCompanies,
    recordCompanySelection,
  }), [activeCompany, companies, loading, recordCompanySelection, refreshCompanies]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompanies() {
  const context = useContext(CompanyContext);
  // Keeping the component renderable outside the application provider makes
  // isolated forms, Storybook-like previews, and unit tests resilient.
  return context ?? standaloneCompanyContext;
}
