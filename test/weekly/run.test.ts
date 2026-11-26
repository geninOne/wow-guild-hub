import { beforeEach, describe, expect, onTestFinished, test, vi } from "vitest";
import type { DaySnapshot, GuildRecord, WeeklyIndex, WeeklyRecord } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import { bausteinGenerator } from "../../src/weekly/zeitung-text";
import { runWeeklyEvaluation, snapshotDates, weekActivity } from "../../src/weekly/run";
import { member } from "../helpers/members";

const guild: GuildRecord = {
  fetchedAt: "2026-11-16T08:00:00.000Z", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 2, rulesetName: "Normal",
  members: [
    member({ id: 1, name: "Anna", firstSeenAt: "2026-11-01T10:00:00.000Z" }),
    member({ id: 2, name: "Bodo", firstSeenAt: "2026-11-01T10:00:00.000Z" }),
  ],
};

const snap = (date: string, levels: Record<string, number>, deaths: Record<string, number> = {}): DaySnapshot => ({
  date,
  takenAt: `${date}T20:00:00.000Z`,
  characters: Object.fromEntries(
    Object.entries(levels).map(([id, level]) => [id, { level, equippedItemLevel: null, professions: {}, deaths: deaths[id] ?? 0 }]),
  ),
});

// Sonntag, 15.11.2026, 10 Uhr: die letzte abgeschlossene Bärenklaue-Woche ist 2026-11-14 (8. bis 14.11.).
const NOW = "2026-11-15T09:00:00.000Z";
let store: ReturnType<typeof createMemoryStore>;
// Ohne Serverstart gilt überall der Vergleich zweier Tagesstände; eigene Tests weiter unten setzen ihn.
const run = (iso = NOW, optOuts: (string | number)[] = [], serverStart: string | null = null) =>
  runWeeklyEvaluation({ store, now: () => new Date(iso), optOuts, generator: bausteinGenerator, serverStart });

beforeEach(async () => {
  store = createMemoryStore();
  await store.set("guild", guild);
  await store.set("history/2026-11-07", snap("2026-11-07", { "1": 20, "2": 30 }, { "1": 1, "2": 5 }));
  await store.set("history/2026-11-12", snap("2026-11-12", { "1": 22, "2": 30 }, { "1": 2, "2": 5 }));
  await store.set("history/2026-11-14", snap("2026-11-14", { "1": 25, "2": 30 }, { "1": 4, "2": 5 }));
  await store.set("history/2026-11-15", snap("2026-11-15", { "1": 40, "2": 30 }, { "1": 9, "2": 5 }));
  await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [2, 26], "2": [20] } });
});

test("snapshotDates: letzter Stand vor der Woche, sonst frühester in der Woche", () => {
  const dates = ["2026-11-12", "2026-11-08", "2026-11-15", "2026-11-16"];
  expect(snapshotDates(dates, "2026-11-09", "2026-11-15")).toEqual({ before: "2026-11-08", end: "2026-11-15" });
  expect(snapshotDates(["2026-11-12", "2026-11-15"], "2026-11-09", "2026-11-15")).toEqual({ before: "2026-11-12", end: "2026-11-15" });
  expect(snapshotDates(["2026-11-20"], "2026-11-09", "2026-11-15")).toEqual({ before: null, end: null });
});

