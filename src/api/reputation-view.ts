import type { CharacterReputation, ReputationFactionsRecord } from "../model";
import { FACTION_NAMES_DE } from "./faction-names";
import type { ReputationView } from "./types";

const OTHERS = "Weitere Fraktionen";

/** Deutscher Name: feste Tabelle, dann statisches Verzeichnis, dann der Name aus den Charakterdaten. */
function factionName(id: number, statics: ReputationFactionsRecord | null, fallback: string): string {
  return FACTION_NAMES_DE[id] ?? statics?.names[String(id)] ?? fallback;
}

/** Ruf eines Charakters, gruppiert nach den Wurzelfraktionen; innerhalb einer Gruppe nach Name. */
export function buildReputationView(
  reputations: CharacterReputation[] | null | undefined,
  statics: ReputationFactionsRecord | null,
): ReputationView {
  if (!reputations) return { available: false, groups: [] };
  const groupOf = new Map<number, number>();
  for (const g of statics?.groups ?? []) for (const id of g.factionIds) groupOf.set(id, g.id);

  const buckets = new Map<number | null, ReputationView["groups"][number]["factions"]>();
  for (const r of reputations) {
    const key = groupOf.get(r.factionId) ?? null;
    const list = buckets.get(key) ?? [];
    list.push({
      id: r.factionId,
      name: factionName(r.factionId, statics, r.name),
      tier: r.tier,
      tierName: r.tierName,
      value: r.value,
      max: r.max,
    });
    buckets.set(key, list);
  }

  const order: (number | null)[] = [...(statics?.groups ?? []).map((g) => g.id), null];
  return {
    available: true,
    groups: order.flatMap((key) => {
      const factions = buckets.get(key);
      if (!factions) return [];
      const group = statics?.groups.find((g) => g.id === key);
      return [
        {
          name: group ? factionName(group.id, statics, group.name) : OTHERS,
          factions: factions.sort((a, b) => a.name.localeCompare(b.name, "de")),
        },
      ];
    }),
  };
}
