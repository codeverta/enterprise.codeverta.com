import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/account",
  }),
  head: () => ({ meta: [{ title: "Masuk — LUMÉA" }] }),
  component: BuyerLoginPage,
});

function BuyerLoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result =
      mode === "login"
        ? await signIn(form.email, form.password)
        : await signUp(form.email, form.password, form.fullName);
    setLoading(false);
    if (result.error) return setError(result.error);
    navigate({ to: mode === "register" ? "/" : redirect || "/account" });
  };

  return (
    <div className="min-h-screen bg-[#f7f3ef] text-neutral-950">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-[#d56f67] lg:block">
          <img
            src="/beauty/hero-beauty.png"
            alt="LUMÉA beauty collection"
            className="absolute inset-0 h-full w-full object-cover object-[68%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
          <div className="absolute bottom-14 left-14 right-14 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.2em]">LUMÉA BEAUTY CIRCLE</p>
            <h1 className="mt-4 max-w-xl font-serif text-6xl leading-[.95]">
              Beauty feels better when it’s yours.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/80">
              Simpan wishlist, checkout lebih cepat, lacak pesanan, dan dapatkan rekomendasi yang
              dipilih untuk Anda.
            </p>
          </div>
        </section>
        <section className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between">
              <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold">
                <ArrowLeft className="size-4" /> Kembali belanja
              </Link>
              <Link to="/" className="text-2xl font-black tracking-[0.25em]">
                LUMÉA
              </Link>
            </div>
            <div className="mt-14">
              <h2 className="mt-6 font-serif text-4xl">
                {mode === "login" ? "Welcome back." : "Join the circle."}
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                {mode === "login"
                  ? "Masuk untuk melanjutkan beauty journey Anda."
                  : "Buat akun buyer LUMÉA dalam beberapa detik."}
              </p>
            </div>
            <div className="mt-8 flex rounded-xl bg-neutral-100 p-1.5">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError("");
                  }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${
                    mode === m
                      ? "bg-white text-black shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {m === "login" ? "MASUK" : "DAFTAR"}
                </button>
              ))}
            </div>
            <form onSubmit={submit} className="mt-7 space-y-5">
              {mode === "register" && (
                <label className="block text-sm font-semibold">
                  Nama lengkap
                  <div className="mt-2 flex h-12 items-center border border-neutral-300 bg-white px-4 focus-within:border-black">
                    <input
                      required
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="Nama Anda"
                      className="w-full border-0 bg-transparent outline-none"
                    />
                  </div>
                </label>
              )}
              <label className="block text-sm font-semibold">
                Email
                <div className="mt-2 flex h-12 items-center border border-neutral-300 bg-white px-4 focus-within:border-black">
                  <Mail className="mr-3 size-4 text-neutral-400" />
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="nama@email.com"
                    className="w-full border-0 bg-transparent outline-none"
                  />
                </div>
              </label>
              <label className="block text-sm font-semibold">
                Kata sandi
                <div className="mt-2 flex h-12 items-center border border-neutral-300 bg-white px-4 focus-within:border-black">
                  <LockKeyhole className="mr-3 size-4 text-neutral-400" />
                  <input
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Minimal 8 karakter"
                    className="w-full border-0 bg-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label="Tampilkan kata sandi"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>
              {error && (
                <p className="border-l-2 border-[#e4003f] bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              )}
              <button
                disabled={loading}
                className="flex h-12 w-full items-center justify-center bg-black text-xs font-bold tracking-[0.15em] text-white transition hover:bg-[#e4003f] disabled:opacity-60"
              >
                {loading ? "MOHON TUNGGU..." : mode === "login" ? "MASUK KE AKUN" : "BUAT AKUN"}
              </button>
            </form>
            <div className="mt-6 flex items-start gap-3 text-xs leading-relaxed text-neutral-500">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p>
                Akun dan sesi buyer diamankan melalui API backend. Anda dapat melanjutkan akun yang
                sama dari perangkat lain.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
