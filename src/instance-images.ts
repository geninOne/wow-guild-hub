import data from "../config/instanz-bilder.json";
import dungeons from "../config/dungeons.json";
import zusatz from "../config/zusatz-dungeons.json";

/** Gepflegter Levelbereich und Bossliste je Instanz (`config/dungeons.json`). */
export interface DungeonInfo {
  stufe: [number, number] | null;
  bosse: string[];
  /**
   * Weitere Einträge der Boss-Kill-Statistik, die den Abschluss anzeigen, wenn die Statistik Instanz oder Endboss
   * anders nennt als Erfolg und Bossliste (etwa "Siege über Erzmagier Arugal (Burg Schattenfang)").
   */
  statistik: { instanz: string; endboss: string }[];
  /** Der Endboss steht nicht in der Boss-Kill-Statistik: kein Abschluss je Charakter nachweisbar. */
  ohneStatistik: boolean;
}

/** Liest einen Eintrag aus `config/dungeons.json`; ungültige Stufen werden zu null, fehlende Bosse zu []. */
export function toDungeonInfo(raw: { stufe?: unknown; bosse?: unknown; statistik?: unknown; ohneStatistik?: unknown }): DungeonInfo {
  const stufe = raw.stufe;
  const valid = Array.isArray(stufe) && stufe.length === 2 && stufe.every((n) => typeof n === "number");
  const bosse = Array.isArray(raw.bosse) ? raw.bosse.filter((b): b is string => typeof b === "string") : [];
  const statistik = (Array.isArray(raw.statistik) ? raw.statistik : []).flatMap((e: { instanz?: unknown; endboss?: unknown }) =>
    typeof e?.instanz === "string" && typeof e.endboss === "string" ? [{ instanz: e.instanz, endboss: e.endboss }] : [],
  );
  return { stufe: valid ? [stufe[0], stufe[1]] : null, bosse, statistik, ohneStatistik: raw.ohneStatistik === true };
}

export const DUNGEON_INFO: Record<string, DungeonInfo> = Object.fromEntries(
  Object.entries(dungeons.instanzen as Record<string, Parameters<typeof toDungeonInfo>[0]>).map(([name, raw]) => [
    name,
    toDungeonInfo(raw),
  ]),
);

/**
 * Dungeon außerhalb der Dungeonerforscher-Kriterien (`config/zusatz-dungeons.json`): einer, der in keinem Erfolg steht,
 * oder eine Hälfte eines Kriteriums für Gegenstücke beider Fraktionen. Der Abschluss kommt aus der Boss-Kill-Statistik
 * "Siege über ENDBOSS (INSTANZ)".
 */
export interface ExtraDungeon {
  name: string;
  /** Erfolgsstufe, in die er einsortiert wird ("Novize", "Erfahren", "Meister"). */
  tier: string;
  info: DungeonInfo;
  source: { instance: string; finalBoss: string };
  image: number | string | null;
  /**
   * Fraktion ("HORDE", "ALLIANCE"), für die der Dungeon zählt, sonst null. Blizzard spiegelt die Statistik von
   * Gegenstücken auf die andere Fraktion; Siege von Charakteren der anderen Fraktion zählen deshalb nicht.
   */
  faction: string | null;
  /** Erfolgskriterien (Bezeichnung), die dieser Eintrag ersetzt; erledigt zählt dann für Charaktere der Fraktion. */
  replaces: string[];
}

/**
 * Liest einen Eintrag aus `config/zusatz-dungeons.json`; unvollständige Einträge werden zu null. Fehlen Stufe und
 * Bosse, gelten die aus `config/dungeons.json` (`known`).
 */
export function toExtraDungeon(raw: Record<string, unknown>, known: Record<string, DungeonInfo> = {}): ExtraDungeon | null {
  const quelle = (raw.quelle ?? {}) as { instanz?: unknown; endboss?: unknown };
  const { name, rang, bild, fraktion, ersetzt } = raw;
  if (typeof name !== "string" || typeof rang !== "string") return null;
  if (typeof quelle.instanz !== "string" || typeof quelle.endboss !== "string") return null;
  const own = toDungeonInfo(raw);
  const fallback = known[name];
  return {
    name,
    tier: rang,
    info: {
      stufe: own.stufe ?? fallback?.stufe ?? null,
      bosse: own.bosse.length > 0 ? own.bosse : (fallback?.bosse ?? []),
      statistik: own.statistik.length > 0 ? own.statistik : (fallback?.statistik ?? []),
      // Zusatz-Dungeons haben mit `quelle` immer einen Eintrag in der Statistik.
      ohneStatistik: false,
    },
    source: { instance: quelle.instanz, finalBoss: quelle.endboss },
    image: typeof bild === "number" || typeof bild === "string" ? bild : null,
    faction: typeof fraktion === "string" ? fraktion : null,
    replaces: Array.isArray(ersetzt) ? ersetzt.filter((e): e is string => typeof e === "string") : [],
  };
}

export const EXTRA_DUNGEONS: ExtraDungeon[] = (zusatz.dungeons as Record<string, unknown>[])
  .map((raw) => toExtraDungeon(raw, DUNGEON_INFO))
  .filter((d): d is ExtraDungeon => d !== null);

/**
 * Deutscher Instanzname zu Retail-`journal-instance`-ID (Kachelbild über die API) oder direkt zu einer
 * Bild-Adresse, gepflegt in `config/instanz-bilder.json`, dazu die Bilder der Zusatz-Dungeons.
 */
export const INSTANCE_IMAGES: Record<string, number | string> = {
  ...data.instanzen,
  ...Object.fromEntries(EXTRA_DUNGEONS.flatMap((d) => (d.image === null ? [] : [[d.name, d.image]]))),
};

/** Nur die IDs, deren Bild der statische Lauf über die API holt. */
export const INSTANCE_IMAGE_IDS: number[] = [
  ...new Set(Object.values(INSTANCE_IMAGES).filter((v): v is number => typeof v === "number")),
];

/**
 * Vergleichsform für Instanz- und Bossnamen: klein, ohne führenden Artikel. Die Statistik beugt Namen ("Siege über
 * Mutanus den Verschlinger"), deshalb gilt "den" wie "der".
 */
export function normName(name: string): string {
  return name.trim().toLowerCase().replace(/^(die|der|das|den) /, "").replace(/ den /g, " der ");
}
