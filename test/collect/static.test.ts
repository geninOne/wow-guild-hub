import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ApiResult, BlizzardClient } from "../../src/blizzard/client";
import type { Config } from "../../src/config";
import { ATTRIBUTES_BUDGET_SHARE, LOCK_KEY, LOCK_TTL_MS, MAX_RETRIES_PER_RUN, attributesDue, retriesDue, runStaticCollection } from "../../src/collect/static";
import type {
  CharacterAttributesRecord,
  CharacterIndex,
  CharacterRecord,
  IconMap,
  InstanceAchievementsRecord,
  NamedList,
  RecipeDetails,
  ReputationFactionsRecord,
  TalentTreeRecord,
} from "../../src/model";
import { CHARACTER_INDEX_KEY, toCharacterIndexEntry } from "../../src/collect/character-index";
import { createMemoryStore } from "../../src/store";
import { buildCharacterRecord } from "../../src/transform/character";
import { createFakeClient } from "../helpers/fake-client";
import { loadFixture } from "../helpers/fixtures";

const config: Config = {
  clientId: "id", clientSecret: "s", guildSlugs: ["bärenklaue"], region: "eu", locale: "de_DE", gameVersion: "forever",
  concurrency: 4, budgetMs: 10_000,
};
const ICON = "https://render.worldofwarcraft.com/forever-eu/icons/56/132269.jpg";

let routes: Record<string, ApiResult>;
let store: ReturnType<typeof createMemoryStore>;
let fake: ReturnType<typeof createFakeClient>;

function indexOnly1117Arms(): ApiResult {
  const raw = loadFixture("talent-tree-index");
  return {
    status: 200,
    data: {
      ...raw.data,
      class_talent_trees: raw.data.class_talent_trees.filter((t: { key: { href: string } }) => /talent-tree\/1117\?/.test(t.key.href)),
      spec_talent_trees: raw.data.spec_talent_trees.filter((t: { key: { href: string } }) => /1117\/playable-specialization\/26\?/.test(t.key.href)),
    },
  };
}

beforeEach(() => {
  routes = {
    "/data/wow/playable-class/index": { status: 200, data: { classes: [{ id: 1, name: "Krieger" }, { id: 2, name: "Paladin" }] } },
    "/data/wow/playable-race/index": { status: 200, data: { races: [{ id: 2, name: "Orc" }] } },
    "/data/wow/talent-tree/index": indexOnly1117Arms(),
    "/data/wow/talent-tree/1117": loadFixture("talent-tree-1117"),
    "/data/wow/talent-tree/1117/playable-specialization/26": loadFixture("talent-tree-1117-spec-26"),
    "/data/wow/media/spell/16462": loadFixture("spell-media-16462"),
  };
  store = createMemoryStore();
  fake = createFakeClient(routes);
});

const run = (cfg: Partial<Config> = {}) =>
  runStaticCollection({ client: fake, store, config: { ...config, ...cfg }, now: () => new Date("2026-11-06T03:00:00.000Z") });

test("statischer Lauf holt Klassen, Völker, Bäume und Zauber-Icons", async () => {
  const rep = await run();
  expect(rep).toMatchObject({ treesAdded: 1, spellIconsAdded: 17, itemIconsAdded: 0, skipped: 0 });
  expect(await store.get<NamedList>("static/classes")).toEqual({ items: [{ id: 1, name: "Krieger" }, { id: 2, name: "Paladin" }] });
  expect(await store.get<NamedList>("static/races")).toEqual({ items: [{ id: 2, name: "Orc" }] });
  expect((await store.get<TalentTreeRecord>("static/talent-trees/1117"))?.specs[0].nodes).toHaveLength(17);
  expect(await store.get("static/talent-trees/index")).toEqual({ "1": 1117 });
  const icons = await store.get<IconMap>("static/spell-icons");
  expect(icons?.["16462"]).toBe(ICON);
  expect(icons?.["12294"]).toBeNull();
  expect(fake.calls.every((p) => !p.includes("?"))).toBe(true);
});

test("zweiter Lauf holt nur Fehlendes", async () => {
  await run();
  fake.calls.length = 0;
  const rep = await run();
  expect(rep).toMatchObject({ treesAdded: 0, spellIconsAdded: 0, itemIconsAdded: 0 });
  expect(fake.calls).toEqual([
    "/data/wow/talent-tree/index",
    "/data/wow/achievement-category/15593",
    "/data/wow/achievement-category/15594",
    "/data/wow/reputation-faction/index",
  ]);
  expect(await store.get<IconMap>("static/instance-images")).toMatchObject({ "63": null, "760": null });
});

test("Spec-Baum nicht abrufbar: Klassenbaum wird nicht gespeichert und später erneut versucht", async () => {
  routes["/data/wow/talent-tree/1117/playable-specialization/26"] = { status: 503, data: null };
  const rep = await run();
  expect(rep.treesAdded).toBe(0);
  expect(await store.get("static/talent-trees/1117")).toBeNull();
  routes["/data/wow/talent-tree/1117/playable-specialization/26"] = loadFixture("talent-tree-1117-spec-26");
  expect((await run()).treesAdded).toBe(1);
});

