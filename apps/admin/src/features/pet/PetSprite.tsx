import React from "react";
import type { PetDefinition } from "./pets";

type PetSpriteProps = {
  pet: PetDefinition;
  animation?: PetAnimation;
  size?: number;
  className?: string;
};

export type PetAnimation =
  | "idle"
  | "walkRight"
  | "walkLeft"
  | "happy"
  | "surprised"
  | "sad"
  | "greeting"
  | "special"
  | "curious";

const ANIMATIONS: Record<PetAnimation, { row: number; frames: number; interval: number }> = {
  idle: { row: 0, frames: 6, interval: 360 },
  walkRight: { row: 1, frames: 8, interval: 95 },
  walkLeft: { row: 2, frames: 8, interval: 95 },
  happy: { row: 3, frames: 4, interval: 130 },
  surprised: { row: 4, frames: 5, interval: 140 },
  sad: { row: 5, frames: 8, interval: 190 },
  greeting: { row: 6, frames: 6, interval: 150 },
  special: { row: 7, frames: 6, interval: 120 },
  curious: { row: 8, frames: 6, interval: 180 },
};

export function PetSprite({ pet, animation = "idle", size = 112, className }: PetSpriteProps) {
  const [frame, setFrame] = React.useState(0);
  const config = ANIMATIONS[animation];

  React.useEffect(() => {
    setFrame(0);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % config.frames);
    }, config.interval);
    return () => window.clearInterval(timer);
  }, [animation, config.frames, config.interval, pet.id]);

  return (
    <span
      role="img"
      aria-label={pet.name}
      className={className}
      style={{
        display: "block",
        width: size,
        height: Math.round(size * (208 / 192)),
        backgroundImage: `url(${pet.spritesheet})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "800% 900%",
        backgroundPosition: `${(frame / 7) * 100}% ${(config.row / 8) * 100}%`,
        imageRendering: "pixelated",
      }}
    />
  );
}
