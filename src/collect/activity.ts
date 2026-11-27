import { weekHour } from "../lib/time";
import type { ActivityWeek, CharacterRecord } from "../model";
import type { JsonStore } from "../store";

export interface LoginSeen {
  characterId: number;
  /** Login time according to Blizzard. */
  at: string;
  /** Whole days since the previous known login. */
  awayDays: number;
}

/** A login after a break of at least this many days is recorded as a return. */
export const RETURN_MIN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * New login if the time has moved forward compared to the stored record.
 * Without a previous value only the baseline is set: otherwise the first run would count old logins as fresh.
 */
export function detectLogin(previous: CharacterRecord | null, next: CharacterRecord): LoginSeen | null {
  if (!previous?.lastLoginAt || !next.lastLoginAt) return null;
  if (Date.parse(next.lastLoginAt) <= Date.parse(previous.lastLoginAt)) return null;
  const awayDays = Math.floor((Date.parse(next.lastLoginAt) - Date.parse(previous.lastLoginAt)) / DAY_MS);
  return { characterId: next.id, at: next.lastLoginAt, awayDays };
}

/** Adds week hours, sorted and without duplicates. `added` counts the entries that are actually new. */
export function addHours(
  week: ActivityWeek,
  entries: { characterId: number; hour: number }[],
): { week: ActivityWeek; added: number } {
  const characters = { ...week.characters };
  let added = 0;
  for (const e of entries) {
    const key = String(e.characterId);
    const hours = characters[key] ?? [];
    if (hours.includes(e.hour)) continue;
    characters[key] = [...hours, e.hour].sort((a, b) => a - b);
    added++;
  }
  return { week: { ...week, characters }, added };
}

/** Records returners from `RETURN_MIN_DAYS` on, per character the longest break of the week. */
export function addReturns(
  week: ActivityWeek,
  entries: { characterId: number; awayDays: number }[],
): { week: ActivityWeek; changed: boolean } {
  const returns = { ...week.returns };
  let changed = false;
  for (const e of entries) {
    const key = String(e.characterId);
    if (e.awayDays < RETURN_MIN_DAYS || (returns[key] ?? 0) >= e.awayDays) continue;
    returns[key] = e.awayDays;
    changed = true;
  }
  return { week: changed ? { ...week, returns } : week, changed };
}

/** Writes the logins to the week blobs `activity/{week}`; per affected week one read and at most one write. */
export async function recordActivity(store: JsonStore, logins: LoginSeen[]): Promise<number> {
  const byWeek = new Map<string, { characterId: number; hour: number; awayDays: number }[]>();
  for (const login of logins) {
    const { week, hour } = weekHour(login.at);
    byWeek.set(week, [...(byWeek.get(week) ?? []), { characterId: login.characterId, hour, awayDays: login.awayDays }]);
  }
  let total = 0;
  for (const [week, entries] of byWeek) {
    const key = `activity/${week}`;
    const current = (await store.get<ActivityWeek>(key)) ?? { week, characters: {} };
    const { week: withHours, added } = addHours(current, entries);
    const { week: next, changed } = addReturns(withHours, entries);
    if (added > 0 || changed) await store.set(key, next);
    total += added;
  }
  return total;
}
