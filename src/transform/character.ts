/* eslint-disable @typescript-eslint/no-explicit-any -- raw API responses are untyped */
import type {
  ItemTooltip,
  CharacterProfession,
  CharacterRecord,
  CharacterSpec,
  EquippedItem,
  AchievementProgress,
  BossKill,
  InstanceProgress,
  CharacterReputation,
  CharacterStats,
} from "../model";
import { PROFESSION_NAMES_DE } from "./professions";

export interface RosterEntry {
  id: number;
  name: string;
  surname: string | null;
  slug: string;
  level: number;
  classId: number;
  raceId: number;
  rank: number;
}

/** Per part the `data` of a 200 response, or null (404 or not requested). */
export interface CharacterParts {
  profile: any | null;
  specializations: any | null;
  equipment: any | null;
  media: any | null;
  professions: any | null;
  raids: any | null;
  achievements: any | null;
  statistics: any | null;
  reputations: any | null;
}

/** Statistics category "Dungeons & Schlachtzüge" (dungeons and raids) and its subcategory "Boss-Kills". */
const STATS_INSTANCES = 14807;
const STATS_BOSS_KILLS = 14821;
/** "5-Spieler-Dungeons betreten" (5-player dungeons entered) in "Dungeons & Schlachtzüge". */
const STAT_DUNGEONS_ENTERED = 932;
/** Statistics category "Tode" (deaths) and within it "Tode insgesamt" (total deaths). */
const STATS_DEATHS = 122;
const STAT_DEATHS_TOTAL = 60;

export function mapEquipment(raw: any | null): EquippedItem[] {
  const items: any[] = raw?.equipped_items ?? [];
  return items.map((i) => ({
    slot: i.slot?.type ?? "",
    slotName: i.slot?.name ?? "",
    itemId: i.item?.id ?? 0,
    name: i.name ?? "",
    quality: i.quality?.type ?? "",
    itemLevel: i.level?.value ?? null,
    enchantments: (i.enchantments ?? []).map((e: any) => e.display_string).filter(Boolean),
    tooltip: mapItemTooltip(i),
  }));
}

export function mapItemTooltip(raw: any): ItemTooltip {
  const copper = raw?.sell_price?.value;
  return {
    binding: raw?.binding?.name ?? null,
    unique: raw?.unique_equipped ?? null,
    slotType: raw?.inventory_type?.type === "NON_EQUIP" ? null : (raw?.inventory_type?.name ?? null),
    subclass: raw?.is_subclass_hidden ? null : (raw?.item_subclass?.name ?? null),
    containerSlots: raw?.container_slots?.display_string ?? null,
    armor: raw?.armor?.display?.display_string ?? null,
    block: raw?.shield_block?.display?.display_string ?? null,
    damage: raw?.weapon?.damage?.display_string ?? null,
    speed: raw?.weapon?.attack_speed?.display_string ?? null,
    dps: raw?.weapon?.dps?.display_string ?? null,
    stats: (raw?.stats ?? []).map((s: any) => s?.display?.display_string).filter(Boolean),
    spells: (raw?.spells ?? []).map((s: any) => s?.description).filter(Boolean),
    description: raw?.description ?? null,
    durability: raw?.durability?.display_string ?? null,
    requiredLevel: raw?.requirements?.level?.display_string ?? null,
    sellPrice:
      typeof copper === "number"
        ? { gold: Math.floor(copper / 10000), silver: Math.floor(copper / 100) % 100, copper: copper % 100 }
        : null,
  };
}

export function mapSpecs(raw: any | null): CharacterSpec[] {
  const specs: any[] = raw?.specialization_groups?.[0]?.specializations ?? [];
  return specs.map((s) => ({
    specId: s.specialization?.id ?? 0,
    name: s.specialization_name ?? s.specialization?.name ?? "",
    spentPoints: s.spent_points ?? 0,
    talents: (s.talents ?? []).map((t: any) => ({
      talentId: t.talent?.id ?? 0,
      spellId: t.spell_tooltip?.spell?.id ?? 0,
      name: t.talent?.name ?? t.spell_tooltip?.spell?.name ?? "",
      rank: t.talent_rank ?? 0,
      description: t.spell_tooltip?.description ?? "",
    })),
  }));
}

