import data from "../config/instance-images.json";
import dungeons from "../config/dungeons.json";
import extraDungeons from "../config/extra-dungeons.json";

/** Maintained level range and boss list per instance (`config/dungeons.json`). */
export interface DungeonInfo {
  levels: [number, number] | null;
  bosses: string[];
  /**
   * Additional entries of the boss kill statistic that indicate completion when the statistic names the instance
   * or final boss differently than the achievement and boss list, e.g. a boss listed with an extra title.
   */
  statisticEntries: { instance: string; finalBoss: string }[];
  /** The final boss is not in the boss kill statistic: completion cannot be proven per character. */
  withoutStatistic: boolean;
}

/** Reads an entry from `config/dungeons.json`; invalid level ranges become null, missing bosses become []. */
export function toDungeonInfo(raw: {
  levels?: unknown;
  bosses?: unknown;
  statisticEntries?: unknown;
  withoutStatistic?: unknown;
}): DungeonInfo {
  const levels = raw.levels;
  const valid = Array.isArray(levels) && levels.length === 2 && levels.every((n) => typeof n === "number");
  const bosses = Array.isArray(raw.bosses) ? raw.bosses.filter((b): b is string => typeof b === "string") : [];
  const entries = (Array.isArray(raw.statisticEntries) ? raw.statisticEntries : []).flatMap(
    (e: { instance?: unknown; finalBoss?: unknown }) =>
      typeof e?.instance === "string" && typeof e.finalBoss === "string" ? [{ instance: e.instance, finalBoss: e.finalBoss }] : [],
  );
  return {
    levels: valid ? [levels[0], levels[1]] : null,
    bosses,
    statisticEntries: entries,
    withoutStatistic: raw.withoutStatistic === true,
  };
}

export const DUNGEON_INFO: Record<string, DungeonInfo> = Object.fromEntries(
  Object.entries(dungeons.instances as Record<string, Parameters<typeof toDungeonInfo>[0]>).map(([name, raw]) => [
    name,
    toDungeonInfo(raw),
  ]),
);

/**
 * Dungeon outside the dungeon explorer achievement criteria (`config/extra-dungeons.json`): one that is in no
 * achievement, or one half of a criterion shared by counterparts of both factions. Completion comes from the boss kill
 * statistic `Siege über FINAL_BOSS (INSTANCE)`.
 */
export interface ExtraDungeon {
  name: string;
  /** Achievement tier it is sorted into (`Novize`, `Erfahren`, `Meister`). */
  tier: string;
  info: DungeonInfo;
  source: { instance: string; finalBoss: string };
  image: number | string | null;
  /**
   * Faction ("HORDE", "ALLIANCE") for which the dungeon counts, otherwise null. Blizzard mirrors the statistic of
   * counterparts onto the other faction, so kills by characters of the other faction do not count.
   */
  faction: string | null;
  /** Achievement criteria (by name) this entry replaces; completion then counts for characters of the faction. */
  replaces: string[];
}

/**
 * Reads an entry from `config/extra-dungeons.json`; incomplete entries become null. If level range and bosses are
 * missing, those from `config/dungeons.json` (`known`) apply.
 */
export function toExtraDungeon(raw: Record<string, unknown>, known: Record<string, DungeonInfo> = {}): ExtraDungeon | null {
  const source = (raw.source ?? {}) as { instance?: unknown; finalBoss?: unknown };
  const { name, tier, image, faction, replaces } = raw;
  if (typeof name !== "string" || typeof tier !== "string") return null;
  if (typeof source.instance !== "string" || typeof source.finalBoss !== "string") return null;
  const own = toDungeonInfo(raw);
  const fallback = known[name];
  return {
    name,
    tier,
    info: {
      levels: own.levels ?? fallback?.levels ?? null,
      bosses: own.bosses.length > 0 ? own.bosses : (fallback?.bosses ?? []),
      statisticEntries: own.statisticEntries.length > 0 ? own.statisticEntries : (fallback?.statisticEntries ?? []),
      // Extra dungeons always have an entry in the statistic via `source`.
      withoutStatistic: false,
    },
    source: { instance: source.instance, finalBoss: source.finalBoss },
    image: typeof image === "number" || typeof image === "string" ? image : null,
    faction: typeof faction === "string" ? faction : null,
    replaces: Array.isArray(replaces) ? replaces.filter((e): e is string => typeof e === "string") : [],
  };
}

export const EXTRA_DUNGEONS: ExtraDungeon[] = (extraDungeons.dungeons as Record<string, unknown>[])
  .map((raw) => toExtraDungeon(raw, DUNGEON_INFO))
  .filter((d): d is ExtraDungeon => d !== null);

/**
 * German instance name to retail `journal-instance` ID (tile image via the API) or directly to an image URL,
 * maintained in `config/instance-images.json`, plus the images of the extra dungeons.
 */
export const INSTANCE_IMAGES: Record<string, number | string> = {
  ...data.instances,
  ...Object.fromEntries(EXTRA_DUNGEONS.flatMap((d) => (d.image === null ? [] : [[d.name, d.image]]))),
};

/** Only the IDs whose image the static run fetches via the API. */
export const INSTANCE_IMAGE_IDS: number[] = [
  ...new Set(Object.values(INSTANCE_IMAGES).filter((v): v is number => typeof v === "number")),
];

/**
 * Comparison form for instance and boss names: lowercase, without a leading German article. The statistic inflects
 * names (accusative after `Siege über`), so `den` is treated like `der`.
 */
export function normName(name: string): string {
  return name.trim().toLowerCase().replace(/^(die|der|das|den) /, "").replace(/ den /g, " der ");
}
