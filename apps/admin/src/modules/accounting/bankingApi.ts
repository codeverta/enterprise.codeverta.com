import api from "@/lib/api";

export type Bank = {
  id: string;
  bank_name: string;
  swift_number: string;
  website: string;
  bank_transaction_mapping?: unknown;
};

export type BankAccountType = { id: string; name: string; disabled: boolean };

export type BankAccount = {
  id: string;
  account_name: string;
  bank: string;
  account_type: string;
  account_subtype: string;
  disabled: boolean;
  is_default: boolean;
  is_company_account: boolean;
  party_type: string;
  party: string;
  iban: string;
  branch_code: string;
  bank_account_no: string;
  last_integration_date?: string | null;
};

const list = async <T>(path: string, q?: string) =>
  (await api.get<{ data: T[] }>(path, { params: { q: q || undefined } })).data.data || [];

export const bankingApi = {
  banks: () => list<Bank>("/accounting/banks"),
  bank: (id: string) => api.get<Bank>(`/accounting/banks/${encodeURIComponent(id)}`).then((r) => r.data),
  createBank: (data: Partial<Bank>) => api.post<Bank>("/accounting/banks", data).then((r) => r.data),
  updateBank: (id: string, data: Partial<Bank>) => api.put<Bank>(`/accounting/banks/${encodeURIComponent(id)}`, data).then((r) => r.data),
  removeBank: (id: string) => api.delete(`/accounting/banks/${encodeURIComponent(id)}`),
  accountTypes: () => list<BankAccountType>("/accounting/bank-account-types"),
  createAccountType: (data: Partial<BankAccountType>) => api.post<BankAccountType>("/accounting/bank-account-types", data).then((r) => r.data),
  bankAccounts: () => list<BankAccount>("/accounting/bank-accounts"),
  bankAccount: (id: string) => api.get<BankAccount>(`/accounting/bank-accounts/${encodeURIComponent(id)}`).then((r) => r.data),
  accountOptions: () => api.get<{ banks: Bank[]; account_types: BankAccountType[] }>("/accounting/bank-accounts/options").then((r) => r.data),
  createBankAccount: (data: Partial<BankAccount>) => api.post<BankAccount>("/accounting/bank-accounts", data).then((r) => r.data),
  updateBankAccount: (id: string, data: Partial<BankAccount>) => api.put<BankAccount>(`/accounting/bank-accounts/${encodeURIComponent(id)}`, data).then((r) => r.data),
  removeBankAccount: (id: string) => api.delete(`/accounting/bank-accounts/${encodeURIComponent(id)}`),
};
