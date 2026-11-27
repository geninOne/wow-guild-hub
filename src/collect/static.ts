/* eslint-disable @typescript-eslint/no-explicit-any -- raw API responses are untyped */
import type { BlizzardClient, Namespace } from "../blizzard/client";
import { INSTANCE_IMAGE_IDS } from "../instance-images";
import { PROFESSION_NAMES_DE } from "../transform/professions";
import { runPool } from "../lib/pool";
import type {
  AttributesIndex,
  CharacterIndex,
  CharacterIndexEntry,
  CharacterRecord,
  GuildRecord,
  InstanceAchievement,
  InstanceAchievementsRecord,
  NamedList,
  RecipeDetail,
  RecipeDetails,
  ReputationFactionsRecord,
  TalentTreeRecord,
} from "../model";
import type { JsonStore } from "../store";
import { toRecipeDetail } from "../transform/recipes";
import { toAttributes } from "../transform/attributes";
import { buildTalentTree, treeIdFromHref } from "../transform/talent-tree";
import { workEndOf } from "./budget";
import { CHARACTER_INDEX_KEY, toCharacterIndexEntry } from "./character-index";
import { ACCOUNT_WIDE_KEY } from "./roster";
import type { CollectDeps } from "./guild";

export interface StaticRunReport {
  at: string;
  treesAdded: number;
  spellIconsAdded: number;
  itemIconsAdded: number;
  /** Item levels from `/data/wow/item/{id}`, a substitute for the missing level in the equipment. */
  itemLevelsAdded: number;
  instanceAchievementsAdded: number;
  /** Achievements whose `is_account_wide` this run fetched. */
  accountWideAdded: number;
  recipesAdded: number;
  reputationGroupsChecked: number;
  instanceImagesAdded: number;
  professionIconsAdded: number;
  /** Characters whose attributes this run fetched ("Werte" view). */
  attributesFetched: number;
  /** Characters whose attributes are outdated but did not fit into the budget; they follow in the next run. */
  attributesPending: number;
  skipped: number;
  /** Characters without an entry in `character-index` that this run read itself. */
  charactersRead: number;
  /** Characters without an index entry for which the time limit of the preparation was not enough. */
  charactersUnread: number;
  /** Phases that did not start at all because of the time budget. */
  notStarted: string[];
  /** Duration per phase in milliseconds (prep, attributes, trees, spells, ... , finish). */
  phases: Record<string, number>;
  /** Another run held the lock; this one did nothing. */
  busy?: true;
  durationMs: number;
}

async function ensureList(client: BlizzardClient, store: JsonStore, key: string, path: string, field: string) {
  if (await store.get(key)) return;
  const res = await client.get(path, "static");
  if (res.status !== 200) return;
  const items = (res.data?.[field] ?? []).map((x: any) => ({ id: x.id, name: x.name }));
  await store.set(key, { items } satisfies NamedList);
}

/** Achievement categories with dungeons and raids. Subcategories (set achievements) are not included. */
export const INSTANCE_CATEGORIES: Record<number, InstanceAchievement["kind"]> = { 15593: "dungeon", 15594: "raid" };

const iconOf = (data: any): string | null => (data?.assets ?? []).find((a: any) => a.key === "icon")?.value ?? null;
const tileOf = (data: any): string | null => (data?.assets ?? []).find((a: any) => a.key === "tile")?.value ?? null;

/** New item levels per run; the first run has almost a thousand, and the budget also belongs to the other tables. */
const MAX_NEW_ITEM_LEVELS_PER_RUN = 300;
/** New achievement flags per run; the guild knows a good 80 achievements, the cap only protects the remaining budget. */
const MAX_NEW_ACCOUNT_WIDE_PER_RUN = 200;

/** Empty entries are requested again no earlier than after this time. */
export const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Recheck at most this many empty entries per table and run so new entries and later tables keep some budget. */
export const MAX_RETRIES_PER_RUN = 100;

/**
 * Empty entries that are due again: without a timestamp (older blobs) first, then those unchecked for the longest time.
 * `checked` is the side blob `<key>-checked` with the time of the last unsuccessful request per ID.
 */
