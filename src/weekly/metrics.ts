import type { ActivityWeek, DaySnapshot, MemberSummary, WeekMetrics } from "../model";

type SnapshotField = "level" | "deaths" | "recipes" | "dungeons" | "achievements" | "reputation" | "equippedItemLevel";

/** Zuwachs eines Zählers zwischen zwei Tagesständen; null, wenn einer der beiden den Wert nicht kennt. */
export function gain(before: DaySnapshot | null, end: DaySnapshot | null, id: number, field: SnapshotField): number | null {
  const a = before?.characters[String(id)]?.[field];
  const b = end?.characters[String(id)]?.[field];
  if (typeof a !== "number" || typeof b !== "number") return null;
  // Rangwechsel zwischen Twink und Hauptcharakter ändert, ob accountweite Erfolge zählen; das ist kein Zuwachs.
  if (field === "achievements" && !before?.characters[String(id)]?.achievementsTwink !== !end?.characters[String(id)]?.achievementsTwink) {
    return null;
  }
  return Math.max(0, b - a);
}

/** Kennzahlen einer Woche je aktivem Mitglied aus der Aktivität und zwei Tagesständen (vor und am Ende der Woche). */
export function weekMetrics(input: {
  activity: ActivityWeek | null;
  before: DaySnapshot | null;
  end: DaySnapshot | null;
  members: MemberSummary[];
}): Map<number, WeekMetrics> {
  const { activity, before, end } = input;
  const result = new Map<number, WeekMetrics>();
  for (const m of input.members) {
    if (m.former) continue;
    const hours = activity?.characters[String(m.id)] ?? [];
    const ofDay = hours.map((h) => h % 24);
    result.set(m.id, {
      logins: hours.length,
      nightLogins: ofDay.filter((h) => h >= 1 && h < 5).length,
      earlyLogins: ofDay.filter((h) => h >= 5 && h < 8).length,
      activeDays: new Set(hours.map((h) => Math.floor(h / 24))).size,
      levels: gain(before, end, m.id, "level"),
      deaths: gain(before, end, m.id, "deaths"),
      recipes: gain(before, end, m.id, "recipes"),
      dungeons: gain(before, end, m.id, "dungeons"),
      achievements: gain(before, end, m.id, "achievements"),
      reputation: gain(before, end, m.id, "reputation"),
      itemLevel: gain(before, end, m.id, "equippedItemLevel"),
      awayDays: activity?.returns?.[String(m.id)] ?? 0,
    });
  }
  return result;
}
