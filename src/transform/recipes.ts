/* eslint-disable @typescript-eslint/no-explicit-any -- raw API responses are untyped */
import type { CraftedItem, RecipeDetail } from "../model";
import { mapItemTooltip } from "./character";

function craftedItem(recipe: any, item: any | null): CraftedItem | null {
  const ref = recipe?.crafted_item;
  if (!ref) return null;
  const preview = item?.preview_item;
  return {
    id: ref.id ?? 0,
    name: item?.name ?? ref.name ?? "",
    quality: item?.quality?.type ?? null,
    itemLevel: preview?.level?.value ?? null,
    tooltip: preview ? mapItemTooltip(preview) : null,
  };
}

/** Compact recipe details from `/data/wow/recipe/{id}`, the recipe icon and `/data/wow/item/{id}` of the result. */
export function toRecipeDetail(recipe: any, icon: string | null, item: any | null): RecipeDetail {
  return {
    id: recipe?.id ?? 0,
    name: recipe?.name ?? "",
    description: recipe?.description ?? null,
    icon,
    craftedQuantity: recipe?.crafted_quantity?.value ?? 1,
    item: craftedItem(recipe, item),
    reagents: (recipe?.reagents ?? []).map((r: any) => ({
      id: r?.reagent?.id ?? 0,
      name: r?.reagent?.name ?? "",
      quantity: r?.quantity ?? 1,
    })),
  };
}
