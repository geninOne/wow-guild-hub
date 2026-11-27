import { expect, test } from "vitest";
import type { DaySnapshot, MemberSummary } from "../../src/model";
import { collectFacts, MAX_ARTICLES, sectionOf, type NewspaperFact } from "../../src/weekly/newspaper-facts";
import { phraseArticles, phraseGenerator, motto, pick } from "../../src/weekly/newspaper-text";
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

test("lead first, similar reports merged, the jumper's title is part of the jump report", () => {
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
  expect(result).toEqual<NewspaperFact[]>([
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
  // Sections ordered by their strongest report; the lead's section moves back a little
  expect(result.map(sectionOf)).toEqual(["Aufsteiger", "Klatsch", "Klatsch", "Friedhof", "Aufsteiger", "Aufsteiger", "Handwerk", "Zahl der Woche"]);
});

test("thresholds: small jumps, few recipes and a single login are no report", () => {
  const members = [member({ id: 1, name: "Anna", firstSeenAt: OLD }), member({ id: 2, name: "Bodo", firstSeenAt: OLD })];
  const before = snap("2026-11-08", { "1": 20, "2": 30 }, { "1": 10 });
  const end = snap("2026-11-15", { "1": 22, "2": 30 }, { "1": 12 });
  expect(facts({ members, before, end, activity: { week: "2026-W46", characters: { "1": [6] } } })).toEqual([{ kind: "ruhig" }]);
});

test("overtakes: at most three, each character only once, all in one report", () => {
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

test("at most MAX_ARTICLES reports, the number of the week stays last", () => {
  const members = Array.from({ length: 12 }, (_, i) => member({ id: i + 1, name: `M${i + 1}`, firstSeenAt: "2026-11-10T10:00:00.000Z" }));
  const before = snap("2026-11-08", Object.fromEntries(members.map((m) => [String(m.id), 5])), Object.fromEntries(members.map((m) => [String(m.id), 1])));
  const end = snap("2026-11-15", Object.fromEntries(members.map((m) => [String(m.id), 12 + m.id])), Object.fromEntries(members.map((m) => [String(m.id), 5])));
  const titles = TITLES.map((t, i) => ({ titleId: t.id, characterId: i + 2, value: 9 }));
  const result = facts({ members, before, end, titles, activity: { week: "2026-W46", characters: Object.fromEntries(members.map((m) => [String(m.id), [20, 21]])) } });
  expect(result.length).toBeLessThanOrEqual(MAX_ARTICLES);
  expect(result[result.length - 1].kind).toBe("zahl");
});

test("opted-out characters do not appear, not even as overtaken or newcomer", () => {
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

const ALL_FACTS: NewspaperFact[] = [
  { kind: "sprung", characterId: 1, levels: 5, from: 28, to: 33, title: null },
  { kind: "sprung", characterId: 1, levels: 5, from: 28, to: 33, title: "dauerlaeufer" },
  { kind: "meilensteine", entries: [{ characterId: 1, level: 30 }] },
  { kind: "meilensteine", entries: [{ characterId: 1, level: 30 }, { characterId: 2, level: 50 }] },
  { kind: "ueberholungen", entries: [{ characterId: 1, passedId: 2, level: 33 }] },
  { kind: "ueberholungen", entries: [{ characterId: 1, passedId: 2, level: 33 }, { characterId: 3, passedId: 4, level: 20 }] },
  ...TITLES.map((t): NewspaperFact => ({ kind: "titel", titleId: t.id, characterId: 2, value: 3 })),
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

test("phrases: one article with section per fact, deterministic, without em dashes or leftover placeholders", async () => {
  for (let w = 10; w < 40; w++) {
    const week = `2026-W${w}`;
    const result = await phraseGenerator(ALL_FACTS, ctx(week));
    expect(result.generator).toBe("bausteine");
    expect(result.articles).toHaveLength(ALL_FACTS.length);
    expect(await phraseGenerator(ALL_FACTS, ctx(week))).toEqual(result);
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

test("a typical issue repeats no headline and no text", async () => {
  const issue: NewspaperFact[] = [ALL_FACTS[1], ALL_FACTS[3], ALL_FACTS[5], ALL_FACTS[17], ...ALL_FACTS.slice(6, 12), ALL_FACTS[14], ALL_FACTS[19], ALL_FACTS[20]];
  const articles = phraseArticles(issue, ctx("2026-W46"));
  expect(new Set(articles.map((a) => a.headline)).size).toBe(articles.length);
  expect(new Set(articles.map((a) => a.text)).size).toBe(articles.length);
});

test("articles name the characters involved", async () => {
  const articles = phraseArticles(ALL_FACTS, ctx("2026-W46"));
  expect(articles[0]).toMatchObject({ kind: "sprung", section: "Aufsteiger", characterIds: [1] });
  expect(articles[1].text).toContain("Dauerläufer");
  expect(articles[1].titleId).toBe("dauerlaeufer");
  expect(articles[0]).not.toHaveProperty("titleId");
  expect(articles.filter((a) => a.kind === "titel").every((a) => a.titleId)).toBe(true);
  const newcomers = articles.filter((a) => a.kind === "neuzugang")[1];
  expect(newcomers.characterIds).toEqual([1, 2, 3]);
  expect(newcomers.text).toContain("Anna, Bodo und Cleo");
  const overtakes = articles.filter((a) => a.kind === "ueberholungen")[1];
  expect(overtakes.characterIds).toEqual([1, 2, 3, 4]);
  const number = articles.find((a) => a.kind === "zahl")!;
  expect(number).toMatchObject({ headline: "42", section: "Zahl der Woche" });
});

test("pick chooses a fixed phrase per key and uses all phrases", () => {
  const options = ["a", "b", "c"];
  expect(pick(options, "x")).toBe(pick(options, "x"));
  const seen = new Set(Array.from({ length: 60 }, (_, i) => pick(options, `k${i}`)));
  expect(seen.size).toBe(3);
});

test("no article contains the motto of the week", () => {
  for (let w = 10; w < 53; w++) {
    const week = `2026-W${String(w).padStart(2, "0")}`;
    const weekMotto = motto(week).replace(/\.$/, "");
    for (const a of phraseArticles(ALL_FACTS, ctx(week))) expect(`${a.headline} ${a.text}`).not.toContain(weekMotto);
  }
});

test("whoever shows up on the first recorded day is no newcomer", () => {
  const members = [
    member({ id: 1, name: "Anna", firstSeenAt: "2026-11-10T10:00:00.000Z" }),
    member({ id: 2, name: "Bodo", firstSeenAt: "2026-11-10T11:00:00.000Z" }),
    member({ id: 3, name: "Cleo", firstSeenAt: "2026-11-12T10:00:00.000Z" }),
  ];
  const s = snap("2026-11-15", { "1": 10, "2": 10, "3": 10 });
  expect(facts({ members, before: s, end: s })).toEqual([{ kind: "neuzugang", characterIds: [3] }]);
});

test("what was already in last week moves back; the number of the week changes", () => {
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
  const fresh = collectFacts(base);
  expect(fresh[0].kind).toBe("sprung");
  expect(fresh.at(-1)).toEqual({ kind: "zahl", value: 13, what: "level" });

  const after = collectFacts({ ...base, recent: [{ kinds: ["sprung", "rezepte"], zahl: "level" }] });
  expect(after[0].kind).toBe("neuzugang");
  expect(after.at(-1)).toEqual({ kind: "zahl", value: 12, what: "anmeldungen" });
  // If every kind was used recently, the number takes the one used longest ago
  const allUsed = collectFacts({ ...base, recent: [{ kinds: [], zahl: "anmeldungen" }, { kinds: [], zahl: "rezepte" }, { kinds: [], zahl: "level" }] });
  expect(allUsed.at(-1)).toMatchObject({ what: "level" });
});

test("phrases: every pool has standard German, English, Swabian and Bavarian of equal length, without em dashes", async () => {
  const b = await import("../../src/weekly/phrases");
  const w = await import("../../src/weekly/phrases-extras");
  const pools: unknown[] = [];
  for (const [name, value] of [...Object.entries(b), ...Object.entries(w)]) {
    if (name === "NEWSPAPER_DEFAULT" || name === "RECORD_KIND" || name === "RECORD_ENTRY" || name === "WEATHER_PLACE") continue;
    if (!value || typeof value !== "object" || name === "Picker") continue;
    if ("de" in value) pools.push(value);
    else for (const sub of Object.values(value)) if (sub && typeof sub === "object" && "de" in sub) pools.push(sub);
  }
  expect(pools.length).toBeGreaterThan(40);
  for (const pool of pools) expect(b.sameLength(pool as never)).toBe(true);
  const args = { n: "Anna", a: "Anna", b: "Bodo", l: "Anna und Bodo", t: "Titel", v: "7 Tode", k: 2, levels: 3, from: 1, to: 4, level: 10, total: 5, dat: "x", akk: "y", day: "Montag", hour: 20, next: 21, count: 9 };
  for (const pool of pools as Record<string, unknown[]>[]) {
    for (const s of ["de", "en", "schwaebisch", "bayrisch"]) {
      for (const entry of pool[s]) {
        const text = typeof entry === "function" ? (entry as (a: unknown) => string)(args) : String(entry);
        expect(text).not.toMatch(/[—–]/);
        // Standard German and English apply to every guild: no Swabian flavour, that stays with the dialects
        if (s === "de" || s === "en") expect(text).not.toMatch(/Maultasch|Schupfnud|Ländle|Gildeblatt|Käsknöpfle/);
      }
    }
  }
});

test("newspaper name: WEBSITE_NEWSPAPER for all languages, otherwise Gildenblatt, Guild Gazette, Gildeblatt and Gildnblatt", async () => {
  const { newspaperName } = await import("../../src/weekly/phrases-extras");
  expect(newspaperName("de")).toBe("Gildenblatt");
  expect(newspaperName("en", "")).toBe("Guild Gazette");
  expect(newspaperName("schwaebisch", "  ")).toBe("Gildeblatt");
  expect(newspaperName("bayrisch", null)).toBe("Gildnblatt");
  for (const s of ["de", "en", "schwaebisch", "bayrisch"] as const) expect(newspaperName(s, " Bärenklaue-Blatt ")).toBe("Bärenklaue-Blatt");
});

test("phrases write every issue in German, English and the offered dialects", async () => {
  const { writeIssue } = await import("../../src/weekly/newspaper-text");
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

test("shared title: on a tie at the top the newspaper names the title holder from the card, not the alphabetically first", () => {
  const members = [member({ id: 1, name: "Anna", firstSeenAt: OLD }), member({ id: 2, name: "Zora", firstSeenAt: OLD })];
  const before = snap("2026-11-08", { "1": 20, "2": 20 });
  const end = snap("2026-11-15", { "1": 25, "2": 25 });
  const result = facts({ members, before, end, titles: [{ titleId: "dauerlaeufer", characterId: 2, characterIds: [2, 1], value: 5 }] });
  expect(result.find((f) => f.kind === "sprung")).toMatchObject({ characterId: 2, title: "dauerlaeufer" });
  expect(result.some((f) => f.kind === "titel" && f.titleId === "dauerlaeufer")).toBe(false);
});

test("without WEBSITE_LANGUAGES there is German and English, but no dialects", async () => {
  const { writeIssue } = await import("../../src/weekly/newspaper-text");
  const previous = process.env.WEBSITE_LANGUAGES;
  delete process.env.WEBSITE_LANGUAGES;
  try {
    const issue = writeIssue([{ kind: "stosszeit", weekday: 4, hour: 20, count: 9 }], { week: "2026-11-21", name: () => "x" });
    const d = issue.articles[0].dialekte as Record<string, { headline: string; text: string }>;
    expect(Object.keys(d)).toEqual(["en"]);
    expect(`${d.en.headline} ${d.en.text}`).toMatch(/Friday|20:00/);
    expect(Object.keys(issue.mottoDialekte)).toEqual(["en"]);
    process.env.WEBSITE_LANGUAGES = "de,bayrisch";
    const withBavarian = writeIssue([{ kind: "ruhig" }], { week: "2026-11-21", name: () => "x" });
    expect(Object.keys(withBavarian.articles[0].dialekte ?? {}).sort()).toEqual(["bayrisch", "en"]);
  } finally {
    if (previous === undefined) delete process.env.WEBSITE_LANGUAGES;
    else process.env.WEBSITE_LANGUAGES = previous;
  }
});
