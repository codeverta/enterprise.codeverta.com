/**
 * Progress toward the next level — shown in Student & Parent dashboards.
 *
 * Drives the level-unlock flow: completion checklist + CTA "Aktifkan Level
 * Berikutnya" → /pembayaran?purpose=level_unlock_fee.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Sparkles, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";
import {
  LEVEL_REQUIREMENTS,
  LEVEL_UNLOCK_FEE_IDR,
  isLevelComplete,
  nextLevel,
  type LevelProgressSnapshot,
} from "@/lib/content-architecture";
import { LEVELS, type LevelId } from "@/lib/curriculum-data";

interface Props {
  activeLevel: LevelId;
  snapshot: LevelProgressSnapshot;
  variant: "student" | "parent";
}

function levelLabel(id: LevelId, en: boolean) {
  const l = LEVELS.find((x) => x.id === id);
  return en ? l?.label_en ?? id : l?.label_id ?? id;
}

export function LevelProgressPanel({ activeLevel, snapshot, variant }: Props) {
  const { lang } = useLang();
  const en = lang === "en";
  const ready = isLevelComplete(snapshot);
  const next = nextLevel(activeLevel);
  const heading =
    variant === "student"
      ? (en ? "Progress to the Next Level" : "Progress Menuju Level Berikutnya")
      : (en ? "Activate the Next Level"     : "Aktivasi Level Berikutnya");

  const overallPct = Math.round(
    (LEVEL_REQUIREMENTS.filter((r) => !r.optional).reduce(
      (acc, r) => acc + Math.min(1, (snapshot[r.key] ?? 0) / r.target),
      0,
    ) /
      LEVEL_REQUIREMENTS.filter((r) => !r.optional).length) *
      100,
  );

  return (
    <Card className="rounded-3xl border-primary/30 bg-primary/[0.04] shadow-card">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {en ? "Active level" : "Level aktif"}: {levelLabel(activeLevel, en)}
            </div>
            <h3 className="mt-2 text-lg font-semibold">{heading}</h3>
            {variant === "parent" && (
              <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                {en
                  ? "Children can move up to the next level faster — no need to wait for a new academic year. Once learning targets are met, parents can activate access to the next level."
                  : "Anak dapat naik level lebih cepat tanpa harus menunggu tahun ajaran berikutnya. Setelah menyelesaikan target pembelajaran, orang tua dapat mengaktifkan akses level berikutnya."}
              </p>
            )}
          </div>
          <Badge variant="outline" className="rounded-full text-xs">
            {overallPct}% {en ? "ready" : "siap"}
          </Badge>
        </div>

        <Progress value={overallPct} className="h-2" />

        <ul className="grid gap-2 sm:grid-cols-2">
          {LEVEL_REQUIREMENTS.map((r) => {
            const cur = snapshot[r.key] ?? 0;
            const done = cur >= r.target;
            return (
              <li
                key={r.key}
                className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-3 py-2 text-xs"
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 leading-tight">
                  {en ? r.label_en : r.label_id}
                  {r.optional && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({en ? "optional" : "opsional"})
                    </span>
                  )}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {Math.min(cur, r.target)}/{r.target}
                </span>
              </li>
            );
          })}
        </ul>

        {ready ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              🎉 {en
                ? "Congratulations! Your child is ready to level up."
                : "Selamat! Anak Anda siap naik level."}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {en
                ? `One-time Level Unlock Fee: Rp${LEVEL_UNLOCK_FEE_IDR.toLocaleString("id-ID")}. Curriculum upgrade to ${next ? levelLabel(next, en) : "the next stage"}.`
                : `Biaya Aktivasi Level Baru sekali bayar: Rp${LEVEL_UNLOCK_FEE_IDR.toLocaleString("id-ID")}. Upgrade kurikulum ke ${next ? levelLabel(next, en) : "tahap berikutnya"}.`}
            </p>
            <Button asChild className="mt-3 rounded-full">
              <Link to="/pembayaran">
                {en ? "Activate Next Level" : "Aktifkan Level Berikutnya"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4 text-muted-foreground" />
              {en
                ? "Next level locked. Finish learning targets or activate access early."
                : "Level berikutnya terkunci. Selesaikan target belajar atau aktifkan akses level baru."}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {en
                ? "Free preview: 2 items from the next level are unlocked for sampling."
                : "Pratinjau gratis: 2 materi dari level berikutnya bisa dicoba."}
            </p>
            {variant === "parent" && (
              <Button asChild size="sm" variant="outline" className="mt-3 rounded-full">
                <Link to="/pembayaran">
                  {en ? "Unlock Next Level Now" : "Buka Level Baru Sekarang"}
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
