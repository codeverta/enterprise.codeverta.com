import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable, type ColumnDef } from "./data-table";

type Row = { name: string; status: string; amount: number };

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name", meta: { label: "Name" } },
  { accessorKey: "status", header: "Status", meta: { label: "Status" } },
  { accessorKey: "amount", header: "Amount", meta: { label: "Amount" } },
];

const data: Row[] = [
  { name: "Alpha", status: "Draft", amount: 20 },
  { name: "Beta", status: "Submitted", amount: 10 },
];

describe("DataTable", () => {
  it("provides global search, multi-column filter, and sorting from one reusable table", () => {
    render(<DataTable columns={columns} data={data} pagination={false} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search table" }), { target: { value: "Beta" } });
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search table" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Filter value" }), { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Sort table" }));
    fireEvent.click(screen.getByRole("option", { name: "Amount" }));

    const body = screen.getAllByRole("rowgroup")[1];
    const rows = within(body).getAllByRole("row");
    expect(within(rows[0]).getByText("Alpha")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ubah arah sort" }));
    expect(within(within(body).getAllByRole("row")[0]).getByText("Beta")).toBeInTheDocument();
  });
});