export function retriesDue(
  ids: number[],
  isEmpty: (id: string) => boolean,
  checked: Record<string, string>,
  nowMs: number,
  limit = MAX_RETRIES_PER_RUN,
): number[] {
  const at = (id: number) => checked[String(id)] ?? "";
  return [...new Set(ids)]
    .filter((id) => {
      if (id <= 0 || !isEmpty(String(id))) return false;
      const last = Date.parse(at(id));
      return Number.isNaN(last) || nowMs - last >= RETRY_AFTER_MS;
    })
    .sort((a, b) => at(a).localeCompare(at(b)) || a - b)
    .slice(0, limit);
}

/**
 * Fetches missing entries of an ID table and rechecks empty entries after some time.
 * 404 or a response without a value is stored as null, with a timestamp in the side blob `<key>-checked`;
 * other errors leave the entry unchanged and are retried in the next run.
 * `seed` are already known values that are taken over without a request.
 */
async function fillMap<T>(
  deps: CollectDeps,
  key: string,
  ids: number[],
  pathFor: (id: number) => string,
  pick: (data: any) => T | null,
  deadline: number,
  opts: { ns?: Namespace; at: string; seed?: Record<string, T>; maxNew?: number },
): Promise<{ added: number; skipped: number }> {
  const checkedKey = `${key}-checked`;
  const [stored, storedChecked] = await Promise.all([
    deps.store.get<Record<string, T | null>>(key),
    deps.store.get<Record<string, string>>(checkedKey),
  ]);
  const map = stored ?? {};
  const checked = storedChecked ?? {};
  // Newly created tables are written even when empty, afterwards only on changes.
  let mapChanged = stored === null;
  let checkedChanged = false;
  for (const [id, value] of Object.entries(opts.seed ?? {})) {
    if (map[id] !== undefined && map[id] !== null) continue;
    map[id] = value;
    mapChanged = true;
    if (Object.hasOwn(checked, id)) {
      delete checked[id];
      checkedChanged = true;
    }
  }
  const missing = [...new Set(ids)].filter((id) => id > 0 && !Object.hasOwn(map, String(id))).slice(0, opts.maxNew);
  const retries = retriesDue(ids, (id) => Object.hasOwn(map, id) && map[id] === null, checked, Date.parse(opts.at));
  let added = 0;
  const pool = await runPool(
    [...missing, ...retries],
    async (id) => {
      const res = await deps.client.get(pathFor(id), opts.ns ?? "static");
      if (res.status !== 200 && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      const value = res.status === 200 ? pick(res.data) : null;
      map[String(id)] = value;
      if (value === null) checked[String(id)] = opts.at;
      else delete checked[String(id)];
      checkedChanged = true;
      added++;
    },
    { concurrency: deps.config.concurrency, deadline },
  );
  await Promise.all([
    mapChanged || added > 0 ? deps.store.set(key, map) : null,
    checkedChanged ? deps.store.set(checkedKey, checked) : null,
  ]);
  return { added, skipped: pool.skipped.length };
}

/** Recipes with gaps: not available, without an icon, or with a crafted item without details. */
function recipeIncomplete(detail: RecipeDetail | null | undefined): boolean {
  return detail === null || detail === undefined || detail.icon === null || (detail.item !== null && detail.item.tooltip === null);
}

/** Up to three requests per recipe; fewer rechecks per run than for the simple tables. */
const MAX_RECIPE_RETRIES_PER_RUN = 30;

/**
 * Recipe details: per recipe the recipe, icon and crafted item. One error leaves the whole recipe open.
 * Recipes with gaps are requested again after some time, like the icons (side blob `static/recipes-checked`).
 */
async function fillRecipes(
  deps: CollectDeps,
  ids: number[],
  deadline: number,
  at: string,
): Promise<{ map: RecipeDetails; added: number; skipped: number }> {
  const key = "static/recipes";
  const checkedKey = `${key}-checked`;
  const [storedMap, storedChecked] = await Promise.all([
    deps.store.get<RecipeDetails>(key),
    deps.store.get<Record<string, string>>(checkedKey),
  ]);
  const map = storedMap ?? {};
  const checked = storedChecked ?? {};
  const missing = [...new Set(ids)].filter((id) => id > 0 && !Object.hasOwn(map, String(id)));
  const retries = retriesDue(
    ids,
    (id) => Object.hasOwn(map, id) && recipeIncomplete(map[id]),
    checked,
    Date.parse(at),
    MAX_RECIPE_RETRIES_PER_RUN,
  );
  const ok = (status: number) => {
    if (status !== 200 && status !== 404) throw new Error(`HTTP ${status}`);
    return status === 200;
  };
  let added = 0;
  const pool = await runPool(
    [...missing, ...retries],
    async (id) => {
      const recipe = await deps.client.get(`/data/wow/recipe/${id}`, "static");
      let detail: RecipeDetail | null;
      if (!ok(recipe.status)) {
        // A previously stored recipe is kept if it is not available now.
        detail = map[String(id)] ?? null;
      } else {
        const itemId = recipe.data?.crafted_item?.id;
        const [media, item] = await Promise.all([
          deps.client.get(`/data/wow/media/recipe/${id}`, "static"),
          itemId ? deps.client.get(`/data/wow/item/${itemId}`, "static") : Promise.resolve(null),
        ]);
        const icon = ok(media.status) ? iconOf(media.data) : null;
        const itemData = item && ok(item.status) ? item.data : null;
        detail = toRecipeDetail(recipe.data, icon, itemData);
      }
      map[String(id)] = detail;
      if (recipeIncomplete(detail)) checked[String(id)] = at;
      else delete checked[String(id)];
      added++;
    },
    { concurrency: deps.config.concurrency, deadline },
  );
  if (added > 0) await Promise.all([deps.store.set(key, map), deps.store.set(checkedKey, checked)]);
  return { map, added, skipped: pool.skipped.length };
}

function toInstanceAchievement(raw: any, kind: InstanceAchievement["kind"], order: number): InstanceAchievement {
  return {
    id: raw.id,
    name: raw.name ?? "",
    kind,
    order,
    rootDescription: raw.criteria?.description ?? null,
    criteria: (raw.criteria?.child_criteria ?? []).map((c: any) => ({ id: c.id, description: c.description ?? "" })),
  };
}

/** Loads missing definitions of dungeon and raid achievements; the categories themselves every time (two requests). */
async function fillInstanceAchievements(deps: CollectDeps, deadline: number): Promise<{ added: number; skipped: number }> {
  const key = "static/instance-achievements";
  const categories = Object.entries(INSTANCE_CATEGORIES);
  const [record, ...responses] = await Promise.all([
    deps.store.get<InstanceAchievementsRecord>(key),
    ...categories.map(([categoryId]) => deps.client.get(`/data/wow/achievement-category/${categoryId}`, "static")),
  ]);
  const stored = (record as InstanceAchievementsRecord | null)?.achievements ?? [];
  const known = new Map(stored.map((a) => [a.id, a]));
  const wanted: { id: number; kind: InstanceAchievement["kind"]; order: number }[] = [];
  categories.forEach(([, kind], i) => {
    const res = responses[i] as { status: number; data: any };
    if (res.status !== 200) return;
    (res.data?.achievements ?? []).forEach((a: any, order: number) => wanted.push({ id: a.id, kind, order }));
  });
  let added = 0;
  const pool = await runPool(
    wanted.filter((w) => !known.has(w.id)),
    async (w) => {
      const res = await deps.client.get(`/data/wow/achievement/${w.id}`, "static");
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      known.set(w.id, toInstanceAchievement(res.data, w.kind, w.order));
      added++;
    },
    { concurrency: deps.config.concurrency, deadline },
  );
  if (added > 0) {
    // Order of the categories; entries Blizzard no longer lists are kept at the end.
    const listed = wanted.flatMap((w) => (known.has(w.id) ? [known.get(w.id)!] : []));
    const rest = [...known.values()].filter((a) => !wanted.some((w) => w.id === a.id));
    await deps.store.set(key, { achievements: [...listed, ...rest] } satisfies InstanceAchievementsRecord);
  }
  return { added, skipped: pool.skipped.length };
}

/** Faction names on every run from the index (one request), groups incrementally from the root factions. */
async function fillReputationFactions(deps: CollectDeps, deadline: number): Promise<{ checked: number; skipped: number }> {
  const key = "static/reputation-factions";
  const [res, prev] = await Promise.all([
    deps.client.get("/data/wow/reputation-faction/index", "static"),
    deps.store.get<ReputationFactionsRecord>(key),
  ]);
  if (res.status !== 200) return { checked: 0, skipped: 0 };
  const names: Record<string, string> = {};
  for (const f of res.data?.factions ?? []) if (typeof f?.name === "string") names[String(f.id)] = f.name;
  const roots: number[] = (res.data?.root_factions ?? []).map((f: any) => f.id);
  const checked = new Set(prev?.checkedRoots ?? []);
  const groups = new Map((prev?.groups ?? []).map((g) => [g.id, g]));
  let added = 0;
  const pool = await runPool(
    roots.filter((id) => !checked.has(id)),
    async (id) => {
      const detail = await deps.client.get(`/data/wow/reputation-faction/${id}`, "static");
      if (detail.status === 200) {
        const children: number[] = (detail.data?.factions ?? []).map((f: any) => f.id);
        if (children.length > 0) groups.set(id, { id, name: detail.data?.name ?? names[String(id)] ?? "", factionIds: children });
      } else if (detail.status !== 404) {
        throw new Error(`HTTP ${detail.status}`);
      }
      checked.add(id);
      added++;
    },
    { concurrency: deps.config.concurrency, deadline },
  );
  const ordered = [
    ...roots.flatMap((id) => (groups.has(id) ? [groups.get(id)!] : [])),
    ...[...groups.values()].filter((g) => !roots.includes(g.id)),
  ];
  const next: ReputationFactionsRecord = { names, groups: ordered, checkedRoots: [...checked] };
  // The index is fetched every time; only what changed is written.
  if (JSON.stringify(next) !== JSON.stringify(prev)) await deps.store.set(key, next);
  return { checked: added, skipped: pool.skipped.length };
}

/** What the collector knows about a character to decide whether its attributes are fetched again. */
interface AttributeCandidate {
  id: number;
  slug: string;
  lastLoginAt: string | null;
}

/**
 * Characters whose attributes are missing or who logged in since the last fetch; only then do attributes change.
 * Missing ones first, then the oldest; whatever does not fit into the budget is handled in the next run.
 */
export function attributesDue(candidates: AttributeCandidate[], index: AttributesIndex): AttributeCandidate[] {
  const fetched = (c: AttributeCandidate) => index[String(c.id)] ?? "";
  return candidates
    .filter((c) => {
      const at = fetched(c);
      return at === "" || (c.lastLoginAt !== null && c.lastLoginAt > at);
    })
    .sort((a, b) => fetched(a).localeCompare(fetched(b)) || a.id - b.id);
}

/**
 * Share of the work time that goes to the character attributes first, as long as attributes are due.
 * Then come the catch-up tasks (icons, recipes, item levels, empty entries) with everything that is left,
 * and finally the attributes once more with the rest. This way the attributes make progress in every run.
 */
export const ATTRIBUTES_BUDGET_SHARE = 0.4;

/** Maximum share of the budget for reading characters without an index entry. */
export const BOOTSTRAP_SHARE = 0.25;
/** Concurrent blob reads when reading the characters. */
const BOOTSTRAP_CONCURRENCY = 20;

const ATTRIBUTES_INDEX_KEY = "attributes/index";

/** Lock against overlapping runs when Netlify starts a slow run a second time. */
export const LOCK_KEY = "locks/collect-static";
/** After this time a lock counts as orphaned (crashed run) and is ignored. */
export const LOCK_TTL_MS = 60_000;

interface RunLock {
  startedAt: string;
  until: string;
}

/**
 * Attributes (`/statistics`) per character into own blobs `attributes/<id>`, staggered over the runs every four hours.
 * 404 is stored as a record without fields so the character is only due again after the next login.
 * `due` comes from `attributesDue`: characters without attributes first, then the oldest due updates.
 * Returns how many were fetched and which stayed open because of the deadline.
 */
async function fillAttributes(
  deps: CollectDeps,
  due: AttributeCandidate[],
  index: AttributesIndex,
  deadline: number,
  at: string,
): Promise<{ fetched: number; open: AttributeCandidate[] }> {
  let fetched = 0;
  const pool = await runPool(
    due,
    async (c) => {
      const path = `/profile/wow/character/${encodeURIComponent(c.slug)}/statistics`;
      const res = await deps.client.get(path, "profile");
      if (res.status === 200) {
        await deps.store.set(`attributes/${c.id}`, toAttributes(res.data, at));
      } else if (res.status === 404) {
        // Existing attributes are kept; only a record without attributes is created.
        if (!(await deps.store.get(`attributes/${c.id}`))) {
          await deps.store.set(`attributes/${c.id}`, { fetchedAt: at, fields: null, powerType: null });
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
      index[String(c.id)] = at;
      fetched++;
    },
    { concurrency: deps.config.concurrency, deadline },
  );
  return { fetched, open: pool.skipped };
}

/** What the run needs from the characters: items, levels, recipes and candidates for the attributes. */
interface CharacterScan {
  itemIds: number[];
  equippedIds: number[];
  knownLevels: Record<string, number>;
  recipeIds: number[];
  /** Completed achievements of all characters, for `is_account_wide`. */
  achievementIds: number[];
  attributeCandidates: AttributeCandidate[];
  /** Characters without an index entry that this run read itself. */
  read: number;
  /** Characters without an index entry for which the time was not enough; they are missing in this run. */
  unread: number;
}

/**
 * Collects the data from `character-index` (maintained by `collect-guild`). Only characters without an entry, e.g.
 * right after the update, are read from `characters/<id>`, in parallel and with their own time limit.
 */
async function scanCharacters(
  deps: CollectDeps,
  keys: string[],
  index: CharacterIndex,
  active: Set<number>,
  deadline: number,
): Promise<CharacterScan> {
  const entries: [number, CharacterIndexEntry][] = [];
  const missing: string[] = [];
  for (const key of keys) {
    const id = Number(key.slice("characters/".length));
    const entry = index[String(id)];
    if (entry) entries.push([id, entry]);
    else missing.push(key);
  }
  const pool = await runPool(
    missing,
    async (key) => {
      const rec = await deps.store.get<CharacterRecord>(key);
      if (rec) entries.push([rec.id, toCharacterIndexEntry(rec)]);
    },
    { concurrency: BOOTSTRAP_CONCURRENCY, deadline },
  );
  const scan: CharacterScan = {
    itemIds: [],
    equippedIds: [],
    knownLevels: {},
    recipeIds: [],
    achievementIds: [],
    attributeCandidates: [],
    read: pool.completed.length,
    unread: pool.skipped.length + pool.failed.length,
  };
  // Fixed order so characters read in parallel do not reorder the results.
  entries.sort((a, b) => a[0] - b[0]);
  for (const [id, e] of entries) {
    scan.itemIds.push(...e.itemIds);
    scan.equippedIds.push(...e.itemIds);
    Object.assign(scan.knownLevels, e.itemLevels);
    scan.recipeIds.push(...e.recipeIds);
    scan.achievementIds.push(...(e.achievementIds ?? []));
    if (e.hasProfile && active.has(id)) scan.attributeCandidates.push({ id, slug: e.slug, lastLoginAt: e.lastLoginAt });
  }
  return scan;
}

const emptyReport = (at: string): StaticRunReport => ({
  at,
  treesAdded: 0,
  spellIconsAdded: 0,
  itemIconsAdded: 0,
  itemLevelsAdded: 0,
  instanceAchievementsAdded: 0,
  accountWideAdded: 0,
  recipesAdded: 0,
  reputationGroupsChecked: 0,
  instanceImagesAdded: 0,
  professionIconsAdded: 0,
  attributesFetched: 0,
  attributesPending: 0,
  skipped: 0,
  charactersRead: 0,
  charactersUnread: 0,
  notStarted: [],
  phases: {},
  durationMs: 0,
});

export async function runStaticCollection(deps: CollectDeps): Promise<StaticRunReport> {
  const { client, store, config } = deps;
  const started = Date.now();
  /** From here on nothing new starts; afterwards only running requests and the writes at the end. */
  const workEnd = workEndOf(started, config.budgetMs);
  const at = deps.now().toISOString();
  const report = emptyReport(at);
  const phases = report.phases;

  /** Measures a phase; if it would only start after `deadline`, it is skipped and noted in `notStarted`. */
  async function phase<T>(name: string, deadline: number, fallback: T, fn: () => Promise<T>): Promise<T> {
    if (Date.now() >= deadline) {
      report.notStarted.push(name);
      return fallback;
    }
    const t = Date.now();
    try {
      return await fn();
    } finally {
      phases[name] = Date.now() - t;
    }
  }

  // Preparation: everything the run needs from the store, in one go.
  let t = Date.now();
  const [lock, guild, characterIndex, attributesIndexStored, characterKeys, treeIndexStored] = await Promise.all([
    store.get<RunLock>(LOCK_KEY),
    store.get<GuildRecord>("guild"),
    store.get<CharacterIndex>(CHARACTER_INDEX_KEY),
    store.get<AttributesIndex>(ATTRIBUTES_INDEX_KEY),
    store.list("characters/"),
    store.get<Record<string, number>>("static/talent-trees/index"),
  ]);
  if (lock && Date.parse(lock.until) > Date.now()) {
    // Another run is still working (Netlify restarted); this one ends right away without writing anything.
    phases.prep = Date.now() - t;
    return { ...report, busy: true, durationMs: Date.now() - started };
  }
  await store.set(LOCK_KEY, { startedAt: at, until: new Date(Date.now() + LOCK_TTL_MS).toISOString() } satisfies RunLock);
  try {
    const active = new Set((guild?.members ?? []).filter((m) => !m.former).map((m) => m.id));
    const scan = await scanCharacters(
      deps,
      characterKeys,
      characterIndex ?? {},
      active,
      started + Math.floor(config.budgetMs * BOOTSTRAP_SHARE),
    );
    report.charactersRead = scan.read;
    report.charactersUnread = scan.unread;
    const { itemIds, equippedIds, knownLevels, recipeIds } = scan;
    const attributesIndex = attributesIndexStored ?? {};
    const attributesToFetch = attributesDue(scan.attributeCandidates, attributesIndex);
    phases.prep = Date.now() - t;

    // First the attributes with their share of the remaining work time.
    let attributesFetched = 0;
    let attributesOpen = attributesToFetch;
    if (attributesToFetch.length > 0) {
      // Measured from now so a long preparation does not eat up the attributes' share.
      const from = Date.now();
      const share = from + Math.floor((workEnd - from) * ATTRIBUTES_BUDGET_SHARE);
      const first = await phase("attributes", workEnd, null, () =>
        fillAttributes(deps, attributesToFetch, attributesIndex, Math.min(share, workEnd), at),
      );
      if (first) {
        attributesFetched += first.fetched;
        attributesOpen = first.open;
      }
    }

    // Classes, races and talent trees: once per class tree, with all its spec trees.
    const treeIndex = treeIndexStored ?? {};
    let treesSkipped = 0;
    await phase("trees", workEnd, null, async () => {
      const [, , indexRes] = await Promise.all([
        ensureList(client, store, "static/classes", "/data/wow/playable-class/index", "classes"),
        ensureList(client, store, "static/races", "/data/wow/playable-race/index", "races"),
        client.get("/data/wow/talent-tree/index", "static"),
      ]);
      if (indexRes.status !== 200) return null;
      const specHrefs: string[] = (indexRes.data?.spec_talent_trees ?? []).map((s: any) => s.key?.href ?? "");
      const treeIds: number[] = (indexRes.data?.class_talent_trees ?? []).map((tr: any) => treeIdFromHref(tr.key?.href ?? ""));
      const stored = await Promise.all(treeIds.map((id) => store.get(`static/talent-trees/${id}`)));
      for (const [i, treeId] of treeIds.entries()) {
        if (stored[i]) continue;
        if (Date.now() >= workEnd) {
          treesSkipped++;
          continue;
        }
        const classRes = await client.get(`/data/wow/talent-tree/${treeId}`, "static");
        const specResults = await Promise.all(
          specHrefs.filter((h) => treeIdFromHref(h) === treeId).map((h) => client.get(h, "static")),
        );
        if (classRes.status !== 200 || specResults.length === 0 || specResults.some((r) => r.status !== 200)) continue;
        const tree = buildTalentTree(classRes.data, specResults.map((r) => r.data));
        await store.set(`static/talent-trees/${treeId}`, tree);
        treeIndex[String(tree.classId)] = treeId;
        report.treesAdded++;
      }
      if (report.treesAdded > 0) await store.set("static/talent-trees/index", treeIndex);
      return null;
    });

    const none = { added: 0, skipped: 0 };
    // Spell icons for all talents of all stored trees.
    const spells = await phase("spells", workEnd, none, async () => {
      const trees = await Promise.all(
        Object.values(treeIndex).map((treeId) => store.get<TalentTreeRecord>(`static/talent-trees/${treeId}`)),
      );
      const spellIds: number[] = [];
      for (const tree of trees) for (const spec of tree?.specs ?? []) for (const n of spec.nodes) if (n.spellId) spellIds.push(n.spellId);
      return fillMap(deps, "static/spell-icons", spellIds, (id) => `/data/wow/media/spell/${id}`, iconOf, workEnd, { at });
    });

    // Recipe details and item icons for everything guild members wear, know and craft with.
    const recipes = await phase("recipes", workEnd, { map: {} as RecipeDetails, ...none }, () =>
      fillRecipes(deps, recipeIds, workEnd, at),
    );
    for (const r of Object.values(recipes.map)) for (const reagent of r?.reagents ?? []) itemIds.push(reagent.id);
    const items = await phase("items", workEnd, none, () =>
      fillMap(deps, "static/item-icons", itemIds, (id) => `/data/wow/media/item/${id}`, iconOf, workEnd, { at }),
    );
    // Since 2026-11-25 the equipment of freshly logged-in characters lacks the level; substitute from the item itself.
    const levels = await phase("levels", workEnd, none, () =>
      fillMap(
        deps,
        "static/item-levels",
        equippedIds.filter((id) => !Object.hasOwn(knownLevels, String(id))),
        (id) => `/data/wow/item/${id}`,
        (data) => (typeof data?.level === "number" ? data.level : null),
        workEnd,
        { at, seed: knownLevels, maxNew: MAX_NEW_ITEM_LEVELS_PER_RUN },
      ),
    );
    const instances = await phase("instances", workEnd, none, () => fillInstanceAchievements(deps, workEnd));
    // Every alt inherits account-wide achievements; the guild collector therefore does not count them as its own.
    const accountWide = await phase("accountWide", workEnd, none, () =>
      fillMap(
        deps,
        ACCOUNT_WIDE_KEY,
        scan.achievementIds,
        (id) => `/data/wow/achievement/${id}`,
        (data) => (typeof data?.is_account_wide === "boolean" ? data.is_account_wide : null),
        workEnd,
        { at, maxNew: MAX_NEW_ACCOUNT_WIDE_PER_RUN },
      ),
    );
    const reputation = await phase("reputation", workEnd, { checked: 0, skipped: 0 }, () => fillReputationFactions(deps, workEnd));
    const professionIcons = await phase("professions", workEnd, none, () =>
      fillMap(
        deps,
        "static/profession-icons",
        Object.keys(PROFESSION_NAMES_DE).map(Number),
        (id) => `/data/wow/media/profession/${id}`,
        iconOf,
        workEnd,
        { at },
      ),
    );
    const images = await phase("images", workEnd, none, () =>
      fillMap(
        deps,
        "static/instance-images",
        INSTANCE_IMAGE_IDS,
        (id) => `/data/wow/media/journal-instance/${id}`,
        tileOf,
        workEnd,
        { at, ns: "static-retail" },
      ),
    );

    // Finally the remaining attributes with everything the catch-up tasks leave over.
    if (attributesOpen.length > 0) {
      const rest = await phase("attributesRest", workEnd, null, () =>
        fillAttributes(deps, attributesOpen, attributesIndex, workEnd, at),
      );
      if (rest) {
        attributesFetched += rest.fetched;
        attributesOpen = rest.open;
      }
    }
    t = Date.now();
    if (attributesFetched > 0) await store.set(ATTRIBUTES_INDEX_KEY, attributesIndex);
    phases.finish = Date.now() - t;

    report.spellIconsAdded = spells.added;
    report.itemIconsAdded = items.added;
    report.itemLevelsAdded = levels.added;
    report.instanceAchievementsAdded = instances.added;
    report.accountWideAdded = accountWide.added;
    report.recipesAdded = recipes.added;
    report.reputationGroupsChecked = reputation.checked;
    report.instanceImagesAdded = images.added;
    report.professionIconsAdded = professionIcons.added;
    report.attributesFetched = attributesFetched;
    report.attributesPending = attributesToFetch.length - attributesFetched;
    report.skipped =
      treesSkipped +
      spells.skipped +
      items.skipped +
      levels.skipped +
      recipes.skipped +
      instances.skipped +
      accountWide.skipped +
      reputation.skipped +
      images.skipped +
      professionIcons.skipped;
  } finally {
    await store.delete(LOCK_KEY).catch(() => undefined);
  }
  report.durationMs = Date.now() - started;
  return report;
}