test("wertet die letzte abgeschlossene Woche aus und schreibt Ergebnis und Index", async () => {
  // Installation mit Dialekten, wie die Bärenklaue-Gilden
  vi.stubEnv("SEITE_SPRACHEN", "de,schwaebisch,bayrisch,en");
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  const report = await run();
  // 2026-11-07 hat nur den Stand vom Samstag: wird ausgewertet, ergibt aber eine ruhige Woche.
  expect(report.evaluated).toEqual(["2026-11-07", "2026-11-14"]);
  expect(report.empty).toHaveLength(6);
  expect((await store.get<WeeklyRecord>("weekly/2026-11-07"))?.zeitung.lead.kind).toBe("ruhig");
  const record = await store.get<WeeklyRecord>("weekly/2026-11-14");
  expect(record).toMatchObject({ week: "2026-11-14", from: "2026-11-08", to: "2026-11-14", generatedAt: NOW });
  expect(record).not.toHaveProperty("testdaten");
  // Stand vom Sonntag 15.11. gehört schon zur nächsten Woche: 5 Level und 3 Tode, nicht 20 und 8.
  // Zwei Nachtanmeldungen und zwei aktive Tage liegen unter den Mindestwerten.
  expect(record?.titles).toEqual([
    { titleId: "dauerlaeufer", characterId: 1, value: 5 },
    { titleId: "pechvogel", characterId: 1, value: 3 },
  ]);
  expect(record?.zeitung).toMatchObject({ generator: "bausteine", lead: { kind: "sprung", section: "Aufsteiger", characterIds: [1] } });
  expect(record?.zeitung.lead.text).toContain("Dauerläufer");
  expect(record?.zeitung.articles.map((a) => [a.kind, a.section])).toEqual([["titel", "Friedhof"]]);
  expect(record?.zeitung.motto.length).toBeGreaterThan(3);
  expect(await store.get<WeeklyIndex>("weekly/index")).toEqual({
    weeks: ["2026-11-07", "2026-11-14"],
    entries: {
      "2026-11-07": {
        headline: expect.any(String),
        dialekte: { en: expect.any(String), schwaebisch: expect.any(String), bayrisch: expect.any(String) },
        from: "2026-11-01",
        to: "2026-11-07",
      },
      "2026-11-14": {
        headline: record?.zeitung.lead.headline,
        dialekte: {
          en: (record?.zeitung.lead.dialekte as { en?: { headline: string } } | undefined)?.en?.headline,
          schwaebisch: record?.zeitung.lead.dialekte?.schwaebisch?.headline,
          bayrisch: record?.zeitung.lead.dialekte?.bayrisch?.headline,
        },
        from: "2026-11-08",
        to: "2026-11-14",
      },
    },
  });
  // Die Ausgabe steht in allen Sprachen: Hochdeutsch oben, Englisch und Dialekte daneben, auch der Spruch
  expect(record?.zeitung.lead.dialekte?.bayrisch?.headline).not.toBe(record?.zeitung.lead.headline);
  expect(record?.zeitung.mottoDialekte?.schwaebisch?.length).toBeGreaterThan(3);
  expect((record?.zeitung.mottoDialekte as { en?: string } | undefined)?.en?.length).toBeGreaterThan(3);
  expect(await store.get("weekly/2026-11-21")).toBeNull();
});

test("zweiter Lauf schreibt nichts, auch mit späterer Uhrzeit", async () => {
  await run();
  const before = store.dump();
  const report = await run("2026-11-16T08:00:00.000Z");
  expect(report.evaluated).toEqual([]);
  expect(store.dump()).toEqual(before);
});

test("in der Folgewoche kommt die nächste Ausgabe dazu, verpasste Wochen werden nachgeholt", async () => {
  await store.set("activity/2026-W47", { week: "2026-W47", characters: { "2": [30] } });
  await store.set("activity/2026-W48", { week: "2026-W48", characters: { "2": [31] }, testdaten: true });
  const report = await run("2026-11-29T09:00:00.000Z");
  expect(report.evaluated).toEqual(["2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28"]);
  const index = await store.get<WeeklyIndex>("weekly/index");
  expect(index?.weeks).toEqual(["2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28"]);
  expect(index?.entries?.["2026-11-28"]).toMatchObject({ testdaten: true });
  expect((await store.get<WeeklyRecord>("weekly/2026-11-28"))?.testdaten).toBe(true);
  expect((await store.get<WeeklyRecord>("weekly/2026-11-21"))?.titles).toContainEqual({ titleId: "dauerlaeufer", characterId: 1, value: 15 });
});

test("Abmeldeliste wirkt auf Titel und damit auf die Zeitung", async () => {
  await run(NOW, ["anna"]);
  const record = await store.get<WeeklyRecord>("weekly/2026-11-14");
  expect(record?.titles).toEqual([]);
  expect(JSON.stringify(record?.zeitung)).not.toContain("Anna");
  expect(record?.zeitung.lead.characterIds).not.toContain(1);
});

test("ohne Gildendaten oder ohne Daten der Woche wird nichts geschrieben", async () => {
  const empty = createMemoryStore();
  const report = await runWeeklyEvaluation({ store: empty, now: () => new Date(NOW) });
  expect(report.evaluated).toEqual([]);
  expect(empty.dump()).toEqual({});

  const onlyGuild = createMemoryStore();
  await onlyGuild.set("guild", guild);
  const second = await runWeeklyEvaluation({ store: onlyGuild, now: () => new Date(NOW) });
  expect(second.evaluated).toEqual([]);
  expect(Object.keys(onlyGuild.dump())).toEqual(["guild"]);
});

