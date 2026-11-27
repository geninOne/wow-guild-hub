import type { CharacterProfession, IconMap, RecipeDetails, RecipeNames } from "../model";
import type { RecipeView } from "./types";

/**
 * Recipe names for display: German from the recipe details, otherwise from `static/recipe-names` (older data),
 * otherwise the English name from the character data.
 */
export function recipeDisplayNames(p: CharacterProfession, names: RecipeNames | null, details?: RecipeDetails | null): string[] {
  return p.recipes.map((en, i) => {
    const id = p.recipeIds?.[i];
    if (id === undefined) return en;
    return details?.[String(id)]?.name || names?.[String(id)] || en;
  });
}

/** Details of a recipe with icons of its reagents; null without an ID or without stored details. */
export function recipeView(id: number | undefined, details: RecipeDetails | null, itemIcons: IconMap | null): RecipeView | null {
  const d = id === undefined ? null : details?.[String(id)];
  if (!d) return null;
  return { ...d, reagents: d.reagents.map((r) => ({ ...r, icon: itemIcons?.[String(r.id)] ?? null })) };
}
