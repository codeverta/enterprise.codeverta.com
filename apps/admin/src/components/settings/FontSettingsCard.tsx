import { useEffect, useState } from "react";
import { Check, Type } from "lucide-react";
import {
  FONT_PREFERENCES,
  FONT_PREFERENCE_EVENT,
  FontPreferenceId,
  getStoredFontPreference,
  setFontPreference,
} from "@/lib/font-preference";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PREVIEW_FONT_LINK_ID = "lms-font-picker-preview";

export function FontSettingsCard() {
  const [selectedFont, setSelectedFont] = useState<FontPreferenceId>(
    getStoredFontPreference
  );

  useEffect(() => {
    if (!document.getElementById(PREVIEW_FONT_LINK_ID)) {
      const families = FONT_PREFERENCES.filter(
        (font) => font.googleFamily
      ).map((font) => `family=${font.googleFamily}`);
      const link = document.createElement("link");
      link.id = PREVIEW_FONT_LINK_ID;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?${families.join(
        "&"
      )}&display=swap`;
      document.head.appendChild(link);
    }

    const handleFontChange = (event: Event) => {
      const preferenceId = (event as CustomEvent<FontPreferenceId>).detail;
      if (preferenceId) setSelectedFont(preferenceId);
    };
    window.addEventListener(FONT_PREFERENCE_EVENT, handleFontChange);
    return () =>
      window.removeEventListener(FONT_PREFERENCE_EVENT, handleFontChange);
  }, []);

  const selectFont = (fontId: FontPreferenceId) => {
    setSelectedFont(fontId);
    setFontPreference(fontId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="h-4 w-4" />
          Font dashboard
        </CardTitle>
        <CardDescription>
          Pilih font yang paling nyaman untuk Anda. Perubahan diterapkan ke
          seluruh dashboard dan tersimpan otomatis di perangkat ini.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          role="radiogroup"
          aria-label="Pilihan font dashboard"
        >
          {FONT_PREFERENCES.map((font) => {
            const isSelected = selectedFont === font.id;
            return (
              <button
                key={font.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => selectFont(font.id)}
                className={cn(
                  "relative min-h-24 rounded-xl border bg-background p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                {isSelected && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
                <span
                  className="block pr-7 text-lg font-semibold text-foreground"
                  style={{ fontFamily: font.family }}
                >
                  Aa {font.label}
                </span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  {font.description}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Preferensi ini disimpan di localStorage dan tetap aktif setelah
          browser dibuka kembali.
        </p>
      </CardContent>
    </Card>
  );
}