test("eigener Texter ersetzt die Satzbausteine", async () => {
  await runWeeklyEvaluation({
    store,
    now: () => new Date(NOW),
    optOuts: [],
    serverStart: null,
    generator: async (facts) => ({
      articles: facts.map((f) => ({ kind: f.kind, headline: "Kopf", text: "Text", characterIds: [] })),
      motto: "Spruch",
      generator: "test",
      model: "testmodell",
      fallback: "nur ein Test",
    }),
  });
  expect((await store.get<WeeklyRecord>("weekly/2026-11-14"))?.zeitung).toMatchObject({
    lead: { kind: "sprung", headline: "Kopf", text: "Text", characterIds: [] },
    motto: "Spruch",
    generator: "test",
    model: "testmodell",
    fallback: "nur ein Test",
  });
});

test("Ausgaben entstehen der Reihe nach und speichern Bausteine und Zahl; die nächste kennt die vorigen", async () => {
  const seen: { week: string; recent: string[] }[] = [];
  await runWeeklyEvaluation({
    store,
    now: () => new Date("2026-11-29T09:00:00.000Z"),
    optOuts: [],
    serverStart: null,
    generator: async (facts, context) => {
      expect(context.gilden).toEqual(["Bärenklaue"]);
      seen.push({ week: context.week, recent: (context.recent ?? []).map((r) => r.week) });
      return bausteinGenerator(facts, context);
    },
  });
  expect(seen.map((s) => s.week)).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);
  expect(seen[2].recent).toEqual(["2026-11-14", "2026-11-07"]);
  const w46 = await store.get<WeeklyRecord>("weekly/2026-11-14");
  expect(w46?.zeitung.bausteine?.length).toBeGreaterThan(0);
  const w45 = await store.get<WeeklyRecord>("weekly/2026-11-07");
  const shared = (w46?.zeitung.bausteine ?? []).filter((id) => w45?.zeitung.bausteine?.includes(id));
  expect(shared).toEqual([]);
});

test("wer mitten in der Woche dazukommt, zählt ab seinem ersten Stand für Dauerläufer und Zeitung", async () => {
  await store.set("guild", {
    ...guild,
    members: [...guild.members, member({ id: 3, name: "Cleo", firstSeenAt: "2026-11-12T09:00:00.000Z" })],
  });
  await store.set("history/2026-11-12", snap("2026-11-12", { "1": 22, "2": 30, "3": 4 }, { "1": 2, "2": 5 }));
  await store.set("history/2026-11-14", snap("2026-11-14", { "1": 25, "2": 30, "3": 12 }, { "1": 4, "2": 5, "3": 1 }));
  // Am ersten Tag mit Level 2 aufgetaucht und bis zum Abend auf 4 gestiegen.
  await store.set("levelups", { events: [
    { characterId: 3, level: 3, at: "2026-11-12T12:00:00.000Z" },
    { characterId: 3, level: 4, at: "2026-11-12T14:00:00.000Z" },
  ] });
  await run();
  const record = await store.get<WeeklyRecord>("weekly/2026-11-14");
  expect(record?.titles).toEqual([
    { titleId: "dauerlaeufer", characterId: 3, value: 10 },
    { titleId: "pechvogel", characterId: 1, value: 3 },
  ]);
  expect(record?.zeitung.lead).toMatchObject({ kind: "sprung", characterIds: [3] });
});

test("Woche des Serverstarts: alle zählen ab Level 1 und Zählerstand 0, Stände davor bleiben außen vor", async () => {
  // Stand vor dem Serverstart (etwa alte Beispieldaten): darf nie Vergleich sein.
  await store.set("history/2026-11-01", snap("2026-11-01", { "1": 15, "2": 29 }, { "1": 1, "2": 5 }));
  await store.set("history/2026-11-06", snap("2026-11-06", { "1": 12, "2": 10 }, { "1": 1, "2": 2 }));
  await run(NOW, [], "2026-11-05");
  // Woche 1. bis 7.11.: Endstand vom Samstag 7.11. mit Anna 20 und Bodo 30, Tode 1 und 5.
  expect((await store.get<WeeklyRecord>("weekly/2026-11-07"))?.titles).toEqual([
    { titleId: "dauerlaeufer", characterId: 2, value: 29 },
    { titleId: "pechvogel", characterId: 2, value: 5 },
  ]);
  expect((await store.get<WeeklyRecord>("weekly/2026-11-07"))?.zeitung.lead).toMatchObject({ kind: "sprung", characterIds: [2] });
  // Die Folgewoche vergleicht wie bisher mit dem Stand vom Samstag davor.
  expect((await store.get<WeeklyRecord>("weekly/2026-11-14"))?.titles).toEqual([
    { titleId: "dauerlaeufer", characterId: 1, value: 5 },
    { titleId: "pechvogel", characterId: 1, value: 3 },
  ]);
});

