import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "@/lib/api";
import { CompanyProvider } from "@/context/CompanyContext";
import { CompanySelect } from "./CompanySelect";

vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const companies = [
  { id: "company-a", name: "Company A", abbreviation: "A", currency: "IDR" },
  { id: "company-b", name: "Company B", abbreviation: "B", currency: "USD" },
];

function Subject({ value = "", onChange = vi.fn() }: { value?: string; onChange?: (value: string) => void }) {
  return (
    <CompanyProvider>
      <CompanySelect value={value} onChange={onChange} />
    </CompanyProvider>
  );
}

describe("CompanySelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: { data: { companies, active_company: companies[0] } } });
    vi.mocked(api.post).mockResolvedValue({ data: { data: { companies, active_company: companies[1] } } });
  });

  it("fills an empty form with the current user's active company", async () => {
    const onChange = vi.fn();
    render(<Subject onChange={onChange} />);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Company A"));
    expect(api.get).toHaveBeenCalledWith("/organization/company-context");
  });

  it("records an explicit selection for frequency-based preference", async () => {
    const onChange = vi.fn();
    render(<Subject value="Company A" onChange={onChange} />);

    const trigger = await screen.findByRole("button", { name: "Company" });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: /Company B/ }));

    expect(onChange).toHaveBeenCalledWith("Company B");
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      "/organization/company-context/select",
      { company_id: "company-b" },
    ));
  });
});
