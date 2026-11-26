import { beforeEach, expect, test } from "vitest";
import { activityWeeks, buildActivityView } from "../../src/api/activity-view";
import { characterTitles } from "../../src/api/fun-common";
import { handleApi } from "../../src/api/router";
import { monthRange, weeksOfMonth } from "../../src/api/wrapped-view";
import type { ActivityView, ZeitungView, CharacterView, TitleRankingView, TitlesView, WrappedView } from "../../src/api/types";
import type { DaySnapshot, GuildRecord, WeeklyRecord } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import { member } from "../helpers/members";
import { ueberall } from "../../src/sprache";

const PECHVOGEL = { de: "Pechvogel", en: "Corpse Runner", schwaebisch: "Pechvogel", bayrisch: "Pechvogl" };
/** Wert eines Titels: in allen deutschen Fassungen gleich, Englisch eigen. */
const wert = (de: string, en: string) => ({ ...ueberall(de), en });
const DAUERLAEUFER = { ...ueberall("Dauerläufer"), en: "Marathon Runner" };

const guild: GuildRecord = {
  fetchedAt: "2026-11-16T08:00:00.000Z", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 3, rulesetName: "Normal",
  members: [
    member({ id: 1, name: "Anna", slug: "anna", guildSlug: "bärenklaue", level: 25, hasProfile: true }),
    member({ id: 2, name: "Bodo", slug: "bodo", guildSlug: "goldene-bärenklaue", level: 31 }),
    member({ id: 3, name: "Cleo", slug: "cleo", guildSlug: "bärenklaue", former: true }),
  ],
  guilds: [
    { slug: "bärenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 2, rulesetName: "Normal", main: true },
    { slug: "goldene-bärenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 1, rulesetName: "Normal", main: false },
  ],
};

const snap = (date: string, c: Record<string, Partial<DaySnapshot["characters"][string]>>, testdaten = false): DaySnapshot => ({
  date, takenAt: `${date}T20:00:00.000Z`,
  characters: Object.fromEntries(Object.entries(c).map(([id, v]) => [id, { level: 1, equippedItemLevel: null, professions: {}, ...v }])),
  ...(testdaten ? { testdaten: true } : {}),
});

const weekly = (week: string, from: string, to: string, over: Partial<WeeklyRecord> = {}): WeeklyRecord => ({
  week, from, to, generatedAt: "2026-11-16T03:15:00.000Z",
  titles: [{ titleId: "pechvogel", characterId: 1, value: 7 }, { titleId: "dauerlaeufer", characterId: 2, value: 3 }],
  zeitung: {
    lead: { kind: "sprung", headline: "Kopf", text: "Text", characterIds: [2] },
    articles: [{ kind: "titel", headline: "H", text: "T", characterIds: [1, 99], titleId: "pechvogel" }],
    motto: "No ned hudla.",
  },
  ...over,
});

const NOW = new Date("2026-11-18T12:00:00.000Z");
// Ohne Serverstart gilt überall der Vergleich zweier Tagesstände; einzelne Tests setzen ihn.
let serverStart: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const get = async <T = any>(path: string): Promise<{ status: number; body: T }> => {
  const res = await handleApi(new Request(`http://x${path}`), store, () => NOW, { serverStart });
  return { status: res.status, body: (await res.json()) as T };
};

let store: ReturnType<typeof createMemoryStore>;
beforeEach(async () => {
  serverStart = null;
  store = createMemoryStore();
  await store.set("guild", guild);
  await store.set("static/classes", { items: [{ id: 1, name: "Krieger" }] });
});

test("activityWeeks: laufende Woche und sieben davor", () => {
  const weeks = activityWeeks(NOW.toISOString());
  expect(weeks).toHaveLength(8);
  expect(weeks[0]).toBe("2026-W40");
  expect(weeks[7]).toBe("2026-W47");
});

test("/api/activity summiert je Gilde, ignoriert Unbekannte und ungültige Stunden", async () => {
  await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [20, 21], "2": [20], "99": [20] } });
  await store.set("activity/2026-W47", { week: "2026-W47", characters: { "1": [20, 500], "3": [5] }, testdaten: true });
  const { status, body } = await get<ActivityView>("/api/activity");
  expect(status).toBe(200);
  expect(body.weeksWithData).toBe(2);
  expect(body.from).toBe("2026-09-28");
  expect(body.to).toBe("2026-11-22");
  expect(body.all.cells[20]).toBe(3);
  expect(body.all.cells[21]).toBe(1);
  expect(body.all.cells[5]).toBe(1); // ehemaliges Mitglied zählt mit seiner letzten Gilde
  expect(body.all.characters).toBe(3);
  expect(body.byGuild["bärenklaue"].cells[20]).toBe(2);
  expect(body.byGuild["goldene-bärenklaue"]).toMatchObject({ characters: 1 });
  expect(body.byGuild["goldene-bärenklaue"].cells[20]).toBe(1);
  expect(body.all.cells.reduce((a, b) => a + b, 0)).toBe(5);
  expect(body.testdaten).toBe(true);
  // Mitgliederliste: Stunden mit Anmeldung je Charakter, meiste zuerst, Unbekannte fehlen, ungültige Stunden zählen nicht
  expect(body.logins).toEqual([[1, 3], [2, 1], [3, 1]]);
});

