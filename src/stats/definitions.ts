import list from "../../config/statistiken.json";

/** How a statistic behaves; see `_hinweis` in `config/statistiken.json`. */
export type StatKind = "zaehler" | "stand" | "text" | "schnitt";

export interface StatCategory {
  id: number;
  name: string;
  /** Parent category, null for top-level categories. */
  ober: number | null;
}

export interface StatDefinition {
  id: number;
  name: string;
  kategorie: number;
  art: StatKind;
}

/** Categories of the character statistics in API order. */
export const STAT_CATEGORIES: StatCategory[] = list.kategorien;

/** All known statistics (extended from the responses seen so far). */
export const STAT_DEFINITIONS: StatDefinition[] = list.statistiken as StatDefinition[];

const byId = new Map(STAT_DEFINITIONS.map((s) => [s.id, s]));

/** Definition for a statistic ID (number or key from a snapshot); undefined if unknown. */
export function statDefinition(id: number | string): StatDefinition | undefined {
  return byId.get(Number(id));
}
