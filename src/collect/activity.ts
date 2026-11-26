import { weekHour } from "../lib/time";
import type { ActivityWeek, CharacterRecord } from "../model";
import type { JsonStore } from "../store";

export interface LoginSeen {
  characterId: number;
  /** Login-Zeitpunkt laut Blizzard. */
  at: string;
  /** Ganze Tage seit dem vorigen bekannten Login. */
  awayDays: number;
}

/** Ab so vielen Tagen Pause wird ein Login als Rückkehr festgehalten. */
export const RETURN_MIN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Neuer Login, wenn sich der Zeitpunkt gegenüber dem gespeicherten Datensatz nach vorn bewegt hat.
 * Ohne Vorwert entsteht nur die Basislinie: sonst würde der erste Lauf alte Logins als frisch zählen.
 */
export function detectLogin(previous: CharacterRecord | null, next: CharacterRecord): LoginSeen | null {
  if (!previous?.lastLoginAt || !next.lastLoginAt) return null;
  if (Date.parse(next.lastLoginAt) <= Date.parse(previous.lastLoginAt)) return null;
  const awayDays = Math.floor((Date.parse(next.lastLoginAt) - Date.parse(previous.lastLoginAt)) / DAY_MS);
  return { characterId: next.id, at: next.lastLoginAt, awayDays };
}

/** Trägt Wochenstunden ein, sortiert und ohne Doppelte. `added` zählt die wirklich neuen Einträge. */
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

/** Hält Rückkehrer ab `RETURN_MIN_DAYS` fest, je Charakter die längste Pause der Woche. */
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

/** Schreibt die Logins in die Wochen-Blobs `activity/{Woche}`; je betroffener Woche ein Lesen und höchstens ein Schreiben. */
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
