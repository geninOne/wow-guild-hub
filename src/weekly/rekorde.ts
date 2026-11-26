// Rekorde gegenüber allen früheren Wochen und der Rückblick auf die Ausgabe von vor vier Wochen.
import { addDays } from "../lib/time";
import type { ZeitungRueckblick, WeeklyRecord, WochenZahlArt, WochenZahlen } from "../model";

/** Arten, für die es Gildenrekorde gibt (alle Gilden zusammen). */
export const REKORD_GILDE: WochenZahlArt[] = ["anmeldungen", "level", "tode", "dungeons", "rezepte", "erfolge"];
/** Arten, für die es Einzelrekorde gibt. */
export const REKORD_EINZELN: WochenZahlArt[] = ["level", "tode", "dungeons", "rezepte", "anmeldungen"];

/** Erst ab so vielen früheren Wochen mit Zahlen ist ein Rekord eine Meldung wert, sonst wäre fast alles einer. */
export const REKORD_MIN_WOCHEN = 3;
/** Mindestwerte, damit kein Rekord aus Kleinkram entsteht. */
export const REKORD_MIN = { gilde: 10, einzeln: 3 } as const;
const MAX_REKORDE = 3;

export interface RekordEintrag {
  art: WochenZahlArt;
  /** Charakter bei Einzelrekorden, null beim Gildenrekord. */
  characterId: number | null;
  value: number;
  /** Bisheriger Bestwert. */
  previous: number;
}

/**
 * Neue Rekorde dieser Woche gegenüber allen früheren Wochen: echt größer als der bisherige Bestwert, ab Mindestwert,
 * und nur, wenn es genug frühere Wochen gibt. Die deutlichsten zuerst, höchstens drei. Abgemeldete stecken schon
 * nicht in `spitze` (siehe `wochenZahlen`).
 */
export function findeRekorde(
  aktuell: Pick<WochenZahlen, "gesamt" | "spitze">,
  frueher: Pick<WochenZahlen, "gesamt" | "spitze">[],
): RekordEintrag[] {
  if (frueher.length < REKORD_MIN_WOCHEN) return [];
  const found: (RekordEintrag & { score: number })[] = [];
  for (const art of REKORD_GILDE) {
    const value = aktuell.gesamt[art];
    if (value === null || value < REKORD_MIN.gilde) continue;
    const previous = Math.max(0, ...frueher.map((z) => z.gesamt[art] ?? 0));
    if (value > previous) found.push({ art, characterId: null, value, previous, score: value / Math.max(1, previous) + 0.05 });
  }
  for (const art of REKORD_EINZELN) {
    const top = aktuell.spitze[art];
    if (!top || top[1] < REKORD_MIN.einzeln) continue;
    const previous = Math.max(0, ...frueher.map((z) => z.spitze[art]?.[1] ?? 0));
    if (top[1] > previous) found.push({ art, characterId: top[0], value: top[1], previous, score: top[1] / Math.max(1, previous) });
  }
  return found
    .sort((a, b) => b.score - a.score || REKORD_GILDE.indexOf(a.art) - REKORD_GILDE.indexOf(b.art))
    .slice(0, MAX_REKORDE)
    .map(({ score: _score, ...e }) => e);
}

/** Wie viele Wochen der Rückblick zurückschaut. */
export const RUECKBLICK_WOCHEN = 4;

/**
 * Schlagzeile des Aufmachers von vor vier Wochen: die frühere Ausgabe, deren letzter Tag genau 28 Tage vor dem
 * letzten Tag dieser Woche liegt. Fehlt sie, gibt es keinen Rückblick.
 */
export function rueckblick(to: string, previous: WeeklyRecord[]): ZeitungRueckblick | null {
  const ziel = addDays(to, -7 * RUECKBLICK_WOCHEN);
  const r = previous.find((p) => p.to === ziel);
  if (!r) return null;
  const lead = r.zeitung.lead;
  const dialekte = Object.fromEntries(
    Object.entries(lead.dialekte ?? {}).flatMap(([d, t]) => (t?.headline ? [[d, t.headline]] : [])),
  );
  return {
    week: r.week,
    from: r.from,
    to: r.to,
    headline: lead.headline,
    ...(Object.keys(dialekte).length > 0 ? { dialekte } : {}),
    characterIds: lead.characterIds,
  };
}
