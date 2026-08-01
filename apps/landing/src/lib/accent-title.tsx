import type { ReactNode } from "react";

/**
 * Wraps the last `words` words of a title in a gradient accent span,
 * matching the hero "Homeschooling Masa Depan" treatment.
 */
export function accentLast(text: string, words: number = 2): ReactNode {
  if (!text) return text;
  const parts = text.trim().split(/\s+/);
  if (parts.length <= words) {
    return <span className="text-accent-grad">{text}</span>;
  }
  const head = parts.slice(0, parts.length - words).join(" ");
  const tail = parts.slice(parts.length - words).join(" ");
  return (
    <>
      {head} <span className="text-accent-grad">{tail}</span>
    </>
  );
}

/**
 * Wraps words from `startWordIndex` onward in a gradient accent span.
 */
export function accentFrom(text: string, startWordIndex: number): ReactNode {
  if (!text) return text;
  const parts = text.trim().split(/\s+/);
  if (startWordIndex <= 0 || startWordIndex >= parts.length) {
    return <span className="text-accent-grad">{text}</span>;
  }
  const head = parts.slice(0, startWordIndex).join(" ");
  const tail = parts.slice(startWordIndex).join(" ");
  return (
    <>
      {head} <span className="text-accent-grad">{tail}</span>
    </>
  );
}
