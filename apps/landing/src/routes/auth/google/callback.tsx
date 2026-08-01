import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth/google/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    handoff: typeof search.handoff === "string" ? search.handoff : "",
    redirect: typeof search.redirect === "string" ? search.redirect : "/",
  }),
  head: () => ({ meta: [{ title: "Memproses Login Google — LUMÉA" }] }),
  component: GoogleOAuthCallbackPage,
});

function safeRedirect(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function GoogleOAuthCallbackPage() {
  const { handoff, redirect } = Route.useSearch();
  const { completeGoogleSignIn } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!handoff) {
      setError("Kode login Google tidak ditemukan.");
      return;
    }
    completeGoogleSignIn(handoff).then((result) => {
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.replace(safeRedirect(redirect));
    });
  }, [handoff, redirect, completeGoogleSignIn]);

  return <div className="flex min-h-screen items-center justify-center bg-[#f7f3ef] px-5 text-center"><div className="w-full max-w-md bg-white p-9 shadow-sm"><Link to="/" className="text-2xl font-black tracking-[0.25em]">LUMÉA</Link>{error ? <><h1 className="mt-8 font-serif text-3xl">Login Google gagal</h1><p className="mt-3 text-sm leading-relaxed text-rose-700">{error}</p><Link to="/login" search={{ redirect: safeRedirect(redirect) }} className="mt-7 inline-flex h-11 items-center justify-center bg-black px-7 text-xs font-bold tracking-[0.12em] text-white">COBA LAGI</Link></> : <><LoaderCircle className="mx-auto mt-9 size-10 animate-spin" /><h1 className="mt-5 font-serif text-3xl">Menyiapkan akun Anda</h1><p className="mt-3 text-sm text-neutral-500">Sedang memverifikasi akun Google dan membuka profil buyer.</p><div className="mt-7 flex items-center justify-center gap-2 text-xs text-neutral-400"><ShieldCheck className="size-4" /> Sesi diproses secara aman melalui backend</div></>}</div></div>;
}
