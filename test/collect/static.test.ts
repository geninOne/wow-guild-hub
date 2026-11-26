import { beforeEach, expect, test } from "vitest";
import type { ApiResult } from "../../src/blizzard/client";
import type { Config } from "../../src/config";
import { runStaticCollection } from "../../src/collect/static";
import type {
  IconMap,
  InstanceAchievementsRecord,
  NamedList,
  RecipeDetails,
  ReputationFactionsRecord,
  TalentTreeRecord,
} from "../../src/model";
import { INSTANCE_IMAGE_IDS } from "../../src/instance-images";
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

test("Zeitbudget 0: kein Baum geholt, Icon-Tabelle trotzdem geschrieben", async () => {
  const rep = await run({ budgetMs: 0 });
  // Ein Baum und alle Instanzbilder werden auf den nächsten Lauf verschoben.
  expect(rep).toMatchObject({ treesAdded: 0, instanceImagesAdded: 0, skipped: 1 + INSTANCE_IMAGE_IDS.length + 12 });
  expect(await store.get<IconMap>("static/spell-icons")).toEqual({});
  expect(await store.get<NamedList>("static/classes")).not.toBeNull();
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
