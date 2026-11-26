import type { Config } from "@netlify/functions";
import { runStaticCollection } from "../../src/collect/static";
import { runAndRespond } from "../../src/handler";
import { createRuntime } from "../../src/runtime";

export default async () => runAndRespond("collect-static", () => runStaticCollection(createRuntime()));

// Alle vier Stunden um halb (0:30, 4:30, ... UTC), versetzt zu collect-guild (volle Stunde) und collect-weekly (Viertel nach),
// damit sich die Läufe nicht im Rate-Limit von Blizzard drängeln. Was im Zeitbudget keinen Platz hat, folgt im nächsten Lauf.
export const config: Config = { schedule: "30 */4 * * *" };
