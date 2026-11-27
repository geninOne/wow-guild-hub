// Server start as the zero point. Deliberately uses only erasable TypeScript syntax and no runtime imports,
// so that the scripts under scripts/ can load this file directly.
import type { DaySnapshot } from "../model";

/**
 * Reads the date from the contents of `config/server-start.json`.
 * If `date` is missing or null, there is no server start (null); anything other than a valid calendar day throws.
 */
export function parseServerStart(raw: unknown): string | null {
  const date = (raw as { date?: unknown } | null)?.date;
  if (date === undefined || date === null) return null;
  const valid =
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!valid) throw new Error("config/server-start.json: date must be a calendar day in the form YYYY-MM-DD");
  return date;
}

/** Does the server start fall within the period (both bounds inclusive)? */
export function startsWithin(serverStart: string | null, from: string, to: string): serverStart is string {
  return serverStart !== null && serverStart >= from && serverStart <= to;
}

/** Calendar days without those before the server start: such day snapshots never serve as a comparison. */
export function sinceServerStart(dates: string[], serverStart: string | null): string[] {
  return serverStart === null ? dates : dates.filter((d) => d >= serverStart);
}

/**
 * Imaginary day snapshot at the moment of the server start for all characters of the end snapshot:
 * level 1, no profession, all counters and the item level at 0.
 * Used as the comparison snapshot, the full current value counts.
 */
export function serverStartSnapshot(serverStart: string, end: DaySnapshot): DaySnapshot {
  return {
    date: serverStart,
    takenAt: `${serverStart}T00:00:00.000Z`,
    characters: Object.fromEntries(
      Object.keys(end.characters).map((id) => [
        id,
        { level: 1, equippedItemLevel: 0, professions: {}, deaths: 0, dungeons: 0, recipes: 0, achievements: 0, reputation: 0 },
      ]),
    ),
  };
}
