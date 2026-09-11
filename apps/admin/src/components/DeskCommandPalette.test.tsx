import { fireEvent, render, screen, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DeskCommandPalette from "./DeskCommandPalette";
import { LanguageProvider } from "@/context/LanguageContext";
import { useCommandPaletteStore } from "@/store/useCommandPaletteStore";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="test-location">{location.pathname}{location.search}</div>;
}

describe("DeskCommandPalette", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("appLanguage", "id");
    useCommandPaletteStore.setState({ isOpen: false });

    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("opens when pressing Command+K (metaKey + 'k')", async () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={["/desk/projects"]}>
          <DeskCommandPalette />
        </MemoryRouter>
      </LanguageProvider>
    );

    expect(screen.queryByPlaceholderText(/Ketik nama modul/i)).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "k" }));
    });

    expect(await screen.findByPlaceholderText(/Ketik nama modul/i)).toBeInTheDocument();
  });

  it("opens when pressing Ctrl+K (ctrlKey + 'k')", async () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={["/desk/timesheet"]}>
          <DeskCommandPalette />
        </MemoryRouter>
      </LanguageProvider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, key: "k" }));
    });

    expect(await screen.findByPlaceholderText(/Ketik nama modul/i)).toBeInTheDocument();
  });

  it("filters results when query is typed and navigates on select", async () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={["/desk/buying"]}>
          <DeskCommandPalette />
          <LocationDisplay />
        </MemoryRouter>
      </LanguageProvider>
    );

    // Open palette
    act(() => {
      useCommandPaletteStore.getState().open();
    });

    const input = await screen.findByPlaceholderText(/Ketik nama modul/i);
    expect(input).toBeInTheDocument();

    // Type query "Proyek"
    fireEvent.change(input, { target: { value: "Proyek" } });

    // Should find Project module ("Manajemen Proyek")
    const projectItem = await screen.findByText(/Manajemen Proyek/i);
    expect(projectItem).toBeInTheDocument();

    // Click to navigate
    fireEvent.click(projectItem);

    // Dialog should be closed and store isOpen reset
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    expect(screen.getByTestId("test-location")).toHaveTextContent("/desk/projects");
  });

  it("can be opened and closed programmatically via useCommandPaletteStore", async () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={["/desk/stock"]}>
          <DeskCommandPalette />
        </MemoryRouter>
      </LanguageProvider>
    );

    expect(screen.queryByPlaceholderText(/Ketik nama modul/i)).not.toBeInTheDocument();

    act(() => {
      useCommandPaletteStore.getState().open();
    });

    expect(await screen.findByPlaceholderText(/Ketik nama modul/i)).toBeInTheDocument();

    act(() => {
      useCommandPaletteStore.getState().close();
    });

    expect(screen.queryByPlaceholderText(/Ketik nama modul/i)).not.toBeInTheDocument();
  });
});
