import { expect, test } from "vitest";
import type { NewspaperFact, NumberKind } from "../../src/weekly/newspaper-facts";
import { phraseGenerator, type RecentIssue, type TextResult } from "../../src/weekly/newspaper-text";
import { RECENT_ISSUES } from "../../src/weekly/phrases";
import { issuePatterns, repetitionStats, sentencePatterns } from "../../src/weekly/repetition";
import { TITLES } from "../../src/weekly/titles";

const NAMES = ["Anna", "Bodo", "Cleo", "Dora", "Emil", "Fritz", "Gerda", "Hugo", "Ida", "Jakob", "Karl", "Lotte"];
const name = (id: number) => NAMES[id % NAMES.length];
const NUMBER_KINDS: NumberKind[] = ["level", "anmeldungen", "rezepte", "dungeons", "erfolge", "tode"];

/** A full week: every kind of report occurs, names and numbers change. */
function factsFor(w: number): NewspaperFact[] {
  const id = (k: number) => (w * 3 + k) % NAMES.length;
  const titles = TITLES.filter((_, i) => (i + w) % 2 === 0).slice(0, 6);
  return [
    { kind: "sprung", characterId: id(0), levels: 4 + (w % 5), from: 20 + w, to: 24 + w + (w % 5), title: w % 2 ? "dauerlaeufer" : null },
    { kind: "meilensteine", entries: [{ characterId: id(1), level: 30 }, { characterId: id(2), level: 40 }] },
    { kind: "ueberholungen", entries: [{ characterId: id(3), passedId: id(4), level: 30 + w }, { characterId: id(5), passedId: id(6), level: 25 + w }] },
    ...titles.map((t, i): NewspaperFact => ({ kind: "titel", titleId: t.id, characterId: id(7 + i), value: t.min + w })),
    { kind: "neuzugang", characterIds: [id(8)] },
    { kind: "rezepte", characterId: id(9), count: 3 + w, total: 20 + w, crafters: 4, title: w % 3 ? "schaffe-schaffe" : null },
    { kind: "stosszeit", weekday: w % 7, hour: 18 + (w % 5), count: 6 + w },
    { kind: "zahl", value: 100 + w, what: NUMBER_KINDS[w % NUMBER_KINDS.length] },
  ];
}

async function issues(count: number): Promise<{ week: string; result: TextResult }[]> {
  const out: { week: string; result: TextResult }[] = [];
  for (let w = 0; w < count; w++) {
    const week = `2026-W${String(10 + w).padStart(2, "0")}`;
    const recent: RecentIssue[] = out
      .slice(-RECENT_ISSUES)
      .reverse()
      .map((x) => ({
        week: x.week,
        bausteine: x.result.bausteine ?? [],
        headlines: x.result.articles.map((a) => a.headline),
        texts: x.result.articles.map((a) => a.text),
        motto: x.result.motto,
      }));
    const result = await phraseGenerator(factsFor(w), { week, name, recent });
    out.push({ week, result });
  }
  return out;
}

test("sentencePatterns replaces names and numbers and drops pure placeholders", () => {
  expect(sentencePatterns("Anna hat 5 Level. Toll, Bodo! 850", ["Anna", "Bodo", "Annabell"])).toEqual([
    "<name> hat <n> level.",
    "toll, <name>!",
  ]);
});

test("over ten consecutive issues: no sentence in two issues in a row, no repetition within six issues", async () => {
  const all = await issues(10);
  const patterns = all.map(({ result }) =>
    issuePatterns({ lead: result.articles[0], articles: result.articles.slice(1), motto: result.motto }, NAMES),
  );
  const stats = repetitionStats(patterns, 6);
  expect(stats.consecutive).toBe(0);
  expect(stats.maxInWindow).toBeLessThanOrEqual(2);
  // Across all ten issues only a small share repeats (at most 15 %)
  expect(stats.repeated / stats.patterns).toBeLessThanOrEqual(0.15);
  // Never the same sentence twice within an issue
  for (const { result } of all) {
    const sentences = result.articles.flatMap((a) => [a.headline, a.text]).flatMap((t) => sentencePatterns(t, NAMES));
    expect(new Set(sentences).size).toBe(sentences.length);
  }
});

test("phrase ids are returned per issue and do not repeat in the following issue", async () => {
  const [a, b] = await issues(2);
  expect(a.result.bausteine?.length).toBeGreaterThan(10);
  const shared = (a.result.bausteine ?? []).filter((id) => b.result.bausteine?.includes(id));
  expect(shared).toEqual([]);
});

test("same input gives same output", async () => {
  const [x] = await issues(1);
  const [y] = await issues(1);
  expect(y).toEqual(x);
});
