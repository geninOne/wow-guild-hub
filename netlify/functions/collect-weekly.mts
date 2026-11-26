import type { Config } from "@netlify/functions";
import { runAndRespond } from "../../src/handler";
import { createNetlifyStore } from "../../src/store";
import { runWeeklyEvaluation } from "../../src/weekly/run";

// Wochenauswertung (Spaßtitel und Zeitung) für die Wertungswoche Sonntag bis Samstag.
// Läuft täglich um 5:15, 6:15 und 7:15 UTC (Winter 6:15 bis 8:15 Uhr, Sommer 7:15 bis 9:15 Uhr deutscher Zeit)
// und schreibt nur, wenn eine abgeschlossene Woche fehlt: Sonntags entsteht die Ausgabe der Vorwoche beim
// ersten Lauf, die beiden späteren sind Wiederholungen für den Fall eines Fehlschlags, die übrigen Tage holen nach.
export default async () =>
  runAndRespond("collect-weekly", () => runWeeklyEvaluation({ store: createNetlifyStore(), now: () => new Date() }));

export const config: Config = { schedule: "15 5,6,7 * * *" };
