import type { DaySnapshot, LevelUpLog, MemberSummary } from "../model";
import type { JsonStore } from "../store";
import { berlinDate } from "./time";

export interface Baseline {
  /** Comparison snapshot, extended with the first known snapshot of each late starter. */
  before: DaySnapshot | null;
  /** Late starters: character ID to the date of the day snapshot from which they are counted. */
  since: Record<string, string>;
}

function firstSeenDay(m: MemberSummary): string {
  const ms = Date.parse(m.firstSeenAt);
  return Number.isNaN(ms) ? "" : berlinDate(m.firstSeenAt);
}

/**
 * Extends the comparison snapshot with characters that are missing from it but present in the end snapshot
 * (newly created, joined or returned): for them, their earliest day snapshot within the period applies.
 *
 * Loading is frugal: nothing at all if nobody is missing; otherwise, per late starter, first the snapshot of
 * their first day (`firstSeenAt`), and only if they are missing there, the next one step by step.
 * Each day snapshot is loaded at most once. On top of that the level-up log is loaded once,
 * because the day snapshot of the first day only shows the evening: level-ups since the first
 * appearance are logged there and lower the starting level to the value before the first level-up.
 *
 * @param dates All existing day snapshot dates (any order).
 */
export async function withLateStarts(
  store: JsonStore,
  dates: string[],
  before: DaySnapshot | null,
  end: DaySnapshot | null,
  members: MemberSummary[],
): Promise<Baseline> {
  if (!before || !end || before.date >= end.date) return { before, since: {} };
  const late = members.filter((m) => !m.former && end.characters[String(m.id)] && !before.characters[String(m.id)]);
  if (late.length === 0) return { before, since: {} };

  const between = dates.filter((d) => d > before.date && d < end.date).sort();
  const loaded = new Map<string, Promise<DaySnapshot | null>>();
  const load = (date: string) => {
    if (!loaded.has(date)) loaded.set(date, store.get<DaySnapshot>(`history/${date}`));
    return loaded.get(date)!;
  };

  const characters = { ...before.characters };
  const since: Record<string, string> = {};
  let pending = late.map((m) => {
    const day = firstSeenDay(m);
    const index = between.findIndex((d) => d >= day);
    return { id: String(m.id), index: index === -1 ? between.length : index };
  });
  while (pending.length > 0) {
    const next: typeof pending = [];
    await Promise.all(
      pending.map(async (p) => {
        // No earlier snapshot left: the end snapshot is also the starting value.
        const snap = p.index < between.length ? await load(between[p.index]) : end;
        const entry = snap?.characters[p.id];
        if (snap && entry) {
          characters[p.id] = entry;
          since[p.id] = snap.date;
        } else {
          next.push({ id: p.id, index: p.index + 1 });
        }
      }),
    );
    pending = next;
  }

  const log = await store.get<LevelUpLog>("levelups");
  for (const e of log?.events ?? []) {
    const id = String(e.characterId);
    if (!(id in since)) continue;
    const day = berlinDate(e.at);
    if (day <= before.date || day > end.date) continue;
    if (e.level - 1 < characters[id].level) characters[id] = { ...characters[id], level: e.level - 1 };
  }
  return { before: { ...before, characters }, since };
}
