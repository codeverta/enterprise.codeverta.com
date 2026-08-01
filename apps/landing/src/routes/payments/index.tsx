import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Copy, CreditCard, Lock, QrCode, Receipt, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteLayout } from "@/components/site-layout";
import { createPaymentIntent } from "@/lib/payments";
import { activateSubscription, readSubscription } from "@/lib/subscriptions";
import { formatRupiah, getLevelPlan, type LevelPlanId } from "@/lib/level-plans";

export const Route = createFileRoute("/payments/")({
  validateSearch: (search: Record<string, unknown>): { level?: LevelPlanId; email?: string } => ({
    level: typeof search.level === "string" ? (search.level as LevelPlanId) : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Xendit Payment Status — KITA Future Homeschool" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentStatusPage,
});

function PaymentStatusPage() {
  const search = Route.useSearch();
  const plan = getLevelPlan(search.level);
  const subscription = readSubscription();
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState(subscription?.providerReference ?? "");
  const parentEmail = search.email ?? subscription?.parentEmail ?? "orangtua@kita.test";

  async function createMockXenditPayment() {
    setPending(true);
    try {
      const payment = await createPaymentIntent({
        parentEmail,
        amountIdr: plan.price,
        method: "qris",
        seats: 1,
      });
      const active = activateSubscription({
        parentEmail,
        levelId: plan.id,
        seats: 1,
        amountIdr: plan.price,
        providerReference: payment.record.id,
      });
      setReference(payment.record.id);
      toast.success(`Subscription aktif sampai ${new Date(active.currentPeriodEnd).toLocaleDateString("id-ID")}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Lock className="h-3.5 w-3.5" />
            Xendit Subscription
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
            Status pembayaran akses belajar
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            Halaman ini siap dihubungkan ke webhook Xendit. Untuk mode lokal, tombol di bawah mensimulasikan pembayaran sukses, mengaktifkan subscription, dan menandai receipt serta credentials sebagai terkirim via Tencent SES.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-3xl border-border/60 bg-card/90 shadow-soft">
            <CardContent className="p-7">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <QrCode className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold">{plan.product}</h2>
                  <p className="text-xs text-muted-foreground">{parentEmail}</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-border/60 bg-muted/40 p-5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Tagihan bulanan</span>
                  <span className="text-2xl font-extrabold text-primary">{formatRupiah(plan.price)}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" />
                  QRIS, virtual account, e-wallet, dan card diproses oleh Xendit.
                </div>
              </div>

              {reference && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(reference);
                    toast.success("Reference disalin");
                  }}
                  className="mt-5 flex w-full items-center justify-between rounded-2xl border border-border/60 bg-background px-4 py-3 text-left text-sm"
                >
                  <span>
                    <span className="block text-xs text-muted-foreground">Provider reference</span>
                    <span className="font-mono">{reference}</span>
                  </span>
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

              <Button className="mt-6 h-12 w-full rounded-2xl" onClick={createMockXenditPayment} disabled={pending}>
                {pending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
                {pending ? "Memproses..." : "Simulasikan pembayaran sukses"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-emerald-500/30 bg-emerald-500/10 shadow-soft">
            <CardContent className="p-7">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h2 className="mt-4 text-lg font-bold">Flow setelah paid</h2>
              <ul className="mt-4 space-y-3 text-sm text-foreground/80">
                <li>Subscription parent menjadi active.</li>
                <li>Akses dashboard siswa/orangtua terbuka.</li>
                <li>Receipt pembayaran dikirim via Tencent SES.</li>
                <li>Credentials akun siswa dikirim ke email orang tua.</li>
                <li>Admin bisa audit di tabs Payments dan Subscriptions.</li>
              </ul>
              <Button asChild variant="outline" className="mt-6 w-full rounded-2xl bg-card/80">
                <Link to="/siswa">Buka Dashboard Siswa</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </SiteLayout>
  );
}
