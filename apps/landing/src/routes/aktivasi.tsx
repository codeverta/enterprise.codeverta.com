import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/lib/i18n";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Lock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/aktivasi")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: (search.token as string) || "",
  }),
  head: () => ({
    meta: [
      { title: "Activate Account — KITA Future Homeschool" },
      {
        name: "description",
        content: "Set your password to activate your KITA Future Homeschool account.",
      },
    ],
  }),
  component: ActivationPage,
});

function ActivationPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const { token } = Route.useSearch();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error(en ? "Activation token is missing!" : "Token aktivasi tidak ditemukan!");
    }
  }, [token, en]);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error(en ? "Missing token." : "Token tidak valid.");
      return;
    }
    if (password.length < 8) {
      toast.error(en ? "Password must be at least 8 characters." : "Kata sandi minimal harus 8 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error(en ? "Passwords do not match." : "Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/activate", {
        token,
        password,
      });

      const data = res.data.data;
      if (data) {
        // 1. Store Go JWT Tokens for backend auth
        localStorage.setItem("accessToken", data.token);
        localStorage.setItem("refreshToken", data.refresh_token);

        setActivated(true);
        toast.success(en ? "Account activated successfully!" : "Akun berhasil diaktifkan!");

        // Redirect to parent dashboard
        setTimeout(() => {
          window.location.href = import.meta.env.VITE_ADMIN_URL;
        }, 2000);
      } else {
        toast.error(en ? "Activation failed." : "Aktivasi gagal.");
      }
    } catch (err: any) {
      console.error("Activation error:", err);
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (en ? "Activation token is invalid or expired" : "Token aktivasi tidak valid atau sudah kadaluarsa");
      toast.error(en ? errMsg : errMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteLayout>
      <section className="relative mx-auto max-w-md px-4 py-16 md:py-24">
        {/* Backdrop aurora */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex justify-center">
          <div className="h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <Card className="rounded-[1.75rem] border border-border/60 bg-card/85 shadow-elegant backdrop-blur">
          <CardContent className="p-8">
            {activated ? (
              <div className="text-center space-y-4 py-6 animate-fade-in">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h1 className="text-2xl font-bold">
                  {en ? "Account Activated!" : "Akun Aktif!"}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {en
                    ? "Your password has been set and your account is active. Redirecting to your dashboard..."
                    : "Kata sandi Anda telah disimpan dan akun Anda sudah aktif. Mengalihkan ke dashboard..."}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                    <Lock className="h-6 w-6" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {en ? "Set Your Password" : "Atur Kata Sandi"}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {en
                      ? "Create a password for your parent account to get started."
                      : "Buat kata sandi untuk akun orang tua Anda untuk memulai."}
                  </p>
                </div>

                <form onSubmit={handleActivate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">
                      {en ? "New Password" : "Kata Sandi Baru"}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      {en ? "Confirm Password" : "Konfirmasi Kata Sandi"}
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading || !token}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-indigo-500 font-bold"
                  >
                    {loading ? (en ? "Activating..." : "Mengaktifkan...") : (en ? "Activate Account" : "Aktifkan Akun")}
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </SiteLayout>
  );
}
