import { useEffect, useMemo, useState } from "react";

type LoginAudience = "parent" | "student";
type LoginBrand = "kita" | "guru2digit" | "default";

type AuthCarouselProps = {
  settings?: { app_name?: string } | null;
  audience?: LoginAudience;
  brand?: LoginBrand;
  backgroundOnly?: boolean;
};

type Slide = {
  id: string;
  image: string;
  alt: string;
  quote?: "family" | "teacher-pay" | "family-change";
  attribution?: string;
};

const SLIDES: Record<string, Slide[]> = {
  "kita-parent": [
    {
      id: "parent-family",
      image: "/assets/login/login-parent.jpeg",
      alt: "Orang tua mendampingi proses belajar keluarga",
      quote: "family",
      attribution: "Ni Wayan Wina — CEO Guru Masa Depan",
    },
    {
      id: "parent-growth",
      image: "/assets/login/login-parent2.jpeg",
      alt: "Keluarga bertumbuh bersama melalui pendidikan",
      quote: "family",
      attribution: "Ni Wayan Wina — CEO Guru Masa Depan",
    },
  ],
  "kita-student": [
    {
      id: "student-future",
      image: "/assets/login/login-student.jpeg",
      alt: "Siswa KITA Future sedang belajar",
    },
  ],
  guru2digit: [
    {
      id: "teacher-pay",
      image: "/assets/login/login-guru2digit.jpeg",
      alt: "Guru Indonesia membangun masa depan pendidikan",
      quote: "teacher-pay",
      attribution: "Studi arXiv (2022)",
    },
    {
      id: "family-change",
      image: "/assets/login/login-guru2digit.jpeg",
      alt: "Guru Indonesia mendampingi keluarga yang siap berubah",
      quote: "family-change",
    },
  ],
  default: [
    {
      id: "default",
      image: "/assets/slider/1.png",
      alt: "Learning management system",
    },
  ],
};

function Quote({ slide }: { slide: Slide }) {
  if (!slide.quote) return null;

  return (
    <figure className="max-w-xl rounded-[2rem] border border-white/20 bg-black/30 p-6 text-white shadow-2xl backdrop-blur-md sm:p-8">
      <img
        src="/assets/login/logo.png"
        alt="Logo"
        className="mb-5 h-11 w-11 rounded-xl border border-white/30 object-cover shadow-lg"
      />
      <blockquote className="text-sm font-medium leading-relaxed tracking-[-0.02em] sm:text-md xl:text-lg">
        {slide.quote === "family" && (
          <>
            “Family shapes 80% of a child’s future. Education{" "}
            <strong className="font-extrabold text-amber-200">without</strong> family
            transformation is{" "}
            <strong className="font-extrabold text-amber-200">incomplete</strong>.
            <br />
            We must redesign the approach. A new model of education starts from the
            family.”
          </>
        )}
        {slide.quote === "teacher-pay" && (
          <>“Bila ingin menjadi negara maju maka gaji guru harus tinggi.”</>
        )}
        {slide.quote === "family-change" && (
          <>
            “Kami percaya, anak yang siap masa depan lahir dari keluarga yang juga
            siap berubah.”
          </>
        )}
      </blockquote>
      {slide.attribution && (
        <figcaption className="mt-5 text-sm font-semibold tracking-wide text-white/80">
          {slide.attribution}
        </figcaption>
      )}
    </figure>
  );
}

export function AuthCarousel({
  settings,
  audience = "parent",
  brand = "default",
  backgroundOnly = false,
}: AuthCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = useMemo(() => {
    if (brand === "guru2digit") return SLIDES.guru2digit;
    if (brand === "kita") return SLIDES[`kita-${audience}`];

    const appName = settings?.app_name?.toLowerCase() || "";
    if (appName.includes("guru2digit")) return SLIDES.guru2digit;
    if (appName.includes("kita")) return SLIDES[`kita-${audience}`];
    return SLIDES.default;
  }, [audience, brand, settings?.app_name]);

  useEffect(() => {
    setCurrentSlide(0);
  }, [audience, brand]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setCurrentSlide((previous) => (previous + 1) % slides.length);
    }, 7000);
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
          <img
            src={slide.image}
            alt={slide.alt}
            className="h-full w-full object-cover"
          />
          <div
            className={`absolute inset-0 ${
              backgroundOnly
                ? "bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/85"
                : "bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-black/10"
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/35 via-transparent to-transparent" />

          {!backgroundOnly && slide.quote ? (
            <div className="absolute inset-x-5 bottom-12 sm:inset-x-10 lg:bottom-16 xl:left-16">
              <Quote slide={slide} />
            </div>
          ) : !backgroundOnly ? (
            <div className="absolute inset-x-8 bottom-12 text-white lg:bottom-16 lg:left-14">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-sky-200">
                Student portal
              </p>
              <p className="max-w-md text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                Ruang belajar untuk tumbuh, mencoba, dan menyiapkan masa depanmu.
              </p>
            </div>
          ) : null}
        </div>
      ))}

      {!backgroundOnly && slides.length > 1 && (
        <div className="absolute bottom-5 right-6 z-10 flex items-center gap-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setCurrentSlide(index)}
              aria-label={`Tampilkan slide ${index + 1}`}
              aria-current={currentSlide === index}
              className={`h-1.5 rounded-full transition-all motion-reduce:transition-none ${
                currentSlide === index ? "w-8 bg-white" : "w-3 bg-white/45 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
