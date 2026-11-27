import { beforeEach, describe, expect, test } from "vitest";
import cardsConfig from "../../config/statistik-karten.json";
import { handleApi } from "../../src/api/router";
import { buildStatCardMembers, buildStatCards, resolveStatsPeriod, STAT_LEADERS, statCards } from "../../src/api/stats-view";
import type { StatCardMembersView, StatsView } from "../../src/api/types";
import type { GuildRecord, MemberSummary } from "../../src/model";
import { statDefinition } from "../../src/stats/definitions";
import type { StatsSnapshot } from "../../src/stats/snapshot";
import { createMemoryStore } from "../../src/store";
import { fassungIn, SPRACHEN, ueberall } from "../../src/sprache";

/** Config text: a string for all languages or an object with at least `de`, only known languages. */
function expectConfigText(text: unknown, where: string) {
  if (typeof text === "string") return;
  expect(text, where).toBeTypeOf("object");
  const obj = text as Record<string, unknown>;
  expect(obj.de, where).toBeTypeOf("string");
  for (const [language, value] of Object.entries(obj)) {
    expect(SPRACHEN as readonly string[], where).toContain(language);
    expect(value, where).toBeTypeOf("string");
  }
}

/** Unit: a pair for all languages or an object with pairs per language (at least `de`). */
function expectConfigUnit(unit: unknown, where: string) {
  if (Array.isArray(unit)) {
    expect(unit, where).toHaveLength(2);
    return;
  }
  const obj = unit as Record<string, unknown>;
  expect(obj.de, where).toHaveLength(2);
  for (const [language, pair] of Object.entries(obj)) {
    expect(SPRACHEN as readonly string[], where).toContain(language);
    expect(pair, where).toHaveLength(2);
  }
}

function member(over: Partial<MemberSummary>): MemberSummary {
  return {
    id: 1, name: "Test", surname: null, slug: "test", rank: 0, level: 10, classId: 1, raceId: 1,
    hasProfile: true, former: false, firstSeenAt: "2026-11-01T00:00:00.000Z", leftAt: null,
    lastFetchedAt: "2026-11-06T10:00:00.000Z", equippedItemLevel: null, mainSpecName: null,
    professions: [], ...over,
  };
}

