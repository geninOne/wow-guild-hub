import { useState } from "react";
import { useLanguage, type Translations } from "../lib/language";

/** Titles with a painted badge at web/public/titel/<id>.png. Future titles without a file are missing here. */
export const TITLE_BADGE_IDS = new Set([
  "nachteule", "frueher-vogel", "stammgast", "dauerlaeufer", "pechvogel", "schaffe-schaffe",
  "kellerkind", "kaepsele", "schleimer", "verlorener-sohn", "tausendsassa", "frisch-eingekleidet",
]);

export function titleBadgeSrc(titleId: string): string | null {
  return TITLE_BADGE_IDS.has(titleId) ? `/titel/${titleId}.png` : null;
}

interface TitleBadgeProps {
  titleId: string;
  /** Name of the title as alt text, as plain text or in all versions (then the selected language applies). */
  name: string | Translations;
  /** Edge length in CSS pixels; the images have 192 pixels, so at most about 100 for a sharp rendering. */
  size: number;
  /** Tooltip, defaults to the name. */
  tooltip?: string;
  /** Dimmed and desaturated, e.g. for titles not awarded. */
  muted?: boolean;
  /** Purely decorative when the name is shown next to it. */
  decorative?: boolean;
}

/** Painted medallion of a fun title; nothing without a file or on a load error (the caller then shows text). */
export function TitleBadge({ titleId, name: versions, size, tooltip, muted = false, decorative = false }: TitleBadgeProps) {
  const { t } = useLanguage();
  const name = typeof versions === "string" ? versions : t(versions);
  const [failed, setFailed] = useState<string | null>(null);
  const src = titleBadgeSrc(titleId);
  if (!src || failed === src) return null;
  return (
    <img
      className={muted ? "title-medal title-medal-muted" : "title-medal"}
      src={src}
      alt={decorative ? "" : name}
      title={decorative ? undefined : (tooltip ?? name)}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(src)}
    />
  );
}

/** Is there a badge for the title? For text fallbacks. */
export function hasTitleBadge(titleId: string): boolean {
  return TITLE_BADGE_IDS.has(titleId);
}