/** Tree with the most points; null on a tie at the top or with 0 points. */
export function pickMainSpec(specs: CharacterSpec[]): number | null {
  const max = Math.max(0, ...specs.map((s) => s.spentPoints));
  if (max === 0) return null;
  const top = specs.filter((s) => s.spentPoints === max);
  return top.length === 1 ? top[0].specId : null;
}

export function mapProfessions(raw: any | null): CharacterProfession[] {
  const map = (list: any[] | undefined, primary: boolean): CharacterProfession[] =>
    (list ?? []).map((p) => {
      const tier = p.tiers?.[0] ?? {};
      const id: number = p.profession?.id ?? 0;
      const nameEn: string = p.profession?.name ?? "";
      const known: any[] = (tier.known_recipes ?? []).filter((r: any) => r?.name);
      return {
        id,
        name: PROFESSION_NAMES_DE[id] ?? nameEn,
        nameEn,
        skill: tier.skill_points ?? 0,
        max: tier.max_skill_points ?? 0,
        primary,
        recipes: known.map((r: any) => r.name),
        recipeIds: known.map((r: any) => r.id ?? 0),
      };
    });
  return [...map(raw?.primaries, true), ...map(raw?.secondaries, false)];
}

export function mapMedia(raw: any | null): Record<string, string> | null {
  const assets: any[] = raw?.assets ?? [];
  if (assets.length === 0) return null;
  return Object.fromEntries(assets.map((a) => [a.key, a.value]));
}

/**
 * Only achievements with progress, only IDs: German names come from the static definitions. On WoW Forever,
 * `completed_timestamp` applies to the whole account (an alt then "has" e.g. "Erkundet Steinkrallengebirge" without
 * ever having been there); so the character's root criterion decides, and the timestamp only when there are no
 * criteria. For account-wide achievements (`is_account_wide`, e.g. "Dungeonerforscher") the criterion is account-wide
 * too.
 */
export function mapAchievementProgress(raw: any | null): AchievementProgress[] {
  const list: any[] = raw?.achievements ?? [];
  return list.flatMap((a) => {
    const criteria: number[] = (a.criteria?.child_criteria ?? [])
      .filter((c: any) => c?.is_completed === true)
      .map((c: any) => c.id);
    const completed = a.criteria ? a.criteria.is_completed === true : a.completed_timestamp != null;
    if (!completed && criteria.length === 0) return [];
    return [{ id: a.id, completed, criteria }];
  });
}

export function parseBossKillName(name: string): { boss: string; instance: string | null } {
  // Blizzard de_DE statistic name: "Siege über BOSS (INSTANCE)" ("Victories over ...").
  const match = /^Siege über (.+?)(?: \((.+)\))?$/.exec(name);
  if (!match) return { boss: name, instance: null };
  return { boss: match[1], instance: match[2] ?? null };
}

export function mapBossKills(raw: any | null): BossKill[] {
  const category = (raw?.categories ?? []).find((c: any) => c?.id === STATS_INSTANCES);
  const sub = (category?.sub_categories ?? []).find((c: any) => c?.id === STATS_BOSS_KILLS);
  return (sub?.statistics ?? [])
    .filter((s: any) => typeof s?.name === "string")
    .map((s: any) => ({
      ...parseBossKillName(s.name),
      quantity: s.quantity ?? 0,
      lastAt: typeof s.last_updated_timestamp === "number" ? new Date(s.last_updated_timestamp).toISOString() : null,
    }));
}

/** Counter directly in a statistics category; if the entry is missing, the value is 0 (Blizzard omits zero values). */
function statQuantity(raw: any, categoryId: number, statId: number): number {
  const category = (raw?.categories ?? []).find((c: any) => c?.id === categoryId);
  const stat = (category?.statistics ?? []).find((s: any) => s?.id === statId);
  return typeof stat?.quantity === "number" ? stat.quantity : 0;
}

