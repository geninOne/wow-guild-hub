import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { professionSlug } from "../../src/transform/professions";
import { handleApi } from "../../src/api/router";
import type { CharacterRecord, GuildRecord, MemberSummary, TalentTreeRecord } from "../../src/model";
import { createMemoryStore } from "../../src/store";

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/records/${name}`, import.meta.url)), "utf-8"));

const tree = fixture<TalentTreeRecord>("talent-trees/1114.json");
const gelmar = fixture<CharacterRecord>("character-1647409.json");
const spellIdsVon1114 = new Set(tree.specs.flatMap((s) => s.nodes.map((n) => n.spellId)));

function member(over: Partial<MemberSummary>): MemberSummary {
  return {
    id: 1, name: "Test", surname: null, slug: "test", rank: 0, level: 10, classId: 1, raceId: 1,
    hasProfile: true, former: false, firstSeenAt: "2026-11-01T00:00:00.000Z", leftAt: null,
    lastFetchedAt: "2026-11-06T10:00:00.000Z", equippedItemLevel: null, mainSpecName: null,
    professions: [], ...over,
  };
}

const guild: GuildRecord = {
  fetchedAt: "2026-11-06T10:00:00.000Z", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 1,
  rulesetName: "Classic",
  members: [
    member({ id: 1647409, name: "Gelmar", surname: "Soulvenn", slug: "gelmar-soulvenn", rank: 3, classId: 5, raceId: 5 }),
    member({ id: 8, name: "Weg", slug: "weg", former: true, leftAt: "2026-11-05T00:00:00.000Z" }),
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const body = (r: Response): Promise<any> => r.json();
const req = (p: string) => new Request(`http://x${p}`);

let store: ReturnType<typeof createMemoryStore>;
beforeEach(async () => {
  store = createMemoryStore();
  await store.set("guild", guild);
  await store.set("characters/1647409", gelmar);
  await store.set("static/classes", { items: [{ id: 5, name: "Priester" }] });
  await store.set("static/races", { items: [{ id: 5, name: "Untoter" }] });
  await store.set("static/item-icons", {});
  await store.set("static/talent-trees/index", { "5": 1114 });
  await store.set("static/talent-trees/1114", tree);
  await store.set("static/spell-icons", { "1": "https://render.worldofwarcraft.com/a.jpg" });
  await store.set("history/2026-11-06", {
    date: "2026-11-06", takenAt: "2026-11-06T10:00:00.000Z",
    characters: { "1647409": { level: 12, equippedItemLevel: null, professions: {} } },
  });
});

