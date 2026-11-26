import { berlinDate } from "../lib/time";
import type { DaySnapshot, MemberSummary } from "../model";

export function buildSnapshot(members: MemberSummary[], at: string): DaySnapshot {
  const characters: DaySnapshot["characters"] = {};
  for (const m of members) {
    if (m.former) continue;
    characters[String(m.id)] = {
      level: m.level,
      equippedItemLevel: m.equippedItemLevel,
      professions: Object.fromEntries(m.professions.map((p) => [String(p.id), p.skill])),
      ...(typeof m.deaths === "number" ? { deaths: m.deaths } : {}),
      ...(typeof m.dungeonsEntered === "number" ? { dungeons: m.dungeonsEntered } : {}),
      ...(typeof m.recipeCount === "number" ? { recipes: m.recipeCount } : {}),
      ...(typeof m.achievementCount === "number" ? { achievements: m.achievementCount } : {}),
      ...(typeof m.reputationTiers === "number" ? { reputation: m.reputationTiers } : {}),
    };
  }
  return { date: berlinDate(at), takenAt: at, characters };
}