test("Icon-Abruf mit Serverfehler wird nicht als null gespeichert", async () => {
  routes["/data/wow/media/spell/16462"] = { status: 500, data: null };
  await run();
  expect((await store.get<IconMap>("static/spell-icons"))?.["16462"]).toBeUndefined();
  routes["/data/wow/media/spell/16462"] = loadFixture("spell-media-16462");
  expect((await run()).spellIconsAdded).toBe(1);
  expect((await store.get<IconMap>("static/spell-icons"))?.["16462"]).toBe(ICON);
});

test("Gegenstands-Icons aus gespeicherten Charakteren", async () => {
  const f = (n: string) => loadFixture(n).data;
  const rec = buildCharacterRecord(
    { id: 382219, name: "Luvia", surname: "Stav", slug: "luvia-stav", level: 21, classId: 1, raceId: 96, rank: 3 },
    { profile: f("luvia-profile"), specializations: null, equipment: f("luvia-equipment"), media: null, professions: null, raids: null, achievements: null, statistics: null, reputations: null },
    "t",
  );
  await store.set("characters/382219", rec);
  routes["/data/wow/media/item/10421"] = { status: 200, data: { assets: [{ key: "icon", value: "U" }] } };
  const rep = await run();
  expect(rep.itemIconsAdded).toBe(12);
  const items = await store.get<IconMap>("static/item-icons");
  expect(items?.["10421"]).toBe("U");
  expect(Object.values(items ?? {}).filter((v) => v === null)).toHaveLength(11);
});

test("Zeitbudget 0: keine Phase beginnt, keine Anfrage, nichts geschrieben außer der wieder gelösten Sperre", async () => {
  const rep = await run({ budgetMs: 0 });
  expect(rep).toMatchObject({ treesAdded: 0, instanceImagesAdded: 0, skipped: 0 });
  expect(rep.notStarted).toEqual(["trees", "spells", "recipes", "items", "levels", "instances", "accountWide", "reputation", "professions", "images"]);
  expect(fake.calls).toEqual([]);
  expect(Object.keys(store.dump())).toEqual([]);
});

function category(id: number, keep: number[]): ApiResult {
  const raw = loadFixture(`achievement-category-${id}`);
  return { status: 200, data: { ...raw.data, achievements: raw.data.achievements.filter((a: { id: number }) => keep.includes(a.id)) } };
}

function withInstanceRoutes() {
  routes["/data/wow/achievement-category/15593"] = category(15593, [62031]);
  routes["/data/wow/achievement-category/15594"] = category(15594, [62034, 684]);
  routes["/data/wow/achievement/62031"] = loadFixture("achievement-62031");
  routes["/data/wow/achievement/62034"] = loadFixture("achievement-62034");
  routes["/data/wow/achievement/684"] = loadFixture("achievement-684");
}

test("Instanz-Erfolge der Kategorien Dungeons und Schlachtzüge", async () => {
  withInstanceRoutes();
  const rep = await run();
  expect(rep.instanceAchievementsAdded).toBe(3);
  const defs = await store.get<InstanceAchievementsRecord>("static/instance-achievements");
  expect(defs?.achievements.map((a) => [a.id, a.kind, a.order])).toEqual([
    [62031, "dungeon", 0],
    [62034, "raid", 0],
    [684, "raid", 1],
  ]);
  const novize = defs!.achievements[0];
  expect(novize.name).toBe("Novize: Dungeonerforscher");
  expect(novize.criteria).toHaveLength(6);
  expect(novize.criteria[0]).toEqual({ id: 230766, description: "Flammenschlund oder Halle der Thanen" });
  expect(defs!.achievements[2]).toMatchObject({ criteria: [], rootDescription: "Tötet Onyxia" });

  fake.calls.length = 0;
  expect((await run()).instanceAchievementsAdded).toBe(0);
  expect(fake.calls.filter((c) => c.startsWith("/data/wow/achievement/"))).toEqual([]);
});

test("Instanz-Erfolg mit Serverfehler wird später geholt", async () => {
  withInstanceRoutes();
  routes["/data/wow/achievement/684"] = { status: 503, data: null };
  expect((await run()).instanceAchievementsAdded).toBe(2);
  routes["/data/wow/achievement/684"] = loadFixture("achievement-684");
  expect((await run()).instanceAchievementsAdded).toBe(1);
  const defs = await store.get<InstanceAchievementsRecord>("static/instance-achievements");
  expect(defs?.achievements.map((a) => a.id)).toEqual([62031, 62034, 684]);
});

async function withRecipeCharacter(recipeIds: number[]) {
  const rec = buildCharacterRecord(
    { id: 1, name: "A", surname: null, slug: "a", level: 21, classId: 1, raceId: 96, rank: 3 },
    { profile: loadFixture("luvia-profile").data, specializations: null, equipment: null, media: null, professions: null, raids: null, achievements: null, statistics: null, reputations: null },
    "t",
  );
  rec.professions = [
    { id: 197, name: "Schneiderei", nameEn: "Tailoring", skill: 1, max: 75, primary: true, recipes: recipeIds.map(String), recipeIds },
  ];
  await store.set("characters/1", rec);
}