const guild: GuildRecord = {
  fetchedAt: "2026-11-21T10:00:00.000Z", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 3,
  rulesetName: "Classic",
  members: [
    member({ id: 1, name: "Anna", slug: "anna", classId: 5, guildSlug: "bärenklaue" }),
    member({ id: 2, name: "Bodo", slug: "bodo", classId: 1, guildSlug: "goldene-bärenklaue" }),
    member({ id: 3, name: "Cleo", slug: "cleo", classId: 8, guildSlug: "bärenklaue" }),
  ],
  guilds: [
    { slug: "bärenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 2, rulesetName: "Classic", main: true },
    { slug: "goldene-bärenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 1, rulesetName: "Classic", main: false },
  ],
};

const snapshot = (week: string, characters: StatsSnapshot["characters"], extra: Partial<StatsSnapshot> = {}): StatsSnapshot => ({
  week, takenAt: `${week}T20:00:00.000Z`, characters, ...extra,
});

// 60 deaths in total, 594 deaths by Hogger (no longer shown), 114 falls, 1065 /wave, 346 drinks (all counters), 95 quests per day (average)
const earlier = snapshot("2026-11-14", { "1": { "60": 3, "1065": 1 }, "2": { "60": 1 } });
const newer = snapshot("2026-11-21", {
  "1": { "60": 5, "594": 1, "95": 4, "1065": 4, "346": 250 },
  "2": { "60": 1, "1065": 2, "114": 1 },
  "3": { "60": 2 },
  "99": { "60": 7 },
});

describe("statCards", () => {
  test("config: only known counters and current values, texts only for used statistics, no dashes", () => {
    const ids = cardsConfig.karten.flatMap((k) => k.statistiken);
    for (const id of ids) expect(["zaehler", "stand"], `statistic ${id}`).toContain(statDefinition(id)?.art);
    const used = new Set(ids.map(String));
    for (const card of cardsConfig.karten as { slug: string; titel: unknown; spruch?: unknown }[]) {
      expectConfigText(card.titel, `title of ${card.slug}`);
      if (card.spruch !== undefined) expectConfigText(card.spruch, `blurb of ${card.slug}`);
    }
    for (const [id, text] of Object.entries(cardsConfig.texte as Record<string, Record<string, unknown>>)) {
      expect(used.has(id), `text for ${id}`).toBe(true);
      for (const field of ["kurz", "ehrung"]) if (field in text) expectConfigText(text[field], `${field} of ${id}`);
      if ("einheit" in text) expectConfigUnit(text.einheit, `unit of ${id}`);
      const conversion = text.umrechnung as { einheit: unknown; satz: unknown } | undefined;
      if (conversion) {
        expectConfigUnit(conversion.einheit, `conversion of ${id}`);
        expectConfigText(conversion.satz, `conversion sentence of ${id}`);
      }
    }
    expect(JSON.stringify(cardsConfig)).not.toMatch(/[\u2013\u2014]/);
  });

  test("a good dozen fun cards in different forms, deaths first, nothing dry", () => {
    const cards = statCards();
    expect(cards.length).toBeGreaterThanOrEqual(8);
    expect(cards.length).toBeLessThanOrEqual(16);
    expect(cards[0]).toMatchObject({ slug: "tode", form: "grabsteinfeld", span: 3 });
    expect(cards[0].ids[0]).toBe(60);
    expect(new Set(cards.map((c) => c.form)).size).toBeGreaterThanOrEqual(12);
    const all = cards.flatMap((c) => c.ids);
    for (const id of [1519, 1524, 932, 931, 107, 56, 594]) expect(all).not.toContain(id);
    for (const id of [1518, 112, 114, 1067, 1042, 319, 320, 108, 94, 64222, 1043, 1044, 346, 353, 349]) {
      expect(all).toContain(id);
    }
    expect(cards.every((c) => c.blurb !== null)).toBe(true);
  });

  test("titles and blurbs come in all languages, English translated separately", () => {
    for (const card of statCards()) {
      for (const language of SPRACHEN) {
        expect(fassungIn(card.title, language), `${card.slug} ${language}`).toBeTypeOf("string");
        expect(fassungIn(card.blurb!, language), `${card.slug} ${language}`).toBeTypeOf("string");
      }
      expect(card.title.en, card.slug).not.toBe(card.title.de);
      expect(card.blurb!.en, card.slug).not.toBe(card.blurb!.de);
    }
  });

  test("German and English without guild names and Swabian allusions", () => {
    const texts: string[] = [];
    const collect = (value: unknown, language = "") => {
      if (typeof value === "string") {
        if (language !== "schwaebisch" && language !== "bayrisch") texts.push(value);
      } else if (Array.isArray(value)) {
        for (const v of value) collect(v, language);
      } else if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) collect(v, k === "schwaebisch" || k === "bayrisch" ? k : language);
      }
    };
    collect(cardsConfig.karten);
    collect(cardsConfig.texte);
    for (const text of texts) expect(text).not.toMatch(/Bärenklaue|Ulm|Schwab|Schwäb|Vesper|Fläschle/);
  });
});

