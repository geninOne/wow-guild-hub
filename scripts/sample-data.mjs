// Sample data ONLY for local development: fills activity (five completed guild weeks, Sunday to Saturday, and the
// current one)
// and missing daily snapshots, then triggers the weekly evaluation (titles and newspaper).
// Nothing is created before the server start (config/server-start.json): there all characters start at level 1.
// Everything generated carries "testdaten": true and can be deleted again with --remove.
//
// Run in the container:  docker compose exec app npm run data:sample
//                        docker compose exec app npm run data:sample -- --remove
// (--entfernen is still accepted as a deprecated alias of --remove.)
//
// Safety: the script only writes files in the folder of the local blob server (.netlify/blobs-serve),
// knows no Netlify access, aborts in a Netlify environment and triggers only through localhost.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseServerStart } from "../src/lib/server-start.ts";
import { checkEnvironment, fillSampleData, localStore, removeSampleData } from "./sample-data-lib.mjs";

const { values } = parseArgs({
  strict: false, // like before: other arguments are ignored
  options: {
    remove: { type: "boolean", default: false },
    "entfernen": { type: "boolean", default: false }, // deprecated alias of --remove
  },
});
const baseUrl = process.env.TRIGGER_BASE_URL ?? "http://localhost:8888";
// BLOBS_ORDNER is the deprecated old name of BLOBS_DIR.
const source = resolve(process.env.BLOBS_DIR ?? process.env["BLOBS_ORDNER"] ?? ".netlify/blobs-serve");
const remove = values.remove || values["entfernen"];
const log = (line) => console.log(line);

async function serverStart() {
  return parseServerStart(JSON.parse(await readFile(new URL("../config/server-start.json", import.meta.url), "utf8")));
}

try {
  checkEnvironment(process.env, baseUrl);
  const store = await localStore(source);
  log(`Local store: ${source}`);
  if (remove) await removeSampleData(store, log);
  else await fillSampleData(store, new Date().toISOString(), log, await serverStart());

  const res = await fetch(`${baseUrl}/.netlify/functions/collect-weekly`);
  await res.text();
  log(`Weekly evaluation triggered (HTTP ${res.status}). Report in the log: docker compose logs app | grep '"job":"collect-weekly"'`);
  if (!res.ok) process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
