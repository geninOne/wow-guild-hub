import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { layoutTalentTree } from "../../src/api/talent-layout";
import { TALENT_FIXES } from "../../src/api/config";
import type { SpecLayout, TalentLayout } from "../../src/api/types";
import type { TalentNode, TalentTreeRecord } from "../../src/model";

function tree(id: number): TalentTreeRecord {
  return JSON.parse(readFileSync(new URL(`../fixtures/records/talent-trees/${id}.json`, import.meta.url), "utf8"));
}
function spec(layout: TalentLayout, name: string): SpecLayout {
  const s = layout.specs.find((x) => x.name === name);
  if (!s) throw new Error(`Spec ${name} fehlt`);
  return s;
}
const placed = (s: SpecLayout, nodeId: number) => s.nodes.find((n) => n.nodeId === nodeId);
const unplaced = (s: SpecLayout, nodeId: number) => s.unplaced.find((n) => n.nodeId === nodeId);

function node(nodeId: number, row: number, col: number): TalentNode {
  return { nodeId, row, col, maxRank: 1, talentId: nodeId, spellId: nodeId, name: `n${nodeId}`, ranks: [], lockedBy: [], unlocks: [] };
}

test("Spalten werden je Spec auf 1 bis 4 gelegt", () => {
  const l = layoutTalentTree(tree(1117), TALENT_FIXES);
  expect(l.specs.map((s) => s.name)).toEqual(["Waffen", "Furor", "Schutz"]);
  for (const s of l.specs) expect(new Set(s.nodes.map((n) => n.gridCol))).toEqual(new Set([1, 2, 3, 4]));
  expect(l.rows).toBe(7);
});
test("Jäger: doppelter Knoten ausgeblendet, Schlangenbiss auf 6/4", () => {
  const l = layoutTalentTree(tree(1091), TALENT_FIXES);
  expect(unplaced(spec(l, "Überleben"), 104982)).toMatchObject({ hidden: true });
  expect(placed(spec(l, "Überleben"), 110859)).toMatchObject({ gridRow: 6, gridCol: 3 });
  expect(placed(spec(l, "Treffsicherheit"), 105003)).toMatchObject({ gridRow: 6, gridCol: 4 });
  expect(l.rows).toBe(7);
});
test("Priester: Heiligspezialisierung nur einmal, im Heilig-Block", () => {
  const heilig = spec(layoutTalentTree(tree(1114), TALENT_FIXES), "Heilig");
  expect(placed(heilig, 110855)).toMatchObject({ gridRow: 1, gridCol: 3 });
  expect(unplaced(heilig, 105865)).toMatchObject({ hidden: true });
  expect(heilig.nodes.every((n) => n.gridCol >= 1 && n.gridCol <= 4)).toBe(true);
});
test("ohne Korrekturen landen Ausreißer sichtbar in unplaced statt im Raster", () => {
  const l = layoutTalentTree(tree(1091), []);
  expect(unplaced(spec(l, "Überleben"), 104982)).toMatchObject({ hidden: false });
  expect(unplaced(spec(l, "Treffsicherheit"), 105003)).toMatchObject({ hidden: false });
  expect(l.rows).toBe(7);
});
test("belegtes Feld: der erste Knoten bleibt, der zweite wird nicht platziert", () => {
  const t: TalentTreeRecord = {
    classTreeId: 1, classId: 1, className: "Test",
    specs: [{ specId: 1, name: "S", nodes: [node(1, 1, 1), node(2, 1, 1)] }],
  };
  const s = layoutTalentTree(t, []).specs[0];
  expect(s.nodes.map((n) => n.nodeId)).toEqual([1]);
  expect(s.unplaced).toMatchObject([{ nodeId: 2, hidden: false }]);
});
test("alle echten Bäume: jedes Feld höchstens einmal, alles im Raster", () => {
  for (const id of [1082, 1089, 1091, 1100, 1111, 1112, 1114, 1116, 1117]) {
    const l = layoutTalentTree(tree(id), TALENT_FIXES);
    for (const s of l.specs) {
      const cells = s.nodes.map((n) => `${n.gridRow}/${n.gridCol}`);
      expect(new Set(cells).size).toBe(cells.length);
      expect(s.nodes.every((n) => n.gridRow >= 1 && n.gridRow <= l.rows && n.gridCol >= 1 && n.gridCol <= 4)).toBe(true);
      expect(s.unplaced.filter((n) => !n.hidden)).toEqual([]);
    }
  }
});
