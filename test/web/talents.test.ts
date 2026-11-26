import { expect, test } from "vitest";
import type { PlacedTalent, SpecLayout, UnplacedTalent } from "../../src/api/types";
import type { TalentNode } from "../../src/model";
import { arrowsFor, nodeState, talentName, talentRanks, visibleUnplaced } from "../../web/src/lib/talents";

const node: TalentNode = {
  nodeId: 1,
  row: 1,
  col: 1,
  maxRank: 5,
  talentId: 10,
  spellId: 100,
  name: "Talent",
  ranks: [{ rank: 1, description: "Eins" }],
  lockedBy: [],
  unlocks: [],
};

function placed(over: Partial<PlacedTalent>): PlacedTalent {
  return { ...node, gridRow: 1, gridCol: 1, ...over };
}

function unplaced(over: Partial<UnplacedTalent>): UnplacedTalent {
  return { ...node, hidden: false, ...over };
}

function spec(nodes: PlacedTalent[], rest: UnplacedTalent[] = []): SpecLayout {
  return { specId: 613, name: "Disziplin", nodes, unplaced: rest };
}

test("Ränge, Zustände und Namen", () => {
  expect(
    talentRanks([
      {
        specId: 613,
        name: "Disziplin",
        spentPoints: 3,
        talents: [{ talentId: 7, spellId: 1, name: "a", rank: 3, description: "" }],
      },
    ]).get(7),
  ).toBe(3);
  expect([nodeState(0, 5), nodeState(2, 5), nodeState(5, 5)]).toEqual(["empty", "partial", "max"]);
  expect(talentName({ ...node, name: "" })).toBe("Unbenanntes Talent");
  expect(talentName({ ...node, name: "  " })).toBe("Unbenanntes Talent");
  expect(talentName(node)).toBe("Talent");
});

test("Ränge aus mehreren Bäumen werden zusammengeführt", () => {
  const ranks = talentRanks([
    { specId: 1, name: "A", spentPoints: 2, talents: [{ talentId: 1, spellId: 1, name: "a", rank: 2, description: "" }] },
    { specId: 2, name: "B", spentPoints: 1, talents: [{ talentId: 2, spellId: 2, name: "b", rank: 1, description: "" }] },
  ]);
  expect([...ranks.entries()]).toEqual([
    [1, 2],
    [2, 1],
  ]);
});

test("Pfeile nur zwischen platzierten Knoten", () => {
  const a = placed({ nodeId: 1, talentId: 11 });
  const b = placed({ nodeId: 2, talentId: 12, gridRow: 2, lockedBy: [1] });
  const c = placed({ nodeId: 3, talentId: 13, gridRow: 3, lockedBy: [99] });
  const x = unplaced({ nodeId: 99, talentId: 19 });
  const arrows = arrowsFor(spec([a, b, c], [x]));
  expect(arrows).toHaveLength(1);
  expect(arrows[0].from.nodeId).toBe(1);
  expect(arrows[0].to.nodeId).toBe(2);
});

test("ausgeblendete Sonderknoten nur mit Punkten", () => {
  const hidden = unplaced({ nodeId: 5, talentId: 50, hidden: true });
  const shown = unplaced({ nodeId: 6, talentId: 60, hidden: false });
  const s = spec([], [hidden, shown]);
  expect(visibleUnplaced(s, new Map()).map((n) => n.nodeId)).toEqual([6]);
  expect(visibleUnplaced(s, new Map([[50, 1]])).map((n) => n.nodeId)).toEqual([5, 6]);
  expect(visibleUnplaced(s, new Map([[50, 0]])).map((n) => n.nodeId)).toEqual([6]);
});
