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

/** Kachelbild zu einem Instanznamen; bei "A oder B" die erste Alternative mit Bild. */
export function instanceImage(name: string, tiles: IconMap | null): string | null {
  for (const alternative of name.split(" oder ")) {
    const ref = IMAGES.get(norm(alternative));
    const url = typeof ref === "string" ? ref : ref === undefined ? null : tiles?.[String(ref)];
    if (url) return url;
  }
  return null;
}

/** Raidname aus dem Wurzelkriterium ("Schließt den Hyjalgipfel ab", "Tötet Onyxia"), sonst der Erfolgsname. */
export function raidName(def: InstanceAchievement): string {
  const root = def.rootDescription ?? "";
  const complete = /^Schließt (?:den|die|das) (.+) ab$/.exec(root);
  if (complete) return complete[1];
  const kill = /^Tötet (.+)$/.exec(root);
  if (kill) return kill[1];
  return def.name;
}

/** Je Name eine Reihe: die mit Fortschritt des Charakters, sonst die erste in Kategorie-Reihenfolge. */
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

/** Abschluss aus der Statistik: Kills der Endbosse (ohne gepflegte Liste alle zugeordneten Kills). */
function completion(kills: KillRef[], finals: string[]): { at: string | null; times: number } {
  const finalSet = new Set(finals.map(norm));
  const relevant = finalSet.size > 0 ? kills.filter((k) => finalSet.has(norm(k.boss))) : kills;
  const dates = relevant.map((k) => k.lastAt).filter((d): d is string => d !== null).sort();
  return { at: dates.at(-1) ?? null, times: relevant.reduce((sum, k) => sum + k.quantity, 0) };
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
  /** Fraktion des Charakters ("HORDE", "ALLIANCE"); entscheidet bei Zusatz-Dungeons mit Fraktion. */
  faction: string | null = null,
): InstancesView {
  const infoByName = new Map(Object.entries(info).map(([name, i]) => [norm(name), i]));
  const infosOf = (names: string[]): DungeonInfo[] =>
    names.map((n) => infoByName.get(norm(n))).filter((i): i is DungeonInfo => i !== undefined);
  const lookup = (names: string[]): DungeonInfo | undefined => infosOf(names)[0];
  if (!defs || defs.achievements.length === 0) return { available: false, dungeonTiers: [], raids: [], otherKills: [] };

  const done = new Map((progress?.achievements ?? []).map((a) => [a.id, a]));
  const isDone = (def: InstanceAchievement, criterionId: number | null): boolean => {
    const p = done.get(def.id);
    return !!p && (p.completed || (criterionId !== null && p.criteria.includes(criterionId)));
  };
  // Jeder Kill wird höchstens einmal zugeordnet.
  const open = new Set(progress?.bossKills ?? []);

  // Kriterien, die Zusatz-Dungeons ersetzen, entfallen; ob sie erledigt waren, zählt dort für die eigene Fraktion.
  const replaced = new Set(extras.flatMap((e) => e.replaces.map(norm)));
  const replacedDone = new Set<string>();
  const dungeonTiers = pickSeries(defs.achievements, "dungeon", done).map((def) => ({
    achievementId: def.id,
    tier: def.name.split(":")[0].trim(),
    dungeons: def.criteria.filter((c) => {
      if (!replaced.has(norm(c.description))) return true;
      if (isDone(def, c.id)) replacedDone.add(norm(c.description));
      return false;
    }).map((c) => {
      const alternatives = c.description.split(" oder ");
      const kills: KillRef[] = [];
      const matched = new Set<string>();
      for (const k of [...open]) {
        const alt = alternatives.find((a) => k.instance !== null && norm(a) === norm(k.instance));
        if (!alt) continue;
        open.delete(k);
        matched.add(alt);
        kills.push(killRef(k));
      }
      const shown = alternatives.filter((a) => matched.has(a));
      const name = shown.length > 0 ? shown.join(" oder ") : c.description;
      // Mit Kills in mehreren Alternativen die Angaben aller gezeigten, sonst die erste Alternative mit Angaben.
      const infos = shown.length > 1 ? infosOf(shown) : infosOf(shown.length > 0 ? shown : alternatives).slice(0, 1);
      const bossNames = [...new Set(infos.flatMap((i) => i.bosse))];
      const finals = infos.flatMap((i) => (i.bosse.length > 0 ? [i.bosse[i.bosse.length - 1]] : []));
      const done = completion(kills, finals);
      return {
        criterionId: c.id,
        name,
        description: c.description,
        completed: isDone(def, c.id) || done.times > 0 || (finals.length === 0 && kills.length > 0),
        kills,
        image: instanceImage(name, tiles),
        levels: levels(infos.find((i) => i.stufe)),
        bosses: bossNames.length > 0 ? bossNames : null,
        finalBosses: finals,
        completedAt: done.at,
        timesCompleted: done.times,
      };
    }),
  }));

  // Zusatz-Dungeons ohne Erfolg: Abschluss nur über die Boss-Kill-Statistik, einsortiert in ihre Stufe nach Mindestlevel.
  extras.forEach((extra, index) => {
    const kills: KillRef[] = [];
    for (const k of [...open]) {
      if (k.instance === null || norm(k.instance) !== norm(extra.source.instance)) continue;
      open.delete(k);
      kills.push(killRef(k));
    }
    // Gespiegelte Siege eines Charakters der anderen Fraktion werden verbraucht, zählen aber nicht.
    const ownFaction = extra.faction === null || faction === null || extra.faction === faction;
    if (!ownFaction) kills.length = 0;
    const finals = [extra.source.finalBoss];
    const result = completion(kills, finals);
    const criterionDone =
      extra.faction !== null && extra.faction === faction && extra.replaces.some((r) => replacedDone.has(norm(r)));
    const entry: DungeonEntry = {
      criterionId: -(index + 1),
      name: extra.name,
      description: extra.name,
      completed: result.times > 0 || criterionDone,
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
    // Vor den ersten Dungeon mit höherem Mindestlevel; Einträge ohne Stufe zählen nicht.
    const min = entry.levels?.min ?? Infinity;
    const at = tier.dungeons.findIndex((d) => d.levels !== null && d.levels.min > min);
    tier.dungeons.splice(at === -1 ? tier.dungeons.length : at, 0, entry);
  });

  const raids = pickSeries(defs.achievements, "raid", done).map((def) => {
    const name = raidName(def);
    const bossList = def.criteria.length > 0 ? def.criteria : [{ id: null, description: name }];
    return {
      achievementId: def.id,
      name,
      image: instanceImage(name, tiles),
      levels: levels(lookup([name])),
      completed: isDone(def, null),
      bosses: bossList.map((b) => {
        const kill = [...open].find((k) => norm(k.boss) === norm(b.description));
        if (kill) open.delete(kill);
        return {
          name: b.description,
          defeated: isDone(def, b.id) || !!kill,
          lastAt: kill?.lastAt ?? null,
        };
      }),
    };
  });

  const otherKills = [...open].map((k) => ({ ...killRef(k), instance: k.instance }));
  return { available: true, dungeonTiers, raids, otherKills };
}