test("buildActivityView ohne Daten: leeres Raster", () => {
  const view = buildActivityView(guild, ["2026-W47"], [null]);
  expect(view.weeksWithData).toBe(0);
  expect(view.all.cells).toHaveLength(168);
  expect(view.testdaten).toBe(false);
  expect(view.logins).toEqual([]);
});

test("/api/titles: aktuelle Woche und Vorwochen, neueste zuerst; vor der ersten Auswertung leer", async () => {
  const empty = await get<TitlesView>("/api/titles");
  expect(empty.body.current).toBeNull();
  expect(empty.body.titles.map((t) => t.id)).toContain("pechvogel");

  await store.set("weekly/2026-W45", weekly("2026-W45", "2026-11-02", "2026-11-08", { titles: [] }));
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/index", { weeks: ["2026-W45", "2026-W46"] });
  const { body } = await get<TitlesView>("/api/titles");
  expect(body.current?.week).toBe("2026-W46");
  expect(body.current?.awards[0]).toMatchObject({
    titleId: "pechvogel", name: PECHVOGEL, valueText: wert("7 Tode", "7 deaths"), character: { id: 1, name: "Anna", slug: "anna" },
  });
  expect(body.history.map((h) => h.week)).toEqual(["2026-W45"]);
});

test("/api/titles?titel=&woche=: ganze Rangliste, alte Wochen nur mit Gewinner, unbekanntes 404", async () => {
  await store.set("weekly/2026-W45", weekly("2026-W45", "2026-11-02", "2026-11-08"));
  await store.set(
    "weekly/2026-11-21",
    weekly("2026-11-21", "2026-11-15", "2026-11-21", { rankings: { pechvogel: [[1, 7], [2, 1]], nachteule: [] } }),
  );
  await store.set("weekly/index", { weeks: ["2026-W45", "2026-11-21"] });

  const view = await get<TitlesView>("/api/titles");
  expect(view.body.current?.ranked).toBe(true);
  expect(view.body.history[0].ranked).toBe(false);

  const neu = await get<TitleRankingView>("/api/titles?titel=pechvogel&woche=2026-11-21");
  expect(neu.status).toBe(200);
  expect(neu.body).toEqual({
    titleId: "pechvogel", week: "2026-11-21", from: "2026-11-15", to: "2026-11-21", winnerIds: [1], complete: true,
    entries: [[1, 7], [2, 1]],
    valueTexts: { "7": wert("7 Tode", "7 deaths"), "1": wert("1 Tod", "1 death") },
  });
  // Titel ohne Werte in einer Woche mit Rangliste: leer, aber vollständig
  const leer = await get<TitleRankingView>("/api/titles?titel=nachteule&woche=2026-11-21");
  expect(leer.body).toMatchObject({ winnerIds: [], entries: [], complete: true });
  // Titel, der in der Rangliste fehlt (etwa später hinzugekommen): nur der Gewinner, falls es einen gibt
  const dauer = await get<TitleRankingView>("/api/titles?titel=dauerlaeufer&woche=2026-11-21");
  expect(dauer.body).toMatchObject({ winnerIds: [2], entries: [[2, 3]], complete: true });

  // Alte Woche ohne Rangliste: nur der Gewinner
  const alt = await get<TitleRankingView>("/api/titles?titel=pechvogel&woche=2026-W45");
  expect(alt.body).toMatchObject({ winnerIds: [1], entries: [[1, 7]], complete: false, valueTexts: { "7": wert("7 Tode", "7 deaths") } });

  for (const path of [
    "/api/titles?titel=gibtsnicht&woche=2026-11-21",
    "/api/titles?titel=pechvogel&woche=2026-11-28",
    "/api/titles?titel=pechvogel&woche=quatsch",
    "/api/titles?titel=pechvogel",
  ]) {
    expect((await get(path)).status, path).toBe(404);
  }
});

