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
  if (!s) throw new Error(`Spec ${name} missing`);
  return s;
}
const placed = (s: SpecLayout, nodeId: number) => s.nodes.find((n) => n.nodeId === nodeId);
const unplaced = (s: SpecLayout, nodeId: number) => s.unplaced.find((n) => n.nodeId === nodeId);

function node(nodeId: number, row: number, col: number): TalentNode {
  return { nodeId, row, col, maxRank: 1, talentId: nodeId, spellId: nodeId, name: `n${nodeId}`, ranks: [], lockedBy: [], unlocks: [] };
}

test("columns are mapped to 1 to 4 per spec", () => {
  const l = layoutTalentTree(tree(1117), TALENT_FIXES);
  expect(l.specs.map((s) => s.name)).toEqual(["Waffen", "Furor", "Schutz"]);
  for (const s of l.specs) expect(new Set(s.nodes.map((n) => n.gridCol))).toEqual(new Set([1, 2, 3, 4]));
  expect(l.rows).toBe(7);
});
test("hunter: duplicate node hidden, Schlangenbiss at 6/4", () => {
  const l = layoutTalentTree(tree(1091), TALENT_FIXES);
  expect(unplaced(spec(l, "Überleben"), 104982)).toMatchObject({ hidden: true });
  expect(placed(spec(l, "Überleben"), 110859)).toMatchObject({ gridRow: 6, gridCol: 3 });
  expect(placed(spec(l, "Treffsicherheit"), 105003)).toMatchObject({ gridRow: 6, gridCol: 4 });
  expect(l.rows).toBe(7);
});
test("priest: Heiligspezialisierung only once, in the Heilig block", () => {
  const holy = spec(layoutTalentTree(tree(1114), TALENT_FIXES), "Heilig");
  expect(placed(holy, 110855)).toMatchObject({ gridRow: 1, gridCol: 3 });
  expect(unplaced(holy, 105865)).toMatchObject({ hidden: true });
  expect(holy.nodes.every((n) => n.gridCol >= 1 && n.gridCol <= 4)).toBe(true);
});
test("without fixes, outliers end up visibly in unplaced instead of the grid", () => {
  const l = layoutTalentTree(tree(1091), []);
  expect(unplaced(spec(l, "Überleben"), 104982)).toMatchObject({ hidden: false });
  expect(unplaced(spec(l, "Treffsicherheit"), 105003)).toMatchObject({ hidden: false });
  expect(l.rows).toBe(7);
});
test("occupied cell: the first node stays, the second is not placed", () => {
  const t: TalentTreeRecord = {
    classTreeId: 1, classId: 1, className: "Test",
    specs: [{ specId: 1, name: "S", nodes: [node(1, 1, 1), node(2, 1, 1)] }],
  };
  const s = layoutTalentTree(t, []).specs[0];
  expect(s.nodes.map((n) => n.nodeId)).toEqual([1]);
  expect(s.unplaced).toMatchObject([{ nodeId: 2, hidden: false }]);
});
test("all real trees: each cell at most once, everything in the grid", () => {
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
