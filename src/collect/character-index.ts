import type { CharacterIndexEntry, CharacterRecord } from "../model";

/** One blob instead of one blob per character: `collect-static` only reads this one. */
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
    achievementIds: (rec.instances?.achievements ?? []).filter((a) => a.completed).map((a) => a.id),
  };
}