test("Rezeptdetails mit Icon und Gegenstand, 404 als null, Material-Icons", async () => {
  await withRecipeCharacter([2408, 999]);
  routes["/data/wow/recipe/2408"] = loadFixture("recipe-2408");
  routes["/data/wow/media/recipe/2408"] = loadFixture("recipe-media-2408");
  routes["/data/wow/item/4343"] = loadFixture("item-4343");
  routes["/data/wow/media/item/2996"] = { status: 200, data: { assets: [{ key: "icon", value: ICON }] } };
  const rep = await run();
  expect(rep.recipesAdded).toBe(2);
  const recipes = await store.get<RecipeDetails>("static/recipes");
  expect(recipes?.["999"]).toBeNull();
  expect(recipes?.["2408"]).toMatchObject({
    name: "Braune Leinenhose",
    icon: "https://render.worldofwarcraft.com/forever-eu/icons/56/134586.jpg",
    item: { quality: "UNCOMMON", itemLevel: 10 },
  });
  const icons = await store.get<IconMap>("static/item-icons");
  expect(icons).toMatchObject({ "2996": ICON, "2320": null });
  expect(await store.get("static/recipe-names")).toBeNull();

  fake.calls.length = 0;
  expect((await run()).recipesAdded).toBe(0);
  expect(fake.calls.filter((c) => c.startsWith("/data/wow/recipe/") || c.startsWith("/data/wow/media/item/"))).toEqual([]);
});

test("Rezept, dessen Gegenstand mit Serverfehler antwortet, wird im nächsten Lauf ganz geholt", async () => {
  await withRecipeCharacter([2408]);
  routes["/data/wow/recipe/2408"] = loadFixture("recipe-2408");
  routes["/data/wow/item/4343"] = { status: 503, data: null };
  const rep = await run();
  expect(rep.recipesAdded).toBe(0);
  expect((await store.get<RecipeDetails>("static/recipes"))?.["2408"]).toBeUndefined();

  routes["/data/wow/item/4343"] = loadFixture("item-4343");
  expect((await run()).recipesAdded).toBe(1);
  const r = (await store.get<RecipeDetails>("static/recipes"))?.["2408"];
  expect(r?.icon).toBeNull();
  expect(r?.item?.tooltip?.armor).toBe("17 Rüstung");
});

test("Fraktionsnamen aus dem Verzeichnis, Gruppen inkrementell aus den Wurzelfraktionen", async () => {
  routes["/data/wow/reputation-faction/index"] = loadFixture("reputation-faction-index");
  routes["/data/wow/reputation-faction/67"] = loadFixture("reputation-faction-67");
  routes["/data/wow/reputation-faction/169"] = loadFixture("reputation-faction-169");
  const rep = await run();
  expect(rep.reputationGroupsChecked).toBeGreaterThan(0);
  const rec = await store.get<ReputationFactionsRecord>("static/reputation-factions");
  expect(rec?.names["81"]).toBe("Thunder Bluff");
  expect(rec?.names["609"]).toBe("Zirkel des Cenarius");
  expect(Object.keys(rec?.names ?? {})).toHaveLength(55);
  expect(rec?.groups.find((g) => g.id === 67)).toEqual({ id: 67, name: "Horde", factionIds: [68, 76, 81, 530] });
  expect(rec?.groups.map((g) => g.id).indexOf(67)).toBeLessThan(rec!.groups.map((g) => g.id).indexOf(169));

  fake.calls.length = 0;
  routes["/data/wow/reputation-faction/67"] = { status: 503, data: null };
  await run();
  expect(fake.calls.filter((c) => /reputation-faction\/\d+$/.test(c))).toEqual([]);
  expect((await store.get<ReputationFactionsRecord>("static/reputation-factions"))?.groups.find((g) => g.id === 67)).toBeTruthy();
});

test("Instanzbilder aus dem Retail-Namespace, Asset tile, nur einmal je ID", async () => {
  const seen: string[] = [];
  const client = {
    async get(path: string, ns: string) {
      if (path.startsWith("/data/wow/media/journal-instance/")) seen.push(`${ns} ${path}`);
      if (path === "/data/wow/media/journal-instance/63") {
        return { status: 200, data: { assets: [{ key: "tile", value: "https://render.worldofwarcraft.com/eu/zones/deadmines-small.jpg" }] } };
      }
      return fake.get(path, ns as "static");
    },
  };
  await runStaticCollection({ client, store, config, now: () => new Date("2026-11-06T03:00:00.000Z") });
  const tiles = await store.get<IconMap>("static/instance-images");
  expect(tiles?.["63"]).toBe("https://render.worldofwarcraft.com/eu/zones/deadmines-small.jpg");
  expect(tiles?.["226"]).toBeNull();
  expect(seen.every((c) => c.startsWith("static-retail "))).toBe(true);
  expect(seen.filter((c) => c.endsWith("/316"))).toHaveLength(1);
  seen.length = 0;
  await runStaticCollection({ client, store, config, now: () => new Date("2026-11-06T03:00:00.000Z") });
  expect(seen).toEqual([]);
});

test("Berufssymbole für alle bekannten Berufe", async () => {
  routes["/data/wow/media/profession/186"] = { status: 200, data: { assets: [{ key: "icon", value: "https://render.worldofwarcraft.com/forever-eu/icons/56/136248.jpg" }] } };
  const rep = await run();
  expect(rep.professionIconsAdded).toBe(12);
  const icons = await store.get<IconMap>("static/profession-icons");
  expect(icons?.["186"]).toBe("https://render.worldofwarcraft.com/forever-eu/icons/56/136248.jpg");
  expect(icons?.["171"]).toBeNull();
});