describe("resolveStatsPeriod", () => {
  const start = "2026-11-05"; // Bärenklaue week until Saturday 2026-11-07

  test("week needs the snapshot of the previous week", () => {
    expect(resolveStatsPeriod(["2026-11-14", "2026-11-21"], { kind: "week", week: "2026-11-21" }, start)).toEqual({
      before: "2026-11-14", after: "2026-11-21", status: "ok",
    });
    expect(resolveStatsPeriod(["2026-11-21"], { kind: "week", week: "2026-11-21" }, start)).toEqual({
      before: null, after: "2026-11-21", status: "zu-wenig",
    });
    // gap: the week before the previous one does not do
    expect(resolveStatsPeriod(["2026-11-07", "2026-11-21"], { kind: "week", week: "2026-11-21" }, start).status).toBe("zu-wenig");
  });

  test("week of the server start counts from all zeros", () => {
    expect(resolveStatsPeriod(["2026-11-07"], { kind: "week", week: "2026-11-07" }, start)).toEqual({
      before: null, after: "2026-11-07", status: "ok",
    });
  });

  test("month: from the server start in the start month, afterwards from the last week of the previous month", () => {
    expect(resolveStatsPeriod(["2026-11-21"], { kind: "month", month: "2026-11" }, start)).toEqual({
      before: null, after: "2026-11-21", status: "ok",
    });
    expect(resolveStatsPeriod(["2026-11-21", "2026-12-05"], { kind: "month", month: "2026-12" }, start).status).toBe("zu-wenig");
    expect(resolveStatsPeriod(["2026-11-28", "2026-12-05", "2026-12-12"], { kind: "month", month: "2026-12" }, start)).toEqual({
      before: "2026-11-28", after: "2026-12-12", status: "ok",
    });
  });

  test("total works right away, without a snapshot there is nothing", () => {
    expect(resolveStatsPeriod(["2026-11-21"], { kind: "total" }, start)).toEqual({ before: null, after: "2026-11-21", status: "ok" });
    expect(resolveStatsPeriod([], { kind: "total" }, start).status).toBe("keine");
    expect(resolveStatsPeriod(["2026-11-21"], { kind: "week", week: "2026-11-28" }, start).status).toBe("zu-wenig");
  });
});

describe("buildStatCards", () => {
  const stat = (cards: ReturnType<typeof buildStatCards>, id: number) => cards.flatMap((c) => c.stats).find((s) => s.id === id)!;

  test("counters as gain with sum, leaders and values per guild", () => {
    const cards = buildStatCards(guild, earlier, newer);
    const deaths = stat(cards, 60);
    // Anna +2, Bodo +0; Cleo and the unknown one are missing from the earlier snapshot and do not count
    expect(deaths).toMatchObject({ art: "zaehler", total: 2 });
    // Texts are `Fassungen` with German and English; missing dialects fall back to German
    expect(deaths.short).toEqual({ de: "Tode", en: "Deaths" });
    expect(deaths.unit!.de).toEqual(["Tod", "Tode"]);
    expect(deaths.unit!.en).toEqual(["death", "deaths"]);
    expect(deaths.honor!.de).toBe("Goldener Grabstein");
    expect(deaths.honor!.en).toBe("Golden Gravestone");
    for (const language of SPRACHEN) expect(fassungIn(deaths.unit!, language)).toHaveLength(2);
    expect(deaths.leaders.map((l) => [l.character.name, l.value])).toEqual([["Anna", 2]]);
    expect(deaths.perGuild).toEqual({ "bärenklaue": 2, "goldene-bärenklaue": 0 });
    expect(stat(cards, 1065).perGuild).toEqual({ "bärenklaue": 3, "goldene-bärenklaue": 2 });
    expect(stat(cards, 113)).toMatchObject({ total: 0, leaders: [] });
    const conversion = stat(cards, 346).conversion!;
    expect(conversion.per).toBe(100);
    expect(conversion.unit.de).toEqual(["Fass", "Fässer"]);
    expect(conversion.unit.en).toEqual(["barrel", "barrels"]);
    for (const language of SPRACHEN) expect(fassungIn(conversion.text, language)).toBeTypeOf("string");
    // How many characters have a value at all (for the stable), class color for the ECG
    expect(stat(cards, 1065).holders).toBe(2);
    expect(stat(cards, 60).holders).toBe(1);
    expect(stat(cards, 60).sum).toBe(2);
    expect(stat(cards, 800)).toMatchObject({ classId: 2, short: ueberall("Paladin"), holders: 0 });
  });

  test("newcomers: left out for week and month, included from the server start for total", () => {
    const before = snapshot("2026-11-14", { "1": { "60": 10 } });
    // Cleo joins with 400 deaths from her previous life and dies once more this week
    const after = snapshot("2026-11-21", { "1": { "60": 12 }, "3": { "60": 401 } });
    expect(stat(buildStatCards(guild, before, after), 60)).toMatchObject({ total: 2, holders: 1 });
    const total = stat(buildStatCards(guild, null, after), 60);
    expect(total.total).toBe(413);
    expect(total.leaders.map((l) => l.character.name)).toEqual(["Cleo", "Anna"]);
  });

  test("guild filter: sum and leaders only of the guild, comparison stays", () => {
    const horde = buildStatCards(guild, earlier, newer, "bärenklaue");
    expect(stat(horde, 60)).toMatchObject({ total: 2, perGuild: { "bärenklaue": 2, "goldene-bärenklaue": 0 } });
    expect(stat(horde, 60).leaders.map((l) => l.character.name)).toEqual(["Anna"]);
    const alliance = buildStatCards(guild, earlier, newer, "goldene-bärenklaue");
    expect(stat(alliance, 114)).toMatchObject({ total: 1 });
    expect(stat(alliance, 1065).leaders.map((l) => l.character.name)).toEqual(["Bodo"]);
    expect(stat(alliance, 60).leaders).toEqual([]);
  });

  test("current value like pets: maximum as total, sum of all characters as sum, owners as holders", () => {
    const pets = snapshot("2026-11-21", { "1": { "338": 3 }, "2": { "338": 2 }, "3": {} });
    expect(stat(buildStatCards(guild, null, pets), 338)).toMatchObject({ art: "stand", total: 3, sum: 5, holders: 2 });
    expect(stat(buildStatCards(guild, null, pets, "bärenklaue"), 338)).toMatchObject({ total: 3, sum: 3, holders: 1 });
  });

  test("server start as zero snapshot, at most five leaders", () => {
    const many = snapshot("2026-11-21", Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [String(i), { "1518": i }])));
    const fish = stat(buildStatCards(guild, null, many), 1518);
    expect(fish.total).toBe(28);
    expect(fish.leaders).toHaveLength(STAT_LEADERS);
    expect(fish.leaders[0].value).toBe(7);
  });
});

