export const FONT_PREFERENCE_STORAGE_KEY = "lms-font-preference";
export const FONT_PREFERENCE_EVENT = "lms-font-preference-changed";

export type FontPreferenceId =
  | "plus-jakarta-sans"
  | "inter"
  | "poppins"
  | "nunito"
  | "lora"
  | "system";

export type FontPreference = {
  id: FontPreferenceId;
  label: string;
  description: string;
  family: string;
  googleFamily?: string;
};

export const DEFAULT_FONT_PREFERENCE: FontPreferenceId = "plus-jakarta-sans";

export const FONT_PREFERENCES: FontPreference[] = [
  {
    id: "plus-jakarta-sans",
    label: "Plus Jakarta Sans",
    description: "Modern dan seimbang",
    family: '"Plus Jakarta Sans", system-ui, sans-serif',
    googleFamily: "Plus+Jakarta+Sans:wght@400;500;600;700;800",
  },
  {
    id: "inter",
    label: "Inter",
    description: "Bersih dan mudah dibaca",
    family: '"Inter", system-ui, sans-serif',
    googleFamily: "Inter:wght@400;500;600;700;800",
  },
  {
    id: "poppins",
    label: "Poppins",
    description: "Geometris dan ramah",
    family: '"Poppins", system-ui, sans-serif',
    googleFamily: "Poppins:wght@400;500;600;700;800",
  },
  {
    id: "nunito",
    label: "Nunito",
    description: "Lembut dan nyaman",
    family: '"Nunito", system-ui, sans-serif',
    googleFamily: "Nunito:wght@400;500;600;700;800",
  },
  {
    id: "lora",
    label: "Lora",
    description: "Hangat dan editorial",
    family: '"Lora", Georgia, serif',
    googleFamily: "Lora:wght@400;500;600;700",
  },
  {
    id: "system",
    label: "Font sistem",
    description: "Mengikuti perangkat",
    family:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
];

const FONT_LINK_ID = "lms-user-font";

export const getFontPreference = (
  id: string | null | undefined
): FontPreference =>
  FONT_PREFERENCES.find((font) => font.id === id) ||
  FONT_PREFERENCES.find((font) => font.id === DEFAULT_FONT_PREFERENCE)!;

export const getStoredFontPreference = (): FontPreferenceId => {
  if (typeof window === "undefined") return DEFAULT_FONT_PREFERENCE;
  return getFontPreference(
    window.localStorage.getItem(FONT_PREFERENCE_STORAGE_KEY)
  ).id;
};

export const applyFontPreference = (
  preferenceId: string | null | undefined
) => {
  if (typeof document === "undefined") return;

  const preference = getFontPreference(preferenceId);
  const root = document.documentElement;
  root.style.setProperty("--font-sans", preference.family);
  root.style.setProperty("--font-display", preference.family);

  const existingLink = document.getElementById(
    FONT_LINK_ID
  ) as HTMLLinkElement | null;
  if (!preference.googleFamily) {
    existingLink?.remove();
    return;
  }

  const href = `https://fonts.googleapis.com/css2?family=${preference.googleFamily}&display=swap`;
  if (existingLink?.href === href) return;

  const link = existingLink || document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  if (!existingLink) document.head.appendChild(link);
};

export const setFontPreference = (preferenceId: FontPreferenceId) => {
  if (typeof window === "undefined") return;

  const preference = getFontPreference(preferenceId);
  window.localStorage.setItem(FONT_PREFERENCE_STORAGE_KEY, preference.id);
  applyFontPreference(preference.id);
  window.dispatchEvent(
    new CustomEvent(FONT_PREFERENCE_EVENT, { detail: preference.id })
  );
};

export const initializeFontPreference = () => {
  if (typeof window === "undefined") return;

  applyFontPreference(getStoredFontPreference());
  window.addEventListener("storage", (event) => {
    if (event.key === FONT_PREFERENCE_STORAGE_KEY) {
      applyFontPreference(event.newValue);
    }
  });
};
