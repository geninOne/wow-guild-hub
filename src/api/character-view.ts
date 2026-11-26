import type {
  CharacterAttributesRecord,
  CharacterRecord,
  GuildRecord,
  IconMap,
  InstanceAchievementsRecord,
  MemberSummary,
  NamedList,
  RecipeDetails,
  RecipeNames,
  ReputationFactionsRecord,
} from "../model";
import { rankName, type RankNames } from "./config";
import { lookupName, memberGuild } from "./guild-view";
import { DUNGEON_INFO, EXTRA_DUNGEONS } from "../instance-images";
import { buildAttributesView } from "./attributes-view";
import { buildInstancesView } from "./instances-view";
import { recipeDisplayNames, recipeView } from "./recipes";
import { buildReputationView } from "./reputation-view";
import type { CharacterView, RecipeView } from "./types";

export function findMember(guild: GuildRecord, key: string): MemberSummary | null {
  const matches = /^\d+$/.test(key)
    ? guild.members.filter((m) => m.id === Number(key))
    : guild.members.filter((m) => m.slug.toLowerCase() === key.toLowerCase());
  return matches.find((m) => !m.former) ?? matches[0] ?? null;
}

export function recordFromMember(m: MemberSummary): CharacterRecord {
  return {
    id: m.id,
    name: m.name,
    surname: m.surname,
    slug: m.slug,
    fetchedAt: m.lastFetchedAt ?? m.firstSeenAt,
    hasProfile: false,
    level: m.level,
    classId: m.classId,
    raceId: m.raceId,
    className: null,
    raceName: null,
    gender: null,
    rulesetName: null,
    equippedItemLevel: m.equippedItemLevel,
    lastLoginAt: null,
    media: null,
    equipment: [],
    specs: [],
    mainSpecId: null,
    professions: [],
    raidsRaw: null,
  };
}

export function buildCharacterView(input: {
  member: MemberSummary | null;
  record: CharacterRecord | null;
  guild: GuildRecord;
  classes: NamedList | null;
  races: NamedList | null;
  itemIcons: IconMap | null;
  rankNames: RankNames;
  recipeNames?: RecipeNames | null;
  recipeDetails?: RecipeDetails | null;
  instanceDefs?: InstanceAchievementsRecord | null;
  reputationFactions?: ReputationFactionsRecord | null;
  instanceImages?: IconMap | null;
  attributes?: CharacterAttributesRecord | null;
}): CharacterView | null {
  const { member, guild, classes, races, itemIcons, rankNames } = input;
  const stored = input.record ?? (member ? recordFromMember(member) : null);
  if (!stored) return null;
  // Die vollständige Statistik bleibt im Speicher; die Seite braucht sie (noch) nicht.
  const { statValues: _values, statTexts: _texts, ...shown } = stored;
  const character: CharacterRecord = {
    ...shown,
    professions: stored.professions.map((p) => ({ ...p, recipes: recipeDisplayNames(p, input.recipeNames ?? null, input.recipeDetails) })),
  };
  const home = memberGuild(guild, member);

  const icons: Record<string, string | null> = {};
  for (const item of character.equipment) {
    const key = String(item.itemId);
    icons[key] = itemIcons?.[key] ?? null;
  }

  const recipes: Record<string, RecipeView> = {};
  for (const p of stored.professions) {
    for (const id of p.recipeIds ?? []) {
      const view = recipeView(id, input.recipeDetails ?? null, itemIcons);
      if (view) recipes[String(id)] = view;
    }
  }

  return {
    character,
    className: lookupName(classes, character.classId, `Klasse ${character.classId}`),
    raceName: lookupName(races, character.raceId, `Volk ${character.raceId}`),
    guildName: home.name,
    guildFaction: home.faction,
    rank: member ? member.rank : null,
    rankName: member ? rankName(member.rank, home.slug, rankNames) : null,
    former: member?.former ?? false,
    itemIcons: icons,
    instances: buildInstancesView(input.instanceDefs ?? null, stored.instances, input.instanceImages ?? null, DUNGEON_INFO, EXTRA_DUNGEONS, home.faction),
    reputation: buildReputationView(stored.reputations, input.reputationFactions ?? null),
    attributes: buildAttributesView(input.attributes),
    recipes,
  };
}
