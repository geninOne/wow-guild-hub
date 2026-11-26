import { expect, test } from "vitest";
import type { DaySnapshot, MemberSummary } from "../../src/model";
import { collectFacts, MAX_ARTICLES, sectionOf, type ZeitungFact } from "../../src/weekly/zeitung-facts";
import { bausteinArticles, bausteinGenerator, motto, pick } from "../../src/weekly/zeitung-text";
import { weekMetrics } from "../../src/weekly/metrics";
import { TITLES } from "../../src/weekly/titles";
import { member } from "../helpers/members";

const snap = (date: string, levels: Record<string, number>, recipes: Record<string, number> = {}): DaySnapshot => ({
  date,
  takenAt: `${date}T20:00:00.000Z`,
  characters: Object.fromEntries(
    Object.entries(levels).map(([id, level]) => [
      id,
      { level, equippedItemLevel: null, professions: {}, ...(id in recipes ? { recipes: recipes[id] } : {}) },
    ]),
  ),
});

const WEEK = { from: "2026-11-09", to: "2026-11-15" };
const OLD = "2026-11-01T10:00:00.000Z";

function facts(input: {
  members: MemberSummary[];
  before: DaySnapshot;
  end: DaySnapshot;
  activity?: { week: string; characters: Record<string, number[]> } | null;
  titles?: { titleId: string; characterId: number; characterIds?: number[]; value: number }[];
  excluded?: Set<number>;
}) {
  const activity = input.activity ?? null;
  const metrics = weekMetrics({ activity, before: input.before, end: input.end, members: input.members });
  return collectFacts({ ...WEEK, metrics, members: input.members, before: input.before, end: input.end, activity, titles: input.titles ?? [], excluded: input.excluded });
}

test("Aufmacher vorn, ähnliche Meldungen zusammengefasst, Titel des Springers steckt in der Sprung-Meldung", () => {
  const members = [
    member({ id: 1, name: "Anna", firstSeenAt: OLD }),
    member({ id: 2, name: "Bodo", firstSeenAt: OLD }),
    member({ id: 3, name: "Cleo", firstSeenAt: "2026-11-10T10:00:00.000Z" }),
    member({ id: 4, name: "Dora", firstSeenAt: OLD }),
    member({ id: 5, name: "Emil", firstSeenAt: OLD }),
  ];
  const before = snap("2026-11-08", { "1": 28, "2": 30, "3": 5, "4": 49, "5": 48 }, { "1": 10, "2": 3 });
  const end = snap("2026-11-15", { "1": 33, "2": 31, "3": 6, "4": 50, "5": 50 }, { "1": 14, "2": 4 });
  const activity = { week: "2026-W46", characters: { "1": [20], "2": [20], "3": [20], "4": [20], "5": [20, 44] } };
  const result = facts({
    members, before, end, activity,
    titles: [{ titleId: "dauerlaeufer", characterId: 1, value: 5 }, { titleId: "pechvogel", characterId: 2, value: 4 }],
  });
  expect(result).toEqual<ZeitungFact[]>([
    { kind: "sprung", characterId: 1, levels: 5, from: 28, to: 33, title: "dauerlaeufer" },
    { kind: "neuzugang", characterIds: [3] },
    { kind: "stosszeit", weekday: 0, hour: 20, count: 5 },
    { kind: "titel", titleId: "pechvogel", characterId: 2, value: 4 },
    {
      kind: "meilensteine",
      entries: [{ characterId: 4, level: 50 }, { characterId: 5, level: 50 }, { characterId: 1, level: 30 }],
    },
    { kind: "ueberholungen", entries: [{ characterId: 1, passedId: 2, level: 33 }] },
    { kind: "rezepte", characterId: 1, count: 4, total: 5, crafters: 2, title: null },
    { kind: "zahl", value: 10, what: "level" },
  ]);
  // Rubriken nach ihrer stärksten Meldung; die Rubrik des Aufmachers rückt dabei etwas nach hinten
  expect(result.map(sectionOf)).toEqual(["Aufsteiger", "Klatsch", "Klatsch", "Friedhof", "Aufsteiger", "Aufsteiger", "Handwerk", "Zahl der Woche"]);
});

