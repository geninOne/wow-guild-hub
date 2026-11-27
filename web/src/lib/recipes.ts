import type { RecipeView } from "../../../src/api/types";
import type { CharacterProfession } from "../../../src/model";

export const MIN_QUERY = 2;
const MAX_HITS = 100;

/** Filters by part of the name from `MIN_QUERY` characters on (otherwise all), keeps the order, at most 100 hits. */
export function filterRecipes<T extends { name: string }>(list: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_QUERY) return list;
  return list.filter((r) => r.name.toLowerCase().includes(needle)).slice(0, MAX_HITS);
}

export interface RecipeEntry {
  /** Recipe ID as text, "name:{Name}" for older data. */
  key: string;
  name: string;
  recipe: RecipeView | null;
}

/** Recipes of a character's profession, sorted by name in German order, with details where available. */
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
