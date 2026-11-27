/* eslint-disable @typescript-eslint/no-explicit-any -- Rohantworten der API sind untypisiert */
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
import { CHARACTER_INDEX_KEY, toCharacterIndexEntry } from "./character-index";
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
  /** Charaktere ohne Eintrag in `character-index`, die dieser Lauf selbst gelesen hat. */
  charactersRead: number;
  /** Charaktere ohne Indexeintrag, für die das Zeitlimit der Vorarbeit nicht reichte. */
  charactersUnread: number;
  /** Phasen, die wegen des Zeitbudgets gar nicht begonnen haben. */
  notStarted: string[];
  /** Dauer je Phase in Millisekunden (prep, attributes, trees, spells, ... , finish). */
  phases: Record<string, number>;
  /** Ein anderer Lauf hielt die Sperre; dieser hat nichts getan. */
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
  const checkedKey = `${key}-checked`;
  const [stored, storedChecked] = await Promise.all([
    deps.store.get<Record<string, T | null>>(key),
    deps.store.get<Record<string, string>>(checkedKey),
  ]);
  const map = stored ?? {};
  const checked = storedChecked ?? {};
  // Neu angelegte Tabellen werden auch leer geschrieben, danach nur noch bei Änderungen.
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

/** Lädt fehlende Definitionen der Dungeon- und Raid-Erfolge; die Kategorien selbst jedes Mal (zwei Anfragen). */
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
  // Das Verzeichnis kommt jedes Mal; geschrieben wird nur, was sich geändert hat.
  if (JSON.stringify(next) !== JSON.stringify(prev)) await deps.store.set(key, next);
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
 * Anteil der Arbeitszeit, der zuerst den Charakterwerten gehört, solange Werte fällig sind.
 * Danach kommen die Nachholaufgaben (Icons, Rezepte, Gegenstandsstufen, Leereinträge) mit allem, was übrig ist,
 * und zum Schluss die Werte noch einmal mit dem Rest. So kommen die Werte in jedem Lauf voran.
 */
export const ATTRIBUTES_BUDGET_SHARE = 0.4;

/**
 * Anteil des Budgets, in dem der Lauf nichts Neues mehr beginnt (2 s bei den üblichen 12 s). Der Rest gehört den
 * Anfragen, die noch unterwegs sind, und dem Schreiben am Ende. Der Planer von Netlify wartet höchstens etwa 15 s
 * auf die Antwort und startet den Lauf sonst ein zweites Mal; der Start der Function kostet davon schon bis zu 1 s.
 */
export const END_RESERVE_SHARE = 1 / 6;

/** Anteil des Budgets, den das Nachlesen von Charakteren ohne Indexeintrag höchstens bekommt. */
export const BOOTSTRAP_SHARE = 0.25;
/** Gleichzeitige Blob-Zugriffe beim Nachlesen der Charaktere. */
const BOOTSTRAP_CONCURRENCY = 20;

const ATTRIBUTES_INDEX_KEY = "attributes/index";

/** Sperre gegen sich überlappende Läufe, wenn Netlify einen langsamen Lauf ein zweites Mal startet. */
export const LOCK_KEY = "locks/collect-static";
/** Nach dieser Zeit gilt eine Sperre als verwaist (abgestürzter Lauf) und wird übergangen. */
export const LOCK_TTL_MS = 60_000;

interface RunLock {
  startedAt: string;
  until: string;
}

/**
 * Werte (`/statistics`) je Charakter in eigene Blobs `attributes/<id>`, gestaffelt über die Läufe alle vier Stunden.
 * 404 wird als Datensatz ohne Felder gespeichert, damit der Charakter erst nach dem nächsten Login wieder dran ist.
 * `due` kommt aus `attributesDue`: Charaktere ohne Werte zuerst, dann die ältesten fälligen Aktualisierungen.
 * Gibt zurück, wie viele geholt wurden und welche wegen der Deadline offen blieben.
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
  return { fetched, open: pool.skipped };
}

/** Was der Lauf aus den Charakteren braucht: Gegenstände, Stufen, Rezepte und Kandidaten für die Werte. */
interface CharacterScan {
  itemIds: number[];
  equippedIds: number[];
  knownLevels: Record<string, number>;
  recipeIds: number[];
  attributeCandidates: AttributeCandidate[];
  /** Charaktere ohne Indexeintrag, die dieser Lauf selbst gelesen hat. */
  read: number;
  /** Charaktere ohne Indexeintrag, für die die Zeit nicht reichte; sie fehlen in diesem Lauf. */
  unread: number;
}

