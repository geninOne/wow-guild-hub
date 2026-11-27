/* eslint-disable @typescript-eslint/no-explicit-any -- Rohantworten der API sind untypisiert */
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

/** Rostereintrag mit der Gilde, aus deren Roster er stammt. */
export type GuildRosterEntry = RosterEntry & { guildSlug: string };

/**
 * Gleicht gespeicherte Mitglieder mit den aktuellen Rostern aller Gilden ab. Ehemalige bleiben erhalten
 * und werden markiert. Das Level kommt nur bei Mitgliedern ohne Profil aus dem Roster.
 * Steht ein Charakter in mehreren Rostern, zählt der erste Eintrag.
 * Aktive Mitglieder einer Gilde aus `unavailable` (Roster nicht abrufbar) bleiben unverändert.
 * Mitglieder ohne `guildSlug` (Daten vor mehreren Gilden) gelten als Mitglieder der Hauptgilde.
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

/** Blob mit `is_account_wide` je Erfolg; der statische Sammler füllt ihn, der Gildensammler liest ihn. */
export const ACCOUNT_WIDE_KEY = "static/achievement-account-wide";

/**
 * Abgeschlossene Erfolge, die dem Charakter selbst gehören. Accountweite Erfolge (Klasse, Berufe, Dungeonerforscher)
 * erbt bei WoW Forever jeder Twink samt erledigtem Kriterium; sie zählen nicht. Erfolge, deren Angabe der statische
 * Sammler noch nicht kennt, zählen vorerst mit: So sinkt die Zahl nur, wenn die Angabe kommt, und täuscht keinen
 * Zuwachs vor.
 */
export function ownAchievementCount(record: CharacterRecord, accountWide: AchievementAccountWide = {}): number | null {
  if (!record.instances) return null;
  return record.instances.achievements.filter((a) => a.completed && accountWide[String(a.id)] !== true).length;
}

export function applyRecord(
  member: MemberSummary,
  record: CharacterRecord,
  at: string,
  accountWide: AchievementAccountWide = {},
): MemberSummary {
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
    achievementCount: ownAchievementCount(record, accountWide),
    reputationTiers: record.reputations ? record.reputations.reduce((sum, r) => sum + r.tier, 0) : null,
  };
}

/** Aktive Mitglieder; nie geholte zuerst, dann die am längsten nicht geholten. */
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
