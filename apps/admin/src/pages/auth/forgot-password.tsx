import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { RefreshCw, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Captcha = { captcha_id: string; image: string; expires_at: string };

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [answer, setAnswer] = useState("");
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadCaptcha = useCallback(async () => {
    setAnswer("");
    setError("");
    try {
      const response = await api.get("/auth/password-reset/captcha");
      setCaptcha(response.data);
    } catch {
      setError("CAPTCHA gagal dimuat. Silakan coba kembali.");
    }
  }, []);

  useEffect(() => { loadCaptcha(); }, [loadCaptcha]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!captcha) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await api.post("/auth/password-reset/request", {
        email, captcha_id: captcha.captcha_id, captcha_answer: answer,
      });
      setMessage(response.data?.message || "Jika email terdaftar, link ubah password akan dikirim.");
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "Permintaan gagal diproses.");
      await loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Lupa Password</CardTitle>
          <CardDescription>Masukkan email akun dan CAPTCHA. Kami akan mengirim link untuk membuat password baru.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            {message && <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
            {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="grid gap-2">
              <Label htmlFor="resetEmail">Email</Label>
              <Input id="resetEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="captchaAnswer">Kode CAPTCHA</Label>
              <div className="flex items-center gap-2">
                <div className="min-h-[72px] flex-1 overflow-hidden rounded-md border bg-white">
                  {captcha?.image && <img src={captcha.image} alt="Kode CAPTCHA" className="h-[72px] w-full object-contain" />}
                </div>
                <Button type="button" variant="outline" size="icon" onClick={loadCaptcha} disabled={loading} aria-label="Muat ulang CAPTCHA">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <Input id="captchaAnswer" value={answer} onChange={(event) => setAnswer(event.target.value.toUpperCase())} maxLength={6} autoComplete="off" required disabled={loading || !captcha} className="font-mono uppercase tracking-[0.3em]" />
            </div>
            <Button type="submit" disabled={loading || !captcha}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kirim Link Ubah Password
            </Button>
            <Button asChild type="button" variant="ghost"><Link to="/">Kembali ke Login</Link></Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
