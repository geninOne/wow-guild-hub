import type { RecipeView } from "../../../src/api/types";
import type { CharacterProfession } from "../../../src/model";

export const MIN_QUERY = 2;
const MAX_HITS = 100;

/** Filtert nach Namensteil ab `MIN_QUERY` Zeichen (sonst alles), Reihenfolge bleibt, höchstens 100 Treffer. */
export function filterRecipes<T extends { name: string }>(list: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_QUERY) return list;
  return list.filter((r) => r.name.toLowerCase().includes(needle)).slice(0, MAX_HITS);
}

export interface RecipeEntry {
  /** Rezept-ID als Text, bei älteren Daten "name:{Name}". */
  key: string;
  name: string;
  recipe: RecipeView | null;
}

/** Rezepte eines Berufs am Charakter, deutsch nach Name sortiert, mit Details soweit vorhanden. */
export function recipeEntries(p: CharacterProfession, recipes: Record<string, RecipeView>): RecipeEntry[] {
  return p.recipes
    .map((name, i) => {
      const id = p.recipeIds?.[i];
      return id === undefined
        ? { key: `name:${name}`, name, recipe: null }
        : { key: String(id), name, recipe: recipes[String(id)] ?? null };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}