test("/api/zeitung: neueste Ausgabe, Blättern, Nummer, unbekannte Charaktere als Platzhalter", async () => {
  expect((await get("/api/zeitung")).status).toBe(404);
  await store.set("weekly/2026-W45", weekly("2026-W45", "2026-11-02", "2026-11-08"));
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15", { testdaten: true }));
  await store.set("weekly/index", { weeks: ["2026-W45", "2026-W46"] });

  const latest = await get<ZeitungView>("/api/zeitung");
  expect(latest.body).toMatchObject({ issue: 2, week: "2026-W46", previous: "2026-W45", next: null, testdaten: true });
  expect(latest.body.lead.characters.map((c) => c.name)).toEqual(["Bodo"]);
  expect(latest.body.articles[0].characters.map((c) => c.name)).toEqual(["Anna", "Unbekannt"]);
  expect(latest.body.articles[0].title).toEqual({ id: "pechvogel", name: PECHVOGEL });
  // Ausgaben ohne Übersetzung liefern Deutsch, auch als Englisch; Dialekte fallen in der Oberfläche auf Deutsch zurück
  expect(latest.body.lead.headline).toEqual({ de: "Kopf", en: "Kopf" });
  expect(latest.body.motto).toEqual({ de: "No ned hudla.", en: "No ned hudla." });
  expect(latest.body.lead.title).toBeNull();

  const first = await get<ZeitungView>("/api/zeitung/2026-W45");
  expect(first.body).toMatchObject({ issue: 1, previous: null, next: "2026-W46", testdaten: false });
  expect((await get("/api/zeitung/2026-W44")).status).toBe(404);
  expect((await get("/api/zeitung/quatsch")).status).toBe(404);
});