export function mapStats(raw: any | null): CharacterStats | null {
  if (raw === null || raw === undefined) return null;
  return {
    deaths: statQuantity(raw, STATS_DEATHS, STAT_DEATHS_TOTAL),
    dungeonsEntered: statQuantity(raw, STATS_INSTANCES, STAT_DUNGEONS_ENTERED),
  };
}

/**
 * All statistics in compact form: statistic ID to value, plus the texts of the "most often" statistics
 * (e.g. the most killed creature type). Names and categories are stored in `config/statistiken.json`.
 */
export function mapStatValues(raw: any | null): { values: Record<string, number>; texts: Record<string, string> } | null {
  if (raw === null || raw === undefined) return null;
  const values: Record<string, number> = {};
  const texts: Record<string, string> = {};
  for (const category of raw.categories ?? []) {
    const lists = [category?.statistics ?? [], ...(category?.sub_categories ?? []).map((sub: any) => sub?.statistics ?? [])];
    for (const stat of lists.flat()) {
      if (typeof stat?.id !== "number" || typeof stat.quantity !== "number") continue;
      values[String(stat.id)] = stat.quantity;
      if (typeof stat.description === "string" && stat.description !== "") texts[String(stat.id)] = stat.description;
    }
  }
  return { values, texts };
}

function mapInstances(achievements: any | null, statistics: any | null): InstanceProgress | null {
  if (achievements === null && statistics === null) return null;
  return { achievements: mapAchievementProgress(achievements), bossKills: mapBossKills(statistics) };
}

export function mapReputations(raw: any | null): CharacterReputation[] {
  return (raw?.reputations ?? [])
    .filter((r: any) => typeof r?.faction?.id === "number")
    .map((r: any) => ({
      factionId: r.faction.id,
      name: r.faction.name ?? "",
      tier: r.standing?.tier ?? 0,
      tierName: r.standing?.name ?? "",
      value: r.standing?.value ?? 0,
      max: r.standing?.max ?? 0,
    }));
}

function mapRaids(raw: any | null): unknown | null {
  if (!raw) return null;
  const { _links, character, ...rest } = raw;
  return rest;
}

export function buildCharacterRecord(entry: RosterEntry, parts: CharacterParts, fetchedAt: string): CharacterRecord {
  const p = parts.profile;
  if (!p) {
    return {
      id: entry.id, name: entry.name, surname: entry.surname, slug: entry.slug, fetchedAt, hasProfile: false,
      level: entry.level, classId: entry.classId, raceId: entry.raceId, className: null, raceName: null,
      gender: null, rulesetName: null, equippedItemLevel: null, lastLoginAt: null, media: null,
      equipment: [], specs: [], mainSpecId: null, professions: [], raidsRaw: null, instances: null, reputations: null,
      stats: null, statValues: null, statTexts: null,
    };
  }
  const specs = mapSpecs(parts.specializations);
  const statistics = mapStatValues(parts.statistics);
  return {
    id: p.id ?? entry.id,
    name: p.name ?? entry.name,
    surname: p.surname ?? null,
    slug: entry.slug,
    fetchedAt,
    hasProfile: true,
    level: p.level ?? entry.level,
    classId: p.character_class?.id ?? entry.classId,
    raceId: p.race?.id ?? entry.raceId,
    className: p.character_class?.name ?? null,
    raceName: p.race?.name ?? null,
    gender: p.gender?.name ?? null,
    rulesetName: p.ruleset?.name ?? null,
    equippedItemLevel: p.equipped_item_level ?? null,
    lastLoginAt: p.last_login_timestamp ? new Date(p.last_login_timestamp).toISOString() : null,
    media: mapMedia(parts.media),
    equipment: mapEquipment(parts.equipment),
    specs,
    mainSpecId: pickMainSpec(specs),
    professions: mapProfessions(parts.professions),
    raidsRaw: mapRaids(parts.raids),
    instances: mapInstances(parts.achievements, parts.statistics),
    reputations: parts.reputations === null ? null : mapReputations(parts.reputations),
    stats: mapStats(parts.statistics),
    statValues: statistics?.values ?? null,
    statTexts: statistics?.texts ?? null,
  };
}
