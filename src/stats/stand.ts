import { berlinDate, shiftGuildWeek, guildWeek } from "../lib/time";
import type { JsonStore } from "../store";

/** Statistik-ID (als Text) auf Wert; fehlende Statistiken stehen für 0. */
export type StatValues = Record<string, number>;

/**
 * Wöchentlicher Statistik-Stand unter `stats/<Samstag>`: je aktivem Charakter die vollständigen Statistikwerte
 * zum Ende der Wertungswoche. Namen und Kategorien stehen einmal in `config/statistiken.json`.
 */
export interface StatsStand {
  /** Samstag der Wertungswoche. */
  week: string;
  /** Zeitpunkt des Laufs, dessen Werte zuletzt einflossen. */
  takenAt: string;
  /** Charakter-ID auf Werte. */
  characters: Record<string, StatValues>;
  /** In dieser Woche lief kein Sammler; der Stand ist eine Kopie des letzten bekannten. */
  nachgeholt?: true;
}

/** Wie viele fehlende Wochen höchstens nachgeholt werden. */
const MAX_FILL_WEEKS = 52;

/**
 * Stand der laufenden Woche nach einem Lauf: Basis ist der schon geschriebene Stand dieser Woche, sonst der letzte
 * bekannte. Frisch geholte Charaktere werden überschrieben, nur aktive Mitglieder bleiben.
 */
export function nextStatsStand(opts: {
  week: string;
  at: string;
  existing: StatsStand | null;
  latest: StatsStand | null;
  active: number[];
  updates: Record<string, StatValues>;
}): StatsStand {
  const base = opts.existing ?? opts.latest;
  const characters: Record<string, StatValues> = {};
  for (const id of opts.active.map(String)) {
    const values = opts.updates[id] ?? base?.characters[id];
    if (values) characters[id] = values;
  }
  return { week: opts.week, takenAt: opts.at, characters };
}

/**
 * Schreibt bei jedem Sammlerlauf den Stand der laufenden Wertungswoche neu, so wie den Tagesstand: Gültig ist am Ende
 * der Stand des letzten Laufs vor Sonntag 0 Uhr Berliner Zeit. Fehlen davor Wochen (kein einziger Lauf), werden sie mit
 * dem letzten bekannten Stand aufgefüllt und als nachgeholt markiert, damit spätere Differenzen lückenlos bleiben.
 */
export async function saveStatsStand(
  store: JsonStore,
  opts: { at: string; active: number[]; updates: Record<string, StatValues> },
): Promise<{ week: string; filled: string[] }> {
  const week = guildWeek(berlinDate(opts.at));
  const key = `stats/${week}`;
  const existing = await store.get<StatsStand>(key);
  const filled: string[] = [];
  let latest: StatsStand | null = null;
  if (!existing) {
    const last = (await store.list("stats/"))
      .map((k) => k.slice("stats/".length))
      .filter((w) => w < week)
      .sort()
      .at(-1);
    latest = last ? await store.get<StatsStand>(`stats/${last}`) : null;
    if (last && latest) {
      const first = shiftGuildWeek(last, 1);
      const limit = shiftGuildWeek(week, -MAX_FILL_WEEKS);
      for (let w = first > limit ? first : limit; w < week; w = shiftGuildWeek(w, 1)) {
        await store.set(`stats/${w}`, { ...latest, week: w, nachgeholt: true } satisfies StatsStand);
        filled.push(w);
      }
    }
  }
  await store.set(key, nextStatsStand({ week, at: opts.at, existing, latest, active: opts.active, updates: opts.updates }));
  return { week, filled };
}
