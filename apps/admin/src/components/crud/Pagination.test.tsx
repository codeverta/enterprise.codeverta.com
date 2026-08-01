// src/components/Pagination.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Pagination from "./Pagination"; // Adjust the import path as necessary

describe("Pagination Component", () => {
  // Test Case 1: Component renders correctly with multiple pages
  it("should render pagination controls and display current page info for multiple pages", () => {
    const currentPage = 3;
    const lastPage = 5;
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={currentPage}
        lastPage={lastPage}
        onPageChange={onPageChange}
      />
    );

    // Verify page information text
    expect(
      screen.getByText(`Halaman ${currentPage} dari ${lastPage}`)
    ).toBeInTheDocument();

    // Verify all pagination buttons are present
    expect(
      screen.getByRole("button", { name: /first page/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /previous page/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /next page/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /last page/i })
    ).toBeInTheDocument();

    // Verify button disabled states based on current page
    // 'First page' and 'Previous page' buttons should be enabled
    expect(
      screen.getByRole("button", { name: /first page/i })
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: /previous page/i })
    ).not.toBeDisabled();
    // 'Next page' and 'Last page' buttons should be enabled
    expect(
      screen.getByRole("button", { name: /next page/i })
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: /last page/i })
    ).not.toBeDisabled();
  });

  // Test Case 2: Component renders correctly on the first page
  it("should disable first and previous buttons when on the first page", () => {
    const currentPage = 1;
    const lastPage = 5;
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={currentPage}
        lastPage={lastPage}
        onPageChange={onPageChange}
      />
    );

    // 'First page' and 'Previous page' buttons should be disabled
    expect(screen.getByRole("button", { name: /first page/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /previous page/i })
    ).toBeDisabled();
    // 'Next page' and 'Last page' buttons should be enabled
    expect(
      screen.getByRole("button", { name: /next page/i })
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: /last page/i })
    ).not.toBeDisabled();
  });

  // Test Case 3: Component renders correctly on the last page
  it("should disable next and last buttons when on the last page", () => {
    const currentPage = 5;
    const lastPage = 5;
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={currentPage}
        lastPage={lastPage}
        onPageChange={onPageChange}
      />
    );

    // 'First page' and 'Previous page' buttons should be enabled
    expect(
      screen.getByRole("button", { name: /first page/i })
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: /previous page/i })
    ).not.toBeDisabled();
    // 'Next page' and 'Last page' buttons should be disabled
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /last page/i })).toBeDisabled();
  });

  // Test Case 4: Component renders null if lastPage is 1 or less
  it("should not render the component if lastPage is 1", () => {
    const currentPage = 1;
    const lastPage = 1;
    const onPageChange = vi.fn();

    const { container } = render(
      <Pagination
        currentPage={currentPage}
        lastPage={lastPage}
        onPageChange={onPageChange}
      />
    );

    // Expect the container to be empty or not contain the pagination div
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Halaman/i)).not.toBeInTheDocument();
  });

  it("should not render the component if lastPage is 0", () => {
    const currentPage = 1;
    const lastPage = 0;
    const onPageChange = vi.fn();

    const { container } = render(
      <Pagination
        currentPage={currentPage}
        lastPage={lastPage}
        onPageChange={onPageChange}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  // Test Case 5: Clicking 'first page' button
  it("should call onPageChange with 1 when first page button is clicked", () => {
    const currentPage = 3;
    const lastPage = 5;
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={currentPage}
        lastPage={lastPage}
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /first page/i }));
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  // Test Case 6: Clicking 'previous page' button
  it("should call onPageChange with currentPage - 1 when previous page button is clicked", () => {
    const currentPage = 3;
    const lastPage = 5;
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={currentPage}
        lastPage={lastPage}
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /previous page/i }));
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(currentPage - 1);
  });

  // Test Case 7: Clicking 'next page' button
  it("should call onPageChange with currentPage + 1 when next page button is clicked", () => {
    const currentPage = 3;
    const lastPage = 5;
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={currentPage}
        lastPage={lastPage}
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(currentPage + 1);
  });

  // Test Case 8: Clicking 'last page' button
  it("should call onPageChange with lastPage when last page button is clicked", () => {
    const currentPage = 3;
    const lastPage = 5;
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={currentPage}
        lastPage={lastPage}
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /last page/i }));
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(lastPage);
  });

  // Test Case 9: Disabled buttons should not trigger onPageChange
  it("should not call onPageChange when disabled buttons are clicked", () => {
    const onPageChange = vi.fn();

    // Initial render: currentPage is 1, so first and previous buttons are disabled
    const { rerender } = render(
      <Pagination
        currentPage={1}
        lastPage={2} // lastPage > 1 so buttons are rendered
        onPageChange={onPageChange}
      />
    );

    // Click disabled 'first page' and 'previous page' buttons
    fireEvent.click(screen.getByRole("button", { name: /first page/i }));
    fireEvent.click(screen.getByRole("button", { name: /previous page/i }));

    // onPageChange should not have been called
    expect(onPageChange).not.toHaveBeenCalled();

    // Clear mock calls before the next phase of testing
    onPageChange.mockClear();

    // Rerender the component to simulate being on the last page (currentPage = lastPage)
    // This makes 'next page' and 'last page' buttons disabled
    rerender(
      <Pagination currentPage={2} lastPage={2} onPageChange={onPageChange} />
    );

    // Click disabled 'next page' and 'last page' buttons
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    fireEvent.click(screen.getByRole("button", { name: /last page/i }));

    // onPageChange should still not have been called
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
