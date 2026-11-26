// Serverstart als Nullpunkt. Bewusst nur mit löschbarer TypeScript-Syntax und ohne Laufzeit-Importe,
// damit auch die Skripte unter scripts/ die Datei direkt laden können.
import type { DaySnapshot } from "../model";

/**
 * Liest das Datum aus dem Inhalt von `config/serverstart.json`.
 * Fehlt `datum` oder ist es null, gibt es keinen Serverstart (null); alles andere als ein gültiger Kalendertag bricht ab.
 */
export function parseServerStart(raw: unknown): string | null {
  const datum = (raw as { datum?: unknown } | null)?.datum;
  if (datum === undefined || datum === null) return null;
  const valid =
    typeof datum === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(datum) &&
    new Date(`${datum}T00:00:00Z`).toISOString().slice(0, 10) === datum;
  if (!valid) throw new Error("config/serverstart.json: datum muss ein Kalendertag der Form JJJJ-MM-TT sein");
  return datum;
}

/** Liegt der Serverstart im Zeitraum (beide Grenzen eingeschlossen)? */
export function startsWithin(serverStart: string | null, from: string, to: string): serverStart is string {
  return serverStart !== null && serverStart >= from && serverStart <= to;
}

/** Kalendertage ohne die vor dem Serverstart: Solche Tagesstände taugen nie als Vergleich. */
export function sinceServerStart(dates: string[], serverStart: string | null): string[] {
  return serverStart === null ? dates : dates.filter((d) => d >= serverStart);
}

/**
 * Gedachter Tagesstand im Augenblick des Serverstarts für alle Charaktere des Endstands:
 * Level 1, kein Beruf, alle Zähler und die Gegenstandsstufe auf 0.
 * Als Vergleichsstand zählt damit der volle heutige Wert.
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
