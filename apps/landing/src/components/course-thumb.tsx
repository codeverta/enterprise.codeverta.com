import {
  Heart, BookOpen, Wallet, Briefcase, Bot, Users, Palette, Hand, Star,
  Sparkles, Tablet, FolderHeart, Lightbulb, Cpu, Network, TrendingUp,
  Award, MessageCircle, PiggyBank, Smile, GraduationCap, type LucideIcon,
} from "lucide-react";
import type { LevelId } from "@/lib/curriculum-data";
import thumbParent from "@/assets/thumb-parent.jpg";
import thumbEarly from "@/assets/thumb-early.jpg";
import thumbElementary from "@/assets/thumb-elementary.jpg";
import thumbMiddle from "@/assets/thumb-middle.jpg";
import thumbHigh from "@/assets/thumb-high.jpg";

// Pillar-specific photoreal illustrations (DSLR style)
import eySel from "@/assets/pillar-ey_sel.jpg";
import eyPrabaca from "@/assets/pillar-ey_prabaca.jpg";
import eyKreatif from "@/assets/pillar-ey_kreatif.jpg";
import eyMotorik from "@/assets/pillar-ey_motorik.jpg";
import eyMandiri from "@/assets/pillar-ey_mandiri.jpg";
import eyUang from "@/assets/pillar-ey_uang.jpg";
import eyGaleri from "@/assets/pillar-ey_galeri.jpg";

import elSel from "@/assets/pillar-el_sel.jpg";
import elBaca from "@/assets/pillar-el_baca.jpg";
import elFinansial from "@/assets/pillar-el_finansial.jpg";
import elEntrep from "@/assets/pillar-el_entrep.jpg";
import elDigital from "@/assets/pillar-el_digital.jpg";
import elKolab from "@/assets/pillar-el_kolab.jpg";
import elPortfolio from "@/assets/pillar-el_portfolio.jpg";

import msSel from "@/assets/pillar-ms_sel.jpg";
import msBaca from "@/assets/pillar-ms_baca.jpg";
import msFinansial from "@/assets/pillar-ms_finansial.jpg";
import msEntrep from "@/assets/pillar-ms_entrep.jpg";
import msAi from "@/assets/pillar-ms_ai.jpg";
import msKomunitas from "@/assets/pillar-ms_komunitas.jpg";
import msPortfolio from "@/assets/pillar-ms_portfolio.jpg";

import hsSel from "@/assets/pillar-hs_sel.jpg";
import hsLeader from "@/assets/pillar-hs_leader.jpg";
import hsFinansial from "@/assets/pillar-hs_finansial.jpg";
import hsBiz from "@/assets/pillar-hs_biz.jpg";
import hsAi from "@/assets/pillar-hs_ai.jpg";
import hsNetwork from "@/assets/pillar-hs_network.jpg";
import hsPortfolio from "@/assets/pillar-hs_portfolio.jpg";

/** Pillar → icon overlay */
const PILLAR_ICON: Record<string, LucideIcon> = {
  ey_sel: Heart, ey_prabaca: BookOpen, ey_kreatif: Palette, ey_motorik: Hand,
  ey_mandiri: Star, ey_uang: PiggyBank, ey_galeri: Sparkles,
  el_sel: Heart, el_baca: BookOpen, el_finansial: Wallet, el_entrep: Briefcase,
  el_digital: Tablet, el_kolab: Users, el_portfolio: FolderHeart,
  ms_sel: Smile, ms_baca: MessageCircle, ms_finansial: Wallet, ms_entrep: Lightbulb,
  ms_ai: Bot, ms_komunitas: Network, ms_portfolio: FolderHeart,
  hs_sel: Sparkles, hs_leader: Award, hs_finansial: TrendingUp, hs_biz: Briefcase,
  hs_ai: Cpu, hs_network: Network, hs_portfolio: GraduationCap,
};

/** Pillar → photorealistic thumbnail (each course gets a unique image by topic) */
const PILLAR_IMAGE: Record<string, string> = {
  ey_sel: eySel, ey_prabaca: eyPrabaca, ey_kreatif: eyKreatif, ey_motorik: eyMotorik,
  ey_mandiri: eyMandiri, ey_uang: eyUang, ey_galeri: eyGaleri,
  el_sel: elSel, el_baca: elBaca, el_finansial: elFinansial, el_entrep: elEntrep,
  el_digital: elDigital, el_kolab: elKolab, el_portfolio: elPortfolio,
  ms_sel: msSel, ms_baca: msBaca, ms_finansial: msFinansial, ms_entrep: msEntrep,
  ms_ai: msAi, ms_komunitas: msKomunitas, ms_portfolio: msPortfolio,
  hs_sel: hsSel, hs_leader: hsLeader, hs_finansial: hsFinansial, hs_biz: hsBiz,
  hs_ai: hsAi, hs_network: hsNetwork, hs_portfolio: hsPortfolio,
};

/** Fallback by level if pillar is unknown */
const LEVEL_FALLBACK: Record<LevelId | "parent", string> = {
  early: thumbEarly,
  elementary: thumbElementary,
  middle: thumbMiddle,
  high: thumbHigh,
  parent: thumbParent,
};

interface CourseThumbProps {
  level: LevelId | "parent";
  pillar?: string;
  icon?: LucideIcon;
  className?: string;
}

export function CourseThumb({ level, pillar, icon, className = "" }: CourseThumbProps) {
  const Icon = icon ?? (pillar ? PILLAR_ICON[pillar] : undefined) ?? Sparkles;
  const src =
    (pillar && PILLAR_IMAGE[pillar]) ??
    LEVEL_FALLBACK[level] ??
    LEVEL_FALLBACK.elementary;
  return (
    <div
      className={`relative h-32 w-full overflow-hidden rounded-xl bg-muted ${className}`}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        width={896}
        height={512}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/15 via-transparent to-transparent" />
      <div className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur">
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </div>
  );
}
