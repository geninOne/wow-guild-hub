// Week in numbers: guild sums per guild and in total, computed deterministically from the weekly key figures.
import type { GuildRecord, MemberSummary, WeekMetrics, WeeklySums, WeeklyNumberKind, WeeklyNumbers } from "../model";

export const WEEKLY_NUMBER_KINDS: WeeklyNumberKind[] = ["anmeldungen", "level", "tode", "dungeons", "rezepte", "erfolge", "ruf", "gegenstandsstufe"];

/** Where a sum takes its values from. */
const FIELD: Record<WeeklyNumberKind, keyof WeekMetrics> = {
  anmeldungen: "logins",
  level: "levels",
  tode: "deaths",
  dungeons: "dungeons",
  rezepte: "recipes",
  erfolge: "achievements",
  ruf: "reputation",
  gegenstandsstufe: "itemLevel",
};

/**
 * Who counts towards the week's numbers: active members without opted-out ones. The same set also counts for the
 * number of the week, so the info box and the article never show different values.
 */
export function countedMembers(members: MemberSummary[], excluded: Set<number> = new Set()): MemberSummary[] {
  return members.filter((m) => !m.former && !excluded.has(m.id));
}

/** Sums over the members; null if none of them has a value. */
export function weeklySums(metrics: Map<number, WeekMetrics>, members: MemberSummary[]): WeeklySums {
  const out = {} as WeeklySums;
  for (const kind of WEEKLY_NUMBER_KINDS) {
    let total: number | null = null;
    for (const m of members) {
      const v = metrics.get(m.id)?.[FIELD[kind]];
      if (typeof v === "number") total = (total ?? 0) + v;
    }
    out[kind] = total;
  }
  return out;
}

/** Guild slug of a member as in the read API: without or with an unknown slug, the main guild. */
export function guildNameOf(guild: GuildRecord, m: MemberSummary): string {
  const slugs = (guild.guilds ?? []).map((g) => g.slug);
  if (slugs.length === 0) return "";
  return m.guildSlug && slugs.includes(m.guildSlug) ? m.guildSlug : slugs[0];
}

/** Numbers of a week: sums in total and per guild, plus the best single value per kind. */
export function buildWeeklyNumbers(
  metrics: Map<number, WeekMetrics>,
  guild: GuildRecord,
  excluded: Set<number> = new Set(),
): Omit<WeeklyNumbers, "vorwoche"> {
  const members = countedMembers(guild.members, excluded);
  const guilds: Record<string, WeeklySums> = {};
  const slugs = (guild.guilds ?? []).map((g) => g.slug);
  for (const slug of slugs.length > 0 ? slugs : [""]) {
    guilds[slug] = weeklySums(metrics, members.filter((m) => guildNameOf(guild, m) === slug));
  }
  const top: WeeklyNumbers["spitze"] = {};
  const byName = (a: MemberSummary, b: MemberSummary) => a.name.localeCompare(b.name, "de") || a.id - b.id;
  for (const kind of WEEKLY_NUMBER_KINDS) {
    const best = members
      .map((m) => ({ m, v: metrics.get(m.id)?.[FIELD[kind]] }))
      .filter((x): x is { m: MemberSummary; v: number } => typeof x.v === "number" && x.v > 0)
      .sort((a, b) => b.v - a.v || byName(a.m, b.m))[0];
    if (best) top[kind] = [best.m.id, best.v];
  }
  return { gesamt: weeklySums(metrics, members), gilden: guilds, spitze: top };
}
