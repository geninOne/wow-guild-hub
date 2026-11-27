import type { Config } from "@netlify/functions";
import { runAndRespond } from "../../src/handler";
import { createNetlifyStore } from "../../src/store";
import { runWeeklyEvaluation } from "../../src/weekly/run";

// Weekly evaluation (fun titles and newspaper) for the scoring week Sunday to Saturday.
// Runs daily at 5:15, 6:15 and 7:15 UTC (6:15 to 8:15 in German winter time, 7:15 to 9:15 in summer time)
// and writes only when a completed week is missing: on Sundays the first run creates the previous week's issue,
// the two later runs are retries in case of a failure, and the other days catch up.
export default async () =>
  runAndRespond("collect-weekly", () => runWeeklyEvaluation({ store: createNetlifyStore(), now: () => new Date() }));

export const config: Config = { schedule: "15 5,6,7 * * *" };