test("Mindestwerte: kleine Sprünge, wenige Rezepte und eine einzelne Anmeldung sind keine Meldung", () => {
  const members = [member({ id: 1, name: "Anna", firstSeenAt: OLD }), member({ id: 2, name: "Bodo", firstSeenAt: OLD })];
  const before = snap("2026-11-08", { "1": 20, "2": 30 }, { "1": 10 });
  const end = snap("2026-11-15", { "1": 22, "2": 30 }, { "1": 12 });
  expect(facts({ members, before, end, activity: { week: "2026-W46", characters: { "1": [6] } } })).toEqual([{ kind: "ruhig" }]);
});

test("Überholungen: höchstens drei, jeder Charakter nur einmal, alles in einer Meldung", () => {
  const members = Array.from({ length: 8 }, (_, i) => member({ id: i + 1, name: `M${i + 1}`, firstSeenAt: OLD }));
  const before = snap("2026-11-08", { "1": 10, "2": 11, "3": 12, "4": 13, "5": 14, "6": 15, "7": 16, "8": 17 });
  const end = snap("2026-11-15", { "1": 30, "2": 29, "3": 28, "4": 27, "5": 14, "6": 15, "7": 16, "8": 17 });
  const f = facts({ members, before, end }).find((x) => x.kind === "ueberholungen");
  const count = f?.kind === "ueberholungen" ? f.entries.length : 0;
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(3);
  const ids = f?.kind === "ueberholungen" ? f.entries.flatMap((e) => [e.characterId, e.passedId]) : [];
  expect(new Set(ids).size).toBe(ids.length);
});

test("höchstens MAX_ARTICLES Meldungen, die Zahl der Woche bleibt als Schluss", () => {
  const members = Array.from({ length: 12 }, (_, i) => member({ id: i + 1, name: `M${i + 1}`, firstSeenAt: "2026-11-10T10:00:00.000Z" }));
  const before = snap("2026-11-08", Object.fromEntries(members.map((m) => [String(m.id), 5])), Object.fromEntries(members.map((m) => [String(m.id), 1])));
  const end = snap("2026-11-15", Object.fromEntries(members.map((m) => [String(m.id), 12 + m.id])), Object.fromEntries(members.map((m) => [String(m.id), 5])));
  const titles = TITLES.map((t, i) => ({ titleId: t.id, characterId: i + 2, value: 9 }));
  const result = facts({ members, before, end, titles, activity: { week: "2026-W46", characters: Object.fromEntries(members.map((m) => [String(m.id), [20, 21]])) } });
  expect(result.length).toBeLessThanOrEqual(MAX_ARTICLES);
  expect(result[result.length - 1].kind).toBe("zahl");
});

test("Abgemeldete kommen nicht vor, auch nicht als Überholte oder Neuzugang", () => {
  const members = [
    member({ id: 1, name: "Anna", firstSeenAt: OLD }),
    member({ id: 2, name: "Bodo", firstSeenAt: OLD }),
    member({ id: 3, name: "Cleo", firstSeenAt: "2026-11-10T10:00:00.000Z" }),
  ];
  const before = snap("2026-11-08", { "1": 28, "2": 30, "3": 5 });
  const end = snap("2026-11-15", { "1": 33, "2": 31, "3": 6 });
  const result = facts({ members, before, end, excluded: new Set([2, 3]) });
  const ids = JSON.stringify(result);
  expect(result.map((f) => f.kind)).toEqual(["sprung", "meilensteine"]);
  expect(ids).not.toMatch(/"(characterId|passedId)":(2|3)\b/);
});

const ALL_FACTS: ZeitungFact[] = [
  { kind: "sprung", characterId: 1, levels: 5, from: 28, to: 33, title: null },
  { kind: "sprung", characterId: 1, levels: 5, from: 28, to: 33, title: "dauerlaeufer" },
  { kind: "meilensteine", entries: [{ characterId: 1, level: 30 }] },
  { kind: "meilensteine", entries: [{ characterId: 1, level: 30 }, { characterId: 2, level: 50 }] },
  { kind: "ueberholungen", entries: [{ characterId: 1, passedId: 2, level: 33 }] },
  { kind: "ueberholungen", entries: [{ characterId: 1, passedId: 2, level: 33 }, { characterId: 3, passedId: 4, level: 20 }] },
  ...TITLES.map((t): ZeitungFact => ({ kind: "titel", titleId: t.id, characterId: 2, value: 3 })),
  { kind: "titel", titleId: "unbekannt", characterId: 2, value: 3 },
  { kind: "neuzugang", characterIds: [1] },
  { kind: "neuzugang", characterIds: [1, 2, 3] },
  { kind: "rezepte", characterId: 1, count: 1, total: 1, crafters: 1, title: null },
  { kind: "rezepte", characterId: 1, count: 4, total: 9, crafters: 3, title: "schaffe-schaffe" },
  { kind: "stosszeit", weekday: 2, hour: 20, count: 7 },
  { kind: "zahl", value: 42, what: "level" },
  { kind: "zahl", value: 42, what: "anmeldungen" },
  { kind: "ruhig" },
];
const names: Record<number, string> = { 1: "Anna", 2: "Bodo", 3: "Cleo", 4: "Dora" };
const ctx = (week: string) => ({ week, name: (id: number) => names[id] });

