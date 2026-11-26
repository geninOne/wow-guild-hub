/* eslint-disable @typescript-eslint/no-explicit-any -- Rohantworten der API sind untypisiert */
import type { TalentNode, TalentTreeRecord } from "../model";

/** Zahl nach /talent-tree/ in einem Link. */
export function treeIdFromHref(href: string): number {
  const m = /\/talent-tree\/(\d+)/.exec(href);
  if (!m) throw new Error(`Kein Talentbaum-Link: ${href}`);
  return Number(m[1]);
}

function specIdFromHref(href: string): number | null {
  const m = /\/playable-specialization\/(\d+)/.exec(href);
  return m ? Number(m[1]) : null;
}

function mapNode(n: any): TalentNode {
  const ranks: any[] = n.ranks ?? [];
  const first = ranks[0]?.tooltip ?? {};
  return {
    nodeId: n.id,
    row: n.display_row,
    col: n.display_col,
    maxRank: ranks.length,
    talentId: first.talent?.id ?? 0,
    spellId: first.spell_tooltip?.spell?.id ?? 0,
    name: first.talent?.name ?? "",
    ranks: ranks.map((r) => ({ rank: r.rank, description: r.tooltip?.spell_tooltip?.description ?? "" })),
    lockedBy: n.locked_by ?? [],
    unlocks: n.unlocks ?? [],
  };
}

/**
 * Knoten und Positionen stammen aus dem Klassenbaum, die Zuordnung zum Spec aus den Spec-Bäumen.
 * Spalten bleiben wie geliefert (pro Baum bereits versetzt).
 */
export function buildTalentTree(classTree: any, specTrees: any[]): TalentTreeRecord {
  const order: number[] = (classTree.spec_talent_trees ?? [])
    .map((s: any) => specIdFromHref(s.key?.href ?? ""))
    .filter((id: number | null): id is number => id !== null);
  const rank = (id: number) => {
    const i = order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const nodes: any[] = classTree.talent_nodes ?? [];
  const specs = specTrees
    .map((st) => {
      const ids = new Set((st.spec_talent_nodes ?? []).map((n: any) => n.id));
      return {
        specId: st.playable_specialization?.id ?? 0,
        name: st.playable_specialization?.name ?? st.name ?? "",
        nodes: nodes.filter((n) => ids.has(n.id)).map(mapNode),
      };
    })
    .sort((a, b) => rank(a.specId) - rank(b.specId));
  return {
    classTreeId: classTree.id,
    classId: specTrees[0]?.playable_class?.id ?? 0,
    className: specTrees[0]?.playable_class?.name ?? "",
    specs,
  };
}