describe("Werte der Charaktere", () => {
  async function character(id: number, slug: string, lastLoginAt: string | null, hasProfile = true) {
    const rec = buildCharacterRecord(
      { id, name: slug, surname: null, slug, level: 30, classId: 1, raceId: 2, rank: 3 },
      { profile: null, specializations: null, equipment: null, media: null, professions: null, raids: null, achievements: null, statistics: null, reputations: null },
      "t",
    );
    await store.set(`characters/${id}`, { ...rec, hasProfile, lastLoginAt });
    // Wie collect-guild: Datensatz und Indexeintrag zusammen.
    const index = (await store.get<CharacterIndex>(CHARACTER_INDEX_KEY)) ?? {};
    index[String(id)] = toCharacterIndexEntry({ ...rec, hasProfile, lastLoginAt });
    await store.set(CHARACTER_INDEX_KEY, index);
  }
  async function guild(ids: number[], former: number[] = []) {
    const members = [...ids, ...former].map((id) => ({ id, former: former.includes(id) }));
    await store.set("guild", { members });
  }
  const stats = (health: number): ApiResult => ({
    status: 200,
    data: { health, power: 100, power_type: { id: 1, name: "Wut" }, strength: { base: 50, effective: 70 } },
  });
  const attributeCalls = () => fake.calls.filter((p) => p.endsWith("/statistics"));

  test("holt fehlende Werte aktiver Charaktere mit Profil, nicht Ehemalige und nicht ohne Profil", async () => {
    await character(1, "eins", "2026-11-05T10:00:00.000Z");
    await character(2, "zwei", null, false);
    await character(3, "drei", "2026-11-05T10:00:00.000Z");
    await guild([1, 2], [3]);
    routes["/profile/wow/character/eins/statistics"] = stats(1000);
    const rep = await run();
    expect(rep).toMatchObject({ attributesFetched: 1, attributesPending: 0 });
    expect(attributeCalls()).toEqual(["/profile/wow/character/eins/statistics"]);
    expect(await store.get<CharacterAttributesRecord>("attributes/1")).toEqual({
      fetchedAt: "2026-11-06T03:00:00.000Z",
      fields: { health: 1000, power: 100, strength: { base: 50, effective: 70 } },
      powerType: { id: 1, name: "Wut" },
    });
    expect(await store.get("attributes/index")).toEqual({ "1": "2026-11-06T03:00:00.000Z" });
  });

  test("zweiter Lauf holt nur nach neuem Login", async () => {
    await character(1, "eins", "2026-11-05T10:00:00.000Z");
    await character(4, "vier", "2026-11-05T10:00:00.000Z");
    await guild([1, 4]);
    routes["/profile/wow/character/eins/statistics"] = stats(1000);
    routes["/profile/wow/character/vier/statistics"] = stats(2000);
    await run();
    fake.calls.length = 0;
    expect((await run()).attributesFetched).toBe(0);
    expect(attributeCalls()).toEqual([]);
    await character(4, "vier", "2026-11-06T12:00:00.000Z");
    routes["/profile/wow/character/vier/statistics"] = stats(2500);
    await runStaticCollection({ client: fake, store, config, now: () => new Date("2026-11-07T03:00:00.000Z") });
    expect(attributeCalls()).toEqual(["/profile/wow/character/vier/statistics"]);
    expect((await store.get<CharacterAttributesRecord>("attributes/4"))?.fields?.health).toBe(2500);
  });

  test("404 legt einen Datensatz ohne Werte an, behält aber vorhandene Werte", async () => {
    await character(1, "eins", "2026-11-05T10:00:00.000Z");
    await character(5, "fuenf", "2026-11-05T10:00:00.000Z");
    await guild([1, 5]);
    await store.set("attributes/1", { fetchedAt: "alt", fields: { health: 7 }, powerType: null });
    await store.set("attributes/index", { "1": "2026-11-01T00:00:00.000Z" });
    const rep = await run();
    expect(rep.attributesFetched).toBe(2);
    expect(await store.get("attributes/5")).toEqual({ fetchedAt: "2026-11-06T03:00:00.000Z", fields: null, powerType: null });
    expect((await store.get<CharacterAttributesRecord>("attributes/1"))?.fields).toEqual({ health: 7 });
  });

  test("Serverfehler und knappes Budget: offen für den nächsten Lauf", async () => {
    await character(1, "eins", null);
    await guild([1]);
    routes["/profile/wow/character/eins/statistics"] = { status: 503, data: null };
    expect(await run()).toMatchObject({ attributesFetched: 0, attributesPending: 1 });
    expect(await store.get("attributes/1")).toBeNull();
    expect(await store.get("attributes/index")).toBeNull();
    routes["/profile/wow/character/eins/statistics"] = stats(1);
    expect(await run({ budgetMs: 0 })).toMatchObject({ attributesFetched: 0, attributesPending: 1 });
  });

  describe("Simulation: voller Nachholbedarf bei langsamer API", () => {
    // Jede Anfrage kostet 100 ms auf der vorgetäuschten Uhr; Date.now() steht sonst still.
    const LATENCY_MS = 100;
    const BUDGET_MS = 10_000;
    const CHARACTERS = 30;
    const START = Date.parse("2026-11-06T03:00:00.000Z");

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(START);
    });
    afterEach(() => vi.useRealTimers());

    const slow = (inner: BlizzardClient): BlizzardClient => ({
      async get(path, ns) {
        vi.setSystemTime(Date.now() + LATENCY_MS);
        return inner.get(path, ns);
      },
    });

    async function backlog() {
      // Je Charakter 20 Gegenstände ohne Stufe und ohne Icon: 600 fehlende Icons, 300 Stufen je Lauf.
      for (let id = 1; id <= CHARACTERS; id++) {
        await character(id, `c${id}`, "2026-11-05T10:00:00.000Z");
        const rec = (await store.get<CharacterRecord>(`characters/${id}`))!;
        const equipment = Array.from({ length: 20 }, (_, i) => ({
          slot: `S${i}`, slotName: `S${i}`, itemId: id * 100 + i, name: "x", quality: "EPIC", itemLevel: null, enchantments: [],
        }));
        await store.set(`characters/${id}`, { ...rec, equipment });
        const index = (await store.get<CharacterIndex>(CHARACTER_INDEX_KEY)) ?? {};
        index[String(id)] = toCharacterIndexEntry({ ...rec, equipment });
        await store.set(CHARACTER_INDEX_KEY, index);
        routes[`/profile/wow/character/c${id}/statistics`] = stats(id);
      }
      await guild(Array.from({ length: CHARACTERS }, (_, i) => i + 1));
      // Alte Leereinträge ohne Zeitstempel, wie vor v2.1.1: werden alle erneut geprüft.
      const nulls = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [String(90_000 + i), null]));
      await store.set("static/spell-icons", nulls);
    }

    const simulate = () =>
      runStaticCollection({ client: slow(fake), store, config: { ...config, budgetMs: BUDGET_MS }, now: () => new Date(Date.now()) });

    test("die Werte bekommen schon im ersten Lauf ihren Anteil und sind nach wenigen Läufen vollständig", async () => {
      await backlog();
      const first = await simulate();
      // Ohne eigenes Budget waren es hier 0: Icons und Stufen fraßen die ganze Zeit.
      expect(first.attributesFetched).toBeGreaterThanOrEqual(10);
      // Die Nachholaufgaben kommen trotzdem voran.
      expect(first.itemIconsAdded + first.itemLevelsAdded).toBeGreaterThan(0);
      // Nicht länger als das Budget plus die Anfragen, die beim Ablauf noch unterwegs sind.
      expect(first.durationMs).toBeLessThanOrEqual(BUDGET_MS + config.concurrency * LATENCY_MS);

      let runs = 1;
      let pending = first.attributesPending;
      while (pending > 0 && runs < 5) {
        pending = (await simulate()).attributesPending;
        runs++;
      }
      expect(pending).toBe(0);
      expect(runs).toBeLessThanOrEqual(3);
      expect(Object.keys((await store.get("attributes/index")) ?? {})).toHaveLength(CHARACTERS);
    });

    test("ohne fällige Werte bekommen die Nachholaufgaben das ganze Budget", async () => {
      await backlog();
      const index = Object.fromEntries(Array.from({ length: CHARACTERS }, (_, i) => [String(i + 1), "2026-11-06T00:00:00.000Z"]));
      await store.set("attributes/index", index);
      const rep = await simulate();
      expect(rep.attributesFetched).toBe(0);
      // Deutlich mehr als der Anteil ohne Reserve hergäbe.
      expect(rep.durationMs).toBeGreaterThan(BUDGET_MS * (1 - ATTRIBUTES_BUDGET_SHARE) + LATENCY_MS * config.concurrency);
    });

    test("neue Charaktere vor fälligen Aktualisierungen", async () => {
      await backlog();
      // Charaktere 1 bis 20 haben alte Werte und waren seitdem eingeloggt, 21 bis 30 sind neu.
      const index = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), "2026-11-01T00:00:00.000Z"]));
      await store.set("attributes/index", index);
      fake.calls.length = 0;
      const rep = await simulate();
      const order = fake.calls.filter((p) => p.endsWith("/statistics")).map((p) => Number(/c(\d+)\//.exec(p)![1]));
      expect(rep.attributesFetched).toBeGreaterThanOrEqual(10);
      expect(order.slice(0, 10).sort((a, b) => a - b)).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
    });
  });
});