test("/api/zeitung und Archiv liefern Englisch, Schwäbisch und Bayrisch, fehlende Fassungen fallen auf Hochdeutsch zurück", async () => {
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15", {
    zeitung: {
      lead: {
        kind: "sprung", section: "Klatsch", headline: "Kopf", text: "Text", characterIds: [2],
        dialekte: {
          en: { headline: "Head", text: "The text" },
          schwaebisch: { headline: "Kopf, gell", text: "Des isch dr Text" },
          bayrisch: { headline: "Kopf, fei", text: "Des is da Text" },
        },
      },
      articles: [{ kind: "titel", headline: "H", text: "T", characterIds: [1], titleId: "pechvogel", dialekte: { bayrisch: { headline: "Hä", text: "Tja" } } }],
      motto: "Gut Ding will Weile haben.",
      mottoDialekte: { en: "Good things come to those who wait.", schwaebisch: "Schaffe, schaffe, Häusle baue.", bayrisch: "Mia san mia." },
      wetter: "Sonne.",
      wetterDialekte: { en: "Sunshine." },
      // Englisch liegt im Feld `dialekte` unter `en`; der Typ in model.ts kennt bisher nur die Dialekte
    } as WeeklyRecord["zeitung"],
  }));
  await store.set("weekly/index", {
    weeks: ["2026-W46"],
    entries: { "2026-W46": { headline: "Kopf", dialekte: { en: "Head", schwaebisch: "Kopf, gell", bayrisch: "Kopf, fei" } } },
  });
  const { body } = await get<ZeitungView>("/api/zeitung");
  expect(body.lead.headline).toEqual({ de: "Kopf", en: "Head", schwaebisch: "Kopf, gell", bayrisch: "Kopf, fei" });
  expect(body.lead.text.en).toBe("The text");
  expect(body.lead.text.bayrisch).toBe("Des is da Text");
  expect(body.lead.section).toEqual({ de: "Klatsch", en: "Gossip", schwaebisch: "Gschwätz", bayrisch: "Ratsch" });
  expect(body.articles[0].headline).toEqual({ de: "H", en: "H", bayrisch: "Hä" });
  expect(body.motto).toEqual({ de: "Gut Ding will Weile haben.", en: "Good things come to those who wait.", schwaebisch: "Schaffe, schaffe, Häusle baue.", bayrisch: "Mia san mia." });
  expect(body.wetter).toEqual({ de: "Sonne.", en: "Sunshine." });
  const archiv = await get<{ issues: { headline: unknown }[] }>("/api/zeitung/archiv");
  expect(archiv.body.issues[0].headline).toEqual({ de: "Kopf", en: "Head", schwaebisch: "Kopf, gell", bayrisch: "Kopf, fei" });
});

test("Charakterseite trägt die Titel der letzten Woche", async () => {
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/index", { weeks: ["2026-W46"] });
  const { body } = await get<CharacterView>("/api/characters/anna");
  expect(body.titles).toEqual([{ titleId: "pechvogel", name: PECHVOGEL, week: "2026-W46", from: "2026-11-09", to: "2026-11-15", valueText: wert("7 Tode", "7 deaths") }]);
  const bodo = await get<CharacterView>("/api/characters/bodo");
  expect(bodo.body.titles?.map((t) => t.name)).toEqual([DAUERLAEUFER]);
});

test("monthRange und weeksOfMonth", () => {
  expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  expect(weeksOfMonth("2026-11")).toEqual(["2026-W44", "2026-W45", "2026-W46", "2026-W47", "2026-W48", "2026-W49"]);
});

test("/api/wrapped: Monatsbilanz aus Tagesständen, Aktivität und Titeln", async () => {
  await store.set("history/2026-10-31", snap("2026-10-31", {
    "1": { level: 20, equippedItemLevel: 10, professions: { "186": 50 }, deaths: 2, recipes: 5, dungeons: 1 },
    "2": { level: 25 },
  }));
  await store.set("history/2026-11-10", snap("2026-11-10", { "1": { level: 22 } }));
  await store.set("history/2026-11-17", snap("2026-11-17", {
    "1": { level: 25, equippedItemLevel: 14, professions: { "186": 80, "164": 5 }, deaths: 9, recipes: 12, dungeons: 4 },
    "2": { level: 31 },
  }, true));
  // W44 beginnt im Oktober: Montag 26.10. zählt nicht, Sonntag 1.11. schon.
  await store.set("activity/2026-W44", { week: "2026-W44", characters: { "1": [20, 6 * 24 + 21] } });
  await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [21, 24 + 21, 24 + 22] } });
  await store.set("weekly/2026-W45", weekly("2026-W45", "2026-11-02", "2026-11-08"));
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/index", { weeks: ["2026-W45", "2026-W46"] });

  const { status, body } = await get<WrappedView>("/api/wrapped/anna");
  expect(status).toBe(200);
  expect(body).toMatchObject({
    month: "2026-11",
    months: ["2026-11", "2026-10"],
    running: true,
    from: "2026-10-31",
    to: "2026-11-17",
    since: null,
    serverStart: null,
    levels: { gained: 5, start: 20, end: 25 },
    rank: { place: 2, of: 2 },
    itemLevel: 4,
    professionPoints: 35,
    dungeons: 3,
    recipes: 7,
    deaths: 7,
    logins: 4,
    activeDays: 3,
    favoriteHour: 21,
    favoriteWeekday: 1,
    testdaten: true,
    character: { name: "Anna", className: "Krieger", level: 25 },
  });
  expect(body.titles.map((t) => [t.week, t.name])).toEqual([["2026-W45", PECHVOGEL], ["2026-W46", PECHVOGEL]]);

  const oct = await get<WrappedView>("/api/wrapped/anna/2026-10");
  expect(oct.body).toMatchObject({ month: "2026-10", running: false, levels: { gained: 0 }, logins: 1, favoriteHour: 20 });

  const none = await get<WrappedView>("/api/wrapped/anna/2026-05");
  expect(none.body).toMatchObject({ levels: null, rank: null, deaths: null, logins: 0, favoriteHour: null, titles: [] });

  expect((await get("/api/wrapped/niemand")).status).toBe(404);
  expect((await get("/api/wrapped/anna/2026-13")).status).toBe(404);
});