test("Woche des Serverstarts neu erzeugen: nur sie entsteht neu, spätere Ausgaben bleiben unverändert", async () => {
  await run();
  const alt45 = await store.get<WeeklyRecord>("weekly/2026-11-07");
  const alt46 = await store.get<WeeklyRecord>("weekly/2026-11-14");
  expect(alt45?.titles).toEqual([]);
  // Wie `npm run zeitung:neu -- 2026-11-07`: Die Woche aus dem Index nehmen, dann erneut auswerten.
  await store.set("weekly/index", { weeks: ["2026-11-14"], entries: { "2026-11-14": { headline: alt46!.zeitung.lead.headline } } });
  const report = await run("2026-11-16T08:00:00.000Z", [], "2026-11-05");
  expect(report.evaluated).toEqual(["2026-11-07"]);
  expect((await store.get<WeeklyRecord>("weekly/2026-11-07"))?.titles).not.toEqual([]);
  expect(await store.get<WeeklyRecord>("weekly/2026-11-14")).toEqual(alt46);
  expect((await store.get<WeeklyIndex>("weekly/index"))?.weeks).toEqual(["2026-11-07", "2026-11-14"]);
});

test("Samstag 23:30 ist die Woche noch offen, ab Sonntag 0 Uhr wird sie ausgewertet", async () => {
  expect((await run("2026-11-14T22:30:00.000Z")).evaluated).toEqual(["2026-11-07"]);
  expect((await run("2026-11-14T23:05:00.000Z")).evaluated).toEqual(["2026-11-14"]);
  // Im Sommer liegt Mitternacht zwei Stunden vor UTC-Mitternacht.
  const summer = createMemoryStore();
  await summer.set("guild", guild);
  await summer.set("history/2026-07-11", snap("2026-07-11", { "1": 10, "2": 10 }));
  await summer.set("history/2026-07-18", snap("2026-07-18", { "1": 12, "2": 10 }));
  const runSummer = (iso: string) =>
    runWeeklyEvaluation({ store: summer, now: () => new Date(iso), optOuts: [], generator: bausteinGenerator, serverStart: null });
  expect((await runSummer("2026-07-18T21:30:00.000Z")).evaluated).toEqual(["2026-07-11"]);
  expect((await runSummer("2026-07-18T22:05:00.000Z")).evaluated).toEqual(["2026-07-18"]);
});

test("weekActivity setzt eine Bärenklaue-Woche aus den zwei berührten ISO-Wochen zusammen", async () => {
  // W46: Montag 9.11. 2 Uhr (vorige Bärenklaue-Woche) und Sonntag 15.11. 20 Uhr (diese).
  await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [2, 164] }, returns: { "1": 9 } });
  // W47: Dienstag 17.11. 6 Uhr (diese) und Sonntag 22.11. 6 Uhr (nächste); Bodo kehrt am Mittwoch zurück.
  await store.set("activity/2026-W47", { week: "2026-W47", characters: { "1": [30, 150], "2": [56] }, returns: { "2": 8 }, testdaten: true });
  expect(await weekActivity(store, "2026-11-21", "2026-11-15", "2026-11-21")).toEqual({
    week: "2026-11-21",
    characters: { "1": [30, 164], "2": [56] },
    // Annas Rückkehr war am Montag 9.11. und gehört nicht in diese Woche.
    returns: { "2": 8 },
    testdaten: true,
  });
  // Verkürzte Übergangswoche ab Montag: Der Sonntag 15.11. ist schon gewertet.
  expect((await weekActivity(store, "2026-11-21", "2026-11-16", "2026-11-21"))?.characters).toEqual({ "1": [30], "2": [56] });
  expect(await weekActivity(store, "2026-12-05", "2026-11-29", "2026-12-05")).toBeNull();
});

