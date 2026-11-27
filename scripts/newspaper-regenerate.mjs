// Regenerates newspaper issues (and the titles of the same week) ONLY in the local environment, e.g. after
// the own AI Gateway (NEWSPAPER_AI_URL, NEWSPAPER_AI_KEY) was configured. Normally an issue is generated exactly once
// and never again.
//
// Run in the container:  docker compose exec app npm run newspaper:regenerate                (latest issue)
//                        docker compose exec app npm run newspaper:regenerate -- 2026-11-21  (given weeks, named after their Saturday)
//                        docker compose exec app npm run newspaper:regenerate -- --all       (all issues)
// (--alle is still accepted as a deprecated alias of --all.)
//
// Like scripts/sample-data.mjs: writes only to .netlify/blobs-serve, aborts in a Netlify environment
// and triggers the weekly evaluation only through localhost. At most the last 8 weeks are evaluated.
// Issues of old ISO weeks (before the switch to Sunday to Saturday, e.g. 2026-W46) are not regenerated
// and therefore always stay.
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { isGuildWeek, isWeek } from "../src/lib/time.ts";
import { checkEnvironment, deleteWeeklyResults, localStore } from "./sample-data-lib.mjs";

const baseUrl = process.env.TRIGGER_BASE_URL ?? "http://localhost:8888";
// BLOBS_ORDNER is the deprecated old name of BLOBS_DIR.
const source = resolve(process.env.BLOBS_DIR ?? process.env["BLOBS_ORDNER"] ?? ".netlify/blobs-serve");
const log = (line) => console.log(line);

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      all: { type: "boolean", default: false },
      "alle": { type: "boolean", default: false }, // deprecated alias of --all
    },
  });
  const all = values.all || values["alle"];
  checkEnvironment(process.env, baseUrl);
  const store = await localStore(source);
  const index = (await store.get("weekly/index")) ?? { weeks: [] };
  const old = positionals.filter((a) => isWeek(a));
  if (old.length > 0) throw new Error(`${old.join(" ")}: issues from before the switch to Sunday to Saturday cannot be regenerated.`);
  const named = positionals.filter((a) => isGuildWeek(a));
  const unknown = positionals.filter((a) => !isGuildWeek(a));
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown.join(" ")}. Allowed: the Saturday of a week such as 2026-11-21 or --all.`);
  const guildWeeks = index.weeks.filter((w) => isGuildWeek(w));
  const weeks = all ? guildWeeks : named.length > 0 ? named : guildWeeks.slice(-1);
  if (weeks.length === 0) throw new Error("There is no issue of a guild week yet. Run the weekly evaluation first.");

  const deleted = await deleteWeeklyResults(store, weeks);
  log(`Removed ${deleted} issues for regeneration: ${weeks.join(", ")}`);
  log(process.env.NEWSPAPER_AI_URL && process.env.NEWSPAPER_AI_KEY ? "Claude writes the texts through the own AI Gateway." : "NEWSPAPER_AI_URL or NEWSPAPER_AI_KEY is missing: texts come from the phrase templates.");

  const res = await fetch(`${baseUrl}/.netlify/functions/collect-weekly`);
  await res.text();
  log(`Weekly evaluation triggered (HTTP ${res.status}). Report in the log: docker compose logs app | grep -E '"job":"(collect-weekly|zeitung)"'`);
  if (!res.ok) process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
