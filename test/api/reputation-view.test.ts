import { expect, test } from "vitest";
import { buildReputationView } from "../../src/api/reputation-view";
import type { CharacterReputation, ReputationFactionsRecord } from "../../src/model";
import { mapReputations } from "../../src/transform/character";
import { loadFixture } from "../helpers/fixtures";

const reps: CharacterReputation[] = mapReputations(loadFixture("chordrak-reputations").data);

const statics: ReputationFactionsRecord = {
  names: { "81": "Thunder Bluff", "76": "Orgrimmar", "2587": "Versorgung und Logistik Durotar", "529": "Argentumdämmerung" },
  groups: [
    { id: 67, name: "Horde", factionIds: [68, 76, 81, 530] },
    { id: 169, name: "Steamwheedle-Kartell", factionIds: [21, 369, 470, 577, 2827] },
  ],
  checkedRoots: [67, 169],
};

test("ohne Rufdaten nicht verfügbar", () => {
  expect(buildReputationView(undefined, statics)).toEqual({ available: false, groups: [] });
  expect(buildReputationView(null, statics)).toEqual({ available: false, groups: [] });
});

test("Gruppen in Reihenfolge, deutsche Namen, Rest unter Weitere Fraktionen", () => {
  const v = buildReputationView(reps, statics);
  expect(v.available).toBe(true);
  expect(v.groups.map((g) => g.name)).toEqual(["Horde", "Dampfdruckkartell", "Weitere Fraktionen"]);
  expect(v.groups[0].factions.map((f) => f.name)).toEqual(["Donnerfels", "Dunkelspeertrolle", "Orgrimmar", "Unterstadt"]);
  expect(v.groups[0].factions.find((f) => f.id === 76)).toEqual({
    id: 76, name: "Orgrimmar", tier: 4, tierName: "Freundlich", value: 1485, max: 6000,
  });
  expect(v.groups[1].factions.map((f) => f.name)).toEqual(["Beutebucht", "Ewige Warte", "Gadgetzan", "Powderfuse", "Ratschet"]);
  expect(v.groups[2].factions.map((f) => f.name)).toEqual(["Argentumdämmerung", "Versorgung und Logistik Durotar"]);
});

test("ohne statische Daten eine Gruppe, Namen aus der Tabelle oder dem Profil", () => {
  const v = buildReputationView(reps, null);
  expect(v.groups.map((g) => g.name)).toEqual(["Weitere Fraktionen"]);
  expect(v.groups[0].factions.map((f) => f.name)).toContain("Donnerfels");
  expect(v.groups[0].factions.map((f) => f.name)).toContain("Powderfuse");
});

test("leere Rufliste ist verfügbar, aber ohne Gruppen", () => {
  expect(buildReputationView([], statics)).toEqual({ available: true, groups: [] });
});
