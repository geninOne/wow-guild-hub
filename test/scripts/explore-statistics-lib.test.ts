import { expect, test } from "vitest";
import { evaluate, kindOf, markdownTables, median, updateList } from "../../scripts/explore-statistics-lib.mjs";

// Statistic and category names are German data as returned by Blizzard for locale de_DE.
const response = (values: Record<number, number>, extra: object = {}) => ({
  categories: [
    { id: 122, name: "Tode", statistics: values[60] === undefined ? [] : [{ id: 60, name: "Tode insgesamt", quantity: values[60], last_updated_timestamp: 1 }] },
    {
      id: 132, name: "Fertigkeiten", statistics: [],
      sub_categories: [{ id: 178, name: "Sekundäre Fertigkeiten", statistics: [{ id: 1524, name: "Kochfertigkeit", quantity: values[1524] ?? 1, ...extra }] }],
    },
  ],
});

test("median", () => {
  expect(median([])).toBeNull();
  expect(median([3, 1, 2])).toBe(2);
  expect(median([4, 1, 2, 3])).toBe(2.5);
});

test("evaluate: count, sum, maximum, median per statistic and the fields found", () => {
  const a = evaluate([
    { member: { id: 1, name: "A", level: 10 }, data: response({ 60: 4, 1524: 10 }) },
    { member: { id: 2, name: "B", level: 20 }, data: response({ 1524: 30 }, { description: "x" }) },
    { member: { id: 3, name: "C", level: 20 }, data: response({ 60: 2, 1524: 20 }) },
  ]);
  expect(a.characters).toBe(3);
  expect(a.categories.map((k: { id: number }) => k.id)).toEqual([122, 132, 178]);
  expect(a.statistics.find((s: { id: number }) => s.id === 60)).toMatchObject({ count: 2, sum: 6, max: 4, median: 3 });
  expect(a.statistics.find((s: { id: number }) => s.id === 1524)).toMatchObject({ count: 3, sum: 60, max: 30, median: 20, textSample: "x" });
  expect(a.fields.statistic).toEqual(["description", "id", "last_updated_timestamp", "name", "quantity"]);
  expect(markdownTables(a)).toContain("| 60 | Tode insgesamt | 2 | 6 | 4 | 3 |");
  expect(markdownTables(a)).not.toContain("| A");
});

test("kindOf classifies counters, levels, texts and averages", () => {
  expect(kindOf({ name: "Tode insgesamt" })).toBe("zaehler");
  expect(kindOf({ name: "Kochfertigkeit" })).toBe("stand");
  expect(kindOf({ name: "Höchste Bergbaufertigkeit" })).toBe("stand");
  expect(kindOf({ name: "Reittiere besessen" })).toBe("stand");
  expect(kindOf({ name: "Am häufigsten getöteter Kreaturtyp", textSample: "Humanoid" })).toBe("text");
  expect(kindOf({ name: "Durchschnittlich abgeschlossene Quests pro Tag" })).toBe("schnitt");
});

test("updateList keeps known entries, adds new ones and takes over new names", () => {
  const old = { _hinweis: "h", kategorien: [{ id: 122, name: "Tode", ober: null }], statistiken: [{ id: 112, name: "Tode durch Ertrinken", kategorie: 122, art: "zaehler" }] };
  const a = evaluate([{ member: { id: 1, name: "A", level: 1 }, data: response({ 60: 1 }) }]);
  const updated = updateList(old, a);
  expect(updated._hinweis).toBe("h");
  expect(updated.kategorien.map((k: { id: number }) => k.id)).toEqual([122, 132, 178]);
  expect(updated.kategorien.find((k: { id: number }) => k.id === 178)).toEqual({ id: 178, name: "Sekundäre Fertigkeiten", ober: 132 });
  expect(updated.statistiken.map((s: { id: number }) => s.id)).toEqual([60, 112, 1524]);
  expect(updated.statistiken.find((s: { id: number }) => s.id === 1524)).toEqual({ id: 1524, name: "Kochfertigkeit", kategorie: 178, art: "stand" });
  expect(updateList(null, a)._hinweis).toMatch(/stats:explore/);
});
