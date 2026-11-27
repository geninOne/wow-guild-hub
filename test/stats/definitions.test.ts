import { expect, test } from "vitest";
import { STAT_CATEGORIES, STAT_DEFINITIONS, statDefinition } from "../../src/stats/definitions";
import { mapStatValues } from "../../src/transform/character";
import { loadFixture } from "../helpers/fixtures";

test("static list: unique IDs, every statistic in a known category, German names", () => {
  const ids = STAT_DEFINITIONS.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  const categories = new Set(STAT_CATEGORIES.map((c) => c.id));
  for (const s of STAT_DEFINITIONS) expect(categories.has(s.category)).toBe(true);
  for (const c of STAT_CATEGORIES) if (c.parent !== null) expect(categories.has(c.parent)).toBe(true);
  expect(statDefinition(60)).toEqual({ id: 60, name: "Tode insgesamt", category: 122, kind: "zaehler" });
  expect(statDefinition("353")?.name).toBe("Anzahl der Nutzungen des Ruhesteins");
  expect(statDefinition(1524)?.kind).toBe("stand");
  expect(statDefinition(1336)?.kind).toBe("text");
  expect(statDefinition(999999)).toBeUndefined();
});

test("every statistic of the sample response is in the list", () => {
  const values = mapStatValues(loadFixture("chordrak-statistics").data)!.values;
  for (const id of Object.keys(values)) expect(statDefinition(id), id).toBeDefined();
});