test("/api/zeitung/archiv: alle Ausgaben neueste zuerst, Schlagzeile aus dem Index, alte Wochen ohne Eintrag werden geladen", async () => {
  expect((await get("/api/zeitung/archiv")).body).toEqual({ issues: [] });
  await store.set("weekly/2026-W45", weekly("2026-W45", "2026-11-02", "2026-11-08", {
    zeitung: { lead: { kind: "ruhig", headline: "Alte Schlagzeile", text: "T", characterIds: [] }, articles: [], motto: "M" },
  }));
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/index", {
    weeks: ["2026-W45", "2026-W46"],
    entries: { "2026-W46": { headline: "Aus dem Index", testdaten: true } },
  });
  const loaded: string[] = [];
  const spy = { ...store, get: async <T,>(k: string) => { loaded.push(k); return store.get<T>(k); } };
  const res = await handleApi(new Request("http://x/api/zeitung/archiv"), spy, () => NOW);
  const body = (await res.json()) as { issues: unknown[] };
  expect(body.issues).toEqual([
    { issue: 2, week: "2026-W46", from: "2026-11-09", to: "2026-11-15", headline: { de: "Aus dem Index", en: "Aus dem Index" }, testdaten: true },
    { issue: 1, week: "2026-W45", from: "2026-11-02", to: "2026-11-08", headline: { de: "Alte Schlagzeile", en: "Alte Schlagzeile" }, testdaten: false },
  ]);
  expect(loaded).not.toContain("weekly/2026-W46");
});

test("/api/zeitung liefert Rubriken und Texter, alte Ausgaben ohne Rubrik landen unter Vermischtes", async () => {
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/index", { weeks: ["2026-W46"] });
  const { body } = await get<ZeitungView>("/api/zeitung");
  expect(body.generator).toBe("bausteine");
  expect(body.lead.section).toEqual({ de: "Vermischtes", en: "Miscellaneous", schwaebisch: "Allerlei", bayrisch: "Allerhand" });
  // Bilder der beteiligten Charaktere, ohne Datensatz null
  expect(body.avatars).toEqual({ "2": null, "1": null, "99": null });
  await store.set("characters/2", { id: 2, media: { avatar: "https://render.example/2-avatar.jpg" } });
  expect((await get<ZeitungView>("/api/zeitung")).body.avatars["2"]).toBe("https://render.example/2-avatar.jpg");
});

