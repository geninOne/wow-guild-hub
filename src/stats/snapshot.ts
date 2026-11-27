import { berlinDate, shiftGuildWeek, guildWeek } from "../lib/time";
import type { JsonStore } from "../store";

/** Statistic ID (as text) to value; missing statistics stand for 0. */
export type StatValues = Record<string, number>;

/**
 * Weekly statistics snapshot under `stats/<Saturday>`: for each active character the complete statistic values
 * at the end of the scoring week. Names and categories are stored once in `config/statistiken.json`.
 */
export interface StatsSnapshot {
  /** Saturday of the scoring week. */
  week: string;
  /** Time of the run whose values were last included. */
  takenAt: string;
  /** Character ID to values. */
  characters: Record<string, StatValues>;
  /** No collector ran this week; the snapshot is a copy of the last known one. */
  nachgeholt?: true;
}

/** Maximum number of missing weeks that are backfilled. */
const MAX_FILL_WEEKS = 52;

/**
 * Snapshot of the current week after a run: based on the snapshot already written for this week, otherwise the last
 * known one. Freshly fetched characters are overwritten, only active members remain.
 */
export function nextStatsSnapshot(opts: {
  week: string;
  at: string;
  existing: StatsSnapshot | null;
  latest: StatsSnapshot | null;
  active: number[];
  updates: Record<string, StatValues>;
}): StatsSnapshot {
  const base = opts.existing ?? opts.latest;
  const characters: Record<string, StatValues> = {};
  for (const id of opts.active.map(String)) {
    const values = opts.updates[id] ?? base?.characters[id];
    if (values) characters[id] = values;
  }
  return { week: opts.week, takenAt: opts.at, characters };
}

/**
 * Rewrites the snapshot of the current scoring week on every collector run, like the day snapshot: what counts in the
 * end is the snapshot of the last run before Sunday 00:00 Berlin time. If weeks before it are missing (not a single
 * run), they are filled with the last known snapshot and marked as backfilled, so later differences have no gaps.
 */
export async function saveStatsSnapshot(
  store: JsonStore,
  opts: { at: string; active: number[]; updates: Record<string, StatValues> },
): Promise<{ week: string; filled: string[] }> {
  const week = guildWeek(berlinDate(opts.at));
  const key = `stats/${week}`;
  const existing = await store.get<StatsSnapshot>(key);
  const filled: string[] = [];
  let latest: StatsSnapshot | null = null;
  if (!existing) {
    const last = (await store.list("stats/"))
      .map((k) => k.slice("stats/".length))
      .filter((w) => w < week)
      .sort()
      .at(-1);
    latest = last ? await store.get<StatsSnapshot>(`stats/${last}`) : null;
    if (last && latest) {
      const first = shiftGuildWeek(last, 1);
      const limit = shiftGuildWeek(week, -MAX_FILL_WEEKS);
      for (let w = first > limit ? first : limit; w < week; w = shiftGuildWeek(w, 1)) {
        await store.set(`stats/${w}`, { ...latest, week: w, nachgeholt: true } satisfies StatsSnapshot);
        filled.push(w);
      }
    }
  }
  await store.set(key, nextStatsSnapshot({ week, at: opts.at, existing, latest, active: opts.active, updates: opts.updates }));
  return { week, filled };
}
