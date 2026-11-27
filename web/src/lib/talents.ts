import type { PlacedTalent, SpecLayout, UnplacedTalent } from "../../../src/api/types";
import type { CharacterSpec, TalentNode } from "../../../src/model";

export type NodeState = "empty" | "partial" | "max";

/** Rank per talentId across all of the character's trees. */
export function talentRanks(specs: CharacterSpec[]): Map<number, number> {
  const ranks = new Map<number, number>();
  for (const spec of specs) {
    for (const talent of spec.talents) ranks.set(talent.talentId, talent.rank);
  }
  return ranks;
}

/** Prerequisite arrows from `lockedBy`, only when source and target are on the grid. */
export function arrowsFor(spec: SpecLayout): { from: PlacedTalent; to: PlacedTalent }[] {
  const byId = new Map(spec.nodes.map((n) => [n.nodeId, n]));
  const arrows: { from: PlacedTalent; to: PlacedTalent }[] = [];
  for (const to of spec.nodes) {
    for (const id of to.lockedBy) {
      const from = byId.get(id);
      if (from) arrows.push({ from, to });
    }
  }
  return arrows;
}

/** Special nodes below the tree: visible ones always, hidden ones only with points. */
export function visibleUnplaced(spec: SpecLayout, ranks: Map<number, number>): UnplacedTalent[] {
  return spec.unplaced.filter((n) => !n.hidden || (ranks.get(n.talentId) ?? 0) > 0);
}

export function nodeState(rank: number, maxRank: number): NodeState {
  if (rank <= 0) return "empty";
  return rank >= maxRank ? "max" : "partial";
}

export function talentName(node: TalentNode): string {
  return node.name.trim() || "Unbenanntes Talent";
}

/** Description of a rank, empty when the tree does not know it. */
export function rankDescription(node: TalentNode, rank: number): string {
  return node.ranks.find((r) => r.rank === rank)?.description ?? "";
}

export function pointsLabel(points: number): string {
  return points === 1 ? "1 Punkt" : `${points} Punkte`;
}
