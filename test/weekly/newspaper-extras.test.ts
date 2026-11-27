import { describe, expect, test, vi } from "vitest";
import { buildZeitungView } from "../../src/api/zeitung-view";
import type { GuildRecord, WeekMetrics, WeeklyRecord, WeeklySums } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import { issueExtras } from "../../src/weekly/issue-extras";
import { sameLength } from "../../src/weekly/phrases";
import { RECORD_HEADLINE, RECORD_TEXT, WEATHER, WEATHER_CLOSING, WEATHER_OPENING } from "../../src/weekly/phrases-extras";
import { sectionOf, type NewspaperFact } from "../../src/weekly/newspaper-facts";
import { phraseGenerator } from "../../src/weekly/newspaper-text";
import { createClaudeGenerator, factsForModel, systemPrompt, validateWeather, type MessagesClient } from "../../src/weekly/claude-text";
import { findRecords, buildLookback } from "../../src/weekly/records";
import { weatherSituation, type WeatherSituation } from "../../src/weekly/weather";
import { weeklySums, buildWeeklyNumbers } from "../../src/weekly/numbers";
import { SPRACHEN } from "../../src/sprache";
import { member } from "../helpers/members";

const guild: GuildRecord = {
  fetchedAt: "2026-11-20T08:00:00.000Z", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 4, rulesetName: "Normal",
  guilds: [
    { slug: "baerenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 3, rulesetName: "Normal", main: true },
    { slug: "goldene-baerenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 2, rulesetName: "Normal", main: false },
  ],
  members: [
    member({ id: 1, name: "Anna", guildSlug: "baerenklaue" }),
    member({ id: 2, name: "Bodo", guildSlug: "baerenklaue" }),
    member({ id: 3, name: "Cleo", guildSlug: "goldene-baerenklaue" }),
    member({ id: 4, name: "Dora", guildSlug: "goldene-baerenklaue" }),
    member({ id: 5, name: "Emil", guildSlug: "baerenklaue", former: true }),
  ],
};

function m(over: Partial<WeekMetrics> = {}): WeekMetrics {
  return {
    logins: 0, nightLogins: 0, earlyLogins: 0, activeDays: 0, levels: null, deaths: null, recipes: null, dungeons: null,
    achievements: null, itemLevel: null, reputation: null, awayDays: 0, ...over,
  };
}

const metrics = new Map<number, WeekMetrics>([
  [1, m({ logins: 10, levels: 5, deaths: 2 })],
  [2, m({ logins: 4, levels: 1, deaths: 0, recipes: 3 })],
  [3, m({ logins: 6, levels: 2, deaths: 7 })],
  [4, m({ logins: 0 })],
  [5, m({ logins: 99, levels: 99, deaths: 99 })],
]);

const empty = (): WeeklySums => ({ anmeldungen: null, level: null, tode: null, dungeons: null, rezepte: null, erfolge: null, ruf: null, gegenstandsstufe: null });

describe("week in numbers", () => {
  test("sums per guild and in total, without former and opted-out members, null without values", () => {
    const z = buildWeeklyNumbers(metrics, guild, new Set([2]));
    expect(z.gesamt).toMatchObject({ anmeldungen: 16, level: 7, tode: 9, rezepte: null, ruf: null });
    expect(z.gilden.baerenklaue).toMatchObject({ anmeldungen: 10, level: 5, tode: 2 });
    expect(z.gilden["goldene-baerenklaue"]).toMatchObject({ anmeldungen: 6, level: 2, tode: 7 });
    // Bodo opted out and does not appear among the top values either.
    expect(z.spitze).toEqual({ anmeldungen: [1, 10], level: [1, 5], tode: [3, 7] });
  });

  test("sum without any value is null, with value 0 it is 0", () => {
    expect(weeklySums(new Map([[1, m()]]), [guild.members[0]]).level).toBeNull();
    expect(weeklySums(new Map([[1, m({ levels: 0 })]]), [guild.members[0]]).level).toBe(0);
  });

  test("previous week from the stored issue, older weeks without numbers are recomputed", async () => {
    const store = createMemoryStore();
    const old = (week: string, from: string, to: string, numbers?: WeeklyRecord["zahlen"]) =>
      ({ week, from, to, generatedAt: "", titles: [], zeitung: { lead: { kind: "ruhig", headline: `Kopf ${week}`, text: "", characterIds: [] }, articles: [], motto: "" }, ...(numbers ? { zahlen: numbers } : {}) }) as WeeklyRecord;
    const previousWeek = buildWeeklyNumbers(new Map([[1, m({ logins: 3, levels: 1 })]]), guild);
    await store.set("weekly/index", { weeks: ["2026-W46", "2026-11-14"] });
    await store.set("weekly/2026-W46", old("2026-W46", "2026-11-02", "2026-11-08"));
    await store.set("weekly/2026-11-14", old("2026-11-14", "2026-11-09", "2026-11-14", previousWeek));
    const keyFigures = vi.fn(async () => new Map([[1, m({ logins: 50 })]]));
    const extras = await issueExtras({ store, guild, from: "2026-11-15", to: "2026-11-21", metrics, excluded: new Set(), previous: [], keyFigures });
    expect(keyFigures).toHaveBeenCalledWith("2026-11-02", "2026-11-08");
    expect(extras.numbers.vorwoche?.gesamt).toMatchObject({ anmeldungen: 3, level: 1 });
    expect(extras.numbers.gesamt).toMatchObject({ anmeldungen: 20, level: 8 });
    // Two earlier weeks are not enough for records yet.
    expect(extras.extraFacts).toEqual([]);
    expect(extras.lookback).toBeNull();
  });

  test("view: rows with previous week per guild, old issues without the new fields can still be shown", () => {
    const record = {
      week: "2026-11-21", from: "2026-11-15", to: "2026-11-21", generatedAt: "", titles: [],
      zeitung: { lead: { kind: "ruhig", headline: "Ruhig", text: "Nix los.", characterIds: [] }, articles: [], motto: "Spruch" },
    } as WeeklyRecord;
    const old = buildZeitungView(guild, record, ["2026-11-21"]);
    expect(old).toMatchObject({ zahlen: null, wetter: null, rueckblick: null });

    const z = buildWeeklyNumbers(metrics, guild);
    const fresh = buildZeitungView(
      guild,
      {
        ...record,
        zahlen: { ...z, vorwoche: { gesamt: { ...empty(), anmeldungen: 30, level: 8 }, gilden: { baerenklaue: { ...empty(), tode: 2 } } } },
        zeitung: {
          ...record.zeitung,
          wetter: "Sonne.",
          wetterDialekte: { schwaebisch: "Sonna." },
          rueckblick: { week: "2026-10-24", from: "2026-10-18", to: "2026-10-24", headline: "Damals", characterIds: [1] },
        },
      },
      ["2026-10-24", "2026-11-21"],
    );
    expect(fresh.zahlen?.gesamt.slice(0, 3)).toEqual([
      { art: "anmeldungen", wert: 20, vorwoche: 30 },
      { art: "level", wert: 8, vorwoche: 8 },
      { art: "tode", wert: 9, vorwoche: null },
    ]);
    expect(fresh.zahlen?.gilden.baerenklaue.find((r) => r.art === "tode")).toEqual({ art: "tode", wert: 2, vorwoche: 2 });
    expect(fresh.zahlen?.guilds.map((g) => g.slug)).toEqual(["baerenklaue", "goldene-baerenklaue"]);
    expect(fresh.wetter).toEqual({ de: "Sonne.", en: "Sonne.", schwaebisch: "Sonna." });
    expect(fresh.rueckblick).toMatchObject({ week: "2026-10-24", issue: 1, headline: { de: "Damals" }, characters: [{ id: 1, name: "Anna" }] });
  });
});

describe("records and lookback", () => {
  const z = (deaths: number, top?: [number, number]) => ({ gesamt: { ...empty(), tode: deaths }, spitze: top ? { tode: top } : {} });

  test("only from three earlier weeks on, only strictly greater and from the minimum value on", () => {
    expect(findRecords(z(30, [1, 9]), [z(10), z(12)])).toEqual([]);
    expect(findRecords(z(30, [1, 9]), [z(10, [2, 4]), z(12, [3, 9]), z(29)])).toEqual([{ art: "tode", characterId: null, value: 30, previous: 29 }]);
    expect(findRecords(z(29), [z(10), z(12), z(29)])).toEqual([]);
    expect(findRecords(z(5), [z(1), z(2), z(3)])).toEqual([]);
  });

  test("individual record with character, the clearest first", () => {
    const r = findRecords(z(31, [2, 12]), [z(30, [1, 4]), z(20, [3, 5]), z(10)]);
    expect(r).toEqual([
      { art: "tode", characterId: 2, value: 12, previous: 5 },
      { art: "tode", characterId: null, value: 31, previous: 30 },
    ]);
  });

  test("lookback takes the issue whose last day is exactly 28 days earlier, else none", () => {
    const rec = (week: string, to: string) =>
      ({ week, from: "", to, zeitung: { lead: { kind: "sprung", headline: `Kopf ${week}`, text: "", characterIds: [3], dialekte: { bayrisch: { headline: "Kopf bairisch", text: "" } } } } }) as unknown as WeeklyRecord;
    const r = buildLookback("2026-12-19", [rec("2026-12-12", "2026-12-12"), rec("2026-W47", "2026-11-21")]);
    expect(r).toEqual({ week: "2026-W47", from: "", to: "2026-11-21", headline: "Kopf 2026-W47", dialekte: { bayrisch: "Kopf bairisch" }, characterIds: [3] });
    expect(buildLookback("2026-12-26", [rec("2026-W47", "2026-11-21")])).toBeNull();
  });
});

describe("weather report", () => {
  const sumsWith = (s: Partial<WeeklySums>) => ({ ...empty(), anmeldungen: 40, ...s });
  const active = new Map(guild.members.map((x) => [x.id, m({ logins: 10, nightLogins: 0 })]));

  test("many deaths bring a storm over the guild with the most deaths", () => {
    const situation = weatherSituation({ weeklySums: sumsWith({ tode: 20, level: 2 }), metrics: active, members: guild.members, guild, deathsByGuild: { baerenklaue: 4, "goldene-baerenklaue": 16 } });
    expect(situation.elemente[0]).toMatchObject({ art: "sturm", ueber: "Goldene Bärenklaue" });
  });

  test("night owls bring starry nights, nothing notable is changeable, no people means doldrums", () => {
    const night = new Map(guild.members.map((x) => [x.id, m({ logins: 10, nightLogins: 2 })]));
    expect(weatherSituation({ weeklySums: sumsWith({}), metrics: night, members: guild.members, guild }).elemente.map((e) => e.art)).toEqual(["sternklar"]);
    expect(weatherSituation({ weeklySums: sumsWith({}), metrics: active, members: guild.members, guild }).elemente.map((e) => e.art)).toEqual(["wechselhaft"]);
    expect(weatherSituation({ weeklySums: sumsWith({ anmeldungen: 3 }), metrics: active, members: guild.members, guild }).elemente.map((e) => e.art)).toEqual(["flaute"]);
  });

  test("with history, what lies above the guild's own average counts, even with big numbers", () => {
    const many = new Map(guild.members.map((x) => [x.id, m({ logins: 70, nightLogins: 1 })]));
    const earlier = [sumsWith({ anmeldungen: 250, tode: 3000, level: 1500, dungeons: 900, rezepte: 6000 }), sumsWith({ anmeldungen: 260, tode: 3200, level: 1700, dungeons: 950, rezepte: 6200 })];
    const now = sumsWith({ anmeldungen: 280, tode: 3100, level: 2400, dungeons: 930, rezepte: 6100 });
    // Without history almost everything would be weather; with history only levelling stays clearly above average.
    expect(weatherSituation({ weeklySums: now, metrics: many, members: guild.members, guild }).elemente.map((e) => e.art)).toEqual(["schmiedehitze", "sturm", "sonne"]);
    expect(weatherSituation({ weeklySums: now, metrics: many, members: guild.members, guild, earlier }).elemente.map((e) => e.art)).toEqual(["sonne"]);
    // Logins collapse: doldrums.
    expect(weatherSituation({ weeklySums: { ...now, anmeldungen: 100 }, metrics: many, members: guild.members, guild, earlier }).elemente.map((e) => e.art)).toEqual(["flaute"]);
  });

  test("all weather pools have the same length in all versions", () => {
    for (const pool of [WEATHER_OPENING, WEATHER_CLOSING, RECORD_HEADLINE, RECORD_TEXT, ...Object.values(WEATHER)]) {
      expect(sameLength(pool)).toBe(true);
    }
  });

  const situation: WeatherSituation = { elemente: [{ art: "sturm", strength: 3, ueber: "Goldene Bärenklaue" }, { art: "sternklar", strength: 2 }] };
  const ctx = { week: "2026-11-21", name: (id: number) => ["", "Anna", "Bodo"][id], allNames: ["Anna", "Bodo"], wetter: situation, sprachen: SPRACHEN };

  test("phrases write the weather report in all languages, without numbers and without em dashes", async () => {
    const r = await phraseGenerator([{ kind: "ruhig" }], ctx);
    expect(r.wetter).toContain("Goldene Bärenklaue");
    expect(r.wetterDialekte?.en).toContain("over the guild Goldene Bärenklaue");
    expect(r.wetterDialekte?.schwaebisch).toContain("Goldene Bärenklaue");
    expect(r.wetterDialekte?.bayrisch).toBeTruthy();
    for (const t of [r.wetter!, r.wetterDialekte!.en!, r.wetterDialekte!.schwaebisch!, r.wetterDialekte!.bayrisch!]) {
      expect(t).not.toMatch(/\d|—/);
      expect(() => validateWeather(t, ctx)).not.toThrow();
    }
    expect(r.bausteine?.some((b) => b.startsWith("wetter-sturm:"))).toBe(true);
    // Without a weather situation everything stays as before.
    expect((await phraseGenerator([{ kind: "ruhig" }], { ...ctx, wetter: undefined })).wetter).toBeUndefined();
  });

  test("check: no numbers, no names, no repetition from earlier issues", () => {
    expect(() => validateWeather("Sturm mit 5 Böen über Azeroth, Schirm mitnehmen.", ctx)).toThrow(/numbers/);
    expect(() => validateWeather("Sturm über Anna, Schirm mitnehmen und gut festhalten.", ctx)).toThrow(/characters/);
    const old = "Sturm über der Gilde, Schirm mitnehmen.";
    expect(() => validateWeather(`Neu hier. ${old}`, { ...ctx, recent: [{ week: "x", bausteine: [], headlines: [], texts: [], motto: "", wetter: old }] })).toThrow(/repeats/);
    expect(validateWeather("Sturm — und danach sternklar über Azeroth.", ctx)).toBe("Sturm, und danach sternklar über Azeroth.");
  });

  function client(weather: (system: string) => unknown) {
    const create = vi.fn(async (params: { system: string; messages: { content: string }[] }) => ({
      model: "anthropic-router",
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({ artikel: [{ nr: 0, schlagzeile: "Stille Woche", text: "In Azeroth war es ruhig." }], spruch: "Gut Ding will Weile haben.", wetter: weather(params.system) }) }],
    }));
    return { client: { messages: { create } } as unknown as MessagesClient, create };
  }

  test("AI: weather report from the response, prompt knows the weather situation", async () => {
    const { client: c, create } = client(() => "Ein Sturmtief zieht über die Goldene Bärenklaue, nachts dann sternklar.");
    const r = await createClaudeGenerator({ client: c, log: () => {} })([{ kind: "ruhig" }], ctx);
    expect(r.generator).toBe("claude");
    expect(r.wetter).toBe("Ein Sturmtief zieht über die Goldene Bärenklaue, nachts dann sternklar.");
    const call = create.mock.calls[0][0];
    expect(call.system).toContain("Wetterbericht für Azeroth");
    expect(call.messages[0].content).toContain("Wetterlage für den Wetterbericht");
    expect(call.messages[0].content).toContain('"ueber": "Goldene Bärenklaue"');
    expect(systemPrompt("de")).not.toContain("Wetterbericht");
  });

  test("AI: a failed weather report only costs the weather, the phrases step in", async () => {
    const log = vi.fn();
    const { client: c } = client((system) => (system.includes("Schwäbisch") ? "Sturm mit 7 Böen über Azeroth heute." : "Sternklar und stürmisch über Azeroth, Schirm mitnehmen."));
    const r = await createClaudeGenerator({ client: c, log })([{ kind: "ruhig" }], ctx);
    expect(r.generator).toBe("claude");
    expect(r.articles[0].headline).toBe("Stille Woche");
    expect(r.wetter).toBe("Sternklar und stürmisch über Azeroth, Schirm mitnehmen.");
    expect(r.wetterDialekte?.schwaebisch).not.toMatch(/\d/);
    expect(r.wetterDialekte?.schwaebisch).toContain("Goldene Bärenklaue");
    expect(r.fallback).toMatch(/weather schwaebisch: Weather report names numbers/);
    expect(log).toHaveBeenCalled();
  });
});