test("attributesDue: fehlende zuerst, dann die ältesten, nur nach neuem Login", () => {
  const due = attributesDue(
    [
      { id: 1, slug: "a", lastLoginAt: "2026-11-05T00:00:00.000Z" },
      { id: 2, slug: "b", lastLoginAt: "2026-11-05T00:00:00.000Z" },
      { id: 3, slug: "c", lastLoginAt: null },
      { id: 4, slug: "d", lastLoginAt: "2026-11-05T00:00:00.000Z" },
    ],
    { "1": "2026-11-04T00:00:00.000Z", "2": "2026-11-06T00:00:00.000Z", "4": "2026-11-03T00:00:00.000Z" },
  );
  expect(due.map((c) => c.id)).toEqual([3, 4, 1]);
});

describe("Leereinträge erneut abfragen", () => {
  const runAt = (iso: string) => runStaticCollection({ client: fake, store, config, now: () => new Date(iso) });
  const NOW = "2026-11-06T03:00:00.000Z";
  const spellCalls = () => fake.calls.filter((c) => c.startsWith("/data/wow/media/spell/"));

  test("alter Blob mit bloßem null wird sofort erneut abgefragt und gefüllt", async () => {
    await run();
    const icons = (await store.get<IconMap>("static/spell-icons"))!;
    icons["16462"] = null;
    await store.set("static/spell-icons", icons);
    await store.delete("static/spell-icons-checked");
    fake.calls.length = 0;
    const rep = await run();
    expect((await store.get<IconMap>("static/spell-icons"))?.["16462"]).toBe(ICON);
    // Alle 16 übrigen Leereinträge hatten nach dem Löschen des Nebenblobs keinen Zeitstempel mehr.
    expect(rep.spellIconsAdded).toBe(17);
    expect((await store.get<Record<string, string>>("static/spell-icons-checked"))?.["16462"]).toBeUndefined();
  });

  test("null mit Zeitstempel wartet sieben Tage, dann wird erneut gefragt", async () => {
    routes["/data/wow/media/spell/16462"] = { status: 404, data: null };
    await runAt(NOW);
    expect((await store.get<Record<string, string>>("static/spell-icons-checked"))?.["16462"]).toBe(NOW);
    routes["/data/wow/media/spell/16462"] = loadFixture("spell-media-16462");

    fake.calls.length = 0;
    await runAt("2026-11-12T03:00:00.000Z");
    expect(spellCalls()).toEqual([]);

    await runAt("2026-11-13T03:00:00.000Z");
    expect(spellCalls()).toContain("/data/wow/media/spell/16462");
    expect((await store.get<IconMap>("static/spell-icons"))?.["16462"]).toBe(ICON);
  });

  test("Serverfehler bei der Neuprüfung lässt Eintrag und Zeitstempel stehen", async () => {
    routes["/data/wow/media/spell/16462"] = { status: 404, data: null };
    await runAt(NOW);
    routes["/data/wow/media/spell/16462"] = { status: 503, data: null };
    await runAt("2026-11-20T03:00:00.000Z");
    expect((await store.get<IconMap>("static/spell-icons"))?.["16462"]).toBeNull();
    expect((await store.get<Record<string, string>>("static/spell-icons-checked"))?.["16462"]).toBe(NOW);
  });

  test("Neuprüfungen je Lauf begrenzt, älteste zuerst", async () => {
    expect(retriesDue([3, 1, 2, 4], (id) => id !== "4", { "1": "2026-11-01T00:00:00.000Z", "3": "2026-10-01T00:00:00.000Z" }, Date.parse(NOW), 2)).toEqual([2, 3]);
    const many = Array.from({ length: MAX_RETRIES_PER_RUN + 20 }, (_, i) => i + 1);
    expect(retriesDue(many, () => true, {}, Date.parse(NOW))).toHaveLength(MAX_RETRIES_PER_RUN);
    expect(retriesDue([1], () => true, { "1": "2026-11-05T00:00:00.000Z" }, Date.parse(NOW))).toEqual([]);
  });

  test("Rezept ohne Icon wird später ergänzt, ein inzwischen fehlendes Rezept bleibt stehen", async () => {
    await withRecipeCharacter([2408]);
    routes["/data/wow/recipe/2408"] = loadFixture("recipe-2408");
    routes["/data/wow/item/4343"] = loadFixture("item-4343");
    await runAt(NOW);
    expect((await store.get<RecipeDetails>("static/recipes"))?.["2408"]?.icon).toBeNull();

    routes["/data/wow/media/recipe/2408"] = loadFixture("recipe-media-2408");
    await runAt("2026-11-14T03:00:00.000Z");
    expect((await store.get<RecipeDetails>("static/recipes"))?.["2408"]?.icon).toBe("https://render.worldofwarcraft.com/forever-eu/icons/56/134586.jpg");
    expect((await store.get<Record<string, string>>("static/recipes-checked"))?.["2408"]).toBeUndefined();

    // Vollständige Rezepte werden nicht mehr abgefragt.
    fake.calls.length = 0;
    await runAt("2026-12-30T03:00:00.000Z");
    expect(fake.calls.filter((c) => c.startsWith("/data/wow/recipe/"))).toEqual([]);
  });
});

