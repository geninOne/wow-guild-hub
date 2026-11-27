import type { TalentNode, TalentTreeRecord } from "../model";
import type { PlacedTalent, SpecLayout, TalentFix, TalentLayout, UnplacedTalent } from "./types";

const MAX_ROW = 12;
const BLOCK_WIDTH = 4;
const MIN_ROWS = 7;

/** Start column whose window s..s+3 contains the most nodes (tie: the smallest). */
function blockStart(cols: number[]): number {
  let best = 0;
  let bestCount = -1;
  for (const s of [...new Set(cols)].sort((a, b) => a - b)) {
    const count = cols.filter((c) => c >= s && c < s + BLOCK_WIDTH).length;
    if (count > bestCount) {
      best = s;
      bestCount = count;
    }
  }
  return best;
}

export function layoutTalentTree(tree: TalentTreeRecord, fixes: TalentFix[]): TalentLayout {
  const fixById = new Map(fixes.map((f) => [f.nodeId, f]));
  let rows = MIN_ROWS;

  const specs: SpecLayout[] = tree.specs.map((spec) => {
    const hidden: UnplacedTalent[] = [];
    const candidates: TalentNode[] = [];
    for (const raw of spec.nodes) {
      const fix = fixById.get(raw.nodeId);
      if (fix?.hide) {
        hidden.push({ ...raw, hidden: true });
        continue;
      }
      candidates.push({ ...raw, row: fix?.row ?? raw.row, col: fix?.col ?? raw.col });
    }

    const s = blockStart(candidates.map((n) => n.col));
    const nodes: PlacedTalent[] = [];
    const unplaced: UnplacedTalent[] = [];
    const taken = new Set<string>();
    for (const n of candidates) {
      const valid = n.row >= 1 && n.row <= MAX_ROW && n.col >= s && n.col < s + BLOCK_WIDTH;
      const key = `${n.row}/${n.col}`;
      if (!valid || taken.has(key)) {
        unplaced.push({ ...n, hidden: false });
        continue;
      }
      taken.add(key);
      nodes.push({ ...n, gridRow: n.row, gridCol: n.col - s + 1 });
      rows = Math.max(rows, n.row);
    }
    return { specId: spec.specId, name: spec.name, nodes, unplaced: [...unplaced, ...hidden] };
  });

  return { classId: tree.classId, className: tree.className, rows, specs };
}
