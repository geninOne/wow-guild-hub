import liste from "../../config/statistiken.json";

/** Wie sich eine Statistik verhält; siehe `_hinweis` in `config/statistiken.json`. */
export type StatKind = "zaehler" | "stand" | "text" | "schnitt";

export interface StatCategory {
  id: number;
  name: string;
  /** Oberkategorie, null für Hauptkategorien. */
  ober: number | null;
}

export interface StatDefinition {
  id: number;
  name: string;
  kategorie: number;
  art: StatKind;
}

/** Kategorien der Charakterstatistik in der Reihenfolge der API. */
export const STAT_CATEGORIES: StatCategory[] = liste.kategorien;

/** Alle bekannten Statistiken (fortgeschrieben aus den gesehenen Antworten). */
export const STAT_DEFINITIONS: StatDefinition[] = liste.statistiken as StatDefinition[];

const byId = new Map(STAT_DEFINITIONS.map((s) => [s.id, s]));

/** Definition zu einer Statistik-ID (Zahl oder Schlüssel aus einem Stand); undefined, wenn unbekannt. */
export function statDefinition(id: number | string): StatDefinition | undefined {
  return byId.get(Number(id));
}