describe("Gegenstandsstufen", () => {
  async function withEquipment(levels: (number | null)[]) {
    const f = (n: string) => loadFixture(n).data;
    const rec = buildCharacterRecord(
      { id: 382219, name: "Luvia", surname: "Stav", slug: "luvia-stav", level: 21, classId: 1, raceId: 96, rank: 3 },
      { profile: f("luvia-profile"), specializations: null, equipment: f("luvia-equipment"), media: null, professions: null, raids: null, achievements: null, statistics: null, reputations: null },
      "t",
    );
    rec.equipment = rec.equipment.slice(0, levels.length).map((e, i) => ({ ...e, itemLevel: levels[i] }));
    await store.set("characters/382219", rec);
    return rec.equipment.map((e) => e.itemId);
  }

  test("fehlende Stufe aus /data/wow/item, bekannte Stufe ohne Anfrage übernommen", async () => {
    const [a, b, c] = await withEquipment([12, null, null]);
    routes[`/data/wow/item/${b}`] = { status: 200, data: { id: b, level: 17 } };
    const rep = await run();
    expect(rep.itemLevelsAdded).toBe(2);
    expect(await store.get("static/item-levels")).toEqual({ [a]: 12, [b]: 17, [c]: null });
    expect(fake.calls).not.toContain(`/data/wow/item/${a}`);
    expect((await store.get<Record<string, string>>("static/item-levels-checked"))?.[String(c)]).toBe("2026-11-06T03:00:00.000Z");
  });

  test("später mitgelieferte Stufe ersetzt einen Leereintrag", async () => {
    const [a] = await withEquipment([null]);
    await run();
    expect((await store.get<Record<string, number | null>>("static/item-levels"))?.[String(a)]).toBeNull();
    await withEquipment([33]);
    await run();
    expect((await store.get<Record<string, number | null>>("static/item-levels"))?.[String(a)]).toBe(33);
    expect((await store.get<Record<string, string>>("static/item-levels-checked"))?.[String(a)]).toBeUndefined();
  });
});

