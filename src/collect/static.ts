/* eslint-disable @typescript-eslint/no-explicit-any -- Rohantworten der API sind untypisiert */
import type { BlizzardClient, Namespace } from "../blizzard/client";
import { INSTANCE_IMAGE_IDS } from "../instance-images";
import { PROFESSION_NAMES_DE } from "../transform/professions";
import { runPool } from "../lib/pool";
import type {
  CharacterRecord,
  IconMap,
  InstanceAchievement,
  InstanceAchievementsRecord,
  NamedList,
  RecipeDetails,
  ReputationFactionsRecord,
  TalentTreeRecord,
} from "../model";
import type { JsonStore } from "../store";
import { toRecipeDetail } from "../transform/recipes";
import { buildTalentTree, treeIdFromHref } from "../transform/talent-tree";
import type { CollectDeps } from "./guild";

export interface StaticRunReport {
  at: string;
  treesAdded: number;
  spellIconsAdded: number;
  itemIconsAdded: number;
  instanceAchievementsAdded: number;
  recipesAdded: number;
  reputationGroupsChecked: number;
  instanceImagesAdded: number;
  professionIconsAdded: number;
  skipped: number;
  durationMs: number;
}

async function ensureList(client: BlizzardClient, store: JsonStore, key: string, path: string, field: string) {
  if (await store.get(key)) return;
  const res = await client.get(path, "static");
  if (res.status !== 200) return;
  const items = (res.data?.[field] ?? []).map((x: any) => ({ id: x.id, name: x.name }));
  await store.set(key, { items } satisfies NamedList);
}

/** Erfolgskategorien mit Dungeons und Schlachtzügen. Unterkategorien (Set-Erfolge) gehören nicht dazu. */
export const INSTANCE_CATEGORIES: Record<number, InstanceAchievement["kind"]> = { 15593: "dungeon", 15594: "raid" };

const iconOf = (data: any): string | null => (data?.assets ?? []).find((a: any) => a.key === "icon")?.value ?? null;
const tileOf = (data: any): string | null => (data?.assets ?? []).find((a: any) => a.key === "tile")?.value ?? null;

