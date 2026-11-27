// Sample data for local development (scripts/sample-data.mjs): activity and daily snapshots.
// Writes only to the file folder of the local blob server of netlify dev, never through a Netlify API.
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { addDays, berlinDate, isoWeeksBetween, isWeek, isWeekId, shiftGuildWeek, guildRange, guildWeek, weekBounds, weekRange } from "../src/lib/time.ts";

/** Hosts allowed for triggering the weekly evaluation. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Aborts when the script runs in a Netlify environment or the evaluation would not be triggered locally.
 * @param {Record<string, string | undefined>} env
 * @param {string} baseUrl
 */
export function checkEnvironment(env, baseUrl) {
  for (const name of ["NETLIFY", "CONTEXT", "DEPLOY_ID", "BUILD_ID", "NETLIFY_BUILD_BASE"]) {
    if (env[name]) throw new Error(`Aborted: ${name} is set. Sample data is meant for the local environment only.`);
  }
  let host;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    throw new Error(`Aborted: ${baseUrl} is not a valid address.`);
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Aborted: the weekly evaluation is only triggered locally, not through ${host}.`);
  }
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Store on the file folder of the local blob server: `entries/<site>/site:<store>/<key>`,
 * metadata laid out the same way under `metadata/`.
 * @param {string} source folder `.netlify/blobs-serve`
 */
export async function localStore(source, storeName = "gilde") {
  const entries = join(source, "entries");
  if (!(await isDirectory(entries))) {
    throw new Error(`No local blob store under ${source}. Is netlify dev running and has the collector written data yet?`);
  }
  const sites = (await readdir(entries, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  if (sites.length !== 1) throw new Error(`Exactly one site folder must exist under ${entries}, found: ${sites.length}`);
  const store = `site:${storeName}`;
  const data = join(entries, sites[0], store);
  const meta = join(source, "metadata", sites[0], store);
  if (!(await isDirectory(data))) throw new Error(`Store ${store} is missing under ${join(entries, sites[0])}`);
  const pathOf = (root, key) => join(root, ...key.split("/"));

  async function files(folder) {
    if (!(await isDirectory(folder))) return [];
    const out = [];
    for (const e of await readdir(folder, { withFileTypes: true })) {
      const p = join(folder, e.name);
      if (e.isDirectory()) out.push(...(await files(p)));
      else if (e.isFile()) out.push(p);
    }
    return out;
  }

  return {
    async get(key) {
      try {
        return JSON.parse(await readFile(pathOf(data, key), "utf8"));
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw error;
      }
    },
    async set(key, value) {
      for (const [root, content] of [[data, JSON.stringify(value)], [meta, "{}"]]) {
        await mkdir(dirname(pathOf(root, key)), { recursive: true });
        await writeFile(pathOf(root, key), content);
      }
    },
    async delete(key) {
      await rm(pathOf(data, key), { force: true });
      await rm(pathOf(meta, key), { force: true });
    },
    async list(prefix) {
      return (await files(data))
        .map((p) => relative(data, p).split(sep).join("/"))
        .filter((k) => k.startsWith(prefix))
        .sort();
    },
  };
}

/** Deterministic randomness (mulberry32) from a text. */
export function seededRandom(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Player types: probability per hour (Berlin time) on weekdays and at the weekend. */
const PLAYER_TYPES = {
  afterWork: (h, weekend) => (h >= 18 && h <= 23 ? 0.32 : weekend && h >= 10 && h < 18 ? 0.14 : 0.015),
  nightOwl: (h) => (h >= 21 || h < 4 ? 0.3 : h < 6 ? 0.08 : 0.01),
  earlyBird: (h, weekend) => (h >= 5 && h < 9 ? 0.32 : h >= 17 && h < 21 ? 0.12 : weekend && h < 14 && h >= 9 ? 0.1 : 0.01),
  weekender: (h, weekend) => (weekend ? (h >= 10 && h <= 23 ? 0.28 : 0.03) : h >= 19 && h <= 22 ? 0.06 : 0.005),
  occasional: (h) => (h >= 19 && h <= 22 ? 0.08 : 0.005),
};
const PLAYER_TYPE_NAMES = Object.keys(PLAYER_TYPES);

/**
 * Activity for ISO weeks (the collector stores it the same way), only up to `untilIso` (no logins in the future)
 * and never before `serverStart`.
 * Seeds such as `aktivitaet:` stay unchanged so the generated data stays the same.
 * @param {{ id: number, former: boolean }[]} members
 * @param {string[]} weeks ISO weeks
 * @param {string} untilIso
 * @param {string | null} serverStart earliest calendar day with logins, usually the server start
 */
export function generateActivity(members, weeks, untilIso, serverStart = null) {
  const today = berlinDate(untilIso);
  const currentHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(new Date(untilIso)));
  const active = members.filter((m) => !m.former);
  return weeks.map((week) => {
    const { from } = weekRange(week);
    const characters = {};
    const returns = {};
    for (const m of active) {
      const r = seededRandom(`aktivitaet:${m.id}`);
      const type = PLAYER_TYPES[PLAYER_TYPE_NAMES[Math.floor(r() * PLAYER_TYPE_NAMES.length)]];
      const diligence = 0.4 + r() * 0.9;
      const w = seededRandom(`aktivitaet:${m.id}:${week}`);
      if (w() < 0.25) continue; // week skipped
      const hours = [];
      for (let day = 0; day < 7; day++) {
        const date = addDays(from, day);
        if (date > today) break;
        for (let h = 0; h < 24; h++) {
          if (date === today && h > currentHour) break;
          // Always roll, so the sequence on later days does not depend on the server start.
          const online = w() < type(h, day >= 5) * diligence;
          if (online && (serverStart === null || date >= serverStart)) hours.push(day * 24 + h);
        }
      }
      if (hours.length > 0) characters[String(m.id)] = hours;
      // Now and then someone comes back after a long break (for the title "Verlorener Sohn").
      // The break must have been possible at all since the server start.
      const comeback = seededRandom(`rueckkehr:${m.id}:${week}`);
      if (hours.length > 0 && comeback() < 0.05) {
        const pause = 14 + Math.floor(comeback() * 60);
        if (serverStart === null || addDays(from, -pause) >= serverStart) returns[String(m.id)] = pause;
      }
    }
    return { week, characters, ...(Object.keys(returns).length > 0 ? { returns } : {}), testdaten: true };
  });
}

/**
 * Daily snapshots for missing days: from the first day on, every character rises in random daily steps
 * to its current state. If the first day is the server start, it starts there at level 1, without a profession
 * and with all counters at 0; otherwise with a share of its current state.
 * Existing real snapshots stay untouched; generated values are never above the next and never below
 * the previous real snapshot.
 * @param {any[]} members MemberSummary
 * @param {string[]} days calendar days, ascending
 * @param {Map<string, any>} real existing DaySnapshots by date
 * @param {Record<string, any>} records character records by ID (for counter values)
 * @param {string | null} serverStart calendar day of the server start
 */
export function generateDailySnapshots(members, days, real, records = {}, serverStart = null) {
  const active = members.filter((m) => !m.former);
  const last = days[days.length - 1];
  const realDays = [...real.keys()].sort();
  const result = new Map();
  const fromZero = serverStart !== null && days[0] <= serverStart;

  // Per character, the share of the current state already reached on each day (0 to 1, rising).
  const progress = new Map();
  for (const m of active) {
    const r = seededRandom(`stand:${m.id}`);
    const rec = records[String(m.id)];
    const target = {
      level: m.level,
      deaths: m.deaths ?? rec?.stats?.deaths ?? Math.floor(5 + r() * 40),
      recipes: m.recipeCount ?? rec?.professions?.reduce((n, p) => n + (p.recipes?.length ?? 0), 0) ?? Math.floor(r() * 40),
      dungeons: m.dungeonsEntered ?? rec?.stats?.dungeonsEntered ?? Math.floor(r() * 12),
      achievements:
        m.achievementCount ?? rec?.instances?.achievements?.filter((a) => a.completed).length ?? Math.floor(10 + r() * 50),
      reputation: m.reputationTiers ?? rec?.reputations?.reduce((n, x) => n + (x.tier ?? 0), 0) ?? Math.floor(20 + r() * 40),
      ilvl: m.equippedItemLevel,
      professions: (m.professions ?? []).map((p) => [String(p.id), p.skill]),
    };
    const base = fromZero ? 0 : 0.3 + r() * 0.5;
    const playfulness = 0.45 + r() * 0.5;
    // Gain per day: on some days not played at all, on others a lot.
    const steps = days.map((day, i) => {
      if (i === 0) return 0;
      const t = seededRandom(`stand:${m.id}:${day}`);
      return t() < playfulness ? 0.3 + t() * 1.7 : 0;
    });
    const total = steps.reduce((a, b) => a + b, 0);
    let soFar = 0;
    const perDay = new Map();
    days.forEach((day, i) => {
      soFar += steps[i];
      const share = days.length === 1 ? 1 : total > 0 ? soFar / total : i / (days.length - 1);
      const f = base + (1 - base) * share;
      // The first levels come fast, deaths, dungeons and achievements pile up only later.
      const early = f ** 0.7;
      const late = f ** 1.3;
      const level = Math.max(1, Math.round(1 + (target.level - 1) * early));
      perDay.set(day, {
        level,
        deaths: Math.round(target.deaths * late),
        recipes: Math.round(target.recipes * f),
        dungeons: Math.round(target.dungeons * late),
        achievements: Math.round(target.achievements * late),
        reputation: Math.round(target.reputation * f),
        ilvl: target.ilvl === null || target.ilvl === undefined ? target.ilvl : Math.max(1, Math.round(target.ilvl * early)),
        professions: Object.fromEntries(target.professions.map(([id, skill]) => [id, Math.round(skill * f)]).filter(([, skill]) => skill >= 1)),
      });
    });
    progress.set(m.id, perDay);
  }

  for (const day of days) {
    if (real.has(day)) continue;
    const nextReal = realDays.find((d) => d > day);
    const previousReal = realDays.findLast((d) => d < day);
    const upperBound = nextReal ? real.get(nextReal) : null;
    const lowerBound = previousReal ? real.get(previousReal) : null;
    const characters = {};
    for (const m of active) {
      const s = progress.get(m.id).get(day);
      const ceiling = upperBound?.characters?.[String(m.id)];
      const floor = lowerBound?.characters?.[String(m.id)];
      const clamped = (value, field) => {
        const low = typeof floor?.[field] === "number" ? Math.max(value, floor[field]) : value;
        return typeof ceiling?.[field] === "number" ? Math.min(low, ceiling[field]) : low;
      };
      characters[String(m.id)] = {
        level: clamped(s.level, "level"),
        equippedItemLevel: s.ilvl ?? null,
        professions: s.professions,
        deaths: clamped(s.deaths, "deaths"),
        dungeons: clamped(s.dungeons, "dungeons"),
        recipes: clamped(s.recipes, "recipes"),
        achievements: clamped(s.achievements, "achievements"),
        reputation: clamped(s.reputation, "reputation"),
      };
    }
    result.set(day, { date: day, takenAt: `${day}T${day === last ? "08" : "21"}:00:00.000Z`, characters, testdaten: true });
  }
  return result;
}

/**
 * Guild weeks (5 completed ones and the current one, Sunday to Saturday) and all days from the Saturday before the
 * first one until today. Also the ISO weeks the activity of these days is stored in, and the first day
 * with logins (Sunday of the first week).
 * With a server start, everything begins there at the earliest: no week that ends before it and no day before it.
 * @param {string} nowIso
 * @param {string | null} serverStart calendar day of the server start
 */
export function timeSpan(nowIso, serverStart = null, completed = 5) {
  const today = berlinDate(nowIso);
  const current = guildWeek(today);
  const weeks = Array.from({ length: completed + 1 }, (_, i) => shiftGuildWeek(current, i - completed)).filter(
    (w) => serverStart === null || w >= serverStart,
  );
  const days = [];
  const weekStart = weeks.length > 0 ? guildRange(weeks[0]).from : today;
  let first = addDays(weekStart, -1);
  if (serverStart !== null && first < serverStart) first = serverStart;
  for (let d = first; d <= today; d = addDays(d, 1)) days.push(d);
  const loginsFrom = serverStart !== null && serverStart > weekStart ? serverStart : weekStart;
  return { weeks, activityWeeks: isoWeeksBetween(days[0], today), loginsFrom, days, today };
}

/**
 * Removes sample data from the time before the server start (daily snapshots, activity weeks and weekly results
 * that end before it). Real data stays. Returns the number of deleted entries.
 */
export async function removeSampleDataBefore(store, serverStart) {
  let removed = 0;
  const weeks = [];
  for (const prefix of ["history/", "activity/", "weekly/"]) {
    for (const key of await store.list(prefix)) {
      if (key === "weekly/index") continue;
      const name = key.slice(prefix.length);
      // Daily snapshots are named after their day, activity after ISO weeks, weekly results after guild or old ISO weeks.
      const end = prefix === "history/" ? name : prefix === "activity/" ? (isWeek(name) ? weekRange(name).to : null) : isWeekId(name) ? weekBounds(name).to : null;
      if (end === null || end >= serverStart) continue;
      if ((await store.get(key))?.testdaten !== true) continue;
      await store.delete(key);
      if (prefix === "weekly/") weeks.push(name);
      removed++;
    }
  }
  const index = await store.get("weekly/index");
  if (index && weeks.length > 0) await store.set("weekly/index", withoutWeeks(index, weeks));
  return removed;
}

/** Resource per class as at Blizzard (power type ID and name); all other classes use mana. */
const RESOURCE = { 1: { id: 1, name: "Wut" }, 4: { id: 3, name: "Energie" }, 6: { id: 6, name: "Runenmacht" } };
/** Main attribute per class: warrior, paladin, death knight strength; hunter, rogue agility; otherwise intellect. */
const MAIN_ATTRIBUTE = { 1: "strength", 2: "strength", 6: "strength", 3: "agility", 4: "agility" };

/**
 * Made-up attributes (the "Werte" view) for a character, in the shape of the record `attributes/<id>`.
 * Roughly by level and class, the same for the same ID. Carries `testdaten: true`.
 * @param {{ id: number, level: number, classId: number }} c
 * @param {string} nowIso
 */
export function generateAttributes(c, nowIso) {
  const r = seededRandom(`werte-${c.id}`);
  const L = Math.max(1, c.level);
  const main = MAIN_ATTRIBUTE[c.classId] ?? "intellect";
  const primary = (key) => {
    const base = Math.round(18 + L * (key === main ? 1.6 : 0.7) + r() * 6);
    return { base, effective: base + Math.round(L * (key === main ? 1.2 : 0.4) * r()) };
  };
  const strength = primary("strength");
  const agility = primary("agility");
  const intellect = primary("intellect");
  const stamina = primary("stamina");
  const spirit = primary("spirit");
  const resource = RESOURCE[c.classId] ?? { id: 0, name: "Mana" };
  const mana = resource.id === 0;
  const percent = (base) => ({ rating: 0, rating_bonus: 0, value: Math.round((base + r() * 4) * 100) / 100 });
  const armor = Math.round(L * (main === "strength" ? 45 : main === "agility" ? 22 : 12) * (0.8 + r() * 0.4));
  return {
    fetchedAt: nowIso,
    fields: {
      health: Math.round(stamina.effective * 10 + L * 18),
      power: mana ? intellect.effective * 15 + L * 20 : 100,
      strength,
      agility,
      intellect,
      stamina,
      spirit,
      attack_power: Math.round(strength.effective * 2 + (main === "agility" ? agility.effective : 0)),
      melee_crit: percent(main === "intellect" ? 1 : 4),
      ranged_crit: percent(main === "agility" ? 4 : 1),
      spell_power: mana ? Math.round(L * 1.5 * r()) : 0,
      spell_crit: percent(mana ? 3 : 0.5),
      ...(mana ? { mana_regen: Math.round(spirit.effective / 4 + 8), mana_regen_combat: Math.round(r() * L * 0.3) } : {}),
      armor: { base: armor, effective: armor + Math.round(agility.effective * 2) },
      dodge: percent(main === "agility" ? 5 : 2),
      parry: main === "strength" ? percent(5) : { rating: 0, rating_bonus: 0, value: 0 },
      block: c.classId === 1 || c.classId === 2 ? percent(4) : { rating: 0, rating_bonus: 0, value: 0 },
      fire_resistance: { base: 0, effective: r() < 0.3 ? Math.round(r() * 30) : 0 },
      shadow_resistance: { base: 0, effective: r() < 0.3 ? Math.round(r() * 30) : 0 },
    },
    powerType: resource,
    testdaten: true,
  };
}

/**
 * Fills the store with sample data. Real activity weeks and daily snapshots stay untouched.
 * Weekly results in the time span are deleted so the evaluation recomputes them.
 * With a server start nothing is created before it, and older sample data from before it is removed.
 * @param {any} store
 * @param {string} nowIso
 * @param {(line: string) => void} log
 * @param {string | null} serverStart calendar day of the server start
 */
export async function fillSampleData(store, nowIso, log = () => {}, serverStart = null) {
  const guild = await store.get("guild");
  if (!guild) throw new Error("No guild data yet. Run the collector once first (npm run collect:guild).");
  const { weeks, activityWeeks, loginsFrom, days } = timeSpan(nowIso, serverStart);
  if (serverStart !== null) {
    const old = await removeSampleDataBefore(store, serverStart);
    if (old > 0) log(`Removed ${old} sample data entries from before the server start (${serverStart}).`);
  }

  const records = {};
  let attributes = 0;
  for (const m of guild.members.filter((x) => !x.former && x.hasProfile)) {
    records[String(m.id)] = await store.get(`characters/${m.id}`);
    // Attributes only where the collector has not fetched any yet; real ones replace them on the next static run.
    if (!(await store.get(`attributes/${m.id}`))) {
      await store.set(`attributes/${m.id}`, generateAttributes(m, nowIso));
      attributes++;
    }
  }

  let activity = 0;
  for (const week of generateActivity(guild.members, activityWeeks, nowIso, loginsFrom)) {
    const existing = await store.get(`activity/${week.week}`);
    if (existing && !existing.testdaten) {
      log(`  activity/${week.week}: real recording exists, left unchanged`);
      continue;
    }
    await store.set(`activity/${week.week}`, week);
    activity++;
  }

  const real = new Map();
  for (const key of await store.list("history/")) {
    const snapshot = await store.get(key);
    if (snapshot && !snapshot.testdaten) real.set(key.slice("history/".length), snapshot);
  }
  const snapshots = generateDailySnapshots(guild.members, days, real, records, serverStart);
  for (const [day, snapshot] of snapshots) await store.set(`history/${day}`, snapshot);

  // Generated issues of old ISO weeks in the time span are dropped too, otherwise counting would only start after them.
  // Real old issues stay as on live; the evaluation then starts on the day after them.
  const oldWeeks = [];
  for (const w of ((await store.get("weekly/index")) ?? { weeks: [] }).weeks.filter((x) => isWeek(x) && weekRange(x).to >= days[0])) {
    if ((await store.get(`weekly/${w}`))?.testdaten === true) oldWeeks.push(w);
  }
  const deleted = await deleteWeeklyResults(store, [...oldWeeks, ...weeks]);
  log(`Wrote ${activity} activity weeks and ${snapshots.size} daily snapshots, ${real.size} real daily snapshots unchanged.`);
  log(`${attributes} characters with made-up attributes.`);
  log(`Removed ${deleted} weekly results for recomputation.`);
  return { activity, dailySnapshots: snapshots.size, weeks, attributes };
}

/** Index without the given weeks, including their archive entries. */
function withoutWeeks(index, weeks) {
  const entries = Object.fromEntries(Object.entries(index.entries ?? {}).filter(([w]) => !weeks.includes(w)));
  return { weeks: index.weeks.filter((w) => !weeks.includes(w)), ...(index.entries ? { entries } : {}) };
}

/**
 * Deletes weekly results (titles and newspaper) including their index entry, so the next weekly evaluation
 * recomputes them. Returns the number of deleted results.
 */
export async function deleteWeeklyResults(store, weeks) {
  const index = (await store.get("weekly/index")) ?? { weeks: [] };
  let deleted = 0;
  for (const w of weeks) {
    if (await store.get(`weekly/${w}`)) {
      await store.delete(`weekly/${w}`);
      deleted++;
    }
  }
  await store.set("weekly/index", withoutWeeks(index, weeks));
  return deleted;
}

/** Removes everything with `testdaten: true` (activity, daily snapshots, weekly results, attributes). */
export async function removeSampleData(store, log = () => {}) {
  let removed = 0;
  const weeks = [];
  for (const prefix of ["activity/", "history/", "weekly/", "attributes/"]) {
    for (const key of await store.list(prefix)) {
      if (key === "weekly/index") continue;
      const value = await store.get(key);
      if (value?.testdaten !== true) continue;
      await store.delete(key);
      if (prefix === "weekly/") weeks.push(key.slice("weekly/".length));
      removed++;
    }
  }
  const index = await store.get("weekly/index");
  if (index) await store.set("weekly/index", withoutWeeks(index, weeks));
  log(`Removed ${removed} sample data entries.`);
  return removed;
}