describe("Accountweite Erfolge", () => {
  const withAchievements = async (id: number, done: number[], open: number[] = []) => {
    const rec = buildCharacterRecord(
      { id, name: `c${id}`, surname: null, slug: `c${id}`, level: 30, classId: 1, raceId: 2, rank: 3 },
      { profile: loadFixture("luvia-profile").data, specializations: null, equipment: null, media: null, professions: null, raids: null,
        statistics: null, reputations: null, achievements: { achievements: [
          ...done.map((a) => ({ id: a, criteria: { is_completed: true } })),
          ...open.map((a) => ({ id: a, criteria: { is_completed: false, child_criteria: [{ id: 1, is_completed: true }] } })),
        ] } },
      "t",
    );
    await store.set(`characters/${id}`, { ...rec, id });
  };

  test("holt is_account_wide je abgeschlossenem Erfolg, offene Erfolge nicht", async () => {
    await withAchievements(1, [62031, 627], [999]);
    await withAchievements(2, [62031, 1176]);
    routes["/data/wow/achievement/62031"] = { status: 200, data: { id: 62031, is_account_wide: true } };
    routes["/data/wow/achievement/627"] = { status: 200, data: { id: 627, is_account_wide: false } };
    const rep = await run();
    expect(rep.accountWideAdded).toBe(3);
    expect(await store.get("static/achievement-account-wide")).toEqual({ "62031": true, "627": false, "1176": null });
    expect(fake.calls).not.toContain("/data/wow/achievement/999");
    expect(fake.calls.filter((c) => c === "/data/wow/achievement/62031")).toHaveLength(1);
    expect((await store.get<Record<string, string>>("static/achievement-account-wide-checked"))?.["1176"]).toBe("2026-11-06T03:00:00.000Z");

    // Bekannte Angaben werden nicht erneut abgefragt.
    fake.calls.length = 0;
    expect((await run()).accountWideAdded).toBe(0);
    expect(fake.calls.filter((c) => c.startsWith("/data/wow/achievement/"))).toEqual([]);
  });

  test("Serverfehler speichert nichts, der nächste Lauf versucht es erneut", async () => {
    await withAchievements(1, [62031]);
    routes["/data/wow/achievement/62031"] = { status: 503, data: null };
    await run();
    expect((await store.get<Record<string, boolean | null>>("static/achievement-account-wide"))?.["62031"]).toBeUndefined();
    routes["/data/wow/achievement/62031"] = { status: 200, data: { is_account_wide: true } };
    await run();
    expect((await store.get<Record<string, boolean | null>>("static/achievement-account-wide"))?.["62031"]).toBe(true);
  });

  test("Indexeinträge ohne Erfolgsliste (ältere Daten) lösen keine Anfrage aus", async () => {
    await store.set(CHARACTER_INDEX_KEY, { "1": { slug: "c1", hasProfile: false, lastLoginAt: null, itemIds: [], itemLevels: {}, recipeIds: [] } });
    await store.set("characters/1", { id: 1 });
    expect((await run()).accountWideAdded).toBe(0);
    expect(await store.get("static/achievement-account-wide")).toEqual({});
  });
});