test("/api/wrapped: Nachzügler zählt ab seinem ersten Tagesstand im Monat und steht in der Rangfolge", async () => {
  const late: GuildRecord = {
    ...guild,
    members: [
      ...guild.members,
      member({ id: 4, name: "Dora", slug: "dora", guildSlug: "bärenklaue", level: 9, firstSeenAt: "2026-11-10T09:00:00.000Z" }),
      member({ id: 5, name: "Emil", slug: "emil", guildSlug: "bärenklaue", level: 44, firstSeenAt: "2026-11-12T18:00:00.000Z" }),
    ],
  };
  await store.set("guild", late);
  await store.set("history/2026-10-31", snap("2026-10-31", { "1": { level: 20 }, "2": { level: 25 } }));
  await store.set("history/2026-11-09", snap("2026-11-09", { "1": { level: 21 }, "2": { level: 25 } }));
  await store.set("history/2026-11-10", snap("2026-11-10", {
    "1": { level: 22 }, "2": { level: 25 }, "4": { level: 3, equippedItemLevel: 2, deaths: 0, dungeons: 0, recipes: 1 },
  }));
  await store.set("history/2026-11-12", snap("2026-11-12", {
    "1": { level: 23 }, "2": { level: 26 }, "4": { level: 6 }, "5": { level: 40, deaths: 11 },
  }));
  await store.set("history/2026-11-17", snap("2026-11-17", {
    "1": { level: 25 }, "2": { level: 31 }, "4": { level: 9, equippedItemLevel: 7, deaths: 2, dungeons: 1, recipes: 4 },
    "5": { level: 44, deaths: 12 },
  }));
  // Dora wurde am 10.11. mit Level 1 zuerst gesehen und stieg am selben Tag noch auf 3.
  await store.set("levelups", { events: [
    { characterId: 4, level: 2, at: "2026-11-10T12:00:00.000Z" },
    { characterId: 4, level: 3, at: "2026-11-10T15:00:00.000Z" },
    { characterId: 4, level: 4, at: "2026-11-11T15:00:00.000Z" },
  ] });

  const dora = (await get<WrappedView>("/api/wrapped/dora")).body;
  expect(dora).toMatchObject({
    from: "2026-11-10", to: "2026-11-17", since: null,
    levels: { gained: 8, start: 1, end: 9 },
    // Dora 8, Bodo 6, Anna 5, Emil 4
    rank: { place: 1, of: 4 },
    itemLevel: 5, deaths: 2, dungeons: 1, recipes: 3,
  });

  // Mit Level 40 beigetreten: gezählt wird ab dem Beitritt, mit Hinweis.
  const emil = (await get<WrappedView>("/api/wrapped/emil")).body;
  expect(emil).toMatchObject({
    from: "2026-11-12", since: "2026-11-12", levels: { gained: 4, start: 40, end: 44 }, rank: { place: 4, of: 4 }, deaths: 1,
  });

  // Wer im Vergleichsstand steht, bleibt unverändert.
  expect((await get<WrappedView>("/api/wrapped/anna")).body).toMatchObject({
    from: "2026-10-31", since: null, levels: { gained: 5, start: 20, end: 25 }, rank: { place: 3, of: 4 },
  });
});

test("/api/wrapped: im Monat des Serverstarts zählen alle ab Level 1 und Zählerstand 0", async () => {
  serverStart = "2026-11-05";
  await store.set("guild", {
    ...guild,
    members: [
      ...guild.members,
      member({ id: 5, name: "Emil", slug: "emil", guildSlug: "bärenklaue", level: 44, firstSeenAt: "2026-11-12T18:00:00.000Z" }),
    ],
  });
  // Ein Stand vor dem Serverstart (etwa alte Beispieldaten) wird nie herangezogen.
  await store.set("history/2026-10-31", snap("2026-10-31", { "1": { level: 10, deaths: 3 }, "2": { level: 12 } }));
  await store.set("history/2026-11-06", snap("2026-11-06", { "1": { level: 8, deaths: 1 }, "2": { level: 14 } }));
  await store.set("history/2026-11-12", snap("2026-11-12", { "1": { level: 20 }, "2": { level: 26 }, "5": { level: 40, deaths: 11 } }));
  await store.set("history/2026-11-17", snap("2026-11-17", {
    "1": { level: 25, equippedItemLevel: 14, professions: { "186": 80, "164": 5 }, deaths: 9, recipes: 12, dungeons: 4 },
    "2": { level: 31 },
    "5": { level: 44, deaths: 12 },
  }));

  const anna = (await get<WrappedView>("/api/wrapped/anna")).body;
  expect(anna).toMatchObject({
    month: "2026-11", months: ["2026-11"], from: "2026-11-05", to: "2026-11-17", since: null, serverStart: "2026-11-05",
    levels: { gained: 24, start: 1, end: 25 },
    // Emil 43, Bodo 30, Anna 24
    rank: { place: 3, of: 3 },
    // Gegenstandsstufe: aktueller Wert; Zähler und Berufspunkte: voller Stand.
    itemLevel: 14, professionPoints: 85, dungeons: 4, recipes: 12, deaths: 9,
  });

  // Mit Level 40 beigetreten: Auch diese Level sind seit dem Serverstart entstanden, kein Beitrittshinweis.
  expect((await get<WrappedView>("/api/wrapped/emil")).body).toMatchObject({
    from: "2026-11-05", since: null, serverStart: "2026-11-05",
    levels: { gained: 43, start: 1, end: 44 }, rank: { place: 1, of: 3 }, deaths: 12,
  });

  // Zähler, die der Endstand nicht kennt, bleiben ohne Wert.
  expect((await get<WrappedView>("/api/wrapped/bodo")).body).toMatchObject({ levels: { gained: 30 }, deaths: null, itemLevel: null });

  // Vor dem Serverstart gibt es nichts, auch wenn dort ein Stand liegt.
  expect((await get<WrappedView>("/api/wrapped/anna/2026-10")).body).toMatchObject({ levels: null, rank: null, serverStart: null });
});

