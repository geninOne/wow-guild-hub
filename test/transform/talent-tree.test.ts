import { expect, test } from "vitest";
import { buildTalentTree, treeIdFromHref } from "../../src/transform/talent-tree";
import { loadFixture } from "../helpers/fixtures";

const cls = loadFixture("talent-tree-1117").data;
const arms = loadFixture("talent-tree-1117-spec-26").data;

test("Waffen-Baum des Kriegers", () => {
  const t = buildTalentTree(cls, [arms]);
  expect([t.classTreeId, t.classId, t.className]).toEqual([1117, 1, "Krieger"]);
  expect(t.specs.map((s) => [s.specId, s.name, s.nodes.length])).toEqual([[26, "Waffen", 17]]);
  const ms = t.specs[0].nodes.find((n) => n.nodeId === 105941)!;
  expect(ms).toMatchObject({
    row: 7, col: 2, maxRank: 1, talentId: 135472, spellId: 12294, name: "Tödlicher Stoß", lockedBy: [105945], unlocks: [],
  });
  expect(t.specs[0].nodes.find((n) => n.nodeId === 105957)).toMatchObject({ talentId: 135488, spellId: 16462, maxRank: 5 });
  const imp = t.specs[0].nodes.find((n) => n.nodeId === 105958)!;
  expect(imp.ranks.map((r) => r.rank)).toEqual([1, 2, 3]);
  expect(imp.ranks[0].description).toBe("Verringert die Kosten Eurer Fähigkeit 'Heldenhafter Stoß' um 1 Wut.");
});

test("zweiter Spec aus versetzten Spalten, Reihenfolge wie im Klassenbaum", () => {
  const fury = {
    playable_class: { id: 1, name: "Krieger" },
    playable_specialization: { id: 256, name: "Furor" },
    spec_talent_nodes: cls.talent_nodes
      .filter((n: { display_col: number }) => n.display_col >= 7 && n.display_col <= 10)
      .map((n: { id: number }) => ({ id: n.id })),
  };
  const t = buildTalentTree(cls, [fury, arms]);
  expect(t.specs.map((s) => s.specId)).toEqual([26, 256]);
  expect(t.specs[1].nodes.find((n) => n.nodeId === 105926)).toMatchObject({ row: 5, col: 10, maxRank: 2 });
});

test("treeIdFromHref", () => {
  expect(
    treeIdFromHref("https://eu.api.blizzard.com/data/wow/talent-tree/1089/playable-specialization/574?namespace=x"),
  ).toBe(1089);
  expect(treeIdFromHref("https://eu.api.blizzard.com/data/wow/talent-tree/1117?namespace=x")).toBe(1117);
});
