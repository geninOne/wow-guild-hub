import { monthOf } from "../lib/time";
import type { StatsSnapshot, StatValues } from "./snapshot";

/** Period for a difference: a scoring week (its Saturday), a calendar month or everything since the server start. */
export type StatsPeriod = { kind: "week"; week: string } | { kind: "month"; month: string } | { kind: "total" };

/**
 * Which weekly snapshots (Saturdays) are compared for a period; `before: null` means server start, i.e. all 0.
 * Week: its snapshot against the last one before. Month: last snapshot with a Saturday in the month against the last
 * one before (a week counts toward the month its Saturday falls in). Total: newest snapshot against the server start.
 * Snapshots before the server start never serve as a comparison. `after: null` if the snapshot does not exist (yet).
 */
export function pickSnapshots(
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
 * Increase per character and statistic between two snapshots; missing values count as 0, zeros are dropped.
 * `before: null` is the server start. Characters missing entirely from the earlier snapshot count from 0 by default
 * (`newCharacters: "zero"`); with `"skip"` they are left out, e.g. for newcomers in the middle of the game.
 */
export function statDiff(
  before: StatsSnapshot | null,
  after: StatsSnapshot,
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

/** Sum per statistic over all characters of a difference. */
export function sumDiff(diff: Record<string, StatValues>): StatValues {
  const sum: StatValues = {};
  for (const values of Object.values(diff)) {
    for (const [stat, value] of Object.entries(values)) sum[stat] = (sum[stat] ?? 0) + value;
  }
  return sum;
}