test("/api/wrapped: nach dem Monat des Serverstarts gilt wieder der Stand vor Monatsbeginn", async () => {
  serverStart = "2026-11-05";
  await store.set("history/2026-10-31", snap("2026-10-31", { "1": { level: 10 } }));
  await store.set("history/2026-11-30", snap("2026-11-30", { "1": { level: 30, deaths: 4 }, "2": { level: 31 } }));
  await store.set("history/2026-12-10", snap("2026-12-10", { "1": { level: 36, deaths: 6 }, "2": { level: 33 } }));
  const res = await handleApi(new Request("http://x/api/wrapped/anna"), store, () => new Date("2026-12-11T12:00:00.000Z"), { serverStart });
  expect(await res.json()).toMatchObject({
    month: "2026-12", months: ["2026-12", "2026-11"], from: "2026-11-30", to: "2026-12-10", serverStart: null,
    levels: { gained: 6, start: 30, end: 36 }, rank: { place: 1, of: 2 }, deaths: 2,
  });
});

test("Bärenklaue-Wochen neben alten ISO-Wochen: Blättern, Archiv mit verkürzter Übergangswoche und Abzeichen", async () => {
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/2026-11-21", weekly("2026-11-21", "2026-11-16", "2026-11-21"));
  await store.set("weekly/2026-11-28", weekly("2026-11-28", "2026-11-22", "2026-11-28", { titles: [{ titleId: "dauerlaeufer", characterId: 1, value: 4 }] }));
  await store.set("weekly/index", {
    weeks: ["2026-W46", "2026-11-21", "2026-11-28"],
    entries: {
      "2026-W46": { headline: "Alt" },
      "2026-11-21": { headline: "Übergang", from: "2026-11-16", to: "2026-11-21" },
      "2026-11-28": { headline: "Neu", from: "2026-11-22", to: "2026-11-28" },
    },
  });
  const latest = await get<ZeitungView>("/api/zeitung");
  expect(latest.body).toMatchObject({ issue: 3, week: "2026-11-28", from: "2026-11-22", to: "2026-11-28", previous: "2026-11-21", next: null });
  const middle = await get<ZeitungView>("/api/zeitung/2026-11-21");
  expect(middle.body).toMatchObject({ issue: 2, from: "2026-11-16", to: "2026-11-21", previous: "2026-W46", next: "2026-11-28" });
  expect((await get("/api/zeitung/2026-11-22")).status).toBe(404); // kein Samstag
  expect((await get("/api/zeitung/2026-11-14")).status).toBe(404); // Samstag ohne Ausgabe

  const archive = await get<{ issues: { issue: number; week: string; from: string; to: string }[] }>("/api/zeitung/archiv");
  expect(archive.body.issues.map((i) => [i.issue, i.week, i.from, i.to])).toEqual([
    [3, "2026-11-28", "2026-11-22", "2026-11-28"],
    [2, "2026-11-21", "2026-11-16", "2026-11-21"],
    [1, "2026-W46", "2026-11-09", "2026-11-15"],
  ]);

  const anna = await get<CharacterView>("/api/characters/anna");
  expect(anna.body.titles).toEqual([{ titleId: "dauerlaeufer", name: DAUERLAEUFER, week: "2026-11-28", from: "2026-11-22", to: "2026-11-28", valueText: wert("4 Level", "4 levels") }]);
});

