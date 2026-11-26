import type { CharacterProfession, IconMap, RecipeDetails, RecipeNames } from "../model";
import type { RecipeView } from "./types";

/**
 * Rezeptnamen zur Anzeige: deutsch aus den Rezeptdetails, sonst aus `static/recipe-names` (ältere Daten),
 * sonst der englische Name aus den Charakterdaten.
 */
export function recipeDisplayNames(p: CharacterProfession, names: RecipeNames | null, details?: RecipeDetails | null): string[] {
  return p.recipes.map((en, i) => {
    const id = p.recipeIds?.[i];
    if (id === undefined) return en;
    return details?.[String(id)]?.name || names?.[String(id)] || en;
  });
}

/** Details eines Rezepts mit Icons der Materialien; null ohne ID oder ohne gespeicherte Details. */
export function recipeView(id: number | undefined, details: RecipeDetails | null, itemIcons: IconMap | null): RecipeView | null {
  const d = id === undefined ? null : details?.[String(id)];
  if (!d) return null;
  return { ...d, reagents: d.reagents.map((r) => ({ ...r, icon: itemIcons?.[String(r.id)] ?? null })) };
}