describe("buildStatCardMembers", () => {
  const ids = (card: string) => statCards().find((c) => c.slug === card)!.ids;

  test("per statistic of the card everyone with a value above 0, highest first, unknown ones stay in", () => {
    const deaths = buildStatCardMembers(null, newer, "tode")!;
    expect(deaths.slug).toBe("tode");
    expect(deaths.stats.map((s) => s.id)).toEqual(ids("tode"));
    expect(deaths.stats[0].entries).toEqual([[99, 7], [1, 5], [3, 2], [2, 1]]);
  });

  test("week counts the gain like the card, newcomers are missing", () => {
    const deaths = buildStatCardMembers(earlier, newer, "tode")!;
    expect(deaths.stats[0].entries).toEqual([[1, 2]]);
  });

  test("stable: the first statistic also includes those on foot with 0", () => {
    const [mounts] = ids("stall");
    const st = snapshot("2026-11-21", { "1": { [mounts]: 2 }, "2": {}, "3": { [mounts]: 1 } });
    expect(buildStatCardMembers(null, st, "stall")!.stats[0].entries).toEqual([[1, 2], [3, 1], [2, 0]]);
  });

  test("unknown card: null", () => {
    expect(buildStatCardMembers(null, newer, "quatsch")).toBeNull();
  });
});

