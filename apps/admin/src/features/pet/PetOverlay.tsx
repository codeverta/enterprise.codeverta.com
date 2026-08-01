import React from "react";
import { X } from "lucide-react";
import { getPet } from "./pets";
import { PetSprite } from "./PetSprite";
import type { PetAnimation } from "./PetSprite";
import { usePetStore } from "@/store/usePetStore";

const PET_WIDTH = 128;
const PET_HEIGHT = 132;
const REACTIONS: Array<{ animation: PetAnimation; message: string; duration: number }> = [
  { animation: "happy", message: "Yeay, kerja bagus!", duration: 1300 },
  { animation: "surprised", message: "Wah! Ada yang baru?", duration: 1500 },
  { animation: "sad", message: "Istirahat sebentar juga boleh.", duration: 1900 },
  { animation: "greeting", message: "Halo! Aku di sini.", duration: 1500 },
  { animation: "special", message: "Ini jurus spesialku!", duration: 1600 },
  { animation: "curious", message: "Mau belajar apa sekarang?", duration: 1700 },
];

const clampPosition = (position: { x: number; y: number }) => ({
  x: Math.min(Math.max(8, position.x), Math.max(8, window.innerWidth - PET_WIDTH - 8)),
  y: Math.min(Math.max(8, position.y), Math.max(8, window.innerHeight - PET_HEIGHT - 8)),
});

const defaultPosition = () => clampPosition({
  x: window.innerWidth - PET_WIDTH - 20,
  y: window.innerHeight - PET_HEIGHT - 16,
});

export function PetOverlay() {
  const selectedPetId = usePetStore((state) => state.selectedPetId);
  const setEnabled = usePetStore((state) => state.setEnabled);
  const savedPosition = usePetStore((state) => state.position);
  const savePosition = usePetStore((state) => state.setPosition);
  const [position, setPosition] = React.useState(() =>
    savedPosition ? clampPosition(savedPosition) : defaultPosition()
  );
  const [animation, setAnimation] = React.useState<PetAnimation>("idle");
  const [message, setMessage] = React.useState("");
  const [reactionIndex, setReactionIndex] = React.useState(0);
  const drag = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
    lastX: number;
  } | null>(null);
  const reactionTimer = React.useRef<number | null>(null);
  const pet = getPet(selectedPetId);

  React.useEffect(() => {
    setPosition(savedPosition ? clampPosition(savedPosition) : defaultPosition());
  }, [savedPosition]);

  React.useEffect(() => {
    const keepOnScreen = () => {
      setPosition((current) => {
        const next = clampPosition(current);
        savePosition(next);
        return next;
      });
    };
    window.addEventListener("resize", keepOnScreen);
    return () => {
      window.removeEventListener("resize", keepOnScreen);
      if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
    };
  }, [savePosition]);

  const interact = () => {
    const reaction = REACTIONS[reactionIndex];
    setReactionIndex((current) => (current + 1) % REACTIONS.length);
    setMessage(reaction.message);
    setAnimation(reaction.animation);
    if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
    reactionTimer.current = window.setTimeout(() => {
      setAnimation("idle");
      setMessage("");
    }, reaction.duration);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
      lastX: event.clientX,
    };
    setMessage("");
    setAnimation("idle");
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const currentDrag = drag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - currentDrag.startX;
    const deltaY = event.clientY - currentDrag.startY;
    if (Math.hypot(deltaX, deltaY) > 5) currentDrag.moved = true;

    const horizontalMovement = event.clientX - currentDrag.lastX;
    if (horizontalMovement > 1) setAnimation("walkRight");
    if (horizontalMovement < -1) setAnimation("walkLeft");
    currentDrag.lastX = event.clientX;
    setPosition(clampPosition({
      x: currentDrag.originX + deltaX,
      y: currentDrag.originY + deltaY,
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const currentDrag = drag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    if (currentDrag.moved) {
      savePosition(clampPosition({
        x: currentDrag.originX + (event.clientX - currentDrag.startX),
        y: currentDrag.originY + (event.clientY - currentDrag.startY),
      }));
      setAnimation("idle");
    } else {
      interact();
    }
  };

  return (
    <div
      className="group fixed z-50 flex w-32 flex-col items-center"
      style={{ left: position.x, top: position.y }}
    >
      <div
        aria-live="polite"
        className={`pointer-events-none absolute bottom-[calc(100%-4px)] left-1/2 w-max max-w-48 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-3 py-1.5 text-center text-xs font-medium text-slate-700 shadow-md backdrop-blur transition-all duration-200 ${
          message ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
      >
        {message}
      </div>

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setAnimation("idle");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            interact();
          }
        }}
        className="relative cursor-grab touch-none select-none rounded-2xl outline-none transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:cursor-grabbing active:scale-95 motion-reduce:transform-none"
        aria-label={`Berinteraksi atau geser ${pet.name}`}
        title="Klik untuk berinteraksi, geser untuk memindahkan"
      >
        <PetSprite pet={pet} animation={animation} />
        <span className="absolute bottom-1 left-1/2 h-3 w-20 -translate-x-1/2 rounded-full bg-slate-950/15 blur-sm" />
      </button>

      <button
        type="button"
        onClick={() => setEnabled(false)}
        className="absolute right-0 top-0 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition-opacity hover:text-slate-900 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group-hover:opacity-100"
        aria-label="Sembunyikan pet"
        title="Sembunyikan pet"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
