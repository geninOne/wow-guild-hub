// Records against all earlier weeks and the lookback on the issue from four weeks ago.
import { addDays } from "../lib/time";
import type { NewspaperLookback, WeeklyRecord, WeeklyNumberKind, WeeklyNumbers } from "../model";

/** Kinds with guild records (all guilds together). */
export const RECORD_GUILD: WeeklyNumberKind[] = ["anmeldungen", "level", "tode", "dungeons", "rezepte", "erfolge"];
/** Kinds with individual records. */
export const RECORD_SINGLE: WeeklyNumberKind[] = ["level", "tode", "dungeons", "rezepte", "anmeldungen"];

/** A record is only worth an article from this many earlier weeks with numbers on, otherwise almost anything would be one. */
export const RECORD_MIN_WEEKS = 3;
/** Minimum values, so no record arises from trifles. */
export const RECORD_MIN = { guild: 10, single: 3 } as const;
const MAX_RECORDS = 3;

export interface RecordEntry {
  art: WeeklyNumberKind;
  /** Character for individual records, null for the guild record. */
  characterId: number | null;
  value: number;
  /** Previous best value. */
  previous: number;
}

/**
 * New records of this week against all earlier weeks: strictly greater than the previous best value, from the minimum
 * value on, and only if there are enough earlier weeks. The clearest first, at most three. Opted-out members are
 * already missing from `spitze` (see `buildWeeklyNumbers`).
 */
export function findRecords(
  current: Pick<WeeklyNumbers, "gesamt" | "spitze">,
  earlier: Pick<WeeklyNumbers, "gesamt" | "spitze">[],
): RecordEntry[] {
  if (earlier.length < RECORD_MIN_WEEKS) return [];
  const found: (RecordEntry & { score: number })[] = [];
  for (const kind of RECORD_GUILD) {
    const value = current.gesamt[kind];
    if (value === null || value < RECORD_MIN.guild) continue;
    const previous = Math.max(0, ...earlier.map((n) => n.gesamt[kind] ?? 0));
    if (value > previous) found.push({ art: kind, characterId: null, value, previous, score: value / Math.max(1, previous) + 0.05 });
  }
  for (const kind of RECORD_SINGLE) {
    const top = current.spitze[kind];
    if (!top || top[1] < RECORD_MIN.single) continue;
    const previous = Math.max(0, ...earlier.map((n) => n.spitze[kind]?.[1] ?? 0));
    if (top[1] > previous) found.push({ art: kind, characterId: top[0], value: top[1], previous, score: top[1] / Math.max(1, previous) });
  }
  return found
    .sort((a, b) => b.score - a.score || RECORD_GUILD.indexOf(a.art) - RECORD_GUILD.indexOf(b.art))
    .slice(0, MAX_RECORDS)
    .map(({ score: _score, ...e }) => e);
}

/** How many weeks the lookback looks back. */
export const LOOKBACK_WEEKS = 4;

/**
 * Headline of the lead article from four weeks ago: the earlier issue whose last day lies exactly 28 days before the
 * last day of this week. Without it there is no lookback.
 */
export function buildLookback(to: string, previous: WeeklyRecord[]): NewspaperLookback | null {
  const target = addDays(to, -7 * LOOKBACK_WEEKS);
  const r = previous.find((p) => p.to === target);
  if (!r) return null;
  const lead = r.zeitung.lead;
  const headlines = Object.fromEntries(
    Object.entries(lead.dialekte ?? {}).flatMap(([d, t]) => (t?.headline ? [[d, t.headline]] : [])),
  );
  return {
    week: r.week,
    from: r.from,
    to: r.to,
    headline: lead.headline,
    ...(Object.keys(headlines).length > 0 ? { dialekte: headlines } : {}),
    characterIds: lead.characterIds,
  };
}