describe("/api/stats", () => {
  let store: ReturnType<typeof createMemoryStore>;
  const opts = { serverStart: "2026-11-05" };
  const get = async (path: string) => {
    const res = await handleApi(new Request(`http://x${path}`), store, () => new Date("2026-11-21T12:00:00Z"), opts);
    return { status: res.status, body: res.status === 200 ? ((await res.json()) as StatsView) : null };
  };

  beforeEach(async () => {
    store = createMemoryStore();
    await store.set("guild", guild);
    await store.set("stats/2026-11-21", newer);
  });

  test("total from the server start with cards and guilds", async () => {
    const { status, body } = await get("/api/stats");
    expect(status).toBe(200);
    expect(body).toMatchObject({ kind: "gesamt", id: null, status: "ok", before: null, after: "2026-11-21", characters: 4, guild: null });
    expect(body!.weeks).toEqual(["2026-11-21"]);
    expect(body!.months).toEqual(["2026-11"]);
    expect(body!.guilds.map((g) => g.slug)).toEqual(["bärenklaue", "goldene-bärenklaue"]);
    expect(body!.cards[0]).toMatchObject({ slug: "tode", form: "grabsteinfeld" });
    expect(body!.cards[0].stats[0]).toMatchObject({ id: 60, total: 15 });
  });

  test("guild filter via ?gilde=, unknown guild: 404", async () => {
    const { body } = await get(`/api/stats?gilde=${encodeURIComponent("bärenklaue")}`);
    expect(body).toMatchObject({ guild: "bärenklaue", characters: 2 });
    expect(body!.cards[0].stats[0]).toMatchObject({ id: 60, total: 7 });
    expect((await get("/api/stats?gilde=quatsch")).status).toBe(404);
  });

  test("week without previous week: notice instead of numbers, with previous week the gain", async () => {
    const without = await get("/api/stats/woche");
    expect(without.body).toMatchObject({ kind: "woche", id: "2026-11-21", status: "zu-wenig", cards: [] });
    await store.set("stats/2026-11-14", earlier);
    const withPrevious = await get("/api/stats/woche/2026-11-21");
    expect(withPrevious.body).toMatchObject({ status: "ok", before: "2026-11-14" });
    expect(withPrevious.body!.cards[0].stats[0].total).toBe(2);
    expect(withPrevious.body!.weeks).toEqual(["2026-11-21", "2026-11-14"]);
  });

  test("month of the server start works right away", async () => {
    expect((await get("/api/stats/monat")).body).toMatchObject({ kind: "monat", id: "2026-11", status: "ok" });
  });

  test("without snapshots: status keine; wrong or unknown periods: 404", async () => {
    const empty = createMemoryStore();
    await empty.set("guild", guild);
    const res = await handleApi(new Request("http://x/api/stats/woche"), empty, () => new Date(), opts);
    expect(await res.json()).toMatchObject({ status: "keine", id: null });
    expect((await get("/api/stats/woche/2026-11-20")).status).toBe(404);
    expect((await get("/api/stats/woche/2026-11-28")).status).toBe(404);
    expect((await get("/api/stats/monat/2026-13")).status).toBe(404);
    expect((await get("/api/stats/jahr")).status).toBe(404);
    expect((await get("/api/stats/woche/2026-11-21/x")).status).toBe(404);
  });

  test("?karte= returns the members behind the card, always across all guilds", async () => {
    const res = await handleApi(new Request(`http://x/api/stats?karte=tode&gilde=${encodeURIComponent("bärenklaue")}`), store, () => new Date(), opts);
    expect(res.status).toBe(200);
    const body = (await res.json()) as StatCardMembersView;
    expect(body.slug).toBe("tode");
    expect(body.stats[0]).toEqual({ id: 60, entries: [[99, 7], [1, 5], [3, 2], [2, 1]] });
    // a week without the previous week does not do, an unknown card does not exist
    expect((await get("/api/stats/woche?karte=tode")).status).toBe(404);
    expect((await get("/api/stats?karte=quatsch")).status).toBe(404);
    await store.set("stats/2026-11-14", earlier);
    const week = await handleApi(new Request("http://x/api/stats/woche/2026-11-21?karte=tode"), store, () => new Date(), opts);
    expect(((await week.json()) as StatCardMembersView).stats[0].entries).toEqual([[1, 2]]);
  });

  test("English paths and parameters answer like the German ones of 2.x", async () => {
    await store.set("stats/2026-11-14", earlier);
    const slug = encodeURIComponent("bärenklaue");
    const pairs = [
      [`/api/stats?guild=${slug}`, `/api/stats?gilde=${slug}`],
      ["/api/stats/week", "/api/stats/woche"],
      ["/api/stats/week/2026-11-21", "/api/stats/woche/2026-11-21"],
      ["/api/stats/month", "/api/stats/monat"],
      ["/api/stats/week/2026-11-21?card=tode", "/api/stats/woche/2026-11-21?karte=tode"],
      ["/api/stats/week/2026-11-20", "/api/stats/woche/2026-11-20"],
    ];
    for (const [english, legacy] of pairs) {
      const a = await handleApi(new Request(`http://x${english}`), store, () => new Date("2026-11-21T12:00:00Z"), opts);
      const b = await handleApi(new Request(`http://x${legacy}`), store, () => new Date("2026-11-21T12:00:00Z"), opts);
      expect([english, a.status, await a.text()]).toEqual([english, b.status, await b.text()]);
    }
    expect((await get("/api/stats/week")).status).toBe(200);
  });
});
