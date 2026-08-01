import React, { useState, useEffect } from "react";
import api from "@/lib/api"; // Sesuaikan dengan struktur proyekmu
import DashboardLayout from "@/layout/DashboardLayout";
import { toast } from "sonner";
import { PageLoader } from "@/components/page-loader";
import { useBlocker } from "react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuotaProgressBar from "@/components/QuotaProgressBar";
import ParticipantQuotaProgressBar from "@/components/ParticipantQuotaProgressBar";
import { Separator } from "@/components/ui/separator";

import { cn, BASE_STORAGE_URL, getStorageUrl } from "@/lib/utils";
import {
  Check,
  Languages,
  Settings2,
  ImagePlus,
  ShieldAlert,
  Webhook,
  Wallet,
  Loader2,
  X,
  AlertTriangle,
  PawPrint,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { PetSettingsCard } from "@/features/pet/PetSettingsCard";
import { FontSettingsCard } from "@/components/settings/FontSettingsCard";

export function SettingsPage() {
  const { t, setLanguage: applyLanguage } = useLanguage();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = Number(user?.role || 0);
  const isParent = userRole === 10;
  const isMentorExternal = userRole === 30 || userRole === 40;
  const isAdmin = userRole >= 99;
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [payoutBankName, setPayoutBankName] = useState("");
  const [payoutBankAccountNumber, setPayoutBankAccountNumber] = useState("");
  const [payoutBankAccountName, setPayoutBankAccountName] = useState("");
  const [settings, setSettings] = useState({
    app_name: "",
    app_tagline: "",
    app_logo: "",
    banner_text: "",
    is_dev_mode: false,
    is_registration_open: false,
    is_maintenance_mode: false,
    event_start_time: "",
    participant_quota: 0,
    participant_used: 0,
    discord_payment_webhook: "",
    discord_email_webhook: "",
    discord_register_webhook: "",
    discord_withdrawal_webhook: "",
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file size cannot exceed 2MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadingLogo(true);
    try {
      const res = await api.post("/admin/upload-image", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      if (res.data?.success && res.data?.data?.key) {
        const logoPath = res.data.data.key;
        setSettings((prev) => ({ ...prev, app_logo: logoPath }));
        setIsDirty(true);
        toast.success("Logo uploaded successfully");
      } else {
        toast.error(res.data?.message || "Failed to upload logo");
      }
    } catch (error) {
      console.error("Upload error", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Fetch Settings saat load
  useEffect(() => {
    fetchSettings();
  }, []);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  const fetchSettings = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const isMentorExternal = user?.role === 40;

      let resSettings = null;
      let resMySettings = null;
      let resPayout = null;

      if (isParent) {
        resMySettings = await api.get("/lms/my-settings").catch(() => null);
      } else if (isMentorExternal) {
        [resMySettings, resPayout] = await Promise.all([
          api.get("/lms/my-settings").catch(() => null),
          api.get("/settings/payout").catch(() => null),
        ]);
      } else {
        [resSettings, resMySettings, resPayout] = await Promise.all([
          api.get("/settings/admin"),
          api.get("/lms/my-settings").catch(() => null),
          api.get("/settings/payout").catch(() => null),
        ]);
      }

      const formatDT = (date) =>
        date ? new Date(date).toISOString().slice(0, 16) : "";

      if (resSettings?.data) {
        setSettings({
          ...resSettings.data,
          event_start_time: formatDT(resSettings.data.event_start_time),
        });
      }

      if (resMySettings?.data?.data?.language) {
        setLanguage(resMySettings.data.data.language === "en" ? "en" : "id");
      }

      if (resPayout?.data) {
        setPayoutBankName(resPayout.data.bank_name || "");
        setPayoutBankAccountNumber(resPayout.data.bank_account_number || "");
        setPayoutBankAccountName(resPayout.data.bank_account_name || "");
      }
    } catch (error) {
      console.error("Failed to load settings", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const role = Number(user?.role || 0);
      const isParent = role === 10;
      const isMentorExternal = role === 30 || role === 40;
      const isAdmin = role >= 99;

      const promises = [
        api
          .put("/lms/my-settings", { language })
          .then(() => {
            applyLanguage(language);
          })
          .catch(() => null),
      ];

      if (!isParent && (payoutBankName || payoutBankAccountNumber || payoutBankAccountName)) {
        promises.push(
          api
            .post("/settings/payout", {
              bank_name: payoutBankName,
              bank_account_number: payoutBankAccountNumber,
              bank_account_name: payoutBankAccountName,
            })
            .catch(() => null)
        );
      }

      if (isAdmin) {
        const payloadSettings = {
          ...settings,
          event_start_time: new Date(settings.event_start_time).toISOString(),
        };
        promises.push(api.put("/settings", payloadSettings));
      }

      await Promise.all(promises);

      setIsDirty(false);

      toast.success("Semua pengaturan berhasil disimpan");
    } catch (error) {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <>
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ada perubahan yang belum disimpan. Apakah Anda yakin ingin
              meninggalkan halaman ini? Perubahan Anda akan hilang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => blocker.state === "blocked" && blocker.reset()}
            >
              Tetap di Sini
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blocker.state === "blocked" && blocker.proceed()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Tinggalkan Halaman
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="sticky top-0 z-10 -mx-4 mb-6 flex flex-col gap-3 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-8 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              System Configuration
            </h1>
            <p className="text-sm text-muted-foreground">
              Kelola konfigurasi umum, akses, notifikasi, dan rekening
              penarikan.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isDirty && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700"
              >
                Perubahan belum disimpan
              </Badge>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="min-w-[9rem]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue={isParent ? "language" : isMentorExternal ? "payout" : "general"} className="w-full">
          <TabsList className={cn(
            "mb-6 grid h-auto w-full gap-1 bg-muted p-1",
            isParent
              ? "max-w-md grid-cols-2"
              : isMentorExternal
                ? "grid-cols-3 max-w-xl"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
          )}>
            {isAdmin && (
              <>
                <TabsTrigger value="general" className="gap-1.5">
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden sm:inline">General</span>
                </TabsTrigger>
                <TabsTrigger value="access" className="gap-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  <span className="hidden sm:inline">Access</span>
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="language" className="gap-1.5">
              <Languages className="h-4 w-4" />
              <span className="hidden sm:inline">Language</span>
            </TabsTrigger>
            <TabsTrigger value="pet" className="gap-1.5">
              <PawPrint className="h-4 w-4" />
              <span className="hidden sm:inline">Pet</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="webhooks" className="gap-1.5">
                <Webhook className="h-4 w-4" />
                <span className="hidden sm:inline">Webhooks</span>
              </TabsTrigger>
            )}
            {!isParent && (
              <TabsTrigger value="payout" className="gap-1.5">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Payout</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* General */}
          {isAdmin && (
            <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>App Identity</CardTitle>
                <CardDescription>
                  Nama dan logo aplikasi yang tampil di seluruh platform.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="app_name">App Name</Label>
                  <Input
                    id="app_name"
                    type="text"
                    value={settings.app_name}
                    onChange={(e) => {
                      setIsDirty(true);
                      setSettings({ ...settings, app_name: e.target.value });
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="app_tagline">App Tagline / Subtitle (Sidebar)</Label>
                  <Input
                    id="app_tagline"
                    type="text"
                    placeholder="e.g. Future of Homeschooling"
                    value={settings.app_tagline}
                    onChange={(e) => {
                      setIsDirty(true);
                      setSettings({ ...settings, app_tagline: e.target.value });
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>App Logo</Label>
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted">
                      {settings.app_logo ? (
                        <img
                          src={getStorageUrl(settings.app_logo)}
                          alt="App Logo"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="p-1 text-center text-xs font-medium text-muted-foreground">
                          No Logo
                        </span>
                      )}
                      {uploadingLogo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="app-logo-upload"
                          disabled={uploadingLogo}
                        />
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          disabled={uploadingLogo}
                        >
                          <label
                            htmlFor="app-logo-upload"
                            className="cursor-pointer"
                          >
                            <ImagePlus className="mr-1.5 h-4 w-4" />
                            Change Logo
                          </label>
                        </Button>
                        {settings.app_logo && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-700"
                            onClick={() => {
                              setIsDirty(true);
                              setSettings({ ...settings, app_logo: "" });
                            }}
                          >
                            <X className="mr-1.5 h-4 w-4" />
                            Remove Logo
                          </Button>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Recommended: Square image, max 2MB (PNG, JPG, WEBP)
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quota Overview</CardTitle>
                <CardDescription>
                  Ringkasan kuota penggunaan saat ini.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {settings && <QuotaProgressBar data={settings} />}
              </CardContent>
            </Card>
            </TabsContent>
          )}

          {/* Access & Status */}
          {isAdmin && (
            <TabsContent value="access" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Access & Status</CardTitle>
                <CardDescription>
                  Kontrol ketersediaan aplikasi untuk pengguna.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="maintenance_mode"
                      className="text-sm font-medium"
                    >
                      Maintenance Mode
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Close the app for everyone except admins.
                    </p>
                  </div>
                  <Switch
                    id="maintenance_mode"
                    checked={settings.is_maintenance_mode}
                    onCheckedChange={(val) => {
                      setIsDirty(true);
                      setSettings({ ...settings, is_maintenance_mode: val });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
            </TabsContent>
          )}

          {/* Language */}
          <TabsContent value="language" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  {t("settings.language.title")}
                </CardTitle>
                <CardDescription>
                  {t("settings.language.subtitle")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid max-w-md grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                  {(
                    [
                      ["id", "Bahasa Indonesia"],
                      ["en", "English"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setIsDirty(true);
                        setLanguage(value);
                      }}
                      className={cn(
                        "flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                        language === value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {language === value && <Check className="h-4 w-4" />}
                      {label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <FontSettingsCard />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Pilihan Layout
                </CardTitle>
                <CardDescription>
                  Pilih gaya navigasi dashboard (Sidebar di samping atau Navbar di atas).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid max-w-md grid-cols-2 gap-2 rounded-lg bg-muted p-1">
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
                          new CustomEvent("layout-type-changed", { detail: value })
                        );
                        // Trigger state updates
                        setIsDirty(true);
                        toast.success(`Layout berhasil diubah ke ${label}`);
                      }}
                      className={cn(
                        "flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                        (localStorage.getItem("layoutType") || "sidebar") === value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {(localStorage.getItem("layoutType") || "sidebar") === value && <Check className="h-4 w-4" />}
                      {label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Tour Dashboard
                </CardTitle>
                <CardDescription>
                  Tampilkan kembali panduan interaktif yang menyorot letak menu dan fungsi penting sesuai role akun Anda.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.dispatchEvent(new Event("onboarding:start"))}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Mulai ulang tour
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pet" className="space-y-6">
            <PetSettingsCard />
          </TabsContent>

          {/* Discord Webhooks */}
          {isAdmin && (
            <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  Discord Webhooks
                </CardTitle>
                <CardDescription>
                  URL webhook untuk notifikasi otomatis ke channel Discord.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {["payment", "email", "withdrawal"].map((type, idx) => (
                  <React.Fragment key={type}>
                    {idx > 0 && <Separator />}
                    <div className="space-y-2">
                      <Label
                        htmlFor={`discord_${type}_webhook`}
                        className="capitalize"
                      >
                        {type} Webhook URL
                      </Label>
                      <Input
                        id={`discord_${type}_webhook`}
                        type="text"
                        value={settings[`discord_${type}_webhook`] || ""}
                        onChange={(e) => {
                          setIsDirty(true);
                          setSettings({
                            ...settings,
                            [`discord_${type}_webhook`]: e.target.value,
                          });
                        }}
                        placeholder="https://discord.com/api/webhooks/..."
                      />
                    </div>
                  </React.Fragment>
                ))}
              </CardContent>
            </Card>
            </TabsContent>
          )}

          {/* Payout */}
          {!isParent && (
          <TabsContent value="payout" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Pengaturan Rekening Penarikan
                </CardTitle>
                <CardDescription>
                  Detail rekening bank Anda untuk menerima penarikan dana.
                  Pengaturan ini hanya berlaku untuk akun Anda sendiri (bukan
                  satu tenant).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Nama Bank</Label>
                    <Input
                      id="bank_name"
                      type="text"
                      value={payoutBankName}
                      onChange={(e) => {
                        setIsDirty(true);
                        setPayoutBankName(e.target.value);
                      }}
                      placeholder="Contoh: BCA, Mandiri, BNI"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank_account_number">Nomor Rekening</Label>
                    <Input
                      id="bank_account_number"
                      type="text"
                      value={payoutBankAccountNumber}
                      onChange={(e) => {
                        setIsDirty(true);
                        setPayoutBankAccountNumber(e.target.value);
                      }}
                      placeholder="Masukkan nomor rekening"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_account_name">
                    Nama Pemilik Rekening
                  </Label>
                  <Input
                    id="bank_account_name"
                    type="text"
                    value={payoutBankAccountName}
                    onChange={(e) => {
                      setIsDirty(true);
                      setPayoutBankAccountName(e.target.value);
                    }}
                    placeholder="Nama sesuai buku tabungan"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}
        </Tabs>

        {/* Bottom save button (mobile-friendly, mirrors sticky header action) */}
        <div className="mt-8 flex justify-end border-t pt-6 sm:hidden">
          <Button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Save Configuration"
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

export default DashboardLayout(SettingsPage);
