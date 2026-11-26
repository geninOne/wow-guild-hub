import { monthOf } from "../lib/time";
import type { StatsStand, StatValues } from "./stand";

/** Zeitraum für eine Differenz: eine Wertungswoche (ihr Samstag), ein Kalendermonat oder alles seit dem Serverstart. */
export type StatsPeriod = { kind: "week"; week: string } | { kind: "month"; month: string } | { kind: "total" };

/**
 * Welche Wochenstände (Samstage) für einen Zeitraum verglichen werden; `before: null` heißt Serverstart, also alles 0.
 * Woche: ihr Stand gegen den letzten davor. Monat: letzter Stand mit Samstag im Monat gegen den letzten davor
 * (eine Woche zählt zu dem Monat, in dem ihr Samstag liegt). Gesamt: neuester Stand gegen den Serverstart.
 * Stände vor dem Serverstart taugen nie als Vergleich. `after: null`, wenn es den Stand (noch) nicht gibt.
 */
export function pickStands(
  available: string[],
  period: StatsPeriod,
  serverStart: string | null,
): { before: string | null; after: string | null } {
  const weeks = [...available].filter((w) => serverStart === null || w >= serverStart).sort();
  const lastBefore = (limit: string) => weeks.filter((w) => w < limit).at(-1) ?? null;
  if (period.kind === "week") {
    return { before: lastBefore(period.week), after: weeks.includes(period.week) ? period.week : null };
  }
  if (period.kind === "month") {
    const inMonth = weeks.filter((w) => monthOf(w) === period.month);
    return { before: lastBefore(`${period.month}-01`), after: inMonth.at(-1) ?? null };
  }
  return { before: null, after: weeks.at(-1) ?? null };
}

/**
 * Zuwachs je Charakter und Statistik zwischen zwei Ständen; fehlende Werte gelten als 0, Nullen fallen weg.
 * `before: null` ist der Serverstart. Charaktere, die im früheren Stand ganz fehlen, zählen standardmäßig ab 0
 * (`newCharacters: "zero"`); mit `"skip"` bleiben sie außen vor, etwa für Neuzugänge mitten im Spiel.
 */
export function statDiff(
  before: StatsStand | null,
  after: StatsStand,
  opts: { newCharacters?: "zero" | "skip" } = {},
): Record<string, StatValues> {
  const result: Record<string, StatValues> = {};
  for (const [id, values] of Object.entries(after.characters)) {
    const prev = before?.characters[id];
    if (before && !prev && opts.newCharacters === "skip") continue;
    const diff: StatValues = {};
    for (const [stat, value] of Object.entries(values)) {
      const delta = value - (prev?.[stat] ?? 0);
      if (delta !== 0) diff[stat] = delta;
    }
    if (Object.keys(diff).length > 0) result[id] = diff;
  }
  return result;
}

/** Summe je Statistik über alle Charaktere einer Differenz. */
export function sumDiff(diff: Record<string, StatValues>): StatValues {
  const sum: StatValues = {};
  for (const values of Object.values(diff)) {
    for (const [stat, value] of Object.entries(values)) sum[stat] = (sum[stat] ?? 0) + value;
  }
  return sum;
}

