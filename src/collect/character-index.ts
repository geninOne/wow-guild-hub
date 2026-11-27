import type { CharacterIndexEntry, CharacterRecord } from "../model";

/** Ein Blob statt eines Blobs je Charakter: `collect-static` liest nur noch diesen. */
export const CHARACTER_INDEX_KEY = "character-index";

export function toCharacterIndexEntry(rec: CharacterRecord): CharacterIndexEntry {
  const itemIds: number[] = [];
  const itemLevels: Record<string, number> = {};
  for (const item of rec.equipment ?? []) {
    if (!item.itemId) continue;
    itemIds.push(item.itemId);
    if (typeof item.itemLevel === "number") itemLevels[String(item.itemId)] = item.itemLevel;
  }
  return {
    slug: rec.slug,
    hasProfile: rec.hasProfile,
    lastLoginAt: rec.lastLoginAt,
    itemIds,
    itemLevels,
    recipeIds: (rec.professions ?? []).flatMap((p) => p.recipeIds ?? []),
  };
}
