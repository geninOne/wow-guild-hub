/* eslint-disable @typescript-eslint/no-explicit-any -- raw API responses are untyped */
import type { AchievementAccountWide, CharacterRecord, MemberSummary } from "../model";
import type { RosterEntry } from "../transform/character";

export function parseRoster(raw: any): RosterEntry[] {
  return (raw?.members ?? []).map((m: any) => {
    const c = m.character ?? {};
    return {
      id: c.id,
      name: c.name ?? "",
      surname: c.surname ?? null,
      slug: c.slug ?? "",
      level: c.level ?? 0,
      classId: c.playable_class?.id ?? 0,
      raceId: c.playable_race?.id ?? 0,
      rank: m.rank ?? 0,
    };
  });
}

/** Roster entry with the guild whose roster it comes from. */
export type GuildRosterEntry = RosterEntry & { guildSlug: string };

/**
 * Reconciles stored members with the current rosters of all guilds. Former members are kept
 * and marked. The level comes from the roster only for members without a profile.
 * If a character appears in several rosters, the first entry counts.
 * Active members of a guild from `unavailable` (roster not available) stay unchanged.
 * Members without `guildSlug` (data from before multiple guilds) count as members of the main guild.
 */
export function mergeRoster(
  prev: MemberSummary[],
  roster: GuildRosterEntry[],
  at: string,
  mainSlug: string,
  unavailable: string[] = [],
): MemberSummary[] {
  const known = new Map(prev.map((m) => [m.id, m]));
  const seen = new Set<number>();
  const unique = roster.filter((e) => !seen.has(e.id) && seen.add(e.id));
  const inRoster = new Set(unique.map((e) => e.id));
  const slugOf = (m: MemberSummary) => m.guildSlug ?? mainSlug;

  const current = unique.map((e): MemberSummary => {
    const old = known.get(e.id);
    if (!old) {
      return {
        id: e.id, name: e.name, surname: e.surname, slug: e.slug, rank: e.rank, level: e.level,
        classId: e.classId, raceId: e.raceId, hasProfile: false, former: false, firstSeenAt: at,
        leftAt: null, lastFetchedAt: null, equippedItemLevel: null, mainSpecName: null, professions: [],
        guildSlug: e.guildSlug,
      };
    }
    return {
      ...old,
      name: e.name, surname: e.surname, slug: e.slug, rank: e.rank, classId: e.classId, raceId: e.raceId,
      level: old.hasProfile ? old.level : e.level,
      former: false,
      leftAt: null,
      guildSlug: e.guildSlug,
    };
  });

  const gone = prev
    .filter((m) => !inRoster.has(m.id))
    .map((m): MemberSummary => {
      if (!m.former && unavailable.includes(slugOf(m))) return m;
      return m.former ? { ...m, guildSlug: slugOf(m) } : { ...m, former: true, leftAt: at, guildSlug: slugOf(m) };
    });

  return [...current, ...gone];
}

/** Blob with `is_account_wide` per achievement; the static collector fills it, the guild collector reads it. */
export const ACCOUNT_WIDE_KEY = "static/achievement-account-wide";

/** Does the member have an alt rank in its guild? Without `guildSlug` the main guild applies. */
export function isTwink(member: MemberSummary, mainSlug: string, twinkRanks: Record<string, number[]> = {}): boolean {
  const slug = (member.guildSlug ?? mainSlug).normalize("NFC");
  return twinkRanks[slug]?.includes(member.rank) ?? false;
}

/**
 * Completed achievements. WoW Forever reports account-wide achievements (class, professions, dungeon explorer) as
 * completed for every character of the account; they count only for the main character, not for alts. Achievements
 * whose flag the static collector does not know yet count for alts too for now.
 */
export function ownAchievementCount(
  record: CharacterRecord,
  accountWide: AchievementAccountWide = {},
  twink = false,
): number | null {
  if (!record.instances) return null;
  return record.instances.achievements.filter((a) => a.completed && !(twink && accountWide[String(a.id)] === true)).length;
}

export function applyRecord(
  member: MemberSummary,
  record: CharacterRecord,
  at: string,
  achievements: { accountWide?: AchievementAccountWide; twink?: boolean } = {},
): MemberSummary {
  const twink = achievements.twink === true;
  const mainSpec = record.specs.find((s) => s.specId === record.mainSpecId);
  return {
    ...member,
    ...(record.hasProfile ? { name: record.name, surname: record.surname, slug: record.slug } : {}),
    level: record.level,
    hasProfile: record.hasProfile,
    equippedItemLevel: record.equippedItemLevel,
    mainSpecName: mainSpec?.name ?? null,
    professions: record.professions.map((p) => ({ id: p.id, skill: p.skill })),
    lastFetchedAt: at,
    deaths: record.stats?.deaths ?? null,
    dungeonsEntered: record.stats?.dungeonsEntered ?? null,
    recipeCount: record.hasProfile ? record.professions.reduce((sum, p) => sum + p.recipes.length, 0) : null,
    achievementCount: ownAchievementCount(record, achievements.accountWide, twink),
    achievementsTwink: twink,
    reputationTiers: record.reputations ? record.reputations.reduce((sum, r) => sum + r.tier, 0) : null,
  };
}

/** Active members; never fetched ones first, then the ones not fetched for the longest time. */
export function fetchOrder(members: MemberSummary[]): MemberSummary[] {
  return members
    .filter((m) => !m.former)
    .sort((a, b) => {
      if (a.lastFetchedAt === b.lastFetchedAt) return 0;
      if (a.lastFetchedAt === null) return -1;
      if (b.lastFetchedAt === null) return 1;
      return a.lastFetchedAt < b.lastFetchedAt ? -1 : 1;
    });
}
