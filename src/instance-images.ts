import data from "../config/instanz-bilder.json";
import dungeons from "../config/dungeons.json";
import extraDungeons from "../config/zusatz-dungeons.json";

/** Maintained level range and boss list per instance (`config/dungeons.json`). */
export interface DungeonInfo {
  stufe: [number, number] | null;
  bosse: string[];
  /**
   * Additional entries of the boss kill statistic that indicate completion when the statistic names the instance
   * or final boss differently than the achievement and boss list, e.g. a boss listed with an extra title.
   */
  statistik: { instanz: string; endboss: string }[];
  /** The final boss is not in the boss kill statistic: completion cannot be proven per character. */
  ohneStatistik: boolean;
}

/** Reads an entry from `config/dungeons.json`; invalid level ranges become null, missing bosses become []. */
export function toDungeonInfo(raw: { stufe?: unknown; bosse?: unknown; statistik?: unknown; ohneStatistik?: unknown }): DungeonInfo {
  const levels = raw.stufe;
  const valid = Array.isArray(levels) && levels.length === 2 && levels.every((n) => typeof n === "number");
  const bosses = Array.isArray(raw.bosse) ? raw.bosse.filter((b): b is string => typeof b === "string") : [];
  const stats = (Array.isArray(raw.statistik) ? raw.statistik : []).flatMap((e: { instanz?: unknown; endboss?: unknown }) =>
    typeof e?.instanz === "string" && typeof e.endboss === "string" ? [{ instanz: e.instanz, endboss: e.endboss }] : [],
  );
  return {
    stufe: valid ? [levels[0], levels[1]] : null,
    bosse: bosses,
    statistik: stats,
    ohneStatistik: raw.ohneStatistik === true,
  };
}

export const DUNGEON_INFO: Record<string, DungeonInfo> = Object.fromEntries(
  Object.entries(dungeons.instanzen as Record<string, Parameters<typeof toDungeonInfo>[0]>).map(([name, raw]) => [
    name,
    toDungeonInfo(raw),
  ]),
);

/**
 * Dungeon outside the dungeon explorer achievement criteria (`config/zusatz-dungeons.json`): one that is in no
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
 * Reads an entry from `config/zusatz-dungeons.json`; incomplete entries become null. If level range and bosses are
 * missing, those from `config/dungeons.json` (`known`) apply.
 */
export function toExtraDungeon(raw: Record<string, unknown>, known: Record<string, DungeonInfo> = {}): ExtraDungeon | null {
  const source = (raw.quelle ?? {}) as { instanz?: unknown; endboss?: unknown };
  const { name, rang: tier, bild: image, fraktion: faction, ersetzt: replaces } = raw;
  if (typeof name !== "string" || typeof tier !== "string") return null;
  if (typeof source.instanz !== "string" || typeof source.endboss !== "string") return null;
  const own = toDungeonInfo(raw);
  const fallback = known[name];
  return {
    name,
    tier,
    info: {
      stufe: own.stufe ?? fallback?.stufe ?? null,
      bosse: own.bosse.length > 0 ? own.bosse : (fallback?.bosse ?? []),
      statistik: own.statistik.length > 0 ? own.statistik : (fallback?.statistik ?? []),
      // Extra dungeons always have an entry in the statistic via `quelle`.
      ohneStatistik: false,
    },
    source: { instance: source.instanz, finalBoss: source.endboss },
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
 * maintained in `config/instanz-bilder.json`, plus the images of the extra dungeons.
 */
export const INSTANCE_IMAGES: Record<string, number | string> = {
  ...data.instanzen,
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