/**
 * Sammelt die Angaben aus `character-index` (von `collect-guild` gepflegt). Nur Charaktere ohne Eintrag, etwa direkt
 * nach dem Update, werden aus `characters/<id>` gelesen, parallel und mit eigenem Zeitlimit.
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
    attributeCandidates: [],
    read: pool.completed.length,
    unread: pool.skipped.length + pool.failed.length,
  };
  // Feste Reihenfolge, damit parallel gelesene Charaktere die Ergebnisse nicht umsortieren.
  entries.sort((a, b) => a[0] - b[0]);
  for (const [id, e] of entries) {
    scan.itemIds.push(...e.itemIds);
    scan.equippedIds.push(...e.itemIds);
    Object.assign(scan.knownLevels, e.itemLevels);
    scan.recipeIds.push(...e.recipeIds);
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
  /** Ab hier beginnt nichts Neues mehr; danach nur noch laufende Anfragen und das Schreiben am Ende. */
  const workEnd = started + Math.floor(config.budgetMs * (1 - END_RESERVE_SHARE));
  const at = deps.now().toISOString();
  const report = emptyReport(at);
  const phases = report.phases;

  /** Misst eine Phase; beginnt sie erst nach `deadline`, wird sie übersprungen und in `notStarted` vermerkt. */
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

  // Vorarbeit: alles, was der Lauf aus dem Speicher braucht, in einem Zug.
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
    // Ein anderer Lauf arbeitet noch (Netlify hat neu gestartet); dieser endet sofort, ohne etwas zu schreiben.
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

    // Zuerst die Werte mit ihrem Anteil an der verbleibenden Arbeitszeit.
    let attributesFetched = 0;
    let attributesOpen = attributesToFetch;
    if (attributesToFetch.length > 0) {
      const share = started + Math.floor((workEnd - started) * ATTRIBUTES_BUDGET_SHARE);
      const first = await phase("attributes", workEnd, null, () =>
        fillAttributes(deps, attributesToFetch, attributesIndex, Math.min(share, workEnd), at),
      );
      if (first) {
        attributesFetched += first.fetched;
        attributesOpen = first.open;
      }
    }

    // Klassen, Völker und Talentbäume: je Klassenbaum einmal, mit allen zugehörigen Spec-Bäumen.
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
    // Zauber-Icons für alle Talente aller gespeicherten Bäume.
    const spells = await phase("spells", workEnd, none, async () => {
      const trees = await Promise.all(
        Object.values(treeIndex).map((treeId) => store.get<TalentTreeRecord>(`static/talent-trees/${treeId}`)),
      );
      const spellIds: number[] = [];
      for (const tree of trees) for (const spec of tree?.specs ?? []) for (const n of spec.nodes) if (n.spellId) spellIds.push(n.spellId);
      return fillMap(deps, "static/spell-icons", spellIds, (id) => `/data/wow/media/spell/${id}`, iconOf, workEnd, { at });
    });

    // Rezeptdetails und Gegenstands-Icons für alles, was Gildenmitglieder tragen, kennen und verarbeiten.
    const recipes = await phase("recipes", workEnd, { map: {} as RecipeDetails, ...none }, () =>
      fillRecipes(deps, recipeIds, workEnd, at),
    );
    for (const r of Object.values(recipes.map)) for (const reagent of r?.reagents ?? []) itemIds.push(reagent.id);
    const items = await phase("items", workEnd, none, () =>
      fillMap(deps, "static/item-icons", itemIds, (id) => `/data/wow/media/item/${id}`, iconOf, workEnd, { at }),
    );
    // Seit dem 25.11.2026 fehlt die Stufe in der Ausrüstung frisch eingeloggter Charaktere; Ersatz aus dem Gegenstand selbst.
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

    // Zum Schluss die übrigen Werte mit allem, was die Nachholaufgaben übrig lassen.
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
      reputation.skipped +
      images.skipped +
      professionIcons.skipped;
  } finally {
    await store.delete(LOCK_KEY).catch(() => undefined);
  }
  report.durationMs = Date.now() - started;
  return report;
}
