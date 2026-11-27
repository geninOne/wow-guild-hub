// One-time data import: uploads all entries of the local blob store "gilde" to the store "gilde"
// of the Netlify site, so history and level-ups are preserved.
//
//   npm run data:import -- --dry-run                    only list, needs no credentials
//   npm run data:import                                 upload
//   npm run data:import -- --source ./blobs-copy        source other than .netlify/blobs-serve
//   npm run data:import -- --overwrite                  even if the target store already has entries
//
// The former German flag names are still accepted as deprecated aliases (see parseArgs below).
//
// Uploading requires NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN. Only keys, sizes and counts are printed,
// never credentials or contents.
import { parseArgs } from "node:util";
import { collectEntries, importEntries, netlifyTarget } from "./blobs-lib.mjs";

const STORE = "gilde";
const DEFAULT_SOURCE = ".netlify/blobs-serve";

try {
  const { values } = parseArgs({
    options: {
      source: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      overwrite: { type: "boolean", default: false },
      // Deprecated German aliases of --source, --dry-run and --overwrite.
      "quelle": { type: "string" },
      "trocken": { type: "boolean", default: false },
      "ueberschreiben": { type: "boolean", default: false },
    },
  });
  const source = values.source ?? values["quelle"] ?? DEFAULT_SOURCE;
  const dryRun = values["dry-run"] || values["trocken"];
  const overwrite = values.overwrite || values["ueberschreiben"];

  const entries = await collectEntries(source, STORE);
  console.log(`Source ${source}: ${entries.length} entries in store ${STORE}.`);

  let target = { list: async () => [], set: async () => {} };
  if (!dryRun) {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_AUTH_TOKEN;
    const missing = [!siteID && "NETLIFY_SITE_ID", !token && "NETLIFY_AUTH_TOKEN"].filter(Boolean);
    if (missing.length) throw new Error(`Environment variable missing: ${missing.join(", ")}`);
    target = netlifyTarget({ siteID, token, storeName: STORE });
    console.log(`Target: store ${STORE} of the Netlify site.`);
  }

  await importEntries({ entries, target, dryRun, overwrite, log: (line) => console.log(line) });
} catch (error) {
  // Only the message, no objects with request details (headers could contain the token).
  console.error(`Aborted: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
