/* eslint-disable @typescript-eslint/no-explicit-any -- Rohantworten der API sind untypisiert */
import type { BlizzardClient, Namespace } from "../blizzard/client";
import { INSTANCE_IMAGE_IDS } from "../instance-images";
import { PROFESSION_NAMES_DE } from "../transform/professions";
import { runPool } from "../lib/pool";
import type {
  AttributesIndex,
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
import type { CollectDeps } from "./guild";

export interface StaticRunReport {
  at: string;
  treesAdded: number;
  spellIconsAdded: number;
  itemIconsAdded: number;
  /** Gegenstandsstufen aus `/data/wow/item/{id}`, Ersatz für die fehlende Stufe in der Ausrüstung. */
  itemLevelsAdded: number;
  instanceAchievementsAdded: number;
  recipesAdded: number;
  reputationGroupsChecked: number;
  instanceImagesAdded: number;
  professionIconsAdded: number;
  /** Charaktere, deren Werte dieser Lauf geholt hat (Ansicht "Werte"). */
  attributesFetched: number;
  /** Charaktere, deren Werte veraltet sind, aber im Budget keinen Platz mehr hatten; sie folgen im nächsten Lauf. */
  attributesPending: number;
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

/** Neue Gegenstandsstufen je Lauf; beim ersten Lauf sind es fast tausend, das Budget gehört auch den übrigen Tabellen. */
const MAX_NEW_ITEM_LEVELS_PER_RUN = 300;

/** Leereinträge werden frühestens nach dieser Zeit erneut abgefragt. */
export const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Höchstens so viele Leereinträge je Tabelle und Lauf neu prüfen, damit neue Einträge und spätere Tabellen Budget behalten. */
export const MAX_RETRIES_PER_RUN = 100;

/**
 * Leereinträge, die wieder an der Reihe sind: ohne Zeitstempel (ältere Blobs) zuerst, dann die am längsten nicht geprüften.
 * `checked` ist der Nebenblob `<key>-checked` mit dem Zeitpunkt der letzten erfolglosen Abfrage je ID.
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
 * Holt fehlende Einträge einer ID-Tabelle und prüft Leereinträge nach einiger Zeit erneut.
 * 404 oder eine Antwort ohne Wert wird als null gespeichert, mit Zeitstempel im Nebenblob `<key>-checked`;
 * andere Fehler lassen den Eintrag unverändert und werden beim nächsten Lauf erneut versucht.
 * `seed` sind schon bekannte Werte, die ohne Anfrage übernommen werden.
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
  const map = (await deps.store.get<Record<string, T | null>>(key)) ?? {};
  const checkedKey = `${key}-checked`;
  const checked = (await deps.store.get<Record<string, string>>(checkedKey)) ?? {};
  let checkedChanged = false;
  for (const [id, value] of Object.entries(opts.seed ?? {})) {
    if (map[id] !== undefined && map[id] !== null) continue;
    map[id] = value;
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
  await deps.store.set(key, map);
  if (checkedChanged) await deps.store.set(checkedKey, checked);
  return { added, skipped: pool.skipped.length };
}

/** Rezepte mit Lücken: nicht abrufbar, ohne Icon oder mit hergestelltem Gegenstand ohne Details. */
function recipeIncomplete(detail: RecipeDetail | null | undefined): boolean {
  return detail === null || detail === undefined || detail.icon === null || (detail.item !== null && detail.item.tooltip === null);
}

/** Je Rezept bis zu drei Anfragen; weniger Neuprüfungen je Lauf als bei den einfachen Tabellen. */
const MAX_RECIPE_RETRIES_PER_RUN = 30;

/**
 * Rezeptdetails: je Rezept Rezept, Icon und hergestellter Gegenstand. Ein Fehler lässt das ganze Rezept offen.
 * Rezepte mit Lücken werden wie die Icons nach einiger Zeit erneut abgefragt (Nebenblob `static/recipes-checked`).
 */
async function fillRecipes(
  deps: CollectDeps,
  ids: number[],
  deadline: number,
  at: string,
): Promise<{ map: RecipeDetails; added: number; skipped: number }> {
  const key = "static/recipes";
  const checkedKey = `${key}-checked`;
  const map = (await deps.store.get<RecipeDetails>(key)) ?? {};
  const checked = (await deps.store.get<Record<string, string>>(checkedKey)) ?? {};
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
        // Ein früher gespeichertes Rezept bleibt stehen, wenn es jetzt nicht abrufbar ist.
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
  if (added > 0) {
    await deps.store.set(key, map);
    await deps.store.set(checkedKey, checked);
  }
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

/** Was der Sammler über einen Charakter weiß, um zu entscheiden, ob seine Werte neu geholt werden. */
interface AttributeCandidate {
  id: number;
  slug: string;
  lastLoginAt: string | null;
}

/**
 * Charaktere, deren Werte fehlen oder seit dem letzten Abruf eingeloggt waren, nur dann ändern sich Werte.
 * Fehlende zuerst, dann die ältesten; was nicht ins Budget passt, kommt im nächsten Lauf dran.
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
 * Werte (`/statistics`) je Charakter in eigene Blobs `attributes/<id>`, gestaffelt über die täglichen Läufe.
 * 404 wird als Datensatz ohne Felder gespeichert, damit der Charakter erst nach dem nächsten Login wieder dran ist.
 */
async function fillAttributes(
  deps: CollectDeps,
  candidates: AttributeCandidate[],
  deadline: number,
  at: string,
): Promise<{ fetched: number; pending: number }> {
  const key = "attributes/index";
  const index = (await deps.store.get<AttributesIndex>(key)) ?? {};
  const due = attributesDue(candidates, index);
  let fetched = 0;
  await runPool(
    due,
    async (c) => {
      const path = `/profile/wow/character/${encodeURIComponent(c.slug)}/statistics`;
      const res = await deps.client.get(path, "profile");
      if (res.status === 200) {
        await deps.store.set(`attributes/${c.id}`, toAttributes(res.data, at));
      } else if (res.status === 404) {
        // Vorhandene Werte bleiben stehen, nur ein Datensatz ohne Werte wird angelegt.
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
  if (fetched > 0) await deps.store.set(key, index);
  return { fetched, pending: due.length - fetched };
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
  const spells = await fillMap(deps, "static/spell-icons", spellIds, (id) => `/data/wow/media/spell/${id}`, iconOf, deadline, { at });

  // Rezeptdetails und Gegenstands-Icons für alles, was Gildenmitglieder tragen, kennen und verarbeiten.
  const itemIds: number[] = [];
  const equippedIds: number[] = [];
  /** Gegenstandsstufen, die Blizzard noch in der Ausrüstung mitliefert; sie hängen nur an der Gegenstands-ID. */
  const knownLevels: Record<string, number> = {};
  const recipeIds: number[] = [];
  // Im selben Durchgang die aktiven Charaktere mit Profil als Kandidaten für die Werte.
  const active = new Set(((await store.get<GuildRecord>("guild"))?.members ?? []).filter((m) => !m.former).map((m) => m.id));
  const attributeCandidates: AttributeCandidate[] = [];
  for (const key of await store.list("characters/")) {
    const rec = await store.get<CharacterRecord>(key);
    for (const item of rec?.equipment ?? []) {
      if (!item.itemId) continue;
      itemIds.push(item.itemId);
      equippedIds.push(item.itemId);
      if (typeof item.itemLevel === "number") knownLevels[String(item.itemId)] = item.itemLevel;
    }
    for (const p of rec?.professions ?? []) recipeIds.push(...(p.recipeIds ?? []));
    if (rec?.hasProfile && active.has(rec.id)) attributeCandidates.push({ id: rec.id, slug: rec.slug, lastLoginAt: rec.lastLoginAt });
  }
  const recipes = await fillRecipes(deps, recipeIds, deadline, at);
  for (const r of Object.values(recipes.map)) for (const reagent of r?.reagents ?? []) itemIds.push(reagent.id);
  const items = await fillMap(deps, "static/item-icons", itemIds, (id) => `/data/wow/media/item/${id}`, iconOf, deadline, { at });
  // Seit dem 25.11.2026 fehlt die Stufe in der Ausrüstung frisch eingeloggter Charaktere; Ersatz aus dem Gegenstand selbst.
  const levels = await fillMap(
    deps,
    "static/item-levels",
    equippedIds.filter((id) => !Object.hasOwn(knownLevels, String(id))),
    (id) => `/data/wow/item/${id}`,
    (data) => (typeof data?.level === "number" ? data.level : null),
    deadline,
    { at, seed: knownLevels, maxNew: MAX_NEW_ITEM_LEVELS_PER_RUN },
  );
  const instances = await fillInstanceAchievements(deps, deadline);
  const reputation = await fillReputationFactions(deps, deadline);
  const professionIcons = await fillMap(
    deps,
    "static/profession-icons",
    Object.keys(PROFESSION_NAMES_DE).map(Number),
    (id) => `/data/wow/media/profession/${id}`,
    iconOf,
    deadline,
    { at },
  );
  const images = await fillMap(
    deps,
    "static/instance-images",
    INSTANCE_IMAGE_IDS,
    (id) => `/data/wow/media/journal-instance/${id}`,
    tileOf,
    deadline,
    { at, ns: "static-retail" },
  );
  // Zuletzt, damit die Werte nie Icons und Rezepte aus dem Budget drängen.
  const attributes = await fillAttributes(deps, attributeCandidates, deadline, at);

  return {
    at,
    treesAdded,
    spellIconsAdded: spells.added,
    itemIconsAdded: items.added,
    itemLevelsAdded: levels.added,
    instanceAchievementsAdded: instances.added,
    recipesAdded: recipes.added,
    reputationGroupsChecked: reputation.checked,
    instanceImagesAdded: images.added,
    professionIconsAdded: professionIcons.added,
    attributesFetched: attributes.fetched,
    attributesPending: attributes.pending,
    skipped:
      skipped +
      spells.skipped +
      items.skipped +
      levels.skipped +
      recipes.skipped +
      instances.skipped +
      reputation.skipped +
      images.skipped +
      professionIcons.skipped,
    durationMs: Date.now() - started,
  };
}
