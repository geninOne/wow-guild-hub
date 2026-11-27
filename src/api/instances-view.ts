import { INSTANCE_IMAGES, normName as norm, type DungeonInfo, type ExtraDungeon } from "../instance-images";
import type {
  AchievementProgress,
  BossKill,
  IconMap,
  InstanceAchievement,
  InstanceAchievementsRecord,
  InstanceProgress,
} from "../model";
import type { InstancesView, KillRef, LevelRange } from "./types";

export type { DungeonInfo, ExtraDungeon };

type DungeonEntry = InstancesView["dungeonTiers"][number]["dungeons"][number];

const IMAGES = new Map(Object.entries(INSTANCE_IMAGES).map(([name, ref]) => [norm(name), ref]));

/** Tile image for an instance name; for "A oder B" the first alternative with an image. */
export function instanceImage(name: string, tiles: IconMap | null): string | null {
  for (const alternative of name.split(" oder ")) {
    const ref = IMAGES.get(norm(alternative));
    const url = typeof ref === "string" ? ref : ref === undefined ? null : tiles?.[String(ref)];
    if (url) return url;
  }
  return null;
}

/** Raid name from the root criterion ("Schließt den Hyjalgipfel ab", "Tötet Onyxia"), else the achievement name. */
export function raidName(def: InstanceAchievement): string {
  const root = def.rootDescription ?? "";
  const complete = /^Schließt (?:den|die|das) (.+) ab$/.exec(root);
  if (complete) return complete[1];
  const kill = /^Tötet (.+)$/.exec(root);
  if (kill) return kill[1];
  return def.name;
}

/** One series per name: the one with progress of the character, otherwise the first in category order. */
function pickSeries(
  defs: InstanceAchievement[],
  kind: InstanceAchievement["kind"],
  progress: Map<number, AchievementProgress>,
): InstanceAchievement[] {
  const groups = new Map<string, InstanceAchievement[]>();
  for (const d of defs.filter((x) => x.kind === kind)) groups.set(d.name, [...(groups.get(d.name) ?? []), d]);
  return [...groups.values()]
    .map((group) => {
      const sorted = [...group].sort((a, b) => a.order - b.order);
      return sorted.find((d) => progress.has(d.id)) ?? sorted[0];
    })
    .sort((a, b) => a.order - b.order);
}

function levels(info: DungeonInfo | undefined): LevelRange | null {
  return info?.stufe ? { min: info.stufe[0], max: info.stufe[1] } : null;
}

/**
 * Completion from the character's statistics: victories over the final boss, the maximum per group of equivalent
 * final boss entries (final boss of the boss list and maintained statistics names of the same instance), summed over
 * the groups. Without a maintained final boss, all assigned kills count.
 */
function completion(kills: KillRef[], groups: string[][]): { at: string | null; times: number } {
  const known = groups.filter((g) => g.length > 0);
  if (known.length === 0) {
    const dates = kills.map((k) => k.lastAt).filter((d): d is string => d !== null).sort();
    return { at: dates.at(-1) ?? null, times: kills.reduce((sum, k) => sum + k.quantity, 0) };
  }
  let times = 0;
  const dates: string[] = [];
  for (const group of known) {
    const names = new Set(group.map(norm));
    const relevant = kills.filter((k) => names.has(norm(k.boss)));
    times += Math.max(0, ...relevant.map((k) => k.quantity));
    dates.push(...relevant.map((k) => k.lastAt).filter((d): d is string => d !== null));
  }
  return { at: dates.sort().at(-1) ?? null, times };
}

/** Final boss names that count for a dungeon: last entry of the boss list and the maintained statistics names. */
function finalGroup(info: DungeonInfo): string[] {
  return [...info.bosse.slice(-1), ...info.statistik.map((s) => s.endboss)];
}

/** Whether a kill belongs to this alternative: same instance name or a maintained statistics entry. */
function killMatches(k: BossKill, alternative: string, info: DungeonInfo | undefined): boolean {
  if (k.instance === null) return false;
  if (norm(k.instance) === norm(alternative)) return true;
  return (info?.statistik ?? []).some((s) => norm(s.instanz) === norm(k.instance!) && norm(s.endboss) === norm(k.boss));
}

function killRef(k: BossKill): KillRef {
  return { boss: k.boss, quantity: k.quantity, lastAt: k.lastAt };
}

