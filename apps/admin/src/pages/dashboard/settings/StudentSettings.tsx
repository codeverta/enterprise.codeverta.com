import React, { useEffect, useState } from "react";
import {
  Bot,
  Check,
  Clock3,
  Languages,
  Loader2,
  PawPrint,
  Settings2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { PetSettingsCard } from "@/features/pet/PetSettingsCard";
import { FontSettingsCard } from "@/components/settings/FontSettingsCard";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type Language = "id" | "en";

type AIUsage = {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  reset_at: string;
};

const defaultUsage: AIUsage = {
  used: 0,
  limit: 200,
  remaining: 200,
  percentage: 0,
  reset_at: "",
};

function StudentSettingsPage() {
  const { t, setLanguage: applyLanguage } = useLanguage();
  const [language, setLanguage] = useState<Language>("id");
  const [usage, setUsage] = useState<AIUsage>(defaultUsage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.get("/lms/my-settings");
        const data = response.data?.data || response.data || {};
        const selectedLanguage: Language = data.language === "en" ? "en" : "id";
        setLanguage(selectedLanguage);
        setUsage({ ...defaultUsage, ...(data.ai_usage || {}) });
        applyLanguage(selectedLanguage);
      } catch (error: any) {
        toast.error(error.response?.data?.message || t("settings.load_error"));
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [applyLanguage, t]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put("/lms/my-settings", { language });
      applyLanguage(language);
      toast.success(t("settings.success"));
    } catch (error: any) {
      toast.error(error.response?.data?.message || t("settings.error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-7 w-7 animate-spin text-zinc-500" />
      </div>
    );
  }

  const percentage = Math.min(100, Math.max(0, Number(usage.percentage || 0)));
  const resetLabel = usage.reset_at
    ? new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
        timeZoneName: "short",
      }).format(new Date(usage.reset_at))
    : "00.00 WIB";

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-zinc-950">
            {t("settings.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{t("settings.subtitle")}</p>
        </header>

        <Tabs defaultValue="language" className="w-full">
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 bg-muted p-1 sm:grid-cols-5">
            <TabsTrigger value="language" className="gap-1.5">
              <Languages className="h-4 w-4" />
              <span className="hidden sm:inline">Bahasa</span>
            </TabsTrigger>
            <TabsTrigger value="font" className="gap-1.5">
              <Type className="h-4 w-4" />
              <span className="hidden sm:inline">Font</span>
            </TabsTrigger>
            <TabsTrigger value="layout" className="gap-1.5">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Layout</span>
            </TabsTrigger>
            <TabsTrigger value="pet" className="gap-1.5">
              <PawPrint className="h-4 w-4" />
              <span className="hidden sm:inline">Pet</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">AI</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="language" className="space-y-6">
            <section className="border-y border-zinc-200 bg-white px-4 py-5 sm:rounded-lg sm:border">
              <div className="flex items-start gap-3">
                <Languages className="mt-0.5 h-5 w-5 text-zinc-600" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    {t("settings.language.title")}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("settings.language.subtitle")}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 p-1">
                    {(
                      [
                        ["id", "Bahasa Indonesia"],
                        ["en", "English"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLanguage(value)}
                        className={cn(
                          "flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                          language === value
                            ? "bg-white text-zinc-950 shadow-sm"
                            : "text-zinc-500 hover:text-zinc-800"
                        )}
                      >
                        {language === value && <Check className="h-4 w-4" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="font" className="space-y-6">
            <FontSettingsCard />
          </TabsContent>

          <TabsContent value="layout" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Pilihan Layout
                </CardTitle>
                <CardDescription>
                  Pilih gaya navigasi dashboard (Sidebar di samping atau Navbar
                  di atas).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                  {(
                    [
                      ["sidebar", "Sidebar (Samping)"],
                      ["navbar", "Navbar (Atas)"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        localStorage.setItem("layoutType", value);
                        window.dispatchEvent(
                          new CustomEvent("layout-type-changed", {
                            detail: value,
                          })
                        );
                        setIsDirty(true);
                        toast.success(`Layout berhasil diubah ke ${label}`);
                      }}
                      className={cn(
                        "flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                        (localStorage.getItem("layoutType") || "sidebar") ===
                          value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {(localStorage.getItem("layoutType") || "sidebar") ===
                        value && <Check className="h-4 w-4" />}
                      {label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pet" className="space-y-6">
            <PetSettingsCard />
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <section className="border-y border-zinc-200 bg-white px-4 py-5 sm:rounded-lg sm:border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Bot className="mt-0.5 h-5 w-5 text-zinc-600" />
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      {t("settings.ai.title")}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("settings.ai.subtitle")}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
                  {usage.used}/{usage.limit}
                </span>
              </div>

              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    percentage >= 90
                      ? "bg-rose-500"
                      : percentage >= 70
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>
                  {t("settings.ai.remaining").replace(
                    "{count}",
                    String(usage.remaining)
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />{" "}
                  {t("settings.ai.reset").replace("{time}", resetLabel)}
                </span>
              </div>
            </section>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? t("settings.saving") : t("settings.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout(StudentSettingsPage);