test("/api/wrapped: eine Bärenklaue-Woche gehört zum Monat ihres Samstags", async () => {
  await store.set("history/2026-11-28", snap("2026-11-28", { "1": { level: 5 } }));
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/2026-10-31", weekly("2026-10-31", "2026-10-25", "2026-10-31"));
  await store.set("weekly/2026-11-28", weekly("2026-11-28", "2026-11-22", "2026-11-28"));
  await store.set("weekly/2026-12-05", weekly("2026-12-05", "2026-11-29", "2026-12-05"));
  await store.set("weekly/index", { weeks: ["2026-10-31", "2026-W46", "2026-11-28", "2026-12-05"] });
  const nov = await get<WrappedView>("/api/wrapped/anna/2026-11");
  expect(nov.body.titles.map((t) => t.week)).toEqual(["2026-W46", "2026-11-28"]);
  const dec = await get<WrappedView>("/api/wrapped/anna/2026-12");
  expect(dec.body.titles.map((t) => t.week)).toEqual(["2026-12-05"]);
});

test("geteilter Titel: Karte zeigt den Titelträger, Rangliste hebt alle Inhaber hervor, Charakteransicht zählt für alle", async () => {
  const geteilt = weekly("2026-11-21", "2026-11-15", "2026-11-21", {
    titles: [{ titleId: "pechvogel", characterId: 2, characterIds: [2, 1], value: 7 }],
    rankings: { pechvogel: [[2, 7], [1, 7]] },
  });
  await store.set("weekly/2026-11-21", geteilt);
  await store.set("weekly/index", { weeks: ["2026-11-21"] });

  const view = await get<TitlesView>("/api/titles");
  expect(view.body.current?.awards).toHaveLength(1);
  expect(view.body.current?.awards[0]).toMatchObject({ character: { id: 2, name: "Bodo" }, sharedWith: 1 });

  const rangliste = await get<TitleRankingView>("/api/titles?titel=pechvogel&woche=2026-11-21");
  expect(rangliste.body).toMatchObject({ winnerIds: [2, 1], entries: [[2, 7], [1, 7]] });

  // Beide haben den Titel, auch wer nicht auf der Karte steht
  expect(characterTitles(geteilt, 1).map((t) => t.titleId)).toEqual(["pechvogel"]);
  expect(characterTitles(geteilt, 2).map((t) => t.titleId)).toEqual(["pechvogel"]);
  expect(characterTitles(geteilt, 3)).toEqual([]);
  const anna = await get<CharacterView>("/api/characters/anna");
  expect(anna.body.titles?.map((t) => t.titleId)).toEqual(["pechvogel"]);
});

test("alte Wochen mit nur einem Inhaber bleiben lesbar", async () => {
  const alt = weekly("2026-W46", "2026-11-09", "2026-11-15");
  await store.set("weekly/2026-W46", alt);
  await store.set("weekly/index", { weeks: ["2026-W46"] });
  const view = await get<TitlesView>("/api/titles");
  expect(view.body.current?.awards.map((a) => [a.titleId, a.character.id, a.sharedWith])).toEqual([["pechvogel", 1, 0], ["dauerlaeufer", 2, 0]]);
  expect(characterTitles(alt, 1).map((t) => t.titleId)).toEqual(["pechvogel"]);
  const rangliste = await get<TitleRankingView>("/api/titles?titel=dauerlaeufer&woche=2026-W46");
  expect(rangliste.body).toMatchObject({ winnerIds: [2], entries: [[2, 3]], complete: false });
});
