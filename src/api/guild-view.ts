import type { GuildRecord, MemberSummary, NamedList } from "../model";
import { PROFESSION_NAMES_DE } from "../transform/professions";
import { configuredRanks, rankName, type RankNames } from "./config";
import type { GuildRef, GuildView, MemberRow } from "./types";

export function lookupName(list: NamedList | null, id: number, fallback: string): string {
  return list?.items.find((item) => item.id === id)?.name ?? fallback;
}

/** Gilden der Gemeinschaft, Hauptgilde zuerst. Alte Blobs ohne `guilds` ergeben eine Gilde aus den Kopf-Feldern. */
export function guildRefs(guild: GuildRecord): GuildRef[] {
  if (guild.guilds && guild.guilds.length > 0) {
    return guild.guilds.map(({ slug, name, faction, memberCount, main }) => ({ slug, name, faction, memberCount, main }));
  }
  return [{ slug: "", name: guild.name, faction: guild.faction, memberCount: guild.memberCount, main: true }];
}

/** Gilde eines Mitglieds; ohne oder mit unbekanntem `guildSlug` die Hauptgilde. */
export function memberGuild(guild: GuildRecord, m: MemberSummary | null, refs: GuildRef[] = guildRefs(guild)): GuildRef {
  return refs.find((g) => g.slug === m?.guildSlug) ?? refs[0];
}

export function buildGuildView(
  guild: GuildRecord,
  classes: NamedList | null,
  races: NamedList | null,
  rankNames: RankNames,
): GuildView {
  const guilds = guildRefs(guild);
  const members: MemberRow[] = guild.members.map((m) => ({
    id: m.id,
    name: m.name,
    surname: m.surname,
    slug: m.slug,
    level: m.level,
    classId: m.classId,
    className: lookupName(classes, m.classId, `Klasse ${m.classId}`),
    raceId: m.raceId,
    raceName: lookupName(races, m.raceId, `Volk ${m.raceId}`),
    rank: m.rank,
    rankName: rankName(m.rank, memberGuild(guild, m, guilds).slug, rankNames),
    itemLevel: m.equippedItemLevel,
    mainSpecName: m.mainSpecName,
    hasProfile: m.hasProfile,
    former: m.former,
    guildSlug: memberGuild(guild, m, guilds).slug,
    guildName: memberGuild(guild, m, guilds).name,
    professions: m.professions.map((p) => ({
      id: p.id,
      name: PROFESSION_NAMES_DE[p.id] ?? `Beruf ${p.id}`,
      skill: p.skill,
    })),
  }));

  const classMap = new Map<number, string>();
  for (const m of members) classMap.set(m.classId, m.className);

  const ranks = guilds.flatMap((g) => {
    const rankSet = new Set<number>(configuredRanks(g.slug, rankNames));
    for (const m of members) if (m.guildSlug === g.slug) rankSet.add(m.rank);
    return [...rankSet]
      .filter((r) => !Number.isNaN(r))
      .sort((x, y) => x - y)
      .map((rank) => ({ guildSlug: g.slug, rank, name: rankName(rank, g.slug, rankNames) }));
  });

  return {
    fetchedAt: guild.fetchedAt,
    name: guild.name,
    faction: guild.faction,
    rulesetName: guild.rulesetName,
    memberCount: guild.memberCount,
    guilds,
    classes: [...classMap]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    ranks,
    members,
  };
}
