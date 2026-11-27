import list from "../../config/statistics.json";

/** How a statistic behaves; see `_note` in `config/statistics.json`. */
export type StatKind = "zaehler" | "stand" | "text" | "schnitt";

export interface StatCategory {
  id: number;
  name: string;
  /** Parent category, null for top-level categories. */
  parent: number | null;
}

export interface StatDefinition {
  id: number;
  name: string;
  category: number;
  kind: StatKind;
}

/** Categories of the character statistics in API order. */
export const STAT_CATEGORIES: StatCategory[] = list.categories;

/** All known statistics (extended from the responses seen so far). */
export const STAT_DEFINITIONS: StatDefinition[] = list.statistics as StatDefinition[];

const byId = new Map(STAT_DEFINITIONS.map((s) => [s.id, s]));

/** Definition for a statistic ID (number or key from a snapshot); undefined if unknown. */
export function statDefinition(id: number | string): StatDefinition | undefined {
  return byId.get(Number(id));
}