test("Satzbausteine: je Fakt ein Artikel mit Rubrik, deterministisch, ohne Gedankenstriche und Platzhalterreste", async () => {
  for (let w = 10; w < 40; w++) {
    const week = `2026-W${w}`;
    const result = await bausteinGenerator(ALL_FACTS, ctx(week));
    expect(result.generator).toBe("bausteine");
    expect(result.articles).toHaveLength(ALL_FACTS.length);
    expect(await bausteinGenerator(ALL_FACTS, ctx(week))).toEqual(result);
    for (const a of result.articles) {
      expect(a.section).toBeTruthy();
      for (const text of [a.headline, a.text]) {
        expect(text.length).toBeGreaterThan(1);
        expect(text).not.toMatch(/[—–]|undefined|null|NaN|\$\{/);
      }
    }
    expect(motto(week)).not.toMatch(/[—–]/);
  }
});

test("Eine typische Ausgabe wiederholt keine Schlagzeile und keinen Text", async () => {
  const issue: ZeitungFact[] = [ALL_FACTS[1], ALL_FACTS[3], ALL_FACTS[5], ALL_FACTS[17], ...ALL_FACTS.slice(6, 12), ALL_FACTS[14], ALL_FACTS[19], ALL_FACTS[20]];
  const articles = bausteinArticles(issue, ctx("2026-W46"));
  expect(new Set(articles.map((a) => a.headline)).size).toBe(articles.length);
  expect(new Set(articles.map((a) => a.text)).size).toBe(articles.length);
});

test("Artikel nennen die beteiligten Charaktere", async () => {
  const articles = bausteinArticles(ALL_FACTS, ctx("2026-W46"));
  expect(articles[0]).toMatchObject({ kind: "sprung", section: "Aufsteiger", characterIds: [1] });
  expect(articles[1].text).toContain("Dauerläufer");
  expect(articles[1].titleId).toBe("dauerlaeufer");
  expect(articles[0]).not.toHaveProperty("titleId");
  expect(articles.filter((a) => a.kind === "titel").every((a) => a.titleId)).toBe(true);
  const neu3 = articles.filter((a) => a.kind === "neuzugang")[1];
  expect(neu3.characterIds).toEqual([1, 2, 3]);
  expect(neu3.text).toContain("Anna, Bodo und Cleo");
  const ueber = articles.filter((a) => a.kind === "ueberholungen")[1];
  expect(ueber.characterIds).toEqual([1, 2, 3, 4]);
  const zahl = articles.find((a) => a.kind === "zahl")!;
  expect(zahl).toMatchObject({ headline: "42", section: "Zahl der Woche" });
});

test("pick wählt je Schlüssel fest und nutzt alle Bausteine", () => {
  const options = ["a", "b", "c"];
  expect(pick(options, "x")).toBe(pick(options, "x"));
  const seen = new Set(Array.from({ length: 60 }, (_, i) => pick(options, `k${i}`)));
  expect(seen.size).toBe(3);
});

test("Kein Artikel enthält den Spruch der Woche", () => {
  for (let w = 10; w < 53; w++) {
    const week = `2026-W${String(w).padStart(2, "0")}`;
    const spruch = motto(week).replace(/\.$/, "");
    for (const a of bausteinArticles(ALL_FACTS, ctx(week))) expect(`${a.headline} ${a.text}`).not.toContain(spruch);
  }
});

test("Wer am ersten Tag der Aufzeichnung auftaucht, ist kein Neuzugang", () => {
  const members = [
    member({ id: 1, name: "Anna", firstSeenAt: "2026-11-10T10:00:00.000Z" }),
    member({ id: 2, name: "Bodo", firstSeenAt: "2026-11-10T11:00:00.000Z" }),
    member({ id: 3, name: "Cleo", firstSeenAt: "2026-11-12T10:00:00.000Z" }),
  ];
  const s = snap("2026-11-15", { "1": 10, "2": 10, "3": 10 });
  expect(facts({ members, before: s, end: s })).toEqual([{ kind: "neuzugang", characterIds: [3] }]);
});

test("Was letzte Woche schon drin war, rückt nach hinten; die Zahl der Woche wechselt", () => {
  const members = [
    member({ id: 1, name: "Anna", firstSeenAt: OLD }),
    member({ id: 2, name: "Bodo", firstSeenAt: OLD }),
    member({ id: 3, name: "Cleo", firstSeenAt: "2026-11-10T10:00:00.000Z" }),
  ];
  const before = snap("2026-11-08", { "1": 20, "2": 30, "3": 5 }, { "1": 10 });
  const end = snap("2026-11-15", { "1": 25, "2": 31, "3": 12 }, { "1": 25 });
  const activity = { week: "2026-W46", characters: { "1": [20, 21, 22, 23, 44, 45], "2": [20, 21, 44, 45], "3": [20, 44] } };
  const metrics = weekMetrics({ activity, before, end, members });
  const base = { ...WEEK, metrics, members, before, end, activity, titles: [] };
  const ohne = collectFacts(base);
  expect(ohne[0].kind).toBe("sprung");
  expect(ohne.at(-1)).toEqual({ kind: "zahl", value: 13, what: "level" });

  const danach = collectFacts({ ...base, recent: [{ kinds: ["sprung", "rezepte"], zahl: "level" }] });
  expect(danach[0].kind).toBe("neuzugang");
  expect(danach.at(-1)).toEqual({ kind: "zahl", value: 12, what: "anmeldungen" });
  // Ist jede Art zuletzt dran gewesen, nimmt die Zahl die, die am längsten her ist
  const alle = collectFacts({ ...base, recent: [{ kinds: [], zahl: "anmeldungen" }, { kinds: [], zahl: "rezepte" }, { kinds: [], zahl: "level" }] });
  expect(alle.at(-1)).toMatchObject({ what: "level" });
});

test("Satzbausteine: jeder Topf hat Hochdeutsch, Englisch, Schwäbisch und Bayrisch in gleicher Länge, ohne Gedankenstriche", async () => {
  const b = await import("../../src/weekly/bausteine");
  const w = await import("../../src/weekly/bausteine-woche");
  const toepfe: unknown[] = [];
  for (const [name, wert] of [...Object.entries(b), ...Object.entries(w)]) {
    if (name === "ZEITUNG_STANDARD" || name === "REKORD_ART" || name === "REKORD_EINTRAG" || name === "WETTER_ORT") continue;
    if (!wert || typeof wert !== "object" || name === "Picker") continue;
    if ("de" in wert) toepfe.push(wert);
    else for (const unter of Object.values(wert)) if (unter && typeof unter === "object" && "de" in unter) toepfe.push(unter);
  }
  expect(toepfe.length).toBeGreaterThan(40);
  for (const topf of toepfe) expect(b.gleichLang(topf as never)).toBe(true);
  const args = { n: "Anna", a: "Anna", b: "Bodo", l: "Anna und Bodo", t: "Titel", v: "7 Tode", k: 2, levels: 3, from: 1, to: 4, level: 10, total: 5, dat: "x", akk: "y", day: "Montag", hour: 20, next: 21, count: 9 };
  for (const topf of toepfe as Record<string, unknown[]>[]) {
    for (const s of ["de", "en", "schwaebisch", "bayrisch"]) {
      for (const eintrag of topf[s]) {
        const text = typeof eintrag === "function" ? (eintrag as (a: unknown) => string)(args) : String(eintrag);
        expect(text).not.toMatch(/[—–]/);
        // Hochdeutsch und Englisch gelten für jede Gilde: keine Maultaschen-Würze, die bleibt den Dialekten
        if (s === "de" || s === "en") expect(text).not.toMatch(/Maultasch|Schupfnud|Ländle|Gildeblatt|Käsknöpfle/);
      }
    }
  }
});

test("Zeitungsname: WEBSITE_NEWSPAPER für alle Sprachen, sonst Gildenblatt, Guild Gazette, Gildeblatt und Gildnblatt", async () => {
  const { zeitungsName } = await import("../../src/weekly/bausteine-woche");
  expect(zeitungsName("de")).toBe("Gildenblatt");
  expect(zeitungsName("en", "")).toBe("Guild Gazette");
  expect(zeitungsName("schwaebisch", "  ")).toBe("Gildeblatt");
  expect(zeitungsName("bayrisch", null)).toBe("Gildnblatt");
  for (const s of ["de", "en", "schwaebisch", "bayrisch"] as const) expect(zeitungsName(s, " Bärenklaue-Blatt ")).toBe("Bärenklaue-Blatt");
});

test("Satzbausteine schreiben jede Ausgabe auf Deutsch, Englisch und in den angebotenen Dialekten", async () => {
  const { writeIssue } = await import("../../src/weekly/zeitung-text");
  const issue = writeIssue([{ kind: "neuzugang", characterIds: [1, 2, 3] }], {
    week: "2026-11-21",
    name: (id: number) => ["", "Anna", "Bodo", "Cleo"][id],
    sprachen: ["de", "schwaebisch", "bayrisch", "en"],
  });
  const a = issue.articles[0];
  expect(a.text).toContain("Anna, Bodo und Cleo");
  const en = (a.dialekte as { en?: { headline: string; text: string } }).en;
  expect(en?.text).toContain("Anna, Bodo and Cleo");
  expect(en?.headline).toBeTruthy();
  expect(issue.mottoDialekte.en).toBeTruthy();
  expect(issue.mottoDialekte.en).not.toBe(issue.motto);
  expect(a.dialekte?.schwaebisch?.text).toContain("Anna, Bodo ond Cleo");
  expect(a.dialekte?.bayrisch?.headline).toBeTruthy();
  expect(a.dialekte?.bayrisch?.text).not.toBe(a.text);
  expect(issue.mottoDialekte.schwaebisch).toBeTruthy();
  expect(issue.mottoDialekte.bayrisch).not.toBe(issue.motto);
});

test("geteilter Titel: die Zeitung nennt beim Gleichstand an der Spitze den Titelträger von der Karte, nicht den alphabetisch ersten", () => {
  const members = [member({ id: 1, name: "Anna", firstSeenAt: OLD }), member({ id: 2, name: "Zora", firstSeenAt: OLD })];
  const before = snap("2026-11-08", { "1": 20, "2": 20 });
  const end = snap("2026-11-15", { "1": 25, "2": 25 });
  const result = facts({ members, before, end, titles: [{ titleId: "dauerlaeufer", characterId: 2, characterIds: [2, 1], value: 5 }] });
  expect(result.find((f) => f.kind === "sprung")).toMatchObject({ characterId: 2, title: "dauerlaeufer" });
  expect(result.some((f) => f.kind === "titel" && f.titleId === "dauerlaeufer")).toBe(false);
});

test("ohne WEBSITE_LANGUAGES gibt es Deutsch und Englisch, aber keine Dialekte", async () => {
  const { writeIssue } = await import("../../src/weekly/zeitung-text");
  const vorher = process.env.WEBSITE_LANGUAGES;
  delete process.env.WEBSITE_LANGUAGES;
  try {
    const issue = writeIssue([{ kind: "stosszeit", weekday: 4, hour: 20, count: 9 }], { week: "2026-11-21", name: () => "x" });
    const d = issue.articles[0].dialekte as Record<string, { headline: string; text: string }>;
    expect(Object.keys(d)).toEqual(["en"]);
    expect(`${d.en.headline} ${d.en.text}`).toMatch(/Friday|20:00/);
    expect(Object.keys(issue.mottoDialekte)).toEqual(["en"]);
    process.env.WEBSITE_LANGUAGES = "de,bayrisch";
    const mitBayrisch = writeIssue([{ kind: "ruhig" }], { week: "2026-11-21", name: () => "x" });
    expect(Object.keys(mitBayrisch.articles[0].dialekte ?? {}).sort()).toEqual(["bayrisch", "en"]);
  } finally {
    if (vorher === undefined) delete process.env.WEBSITE_LANGUAGES;
    else process.env.WEBSITE_LANGUAGES = vorher;
  }
});