export function buildInstancesView(
  defs: InstanceAchievementsRecord | null,
  progress: InstanceProgress | null | undefined,
  tiles: IconMap | null = null,
  info: Record<string, DungeonInfo> = {},
  extras: ExtraDungeon[] = [],
  /** Faction of the character ("HORDE", "ALLIANCE"); decides for extra dungeons that have a faction. */
  faction: string | null = null,
): InstancesView {
  const infoByName = new Map(Object.entries(info).map(([name, i]) => [norm(name), i]));
  const infosOf = (names: string[]): DungeonInfo[] =>
    names.map((n) => infoByName.get(norm(n))).filter((i): i is DungeonInfo => i !== undefined);
  const lookup = (names: string[]): DungeonInfo | undefined => infosOf(names)[0];
  if (!defs || defs.achievements.length === 0) return { available: false, dungeonTiers: [], raids: [], otherKills: [] };

  const done = new Map((progress?.achievements ?? []).map((a) => [a.id, a]));
  /**
   * In WoW Forever, achievements and their criteria apply to the whole account (alts inherit them from the main
   * character). They therefore only indicate "on this account"; a dungeon is completed only via its own statistics.
   */
  const onAccount = (def: InstanceAchievement, criterionId: number | null): boolean => {
    const p = done.get(def.id);
    return !!p && (p.completed || (criterionId !== null && p.criteria.includes(criterionId)));
  };
  // Each kill is assigned at most once.
  const open = new Set(progress?.bossKills ?? []);

  // Criteria replaced by extra dungeons are dropped; the extra dungeon shows whether they are done on the account.
  const replaced = new Set(extras.flatMap((e) => e.replaces.map(norm)));
  const replacedDone = new Set<string>();
  const dungeonTiers = pickSeries(defs.achievements, "dungeon", done).map((def) => ({
    achievementId: def.id,
    tier: def.name.split(":")[0].trim(),
    dungeons: def.criteria.filter((c) => {
      if (!replaced.has(norm(c.description))) return true;
      if (onAccount(def, c.id)) replacedDone.add(norm(c.description));
      return false;
    }).map((c) => {
      const alternatives = c.description.split(" oder ");
      const kills: KillRef[] = [];
      const matched = new Set<string>();
      for (const k of [...open]) {
        const alt = alternatives.find((a) => killMatches(k, a, lookup([a])));
        if (!alt) continue;
        open.delete(k);
        matched.add(alt);
        kills.push(killRef(k));
      }
      const shown = alternatives.filter((a) => matched.has(a));
      const name = shown.length > 0 ? shown.join(" oder ") : c.description;
      // With kills in several alternatives the data of all shown ones, otherwise the first alternative with data.
      const infos = shown.length > 1 ? infosOf(shown) : infosOf(shown.length > 0 ? shown : alternatives).slice(0, 1);
      const bossNames = [...new Set(infos.flatMap((i) => i.bosse))];
      const finals = infos.flatMap((i) => (i.bosse.length > 0 ? [i.bosse[i.bosse.length - 1]] : []));
      const result = completion(kills, infos.map(finalGroup));
      const completed = result.times > 0 || (finals.length === 0 && kills.length > 0);
      return {
        criterionId: c.id,
        name,
        description: c.description,
        completed,
        onAccount: !completed && onAccount(def, c.id),
        tracked: infos.length === 0 || infos.some((i) => !i.ohneStatistik),
        kills,
        image: instanceImage(name, tiles),
        levels: levels(infos.find((i) => i.stufe)),
        bosses: bossNames.length > 0 ? bossNames : null,
        finalBosses: finals,
        completedAt: result.at,
        timesCompleted: result.times,
      };
    }),
  }));

  // Extra dungeons without an achievement: completion only via boss kill statistics, sorted into their tier by min level.
  extras.forEach((extra, index) => {
    const kills: KillRef[] = [];
    for (const k of [...open]) {
      if (k.instance === null || norm(k.instance) !== norm(extra.source.instance)) continue;
      open.delete(k);
      kills.push(killRef(k));
    }
    // Mirrored victories of a character of the other faction are consumed but do not count.
    const ownFaction = extra.faction === null || faction === null || extra.faction === faction;
    if (!ownFaction) kills.length = 0;
    const finals = [extra.source.finalBoss];
    const result = completion(kills, [finals]);
    const criterionDone =
      extra.faction !== null && extra.faction === faction && extra.replaces.some((r) => replacedDone.has(norm(r)));
    const entry: DungeonEntry = {
      criterionId: -(index + 1),
      name: extra.name,
      description: extra.name,
      completed: result.times > 0,
      onAccount: result.times === 0 && criterionDone,
      tracked: true,
      kills,
      image: instanceImage(extra.name, tiles),
      levels: levels(extra.info),
      bosses: extra.info.bosse.length > 0 ? extra.info.bosse : null,
      finalBosses: finals,
      completedAt: result.at,
      timesCompleted: result.times,
    };
    const tier = dungeonTiers.find((t) => t.tier === extra.tier);
    if (!tier) {
      dungeonTiers.push({ achievementId: 0, tier: extra.tier, dungeons: [entry] });
      return;
    }
    // Before the first dungeon with a higher minimum level; entries without a level do not count.
    const min = entry.levels?.min ?? Infinity;
    const at = tier.dungeons.findIndex((d) => d.levels !== null && d.levels.min > min);
    tier.dungeons.splice(at === -1 ? tier.dungeons.length : at, 0, entry);
  });

  const raids = pickSeries(defs.achievements, "raid", done).map((def) => {
    const name = raidName(def);
    const bossList = def.criteria.length > 0 ? def.criteria : [{ id: null, description: name }];
    // Defeated only via its own statistics; the achievement criteria apply to the whole account.
    const bosses = bossList.map((b) => {
      const kill = [...open].find((k) => norm(k.boss) === norm(b.description));
      if (kill) open.delete(kill);
      return { name: b.description, defeated: !!kill, lastAt: kill?.lastAt ?? null };
    });
    const completed = bosses.every((b) => b.defeated);
    return {
      achievementId: def.id,
      name,
      image: instanceImage(name, tiles),
      levels: levels(lookup([name])),
      completed,
      onAccount: !completed && onAccount(def, null),
      bosses,
    };
  });

  const otherKills = [...open].map((k) => ({ ...killRef(k), instance: k.instance }));
  return { available: true, dungeonTiers, raids, otherKills };
}
