import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FONT_PREFERENCE_EVENT,
  FONT_PREFERENCE_STORAGE_KEY,
  applyFontPreference,
  getStoredFontPreference,
  setFontPreference,
} from "./font-preference";

describe("font preference", () => {
  beforeEach(() => {
    localStorage.clear();
    document.getElementById("lms-user-font")?.remove();
    document.documentElement.style.removeProperty("--font-sans");
    document.documentElement.style.removeProperty("--font-display");
  });

  it("persists and applies the selected font globally", () => {
    const listener = vi.fn();
    window.addEventListener(FONT_PREFERENCE_EVENT, listener);

    setFontPreference("inter");

    expect(localStorage.getItem(FONT_PREFERENCE_STORAGE_KEY)).toBe("inter");
    expect(getStoredFontPreference()).toBe("inter");
    expect(
      document.documentElement.style.getPropertyValue("--font-sans")
    ).toContain('"Inter"');
    expect(document.getElementById("lms-user-font")).toHaveAttribute(
      "href",
      expect.stringContaining("family=Inter")
    );
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener(FONT_PREFERENCE_EVENT, listener);
  });

  it("falls back to the default font for an unknown stored value", () => {
    localStorage.setItem(FONT_PREFERENCE_STORAGE_KEY, "unknown-font");

    expect(getStoredFontPreference()).toBe("plus-jakarta-sans");

    applyFontPreference(getStoredFontPreference());
    expect(
      document.documentElement.style.getPropertyValue("--font-display")
    ).toContain('"Plus Jakarta Sans"');
  });
});