describe("Vorarbeit, Zeitlimit und Sperre", () => {
  const minimal = (id: number, slug: string, lastLoginAt: string | null, equipment: CharacterRecord["equipment"] = []) => ({
    ...buildCharacterRecord(
      { id, name: slug, surname: null, slug, level: 30, classId: 1, raceId: 2, rank: 3 },
      { profile: null, specializations: null, equipment: null, media: null, professions: null, raids: null, achievements: null, statistics: null, reputations: null },
      "t",
    ),
    hasProfile: true,
    lastLoginAt,
    equipment,
  });
  const item = (itemId: number, itemLevel: number | null) => ({
    slot: "HEAD", slotName: "Kopf", itemId, name: "x", quality: "EPIC", itemLevel, enchantments: [],
  });

  test("mit vollständigem Index liest der Lauf keinen einzigen Charakter-Blob", async () => {
    const recs = [minimal(1, "eins", "2026-11-05T10:00:00.000Z", [item(10421, 20)]), minimal(2, "zwei", null, [item(777, null)])];
    for (const r of recs) await store.set(`characters/${r.id}`, r);
    await store.set(CHARACTER_INDEX_KEY, Object.fromEntries(recs.map((r) => [String(r.id), toCharacterIndexEntry(r)])));
    await store.set("guild", { members: [{ id: 1, former: false }, { id: 2, former: false }] });
    const gets: string[] = [];
    const counting = { ...store, get: <T,>(key: string) => (gets.push(key), store.get<T>(key)) };
    const rep = await runStaticCollection({ client: fake, store: counting, config, now: () => new Date("2026-11-06T03:00:00.000Z") });
    expect(gets.filter((k) => k.startsWith("characters/"))).toEqual([]);
    expect(rep).toMatchObject({ charactersRead: 0, charactersUnread: 0, attributesFetched: 2, itemIconsAdded: 2, itemLevelsAdded: 1 });
    expect(await store.get("static/item-levels")).toEqual({ "10421": 20, "777": null });
  });

  test("Charaktere ohne Indexeintrag werden nachgelesen und zählen mit", async () => {
    await store.set("characters/1", minimal(1, "eins", null, [item(555, 7)]));
    await store.set("guild", { members: [{ id: 1, former: false }] });
    const rep = await run();
    expect(rep).toMatchObject({ charactersRead: 1, charactersUnread: 0, attributesFetched: 1 });
    expect((await store.get<Record<string, number>>("static/item-levels"))?.["555"]).toBe(7);
  });

  test("Bericht nennt die Dauer je Phase", async () => {
    const rep = await run();
    expect(Object.keys(rep.phases)).toEqual(
      expect.arrayContaining(["prep", "trees", "spells", "recipes", "items", "levels", "instances", "accountWide", "reputation", "professions", "images", "finish"]),
    );
    expect(rep.notStarted).toEqual([]);
  });

  test("laufende Sperre: zweiter Lauf endet sofort ohne Anfrage und ohne zu schreiben", async () => {
    await store.set(LOCK_KEY, { startedAt: "x", until: new Date(Date.now() + LOCK_TTL_MS).toISOString() });
    const before = JSON.stringify(store.dump());
    const rep = await run();
    expect(rep.busy).toBe(true);
    expect(fake.calls).toEqual([]);
    expect(JSON.stringify(store.dump())).toBe(before);
  });

  test("abgelaufene Sperre wird übergangen, nach dem Lauf ist sie gelöst", async () => {
    await store.set(LOCK_KEY, { startedAt: "x", until: new Date(Date.now() - 1).toISOString() });
    const rep = await run();
    expect(rep.busy).toBeUndefined();
    expect(rep.treesAdded).toBe(1);
    expect(await store.get(LOCK_KEY)).toBeNull();
  });

  test("Sperre wird auch nach einem Fehler gelöst", async () => {
    const broken: BlizzardClient = { get: async () => { throw new Error("kaputt"); } };
    await expect(runStaticCollection({ client: broken, store, config, now: () => new Date() })).rejects.toThrow("kaputt");
    expect(await store.get(LOCK_KEY)).toBeNull();
  });

  // Nachbildung des Live-Fehlers seit v2.1.2: 290 Charaktere, jeder Blob-Zugriff kostet Zeit, echte Uhr im Maßstab 1:10.
  // Vorher las der Lauf alle Charaktere nacheinander (290 × 5 ms > Budget) und schaffte nichts.
  test("Live-Größenordnung mit Blob-Latenz: der Lauf holt Werte und endet im Budget", async () => {
    const CHARACTERS = 290;
    const BLOB_MS = 5;
    const API_MS = 15;
    const BUDGET_MS = 1200;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const index: CharacterIndex = {};
    for (let id = 1; id <= CHARACTERS; id++) {
      const rec = minimal(id, `c${id}`, "2026-11-05T10:00:00.000Z", [item(id * 10, 100), item(id * 10 + 1, null)]);
      await store.set(`characters/${id}`, { ...rec, id });
      index[String(id)] = toCharacterIndexEntry(rec);
      routes[`/profile/wow/character/c${id}/statistics`] = { status: 200, data: { health: id } };
    }
    await store.set(CHARACTER_INDEX_KEY, index);
    await store.set("guild", { members: Array.from({ length: CHARACTERS }, (_, i) => ({ id: i + 1, former: false })) });
    const slowStore = {
      ...store,
      get: async <T,>(key: string) => (await sleep(BLOB_MS), store.get<T>(key)),
      set: async (key: string, value: unknown) => (await sleep(BLOB_MS), store.set(key, value)),
      list: async (prefix: string) => (await sleep(BLOB_MS * 3), store.list(prefix)),
      delete: async (key: string) => (await sleep(BLOB_MS), store.delete(key)),
    };
    const slowClient: BlizzardClient = { get: async (p, ns) => (await sleep(API_MS), fake.get(p, ns)) };
    const t0 = Date.now();
    const rep = await runStaticCollection({ client: slowClient, store: slowStore, config: { ...config, budgetMs: BUDGET_MS }, now: () => new Date() });
    const total = Date.now() - t0;
    expect(rep.attributesFetched).toBeGreaterThan(30);
    expect(rep.itemIconsAdded + rep.itemLevelsAdded).toBeGreaterThan(0);
    expect(rep.phases.prep).toBeLessThan(BUDGET_MS / 10);
    // Ende vor dem Budget: die Reserve fängt laufende Anfragen und das Schreiben ab.
    expect(total).toBeLessThan(BUDGET_MS);
  });
});
