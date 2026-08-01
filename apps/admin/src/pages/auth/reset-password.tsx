import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(token ? "" : "Token reset password tidak tersedia.");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) { setError("Konfirmasi password tidak sama."); return; }
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/password-reset/confirm", {
        token, password, confirm_password: confirmation,
      });
      setSuccess(true);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "Link tidak valid atau sudah kedaluwarsa.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Ubah Password</CardTitle>
          <CardDescription>Buat password baru dengan panjang 8–20 karakter.</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="grid gap-4">
              <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Password berhasil diubah. Silakan login kembali.</div>
              <Button asChild><Link to="/">Ke Halaman Login</Link></Button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <div className="grid gap-2">
                <Label htmlFor="newPassword">Password Baru</Label>
                <Input id="newPassword" type="password" minLength={8} maxLength={20} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading || !token} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                <Input id="confirmPassword" type="password" minLength={8} maxLength={20} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required disabled={loading || !token} />
              </div>
              <Button type="submit" disabled={loading || !token}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Password Baru
              </Button>
              <Button asChild type="button" variant="ghost"><Link to="/">Kembali ke Login</Link></Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
