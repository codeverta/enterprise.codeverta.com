// src/pages/LoginPage.jsx
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCarousel } from "@/components/AuthCarousel";
import { Helmet } from "react-helmet";
import { Eye, EyeOff, Fingerprint, Handshake, Loader2, Store } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { BASE_STORAGE_URL, getStorageUrl } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { ROLES } from "@/lib/constants";
import { clearImpersonationStorage } from "@/lib/impersonation";
import { resolveAuthenticatedLandingPath } from "@/lib/dynamic-permissions";

// --- LIBRARY PENTING UNTUK WEBAUTHN ---
import { startAuthentication } from "@simplewebauthn/browser";
import { toast } from "sonner"; // Opsional: untuk notifikasi error yang lebih cantik

export default function LoginPage() {
    const { t } = useLanguage();
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loginType, setLoginType] = useState<"merchant" | "partner">("merchant");
    const navigate = useNavigate();
    const { settings, fetchSettings } = useSettingsStore();
    const [isChecking, setIsChecking] = useState(true);
    const loginBrand = "erp";
    const isRoleSpecificPortal = true;
    const logo = useMemo(() => {
        if (settings?.app_logo) {
            return getStorageUrl(settings.app_logo);
        }
        if (!settings?.app_name) return "";
        const appName = settings.app_name.toLowerCase();
        if (appName.includes("malabar")) return "/assets/logo.jpg";
        if (appName.includes("manglayang")) return "/manglayang/logo-long.png";
        return "";
    }, [settings?.app_logo, settings?.app_name]);

    useEffect(() => {
        let cancelled = false;

        const establishSession = async () => {
            const params = new URLSearchParams(window.location.search);
            const handoff = params.get("handoff");

            if (handoff) {
                try {
                    const response = await api.post("/auth/handoff/exchange", { token: handoff });
                    if (cancelled) return;
                    const data = response.data?.data || response.data;
                    clearImpersonationStorage();
                    localStorage.setItem("accessToken", data.access_token);
                    localStorage.setItem("refreshToken", data.refresh_token);
                    localStorage.setItem("user", JSON.stringify(data.user));
                    window.history.replaceState({}, document.title, window.location.pathname);
                    navigate(await resolveAuthenticatedLandingPath(data.user), { replace: true });
                    return;
                } catch (err: any) {
                    if (cancelled) return;
                    window.history.replaceState({}, document.title, window.location.pathname);
                    setError(
                        err.response?.data?.message ||
                        "Sesi coba gratis tidak valid atau sudah kedaluwarsa."
                    );
                    setIsChecking(false);
                    return;
                }
            }

            const token = localStorage.getItem("accessToken");
            const storedUser = localStorage.getItem("user");
            if (token && storedUser) {
                try {
                    navigate(await resolveAuthenticatedLandingPath(JSON.parse(storedUser)), { replace: true });
                } catch {
                    navigate("/dashboard", { replace: true });
                }
                return;
            }
            setIsChecking(false);
        };

        void establishSession();
        return () => {
            cancelled = true;
        };
    }, [navigate]);

    useEffect(() => {
        fetchSettings({ isPublic: true });
    }, []);

    if (isChecking) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // --- LOGIC SUKSES LOGIN (Shared) ---
    const onLoginSuccess = async (data) => {
        const { access_token, refresh_token, user } = data || {};
        if (isRoleSpecificPortal) {
            const expectedRole = loginType === "merchant" ? ROLES.MERCHANT : ROLES.PARTNER;
            const isPrivilegedAccount = user?.role >= ROLES.ADMIN;
            if (user?.role !== expectedRole && !isPrivilegedAccount) {
                setError(
                    loginType === "merchant"
                        ? "Akun ini bukan akun merchant."
                        : "Akun ini bukan akun partner."
                );
                return;
            }
        }
        clearImpersonationStorage();
        localStorage.setItem("accessToken", access_token);
        localStorage.setItem("refreshToken", refresh_token);
        localStorage.setItem("user", JSON.stringify(user));

        navigate(await resolveAuthenticatedLandingPath(user));
    };

    // --- HANDLE LOGIN PASSKEY (DISCOVERABLE / TANPA EMAIL) ---
    const handleDiscoverableLogin = async () => {
        setIsLoading(true);
        setError(null); // Reset error manual login jika ada

        try {
            // 1. Begin Login (Tanpa kirim email)
            // Pastikan backend sudah ada route: /auth/webauthn/login/discoverable/begin
            const beginResp = await api.post("/auth/webauthn/login/discoverable/begin");
            console.log("Begin Response:", beginResp.data);

            // FIX: Navigasi ke dalam struktur JSON yang benar
            // Response backend: { options: { publicKey: { challenge: ... } } }
            const responseData = beginResp.data;

            // Cek apakah ada di dalam properti 'options' (karena backend pakai gin.H{"options": ...})
            const optionsWrapper = responseData.options || responseData;

            // Ambil isi 'publicKey'
            const actualOptions = optionsWrapper.publicKey || optionsWrapper;

            // Debugging: Pastikan ini object yang berisi 'challenge'
            console.log("Final Options for Library:", actualOptions);

            const challengeID = actualOptions.challenge;

            if (!challengeID) {
                throw new Error(t("login.error.challenge"));
            }

            // 2. Browser Scan Jari (Browser otomatis cari akun yang cocok)
            let asseResp;
            try {
                asseResp = await startAuthentication(actualOptions);
            } catch (elemError) {
                if (elemError.name === 'NotAllowedError') {
                    // User membatalkan / klik cancel
                    console.log("User cancelled login");
                    setIsLoading(false);
                    return;
                }
                throw elemError;
            }

            // 3. Finish Login
            // Kirim challengeID di URL agar backend bisa load session yang benar
            const finishResp = await api.post(
                `/auth/webauthn/login/discoverable/finish?challenge=${challengeID}`,
                asseResp
            );

            console.log("Login Success:", finishResp.data);
            onLoginSuccess(finishResp.data.data);

        } catch (err) {
            console.error("Passkey error:", err);
            // Error handling khusus Passkey
            let msg = t("login.error.passkey");

            if (err.response?.data?.message) {
                msg = err.response.data.message;
            } else if (err.message) {
                msg = err.message;
            }

            // Tampilkan error di UI atau Toast
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    // --- HANDLE LOGIN MANUAL (EMAIL & PASSWORD) ---
    const handleManualLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Keep the Merchant/Partner UI compatible with backend processes
            // that still use the original numeric-role login aliases.
            const compatibleLoginType = loginType === "merchant" ? "parent" : "student";
            const response = await api.post("/auth/login", {
                identifier,
                password,
                ...(isRoleSpecificPortal ? { login_type: compatibleLoginType } : {}),
            });
            onLoginSuccess(response.data.data);
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleError = (err) => {
        if (err.response?.data?.errors?.email) {
            setError(err.response.data.errors.email[0]);
        } else if (err.response?.data?.message) {
            setError(err.response.data.message);
        } else {
            setError(t("login.error.generic"));
        }
    };

    return (
        <>
            <Helmet>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>
            <div className="relative grid min-h-screen w-full overflow-hidden bg-slate-950 lg:h-screen lg:grid-cols-2 lg:bg-background">
                <div className="absolute inset-0 lg:hidden" aria-hidden="true">
                    <AuthCarousel
                        settings={settings}
                        audience={loginType}
                        brand={loginBrand}
                        backgroundOnly
                    />
                </div>

                <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:px-8 lg:py-12">
                    <div className="mx-auto w-full max-w-md space-y-6">
                        <div className="flex flex-col items-center text-center">
                            {logo && (
                                <img
                                    src={logo}
                                    alt="Logo admin"
                                    className="w-20 h-auto mb-4"
                                />
                            )}
                            <h1 className="text-3xl font-bold tracking-tight text-white lg:text-foreground">
                                {settings?.app_name || "Codeverta ERP"}
                            </h1>
                            <p className="mt-2 text-white/75 lg:text-muted-foreground">
                                {loginType === "merchant"
                                    ? "Kelola impor, order, dan operasional bisnis Anda."
                                    : "Koordinasikan layanan logistik dan pengiriman merchant."}
                            </p>
                        </div>
                        <Card className="overflow-hidden border-white/25 bg-background/95 shadow-2xl shadow-black/30 backdrop-blur-xl lg:border-border/70 lg:bg-card lg:shadow-xl lg:shadow-slate-950/5">
                            {/* <CardHeader className="space-y-1 pb-2">
                                <CardTitle className="text-2xl text-center">Selamat Datang</CardTitle>
                                <CardDescription className="text-center">
                                    Metode Login Cepat
                                </CardDescription>
                            </CardHeader> */}

                            <CardContent className="grid gap-4 pt-4">
                                {isRoleSpecificPortal && (
                                    <div className="mb-1">
                                        <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                            Pilih akses masuk
                                        </p>
                                        <div
                                            className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
                                            role="tablist"
                                            aria-label="Tipe akun"
                                        >
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={loginType === "merchant"}
                                                onClick={() => {
                                                    setLoginType("merchant");
                                                    setError(null);
                                                }}
                                                className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all ${
                                                    loginType === "merchant"
                                                        ? "bg-background text-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                <Store className="h-4 w-4" />
                                                Merchant
                                            </button>
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={loginType === "partner"}
                                                onClick={() => {
                                                    setLoginType("partner");
                                                    setError(null);
                                                }}
                                                className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all ${
                                                    loginType === "partner"
                                                        ? "bg-background text-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                <Handshake className="h-4 w-4" />
                                                Partner
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm">
                                        <span className="block sm:inline">{error}</span>
                                    </div>
                                )}

                                {/* --- TOMBOL PASSKEY UTAMA (HIGHLIGHT) --- */}
                                <Button
                                    type="button"
                                    variant="default" // Gunakan style primary/default biar menonjol
                                    size="lg"
                                    className="w-full h-12 text-md font-semibold flex gap-2 items-center justify-center"
                                    onClick={handleDiscoverableLogin}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="animate-spin h-5 w-5" />
                                    ) : (
                                        <Fingerprint className="h-6 w-6" />
                                    )}
                                    {t("login.passkey_btn")}
                                </Button>

                                {/* --- DIVIDER --- */}
                                <div className="relative my-2">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground">
                                            {t("login.divider")}
                                        </span>
                                    </div>
                                </div>

                                {/* --- FORM LOGIN MANUAL --- */}
                                <form onSubmit={handleManualLogin} className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="identifier">{t("login.identifier")}</Label>
                                        <Input
                                            id="identifier"
                                            name="username"
                                            type="text"
                                            autoComplete="username"
                                            placeholder="nama@email.com atau username"
                                            required
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                            disabled={isLoading}
                                        />
                                    </div>
                                    <div className="grid gap-2">
									<div className="flex items-center justify-between">
										<Label htmlFor="password">{t("login.password")}</Label>
										<button type="button" onClick={() => navigate("/forgot-password")} className="text-xs font-medium text-primary hover:underline">Lupa password?</button>
									</div>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                required
                                                value={password}
                                                placeholder="••••••••"
                                                onChange={(e) => setPassword(e.target.value)}
                                                disabled={isLoading}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <Button
                                        size="lg"
                                        type="submit"
                                        variant="outline" // Gunakan outline biar tidak rebutan perhatian dgn passkey
                                        className="w-full mt-2"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? t("login.processing") : t("login.password_btn")}
                                    </Button>
                                </form>
                             </CardContent>
                        </Card>
                    </div>
                </div>
                <div className="hidden h-full bg-muted lg:block">
                    <AuthCarousel
                        settings={settings}
                        audience={loginType}
                        brand={loginBrand}
                    />
                </div>
            </div>
        </>
    );
}
