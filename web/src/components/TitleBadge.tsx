import { useState } from "react";
import { useSprache, type Fassungen } from "../lib/sprache";

/** Titel mit gemaltem Abzeichen unter web/public/titel/<id>.png. Künftige Titel ohne Datei fehlen hier. */
export const TITLE_BADGE_IDS = new Set([
  "nachteule", "frueher-vogel", "stammgast", "dauerlaeufer", "pechvogel", "schaffe-schaffe",
  "kellerkind", "kaepsele", "schleimer", "verlorener-sohn", "tausendsassa", "frisch-eingekleidet",
]);

export function titleBadgeSrc(titleId: string): string | null {
  return TITLE_BADGE_IDS.has(titleId) ? `/titel/${titleId}.png` : null;
}

interface TitleBadgeProps {
  titleId: string;
  /** Name des Titels als Alternativtext, als Text oder in allen Fassungen (dann gilt die gewählte Sprache). */
  name: string | Fassungen;
  /** Kantenlänge in CSS-Pixeln; die Bilder haben 192 Pixel, also höchstens etwa 100 für scharfe Darstellung. */
  size: number;
  /** Tooltip, ohne Angabe der Name. */
  tooltip?: string;
  /** Abgedunkelt und entsättigt, z. B. für nicht vergebene Titel. */
  muted?: boolean;
  /** Rein schmückend, wenn der Name daneben steht. */
  decorative?: boolean;
}

/** Gemaltes Medaillon eines Spaßtitels; ohne Datei oder bei Ladefehler nichts (der Aufrufer zeigt dann Text). */
export function TitleBadge({ titleId, name: fassungen, size, tooltip, muted = false, decorative = false }: TitleBadgeProps) {
  const { t } = useSprache();
  const name = typeof fassungen === "string" ? fassungen : t(fassungen);
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

/** Gibt es für den Titel ein Abzeichen? Für Rückfälle mit Text. */
export function hasTitleBadge(titleId: string): boolean {
  return TITLE_BADGE_IDS.has(titleId);
}
