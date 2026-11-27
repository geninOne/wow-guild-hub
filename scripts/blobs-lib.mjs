// Helpers for the one-time import of the local blobs into Netlify (scripts/blobs-import.mjs).
import { getStore } from "@netlify/blobs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/**
 * @typedef {{ key: string, path: string, size: number, metadata: Record<string, unknown> | null }} Entry
 * @typedef {{
 *   list(): Promise<string[]>,
 *   set(key: string, content: string, metadata?: Record<string, unknown>): Promise<void>,
 * }} Target
 */

async function filesUnder(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await filesUnder(path)));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Reads all entries of a store from the folder of the local blob server of `netlify dev`
 * (`.netlify/blobs-serve`): contents under `entries/<site>/site:<store>/<key>`, metadata
 * laid out the same way under `metadata/`.
 * @param {string} source
 * @param {string} [storeName]
 * @returns {Promise<Entry[]>}
 */
export async function collectEntries(source, storeName = "gilde") {
  const entries = join(source, "entries");
  if (!(await isDir(entries))) throw new Error(`There is no "entries" folder in ${source}`);
  const sites = (await readdir(entries, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  if (sites.length !== 1) {
    throw new Error(
      `${entries} must contain exactly one site folder, found: ${sites.length ? sites.sort().join(", ") : "none"}`,
    );
  }
  const store = `site:${storeName}`;
  const storeDir = join(entries, sites[0], store);
  if (!(await isDir(storeDir))) throw new Error(`Store ${store} is missing under ${join(entries, sites[0])}`);
  const metadataDir = join(source, "metadata", sites[0], store);

  const collected = [];
  for (const path of await filesUnder(storeDir)) {
    const key = relative(storeDir, path).split(sep).join("/");
    collected.push({
      key,
      path,
      size: (await stat(path)).size,
      metadata: await metadataOf(join(metadataDir, ...key.split("/"))),
    });
  }
  return collected.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

async function metadataOf(path) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return null;
  }
  const metadata = JSON.parse(raw);
  return metadata && typeof metadata === "object" && Object.keys(metadata).length > 0 ? metadata : null;
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Uploads the entries to the target. A dry run only lists them and does not touch the target.
 * If the target already has entries, the import aborts unless `overwrite` is set.
 * Blob contents are never printed, only keys and sizes.
 * @param {{
 *   entries: Entry[],
 *   target: Target,
 *   dryRun: boolean,
 *   overwrite?: boolean,
 *   log: (line: string) => void,
 *   parallel?: number,
 * }} options
 * @returns {Promise<{ uploaded: number, entries: number, bytes: number }>}
 */
export async function importEntries({ entries, target, dryRun, overwrite = false, log, parallel = 5 }) {
  const bytes = entries.reduce((sum, e) => sum + e.size, 0);
  if (dryRun) {
    for (const e of entries) log(`  ${e.key} (${kb(e.size)})`);
    log(`Dry run: ${entries.length} entries, ${kb(bytes)} would be uploaded. Nothing was changed.`);
    return { uploaded: 0, entries: entries.length, bytes };
  }

  const existing = await target.list();
  if (existing.length > 0 && !overwrite) {
    throw new Error(
      `The target store already has ${existing.length} entries. Aborting so nothing is overwritten. ` +
        "To overwrite, run again with --overwrite.",
    );
  }

  let uploaded = 0;
  const queue = [...entries];
  async function worker() {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const content = await readFile(e.path, "utf8");
      await target.set(e.key, content, e.metadata ?? undefined);
      uploaded++;
      if (uploaded % 25 === 0 || uploaded === entries.length) log(`  ${uploaded} of ${entries.length} uploaded`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));
  log(`Done: ${uploaded} entries, ${kb(bytes)} uploaded.`);
  return { uploaded, entries: entries.length, bytes };
}

/**
 * Target for importEntries(): the store of a Netlify site via the Blobs API.
 * @param {{ siteID: string, token: string, storeName?: string }} options
 * @returns {Target}
 */
export function netlifyTarget({ siteID, token, storeName = "gilde" }) {
  const store = getStore({ name: storeName, siteID, token });
  return {
    list: async () => (await store.list()).blobs.map((b) => b.key),
    set: async (key, content, metadata) => {
      await store.set(key, content, metadata ? { metadata } : undefined);
    },
  };
}

/**
 * Guided import for going live: show the dry run, wait for confirmation, only then ask for the token
 * and upload. Returns null if not confirmed.
 * @param {{
 *   source: string,
 *   log: (line: string) => void,
 *   confirm: (question: string) => Promise<string>,
 *   askToken: () => Promise<string>,
 *   createTarget: (token: string) => Target,
 *   overwrite?: boolean,
 * }} options
 */
export async function liveImport({ source, log, confirm, askToken, createTarget, overwrite = false }) {
  const entries = await collectEntries(source, "gilde");
  await importEntries({ entries, target: { list: async () => [], set: async () => {} }, dryRun: true, log });

  const answer = await confirm(`Upload ${entries.length} entries to the store gilde of the Netlify site? (yes/no) `);
  // "ja"/"j" are still accepted for users used to the former German prompt.
  if (!/^(yes|y|ja|j)$/i.test(answer.trim())) {
    log("Not uploaded.");
    return null;
  }
  const token = (await askToken()).trim();
  if (!token) throw new Error("No Netlify token entered");
  return importEntries({ entries, target: createTarget(token), dryRun: false, overwrite, log });
}
