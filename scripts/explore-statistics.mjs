// Test run against the Blizzard API: what does the statistics endpoint really return for WoW Forever?
// Local only, none of this goes live. Fetches the statistics for all current members of both guilds that have a
// profile (throttled like the collector), evaluates count, sum, maximum and median per statistic and probes samples
// of further endpoints (definitions, achievements, collections).
//
// Run from the project folder:  npm run stats:explore
// Credentials come from the local .env and are never printed.
// Raw responses and the evaluation go to .explore/ (not versioned, EXPLORE_DIR overrides it); the static name list
// config/statistics.json is updated (new statistics are added, known ones stay).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createBlizzardClient } from "../src/blizzard/client.ts";
import { runPool } from "../src/lib/pool.ts";
import { evaluate, fieldsOf, markdownTables, updateList } from "./explore-statistics-lib.mjs";

// ERKUNDUNG_ORDNER is the deprecated former name of EXPLORE_DIR, still read as a fallback.
const target = resolve(process.env.EXPLORE_DIR ?? process.env["ERKUNDUNG_ORDNER"] ?? ".explore");
const log = (line) => console.log(line);

try {
  process.loadEnvFile(".env");
} catch {
  // without .env the values from the environment apply
}
const env = process.env;
if (!env.BNET_CLIENT_ID || !env.BNET_CLIENT_SECRET) {
  console.error("BNET_CLIENT_ID and BNET_CLIENT_SECRET are missing (local .env).");
  process.exit(2);
}
const region = env.BNET_REGION || "eu";
const locale = env.BNET_LOCALE || "de_DE";
const guilds = (env.GUILD_SLUGS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (guilds.length === 0) {
  console.error("GUILD_SLUGS is missing (local .env), e.g. GUILD_SLUGS=my-guild,second-guild.");
  process.exit(2);
}
const concurrency = Number(env.COLLECT_CONCURRENCY || 10);

const client = createBlizzardClient({ clientId: env.BNET_CLIENT_ID, clientSecret: env.BNET_CLIENT_SECRET, region, locale });

await mkdir(join(target, "statistics"), { recursive: true });
await mkdir(join(target, "probes"), { recursive: true });
const save = (file, data) => writeFile(join(target, file), JSON.stringify(data, null, 2));

// 1. Members of both guilds
const members = new Map();
for (const slug of guilds) {
  const res = await client.get(`/data/wow/guild/${encodeURIComponent(slug)}/roster`, "profile");
  if (res.status !== 200) throw new Error(`Roster ${slug}: HTTP ${res.status}`);
  for (const m of res.data?.members ?? []) {
    const c = m.character ?? {};
    if (c.id && c.slug) members.set(c.id, { id: c.id, name: c.name, slug: c.slug, level: c.level ?? 0, guild: slug });
  }
}
log(`${members.size} members in ${guilds.length} guilds`);

// 2. Profile and statistics per member, throttled like the collector
const responses = [];
const status = { withoutProfile: 0, withoutStatistics: 0, errors: 0 };
const pool = await runPool(
  [...members.values()],
  async (m) => {
    const base = `/profile/wow/character/${encodeURIComponent(m.slug)}`;
    const profile = await client.get(base, "profile");
    if (profile.status !== 200) {
      status.withoutProfile++;
      return;
    }
    const stat = await client.get(`${base}/achievements/statistics`, "profile");
    if (stat.status !== 200) {
      status.withoutStatistics++;
      return;
    }
    await save(`statistics/${m.id}.json`, stat.data);
    responses.push({ member: { ...m, level: profile.data?.level ?? m.level }, data: stat.data });
  },
  { concurrency, deadline: Date.now() + 10 * 60_000 },
);
status.errors = pool.failed.length;
log(
  `${responses.length} statistics fetched, without profile ${status.withoutProfile}, ` +
    `without statistics ${status.withoutStatistics}, errors ${status.errors}`,
);

// 3. Evaluation
const evaluation = evaluate(responses);
await save("evaluation.json", { status, ...evaluation });
await writeFile(join(target, "tables.md"), markdownTables(evaluation));
log(`${evaluation.statistics.length} distinct statistics in ${evaluation.categories.length} categories`);
const listPath = resolve("config/statistics.json");
const oldList = await readFile(listPath, "utf-8").then(JSON.parse, () => null);
const list = updateList(oldList, evaluation);
await writeFile(listPath, `${JSON.stringify(list, null, 2)}\n`);
log(`config/statistics.json: ${list.statistics.length} statistics (before ${oldList?.statistics?.length ?? 0})`);

// 4. Samples of further endpoints
const probe = async (name, path, ns) => {
  const res = await client.get(path, ns);
  await save(`probes/${name}.json`, res);
  return { name, path, ns, status: res.status, fields: fieldsOf(res.data) };
};
const byLevel = [...responses].sort((a, b) => b.member.level - a.member.level);
const samples = byLevel.slice(0, 3).map((a) => a.member);
const probes = [];
// Definitions: in the game, statistics are achievements with a statistics flag; category 1 is "Statistics".
for (const [name, path] of [
  ["category-index", "/data/wow/achievement-category/index"],
  ["category-1", "/data/wow/achievement-category/1"],
  ["category-130", "/data/wow/achievement-category/130"],
  ["category-122", "/data/wow/achievement-category/122"],
  ["achievement-60", "/data/wow/achievement/60"],
  ["achievement-index", "/data/wow/achievement/index"],
]) {
  probes.push(await probe(name, path, "static"));
}
for (const m of samples) {
  const base = `/profile/wow/character/${encodeURIComponent(m.slug)}`;
  for (const [part, path] of [
    ["profile", ""],
    ["achievements", "/achievements"],
    ["mounts", "/collections/mounts"],
    ["pets", "/collections/pets"],
    ["collections", "/collections"],
    ["toys", "/collections/toys"],
    ["quests", "/quests/completed"],
    ["titles", "/titles"],
    ["dungeons", "/encounters/dungeons"],
    ["pvp", "/pvp-summary"],
    ["hunter-pets", "/hunter-pets"],
  ]) {
    probes.push(await probe(`${m.id}-${part}`, base + path, "profile"));
  }
}
await save("probes.json", probes);
for (const p of probes) log(`${String(p.status).padStart(3)} ${p.ns.padEnd(7)} ${p.path}`);
log(`Done. Results in ${target}`);
