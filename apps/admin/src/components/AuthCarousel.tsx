import { useEffect, useMemo, useState } from "react";

type LoginAudience = "merchant" | "partner";

type AuthCarouselProps = {
  settings?: { app_name?: string } | null;
  audience?: LoginAudience;
  brand?: string;
  backgroundOnly?: boolean;
};

type Slide = {
  id: string;
  image: string;
  alt: string;
  eyebrow: string;
  headline: string;
  description: string;
};

const SLIDES: Record<LoginAudience, Slide[]> = {
  merchant: [
    {
      id: "merchant-import",
      image: "/assets/login/login-merchant.png",
      alt: "Merchant mengelola aktivitas impor dan inventori di gudang",
      eyebrow: "Merchant workspace",
      headline: "Kendalikan arus barang dari pemasok hingga gudang.",
      description: "Pantau order, dokumen impor, pembayaran, dan status operasional dalam satu sistem.",
    },
  ],
  partner: [
    {
      id: "partner-logistics",
      image: "/assets/login/login-partner.png",
      alt: "Partner logistik mengoordinasikan pengiriman di terminal peti kemas",
      eyebrow: "Logistics partner",
      headline: "Kolaborasi pengiriman yang cepat, transparan, dan terukur.",
      description: "Kelola shipment, dokumen, milestone, dan komunikasi merchant secara terpusat.",
    },
  ],
};

export function AuthCarousel({
  audience = "merchant",
  backgroundOnly = false,
}: AuthCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = useMemo(() => SLIDES[audience], [audience]);

  useEffect(() => setCurrentSlide(0), [audience]);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = window.setInterval(
      () => setCurrentSlide((previous) => (previous + 1) % slides.length),
      7000,
    );
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden bg-slate-950">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          aria-hidden={index !== currentSlide}
          className={`absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none ${
            index === currentSlide ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <img src={slide.image} alt={slide.alt} className="h-full w-full object-cover" />
          <div className={`absolute inset-0 ${backgroundOnly
            ? "bg-gradient-to-b from-slate-950/80 via-slate-950/50 to-slate-950/90"
            : "bg-gradient-to-t from-slate-950/95 via-slate-950/20 to-black/10"}`} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />

          {!backgroundOnly && (
            <div className="absolute inset-x-8 bottom-12 max-w-xl text-white lg:bottom-16 lg:left-14 xl:left-16">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">{slide.eyebrow}</p>
              <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">{slide.headline}</h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/75 xl:text-base">{slide.description}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