describe("handleApi", () => {
  test("Gilde mit Live-Cache-Headern", async () => {
    const res = await handleApi(req("/api/guild"), store);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(res.headers.get("Netlify-CDN-Cache-Control")).toBe("public, s-maxage=900, stale-while-revalidate=3600");
    expect((await body(res)).members).toHaveLength(2);
  });

  test("Charakter mit Werten aus attributes/<id>, ohne Blob nicht verfügbar", async () => {
    expect((await body(await handleApi(req("/api/characters/gelmar-soulvenn"), store))).attributes).toEqual({
      available: false, fetchedAt: null, resource: null, groups: [],
    });
    await store.set("attributes/1647409", { fetchedAt: "2026-11-26T03:00:00.000Z", fields: { health: 900 }, powerType: null });
    const view = await body(await handleApi(req("/api/characters/gelmar-soulvenn"), store));
    expect(view.attributes.groups).toEqual([{ id: "basis", rows: [{ key: "health", kind: "number", value: 900 }] }]);
  });

  test("Charakter per Slug und per ID, unbekannt 404 ohne Cache", async () => {
    expect((await body(await handleApi(req("/api/characters/gelmar-soulvenn"), store))).character.id).toBe(1647409);
    expect((await handleApi(req("/api/characters/1647409/"), store)).status).toBe(200);
    const res = await handleApi(req("/api/characters/niemand"), store);
    expect([res.status, res.headers.get("Cache-Control")]).toEqual([404, "no-store"]);
  });

  test("Mitglied ohne gespeicherten Datensatz liefert Ansicht aus der Mitgliederliste", async () => {
    const res = await handleApi(req("/api/characters/weg"), store);
    expect(res.status).toBe(200);
    expect((await body(res)).former).toBe(true);
  });

  test("Talente mit statischem Cache und nur eigenen Icons", async () => {
    const res = await handleApi(req("/api/talents/5"), store);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(res.headers.get("Netlify-CDN-Cache-Control")).toBe("public, s-maxage=86400, stale-while-revalidate=604800");
    const data = await body(res);
    expect(data.layout.className).toBe("Priester");
    expect(Object.keys(data.icons).every((id) => spellIdsVon1114.has(Number(id)))).toBe(true);
    expect((await handleApi(req("/api/talents/3"), store)).status).toBe(404);
  });

  test("Berufe antworten, Verlauf, Levelrennen und Raids gibt es nicht mehr", async () => {
    expect((await handleApi(req("/api/professions"), store)).status).toBe(200);
    for (const p of ["/api/characters/gelmar-soulvenn/history", "/api/levelrace", "/api/raids"])
      expect((await handleApi(req(p), store)).status).toBe(404);
  });

  test("Berufe und Charakter lesen deutsche Rezeptnamen", async () => {
    const p = gelmar.professions[0];
    const berufKuerzel = professionSlug(p.name);
    await store.set("characters/1647409", {
      ...gelmar,
      professions: [{ ...p, recipes: ["Bolt of Linen Cloth"], recipeIds: [2963] }],
    });
    await store.set("static/recipe-names", { "2963": "Leinenstoffballen" });
    const berufe = await body(await handleApi(req("/api/professions"), store));
    expect(berufe.recipes).toBeUndefined();
    const rezepte = await body(await handleApi(req(`/api/professions/${encodeURIComponent(berufKuerzel)}`), store));
    expect(rezepte.recipes.map((r: { name: string }) => r.name)).toEqual(["Leinenstoffballen"]);
    expect(berufe.guilds).toEqual([{ slug: "", name: "Bärenklaue", faction: "HORDE", memberCount: 1, main: true }]);
    const charakter = await body(await handleApi(req("/api/characters/gelmar-soulvenn"), store));
    expect(charakter.character.professions[0].recipes).toEqual(["Leinenstoffballen"]);
  });

  test("Rezepte je Beruf mit Details, unbekannter Beruf 404", async () => {
    const p = gelmar.professions[0];
    await store.set("characters/1647409", { ...gelmar, professions: [{ ...p, recipes: ["X"], recipeIds: [2408] }] });
    await store.set("static/recipes", {
      "2408": { id: 2408, name: "Braune Leinenhose", description: null, icon: null, craftedQuantity: 1, item: null,
        reagents: [{ id: 2996, name: "Leinenstoffballen", quantity: 2 }] },
    });
    await store.set("static/item-icons", { "2996": "https://render.worldofwarcraft.com/a.jpg" });
    const res = await handleApi(req(`/api/professions/${encodeURIComponent(professionSlug(p.name))}`), store);
    expect([res.status, res.headers.get("Cache-Control")]).toEqual([200, "public, max-age=300"]);
    const data = await body(res);
    expect(data.recipes[0]).toMatchObject({ id: 2408, name: "Braune Leinenhose", characterIds: [1647409] });
    expect(data.recipes[0].recipe.reagents[0].icon).toBe("https://render.worldofwarcraft.com/a.jpg");
    const charakter = await body(await handleApi(req("/api/characters/gelmar-soulvenn"), store));
    expect(charakter.character.professions[0].recipes).toEqual(["Braune Leinenhose"]);
    expect(charakter.recipes["2408"].reagents[0].icon).toBe("https://render.worldofwarcraft.com/a.jpg");
    expect((await handleApi(req("/api/professions/gibtsnicht"), store)).status).toBe(404);
    expect((await handleApi(req("/api/professions/a/b"), store)).status).toBe(404);
  });

  test("Charakter mit Dungeons und Raids, sobald Definitionen vorliegen", async () => {
    const vorher = await body(await handleApi(req("/api/characters/gelmar-soulvenn"), store));
    expect(vorher.instances.available).toBe(false);
    await store.set("characters/1647409", {
      ...gelmar,
      instances: {
        achievements: [{ id: 62031, completed: false, criteria: [11] }],
        bossKills: [{ boss: "Edwin van Cleef", instance: "Todesminen", quantity: 1, lastAt: "2026-11-20T20:00:00.000Z" }],
      },
    });
    await store.set("static/instance-achievements", {
      achievements: [
        { id: 62031, name: "Novize: Dungeonerforscher", kind: "dungeon", order: 0, rootDescription: null,
          criteria: [{ id: 11, description: "Todesminen" }] },
      ],
    });
    const nachher = await body(await handleApi(req("/api/characters/gelmar-soulvenn"), store));
    const dungeons = nachher.instances.dungeonTiers[0].dungeons as { name: string; completed: boolean }[];
    expect(dungeons.find((d) => d.name === "Todesminen")).toMatchObject({ completed: true, onAccount: false });
    // Zusatz-Dungeons aus config/zusatz-dungeons.json stehen mit drin.
    expect(dungeons.map((d) => d.name)).toEqual(expect.arrayContaining(["Flammenschlund", "Halle der Thanen", "Das Verlies"]));
  });

  test("Charakter mit Ruf und deutschen Fraktionsnamen", async () => {
    await store.set("characters/1647409", {
      ...gelmar,
      reputations: [{ factionId: 81, name: "Thunder Bluff", tier: 3, tierName: "Neutral", value: 2116, max: 3000 }],
    });
    await store.set("static/reputation-factions", {
      names: { "81": "Thunder Bluff" },
      groups: [{ id: 67, name: "Horde", factionIds: [81] }],
      checkedRoots: [67],
    });
    const v = await body(await handleApi(req("/api/characters/gelmar-soulvenn"), store));
    expect(v.reputation.groups).toEqual([
      { name: "Horde", factions: [{ id: 81, name: "Donnerfels", tier: 3, tierName: "Neutral", value: 2116, max: 3000 }] },
    ]);
  });

  test("ohne Gildendaten 503, unbekannter Pfad 404, POST 405", async () => {
    const leer = createMemoryStore();
    const res = await handleApi(req("/api/guild"), leer);
    expect([res.status, await body(res)]).toEqual([503, { error: "Noch keine Daten gesammelt" }]);
    expect((await handleApi(req("/api/gibtsnicht"), store)).status).toBe(404);
    const post = await handleApi(new Request("http://x/api/guild", { method: "POST" }), store);
    expect([post.status, post.headers.get("Cache-Control")]).toEqual([405, "no-store"]);
  });

  test("kaputte Prozentkodierung ergibt 404 ohne Cache und ohne Fehlerlog", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const p of ["/api/characters/%E0%A4%A", "/api/characters/%E0%A4%A/history"]) {
      const res = await handleApi(req(p), store);
      expect([res.status, res.headers.get("Cache-Control")]).toEqual([404, "no-store"]);
    }
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  test("Talent-Index kennt nur eigene Schlüssel", async () => {
    for (const k of ["constructor", "__proto__"])
      expect((await handleApi(req(`/api/talents/${k}`), store)).status).toBe(404);
  });

  test("HEAD wird wie GET beantwortet", async () => {
    const res = await handleApi(new Request("http://x/api/guild", { method: "HEAD" }), store);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(res.headers.get("Netlify-CDN-Cache-Control")).toBe("public, s-maxage=900, stale-while-revalidate=3600");
  });

  test("Ausnahme im Speicher ergibt 500 ohne Details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const kaputt = { ...store, get: async () => { throw new Error("geheim"); } };
    const res = await handleApi(req("/api/guild"), kaputt);
    expect([res.status, await body(res)]).toEqual([500, { error: "Interner Fehler" }]);
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