/** Holt fehlende Einträge einer ID-Tabelle; 404 wird als null gespeichert, andere Fehler beim nächsten Lauf erneut versucht. */
async function fillMap(
  deps: CollectDeps,
  key: string,
  ids: number[],
  pathFor: (id: number) => string,
  pick: (data: any) => string | null,
  deadline: number,
  ns: Namespace = "static",
): Promise<{ added: number; skipped: number }> {
  const map = (await deps.store.get<IconMap>(key)) ?? {};
  const missing = [...new Set(ids)].filter((id) => id > 0 && !Object.hasOwn(map, String(id)));
  let added = 0;
  const pool = await runPool(
    missing,
    async (id) => {
      const res = await deps.client.get(pathFor(id), ns);
      if (res.status === 200) {
        map[String(id)] = pick(res.data);
      } else if (res.status === 404) {
        map[String(id)] = null;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
      added++;
    },
    { concurrency: deps.config.concurrency, deadline },
  );
  await deps.store.set(key, map);
  return { added, skipped: pool.skipped.length };
}

/** Rezeptdetails: je Rezept Rezept, Icon und hergestellter Gegenstand. Ein Fehler lässt das ganze Rezept offen. */
async function fillRecipes(deps: CollectDeps, ids: number[], deadline: number): Promise<{ map: RecipeDetails; added: number; skipped: number }> {
  const key = "static/recipes";
  const map = (await deps.store.get<RecipeDetails>(key)) ?? {};
  const missing = [...new Set(ids)].filter((id) => id > 0 && !Object.hasOwn(map, String(id)));
  const ok = (status: number) => {
    if (status !== 200 && status !== 404) throw new Error(`HTTP ${status}`);
    return status === 200;
  };
  let added = 0;
  const pool = await runPool(
    missing,
    async (id) => {
      const recipe = await deps.client.get(`/data/wow/recipe/${id}`, "static");
      if (!ok(recipe.status)) {
        map[String(id)] = null;
      } else {
        const itemId = recipe.data?.crafted_item?.id;
        const [media, item] = await Promise.all([
          deps.client.get(`/data/wow/media/recipe/${id}`, "static"),
          itemId ? deps.client.get(`/data/wow/item/${itemId}`, "static") : Promise.resolve(null),
        ]);
        const icon = ok(media.status) ? iconOf(media.data) : null;
        const itemData = item && ok(item.status) ? item.data : null;
        map[String(id)] = toRecipeDetail(recipe.data, icon, itemData);
      }
      added++;
    },
    { concurrency: deps.config.concurrency, deadline },
  );
  if (added > 0) await deps.store.set(key, map);
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

/** Lädt fehlende Definitionen der Dungeon- und Raid-Erfolge; die Kategorien selbst jedes Mal (zwei Anfragen). */
async function fillInstanceAchievements(deps: CollectDeps, deadline: number): Promise<{ added: number; skipped: number }> {
  const key = "static/instance-achievements";
  const stored = (await deps.store.get<InstanceAchievementsRecord>(key))?.achievements ?? [];
  const known = new Map(stored.map((a) => [a.id, a]));
  const wanted: { id: number; kind: InstanceAchievement["kind"]; order: number }[] = [];
  for (const [categoryId, kind] of Object.entries(INSTANCE_CATEGORIES)) {
    const res = await deps.client.get(`/data/wow/achievement-category/${categoryId}`, "static");
    if (res.status !== 200) continue;
    (res.data?.achievements ?? []).forEach((a: any, order: number) => wanted.push({ id: a.id, kind, order }));
  }
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
    // Reihenfolge der Kategorien; Einträge, die Blizzard nicht mehr listet, bleiben am Ende erhalten.
    const listed = wanted.flatMap((w) => (known.has(w.id) ? [known.get(w.id)!] : []));
    const rest = [...known.values()].filter((a) => !wanted.some((w) => w.id === a.id));
    await deps.store.set(key, { achievements: [...listed, ...rest] } satisfies InstanceAchievementsRecord);
  }
  return { added, skipped: pool.skipped.length };
}

/** Fraktionsnamen bei jedem Lauf aus dem Verzeichnis (eine Anfrage), Gruppen inkrementell aus den Wurzelfraktionen. */
async function fillReputationFactions(deps: CollectDeps, deadline: number): Promise<{ checked: number; skipped: number }> {
  const key = "static/reputation-factions";
  const res = await deps.client.get("/data/wow/reputation-faction/index", "static");
  if (res.status !== 200) return { checked: 0, skipped: 0 };
  const prev = await deps.store.get<ReputationFactionsRecord>(key);
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
  await deps.store.set(key, { names, groups: ordered, checkedRoots: [...checked] } satisfies ReputationFactionsRecord);
  return { checked: added, skipped: pool.skipped.length };
}

export async function runStaticCollection(deps: CollectDeps): Promise<StaticRunReport> {
  const { client, store, config } = deps;
  const started = Date.now();
  const deadline = started + config.budgetMs;
  const at = deps.now().toISOString();
  let skipped = 0;

  await ensureList(client, store, "static/classes", "/data/wow/playable-class/index", "classes");
  await ensureList(client, store, "static/races", "/data/wow/playable-race/index", "races");

  // Talentbäume: je Klassenbaum einmal, mit allen zugehörigen Spec-Bäumen.
  let treesAdded = 0;
  const treeIndex = (await store.get<Record<string, number>>("static/talent-trees/index")) ?? {};
  const indexRes = await client.get("/data/wow/talent-tree/index", "static");
  if (indexRes.status === 200) {
    const specHrefs: string[] = (indexRes.data?.spec_talent_trees ?? []).map((s: any) => s.key?.href ?? "");
    for (const t of indexRes.data?.class_talent_trees ?? []) {
      const treeId = treeIdFromHref(t.key?.href ?? "");
      if (await store.get(`static/talent-trees/${treeId}`)) continue;
      if (Date.now() >= deadline) {
        skipped++;
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
      treesAdded++;
    }
    if (treesAdded > 0) await store.set("static/talent-trees/index", treeIndex);
  }

  // Zauber-Icons für alle Talente aller gespeicherten Bäume.
  const spellIds: number[] = [];
  for (const treeId of Object.values(treeIndex)) {
    const tree = await store.get<TalentTreeRecord>(`static/talent-trees/${treeId}`);
    for (const spec of tree?.specs ?? []) for (const n of spec.nodes) if (n.spellId) spellIds.push(n.spellId);
  }
  const spells = await fillMap(deps, "static/spell-icons", spellIds, (id) => `/data/wow/media/spell/${id}`, iconOf, deadline);

  // Rezeptdetails und Gegenstands-Icons für alles, was Gildenmitglieder tragen, kennen und verarbeiten.
  const itemIds: number[] = [];
  const recipeIds: number[] = [];
  for (const key of await store.list("characters/")) {
    const rec = await store.get<CharacterRecord>(key);
    for (const item of rec?.equipment ?? []) if (item.itemId) itemIds.push(item.itemId);
    for (const p of rec?.professions ?? []) recipeIds.push(...(p.recipeIds ?? []));
  }
  const recipes = await fillRecipes(deps, recipeIds, deadline);
  for (const r of Object.values(recipes.map)) for (const reagent of r?.reagents ?? []) itemIds.push(reagent.id);
  const items = await fillMap(deps, "static/item-icons", itemIds, (id) => `/data/wow/media/item/${id}`, iconOf, deadline);
  const instances = await fillInstanceAchievements(deps, deadline);
  const reputation = await fillReputationFactions(deps, deadline);
  const professionIcons = await fillMap(
    deps,
    "static/profession-icons",
    Object.keys(PROFESSION_NAMES_DE).map(Number),
    (id) => `/data/wow/media/profession/${id}`,
    iconOf,
    deadline,
  );
  const images = await fillMap(
    deps,
    "static/instance-images",
    INSTANCE_IMAGE_IDS,
    (id) => `/data/wow/media/journal-instance/${id}`,
    tileOf,
    deadline,
    "static-retail",
  );

  return {
    at,
    treesAdded,
    spellIconsAdded: spells.added,
    itemIconsAdded: items.added,
    instanceAchievementsAdded: instances.added,
    recipesAdded: recipes.added,
    reputationGroupsChecked: reputation.checked,
    instanceImagesAdded: images.added,
    professionIconsAdded: professionIcons.added,
    skipped:
      skipped +
      spells.skipped +
      items.skipped +
      recipes.skipped +
      instances.skipped +
      reputation.skipped +
      images.skipped +
      professionIcons.skipped,
    durationMs: Date.now() - started,
  };
}