describe("Übergang von ISO-Wochen auf Bärenklaue-Wochen", () => {
  const legacy = async (week: string, from: string, to: string) => {
    const record = { week, from, to, generatedAt: "2026-11-17T03:15:00.000Z", titles: [], zeitung: { lead: { kind: "ruhig", headline: `Alt ${week}`, text: "", characterIds: [] }, articles: [], motto: "" } };
    await store.set(`weekly/${week}`, record);
    return record;
  };

  beforeEach(async () => {
    await store.set("history/2026-11-21", snap("2026-11-21", { "1": 46, "2": 33 }, { "1": 9, "2": 5 }));
  });

  test("altes Ergebnis bis Sonntag 15.11. bleibt, die erste Bärenklaue-Woche läuft verkürzt vom 16. bis 21.11.", async () => {
    const w45 = await legacy("2026-W45", "2026-11-02", "2026-11-08");
    const w46 = await legacy("2026-W46", "2026-11-09", "2026-11-15");
    await store.set("weekly/index", { weeks: ["2026-W45", "2026-W46"], entries: { "2026-W45": { headline: "Alt 2026-W45" }, "2026-W46": { headline: "Alt 2026-W46" } } });
    // Sonntag 15.11. 20 Uhr ist schon in W46 gewertet, Dienstag 17.11. zählt neu.
    await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [164] } });
    await store.set("activity/2026-W47", { week: "2026-W47", characters: { "2": [30] } });
    const report = await run("2026-11-22T09:00:00.000Z");
    expect(report.evaluated).toEqual(["2026-11-21"]);
    expect(await store.get("weekly/2026-W45")).toEqual(w45);
    expect(await store.get("weekly/2026-W46")).toEqual(w46);
    expect(await store.get("weekly/2026-11-14")).toBeNull();
    const record = await store.get<WeeklyRecord>("weekly/2026-11-21");
    expect(record).toMatchObject({ week: "2026-11-21", from: "2026-11-16", to: "2026-11-21" });
    // Vergleich mit dem Stand vom 15.11. (Ende von W46): Anna 40 auf 46, Bodo 30 auf 33.
    expect(record?.titles).toContainEqual({ titleId: "dauerlaeufer", characterId: 1, value: 6 });
    const index = await store.get<WeeklyIndex>("weekly/index");
    expect(index?.weeks).toEqual(["2026-W45", "2026-W46", "2026-11-21"]);
    expect(index?.entries?.["2026-11-21"]).toMatchObject({ from: "2026-11-16", to: "2026-11-21" });
    // Danach wieder volle Wochen von Sonntag bis Samstag.
    await store.set("history/2026-11-28", snap("2026-11-28", { "1": 50, "2": 33 }));
    expect((await run("2026-11-29T09:00:00.000Z")).evaluated).toEqual(["2026-11-28"]);
    expect(await store.get<WeeklyRecord>("weekly/2026-11-28")).toMatchObject({ from: "2026-11-22", to: "2026-11-28" });
  });

  test("ohne altes Ergebnis beginnt die Zählung früher, ganz ohne Lücke", async () => {
    const report = await run("2026-11-22T09:00:00.000Z");
    expect(report.evaluated).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);
    expect(await store.get<WeeklyRecord>("weekly/2026-11-21")).toMatchObject({ from: "2026-11-15", to: "2026-11-21" });
    expect((await store.get<WeeklyIndex>("weekly/index"))?.weeks).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);
  });
});

// Beide Richtungen: Mit nur sechs Wochen Historie entschiede der feste Zufall, und der läge in einem Fall daneben.
test.each([
  [1, 2],
  [2, 1],
])("Titelträger bei Gleichstand: die ganze Historie zählt, nicht nur die letzten Zeitungsausgaben (%i vor %i)", async (aeltester, juengerer) => {
  // Gleichstand bei den Toden: Anna und Bodo je 3. Einer hatte den Pechvogel vor acht Wochen, der andere vor sieben.
  await store.set("history/2026-11-14", snap("2026-11-14", { "1": 20, "2": 30 }, { "1": 4, "2": 8 }));
  await store.set("history/2026-11-07", snap("2026-11-07", { "1": 20, "2": 30 }, { "1": 1, "2": 5 }));
  const alt = Array.from({ length: 8 }, (_, i) => `2026-W${String(36 + i).padStart(2, "0")}`);
  for (const [i, w] of alt.entries()) {
    const titles = i === 0 ? [{ titleId: "pechvogel", characterId: aeltester, value: 3 }] : i === 1 ? [{ titleId: "pechvogel", characterId: juengerer, value: 3 }] : [];
    await store.set(`weekly/${w}`, { week: w, from: "2026-08-31", to: "2026-09-06", generatedAt: NOW, titles, zeitung: { lead: { kind: "ruhig", headline: "H", text: "T", characterIds: [] }, articles: [], motto: "M" } });
  }
  await store.set("weekly/index", { weeks: alt });
  await run();
  const pech = (await store.get<WeeklyRecord>("weekly/2026-11-14"))?.titles.find((a) => a.titleId === "pechvogel");
  expect(pech).toEqual({ titleId: "pechvogel", characterId: aeltester, characterIds: [aeltester, juengerer], value: 3 });
});