describe("new articles in the newspaper", () => {
  const facts: NewspaperFact[] = [
    { kind: "rekord", entries: [{ art: "tode", characterId: null, value: 31, previous: 30 }, { art: "level", characterId: 1, value: 12, previous: 9 }] },
  ];
  const names: Record<number, string> = { 1: "Anna", 2: "Bodo", 3: "Cleo" };
  const ctx = { week: "2026-11-21", name: (id: number) => names[id], allNames: Object.values(names), sprachen: SPRACHEN };

  test("sections, numbers and phrases", async () => {
    expect(facts.map(sectionOf)).toEqual(["Rekorde"]);
    const r = await phraseGenerator(facts, ctx);
    expect(r.articles.map((a) => a.characterIds)).toEqual([[1]]);
    expect(r.articles[0].text).toContain("31");
    expect(r.articles[0].text).toContain("Anna mit 12 Level (bisher 9)");
    for (const a of r.articles) {
      expect(a.dialekte?.schwaebisch?.text).toBeTruthy();
      expect(a.dialekte?.bayrisch?.text).toBeTruthy();
    }
    const en = (a: (typeof r.articles)[number]) => (a.dialekte as { en?: { text: string } }).en?.text;
    expect(en(r.articles[0])).toContain("Anna with 12 levels (previously 9)");
    const model = factsForModel(facts, ctx) as Record<string, unknown>[];
    expect(model[0]).toMatchObject({ art: "rekord", neue_rekorde: [{ wer: "die ganze Gilde", neuer_rekord: 31, alter_rekord: 30 }, { wer: "Anna" }] });
  });
});
