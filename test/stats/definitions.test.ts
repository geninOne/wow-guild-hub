import { expect, test } from "vitest";
import { STAT_CATEGORIES, STAT_DEFINITIONS, statDefinition } from "../../src/stats/definitions";
import { mapStatValues } from "../../src/transform/character";
import { loadFixture } from "../helpers/fixtures";

test("Statische Liste: eindeutige IDs, jede Statistik in einer bekannten Kategorie, deutsche Namen", () => {
  const ids = STAT_DEFINITIONS.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  const categories = new Set(STAT_CATEGORIES.map((c) => c.id));
  for (const s of STAT_DEFINITIONS) expect(categories.has(s.kategorie)).toBe(true);
  for (const c of STAT_CATEGORIES) if (c.ober !== null) expect(categories.has(c.ober)).toBe(true);
  expect(statDefinition(60)).toEqual({ id: 60, name: "Tode insgesamt", kategorie: 122, art: "zaehler" });
  expect(statDefinition("353")?.name).toBe("Anzahl der Nutzungen des Ruhesteins");
  expect(statDefinition(1524)?.art).toBe("stand");
  expect(statDefinition(1336)?.art).toBe("text");
  expect(statDefinition(999999)).toBeUndefined();
});

test("Jede Statistik der Beispielantwort steht in der Liste", () => {
  const values = mapStatValues(loadFixture("chordrak-statistics").data)!.values;
  for (const id of Object.keys(values)) expect(statDefinition(id), id).toBeDefined();
});
