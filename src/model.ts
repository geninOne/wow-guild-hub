// Alle Datentypen, die in Netlify Blobs abgelegt werden. Vertrag für Lese-API und Frontend.

import type { Dialekte } from "./sprache";

export interface ItemTooltip {
  binding: string | null;
  unique: string | null;
  slotType: string | null;
  subclass: string | null;
  /** Taschen, z.B. "6 Platz Behälter". Fehlt in Daten vor den Rezeptdetails. */
  containerSlots?: string | null;
  armor: string | null;
  block: string | null;
  damage: string | null;
  speed: string | null;
  dps: string | null;
  stats: string[];
  spells: string[];
  description: string | null;
  durability: string | null;
  requiredLevel: string | null;
  sellPrice: { gold: number; silver: number; copper: number } | null;
}

export interface EquippedItem {
  slot: string;
  slotName: string;
  itemId: number;
  name: string;
  quality: string;
  itemLevel: number | null;
  enchantments: string[];
  tooltip?: ItemTooltip;
}

export interface CharacterTalent {
  talentId: number;
  spellId: number;
  name: string;
  rank: number;
  description: string;
}

export interface CharacterSpec {
  specId: number;
  name: string;
  spentPoints: number;
  talents: CharacterTalent[];
}

export interface CharacterProfession {
  id: number;
  name: string;
  nameEn: string;
  skill: number;
  max: number;
  primary: boolean;
  /** Englische Rezeptnamen aus den Charakterdaten (Rückfall für die Anzeige). */
  recipes: string[];
  /** Rezept-IDs parallel zu `recipes`. Fehlt in Daten vor dem Nachtrag Oberfläche. */
  recipeIds?: number[];
}

/** Fortschritt eines Erfolgs: nur die IDs der erledigten Kind-Kriterien. */
export interface AchievementProgress {
  id: number;
  completed: boolean;
  criteria: number[];
}

/** Ein Eintrag aus der Statistik "Boss-Kills", z.B. "Siege über Bazzalan (Flammenschlund)". */
export interface BossKill {
  boss: string;
  instance: string | null;
  quantity: number;
  lastAt: string | null;
}

export interface InstanceProgress {
  achievements: AchievementProgress[];
  bossKills: BossKill[];
}

/** Ruf bei einer Fraktion; `value` von `max` ist der Fortschritt innerhalb der Stufe. */
export interface CharacterReputation {
  factionId: number;
  /** Name aus den Charakterdaten, teils englisch; die Lese-API übersetzt. */
  name: string;
  tier: number;
  tierName: string;
  value: number;
  max: number;
}

/** Zähler aus der Charakterstatistik; null, wenn die Statistik den Wert nicht liefert. */
export interface CharacterStats {
  /** "Tode insgesamt". */
  deaths: number | null;
  /** "5-Spieler-Dungeons betreten". */
  dungeonsEntered: number | null;
}

export interface CharacterRecord {
  id: number;
  name: string;
  surname: string | null;
  slug: string;
  fetchedAt: string;
  hasProfile: boolean;
  level: number;
  classId: number;
  raceId: number;
  className: string | null;
  raceName: string | null;
  gender: string | null;
  rulesetName: string | null;
  equippedItemLevel: number | null;
  lastLoginAt: string | null;
  media: Record<string, string> | null;
  equipment: EquippedItem[];
  specs: CharacterSpec[];
  mainSpecId: number | null;
  professions: CharacterProfession[];
  raidsRaw: unknown | null;
  /** Dungeon- und Raidfortschritt; null ohne Daten, fehlt in Daten vor dem Nachtrag Oberfläche. */
  instances?: InstanceProgress | null;
  /** Ruf; null ohne Daten, fehlt in Daten vor dem Nachtrag Oberfläche. */
  reputations?: CharacterReputation[] | null;
  /** Zähler für Titel und Wrapped; null ohne Statistik, fehlt in Daten vor den Spaßtiteln. */
  stats?: CharacterStats | null;
  /** Vollständige Statistik, Statistik-ID auf Wert (fehlende = 0); null ohne Statistik, fehlt in Daten vor den Statistik-Ständen. */
  statValues?: Record<string, number> | null;
  /** Texte der Am-häufigsten-Statistiken, Statistik-ID auf Text (etwa "Humanoid"). */
  statTexts?: Record<string, string> | null;
}

export interface MemberSummary {
  id: number;
  name: string;
  surname: string | null;
  slug: string;
  rank: number;
  level: number;
  classId: number;
  raceId: number;
  hasProfile: boolean;
  former: boolean;
  firstSeenAt: string;
  leftAt: string | null;
  lastFetchedAt: string | null;
  equippedItemLevel: number | null;
  mainSpecName: string | null;
  professions: { id: number; skill: number }[];
  /** Gilde, in der das Mitglied zuletzt gesehen wurde. Fehlt nur in Daten vor dem ersten Lauf mit mehreren Gilden. */
  guildSlug?: string;
  /** Zähler für den Tagesstand; fehlen in Daten vor den Spaßtiteln, null ohne Profil oder Statistik. */
  deaths?: number | null;
  dungeonsEntered?: number | null;
  /** Anzahl bekannter Rezepte über alle Berufe. */
  recipeCount?: number | null;
  /** Abgeschlossene Erfolge laut Erfolgsliste; null ohne Daten. */
  achievementCount?: number | null;
  /** Summe der Rufstufen über alle Fraktionen; null ohne Daten. */
  reputationTiers?: number | null;
}

/** Eine der Gilden der Gemeinschaft; `main` ist die Hauptgilde (erste in `GUILD_SLUGS`). */
export interface GuildInfo {
  slug: string;
  id: number;
  name: string;
  faction: string;
  memberCount: number;
  rulesetName: string;
  main: boolean;
}

/** Kopf-Felder beschreiben die Hauptgilde, `members` umfasst alle Gilden. */
export interface GuildRecord {
  fetchedAt: string;
  id: number;
  name: string;
  faction: string;
  memberCount: number;
  rulesetName: string;
  members: MemberSummary[];
  /** Alle Gilden, Hauptgilde zuerst. Fehlt nur in Daten vor dem ersten Lauf mit mehreren Gilden. */
  guilds?: GuildInfo[];
}

export interface LevelUpEvent {
  characterId: number;
  level: number;
  at: string;
}

export interface LevelUpLog {
  events: LevelUpEvent[];
}

export interface DaySnapshot {
  date: string;
  takenAt: string;
  characters: Record<
    string,
    {
      level: number;
      equippedItemLevel: number | null;
      professions: Record<string, number>;
      /** Zähler seit den Spaßtiteln; fehlen in älteren Ständen und bei Charakteren ohne Statistik. */
      deaths?: number;
      dungeons?: number;
      recipes?: number;
      /** Abgeschlossene Erfolge. */
      achievements?: number;
      /** Summe der Rufstufen über alle Fraktionen. */
      reputation?: number;
    }
  >;
  /** Nur bei lokalen Beispieldaten. */
  testdaten?: boolean;
}

/**
 * Blob `activity/{Woche}`: wer in welcher Wochenstunde (Montag 0 Uhr = 0, Berliner Zeit) einen Login hatte.
 * Gespeichert wird je ISO-Woche; die Wochenauswertung setzt daraus ihre Wertungswochen zusammen (siehe `weekActivity`).
 */
export interface ActivityWeek {
  /** ISO-Woche, z. B. `2026-W47`; in der Wochenauswertung auch die Wertungswoche, aus der die Stunden stammen. */
  week: string;
  /** Charakter-ID auf Wochenstunden 0 bis 167, aufsteigend, ohne Doppelte. */
  characters: Record<string, number[]>;
  /** Rückkehrer: Charakter-ID auf Tage Pause vor dem Login in dieser Woche (nur ab 7 Tagen, längste Pause). */
  returns?: Record<string, number>;
  /** Nur bei lokalen Beispieldaten. */
  testdaten?: boolean;
}

export interface TalentNode {
  nodeId: number;
  row: number;
  col: number;
  maxRank: number;
  talentId: number;
  spellId: number;
  name: string;
  ranks: { rank: number; description: string }[];
  lockedBy: number[];
  unlocks: number[];
}

export interface TalentTreeRecord {
  classTreeId: number;
  classId: number;
  className: string;
  specs: { specId: number; name: string; nodes: TalentNode[] }[];
}

export interface NamedList {
  items: { id: number; name: string }[];
}

export type IconMap = Record<string, string | null>;

/** Definition eines Dungeon- oder Raid-Erfolgs (Kategorien 15593 und 15594), Namen deutsch. */
export interface InstanceAchievement {
  id: number;
  name: string;
  kind: "dungeon" | "raid";
  /** Position innerhalb der Kategorie. */
  order: number;
  /** Beschreibung des Wurzelkriteriums, z.B. "Schließt den Hyjalgipfel ab" oder "Tötet Onyxia". */
  rootDescription: string | null;
  criteria: { id: number; description: string }[];
}

/** Blob `static/instance-achievements`, Reihenfolge: Dungeons, dann Schlachtzüge, je in Kategorie-Reihenfolge. */
export interface InstanceAchievementsRecord {
  achievements: InstanceAchievement[];
}

/** Blob `static/recipe-names`: Rezept-ID zu deutschem Namen, null bei 404. Nur noch Rückfall für ältere Daten, neu ist `static/recipes`. */
export type RecipeNames = Record<string, string | null>;

/** Blob `static/reputation-factions`: Namen aus dem Verzeichnis und Gruppen der Wurzelfraktionen. */
export interface ReputationFactionsRecord {
  names: Record<string, string>;
  /** In Reihenfolge der Wurzelfraktionen. */
  groups: { id: number; name: string; factionIds: number[] }[];
  /** Wurzelfraktionen, deren Details schon abgefragt wurden (auch ohne Unterfraktionen). */
  checkedRoots: number[];
}

export interface RecipeReagent {
  id: number;
  name: string;
  quantity: number;
}

/** Hergestellter Gegenstand; Qualität, Stufe und Tooltip fehlen, wenn der Gegenstand nicht abrufbar war. */
export interface CraftedItem {
  id: number;
  name: string;
  quality: string | null;
  /** Nur für Gegenstände mit angezeigter Stufe, nicht bei Verbrauchsgütern. */
  itemLevel: number | null;
  tooltip: ItemTooltip | null;
}

export interface RecipeDetail {
  id: number;
  /** Deutscher Rezeptname. */
  name: string;
  /** Bei Rezepten ohne Gegenstand (z.B. Verzauberungen) die Wirkung. */
  description: string | null;
  icon: string | null;
  craftedQuantity: number;
  item: CraftedItem | null;
  reagents: RecipeReagent[];
}

/** Blob `static/recipes`: Rezept-ID zu Details, null bei 404. */
export type RecipeDetails = Record<string, RecipeDetail | null>;

/** Wochenkennzahlen eines Charakters; null, wenn die Tagesstände den Wert nicht hergeben. */
export interface WeekMetrics {
  /** Wochenstunden mit Login. */
  logins: number;
  /** Logins zwischen 1 und 5 Uhr. */
  nightLogins: number;
  /** Logins zwischen 5 und 8 Uhr. */
  earlyLogins: number;
  /** Tage mit mindestens einem Login. */
  activeDays: number;
  levels: number | null;
  deaths: number | null;
  recipes: number | null;
  dungeons: number | null;
  /** Neu abgeschlossene Erfolge. */
  achievements: number | null;
  /** Zuwachs der angelegten Gegenstandsstufe; null ohne Vergleichswert. */
  itemLevel: number | null;
  /** Gewonnene Rufstufen, über alle Fraktionen summiert. */
  reputation: number | null;
  /** Längste Pause in Tagen vor einem Login in dieser Woche, 0 ohne Rückkehr. */
  awayDays: number;
}

export interface TitleAward {
  titleId: string;
  /** Titelträger auf der Karte; bei Gleichstand der, der den Titel am längsten nicht hatte. */
  characterId: number;
  /**
   * Alle Inhaber mit dem Höchstwert, der Titelträger zuerst. Fehlt in Wochen vor dem geteilten Titel und bei nur einem
   * Inhaber; dann gilt `characterId` allein, siehe `titleHolders`.
   */
  characterIds?: number[];
  value: number;
}

export interface ZeitungArticle {
  /** Art des Fakts, z. B. `sprung`, `titel`, `neuzugang`. */
  kind: string;
  /** Rubrik, z. B. `Aufsteiger`; fehlt in Ausgaben vor den Rubriken. */
  section?: string;
  /** Spaßtitel, um den es in der Meldung geht (für das Abzeichen); fehlt ohne Titel und in älteren Ausgaben. */
  titleId?: string;
  /** Hochdeutsche Fassung. */
  headline: string;
  text: string;
  /** Schwäbische und bayrische Fassung; fehlt in Ausgaben vor den Sprachvarianten. */
  dialekte?: Dialekte<{ headline: string; text: string }>;
  /** Beteiligte Charaktere, damit die Oberfläche verlinken kann. */
  characterIds: number[];
}

export interface ZeitungIssue {
  lead: ZeitungArticle;
  articles: ZeitungArticle[];
  /** Spruch der Woche, hochdeutsch. */
  motto: string;
  /** Spruch der Woche auf Schwäbisch und Bayrisch; fehlt in Ausgaben vor den Sprachvarianten. */
  mottoDialekte?: Dialekte<string>;
  /** Wer die Texte geschrieben hat: `bausteine` oder `claude`; fehlt in älteren Ausgaben. */
  generator?: string;
  /** Modell, falls ein Sprachmodell geschrieben hat. */
  model?: string;
  /** Grund, falls ein eingestelltes Sprachmodell nicht geschrieben hat und die Satzbausteine eingesprungen sind. */
  fallback?: string;
  /** Verwendete Satzbaustein-Kennungen, damit die nächsten Ausgaben andere wählen. */
  bausteine?: string[];
  /** Art der Zahl der Woche, z. B. `level` oder `tode`. */
  zahl?: string;
  /** Wetterbericht für Azeroth, hochdeutsch, gedichtet aus den Wochenzahlen; fehlt in Ausgaben davor. */
  wetter?: string;
  /** Wetterbericht auf Schwäbisch und Bayrisch. */
  wetterDialekte?: Dialekte<string>;
  /** Schlagzeile der Ausgabe von vor vier Wochen; fehlt, wenn es sie nicht gibt, und in Ausgaben davor. */
  rueckblick?: ZeitungRueckblick;
}

/** Eine Schlagzeile aus einer früheren Ausgabe, so wie sie damals erschien. */
export interface ZeitungRueckblick {
  week: string;
  from: string;
  to: string;
  headline: string;
  dialekte?: Dialekte<string>;
  characterIds: number[];
}

/** Was die Woche in Zahlen zählt. */
export type WochenZahlArt = "anmeldungen" | "level" | "tode" | "dungeons" | "rezepte" | "erfolge" | "ruf" | "gegenstandsstufe";

/** Summen einer Woche; null, wenn kein Charakter einen Wert hatte. */
export type WochenSummen = Record<WochenZahlArt, number | null>;

/** Gildensummen einer Woche, fest berechnet (nicht von der KI). */
export interface WochenZahlen {
  /** Alle Gilden zusammen. */
  gesamt: WochenSummen;
  /** Je Gilden-Slug. */
  gilden: Record<string, WochenSummen>;
  /** Bester Einzelwert der Woche je Art als [Charakter-ID, Wert], für Rekorde. */
  spitze: Partial<Record<WochenZahlArt, [id: number, value: number]>>;
  /** Dieselben Summen der Vorwoche; fehlt ohne Vorwoche. */
  vorwoche?: { gesamt: WochenSummen; gilden: Record<string, WochenSummen> };
}

/**
 * Blob `weekly/{Woche}`: Ergebnis der Wochenauswertung. Woche ist eine Wertungswoche (Sonntag bis Samstag,
 * Kennung ist der Samstag, z. B. `2026-11-21`) oder, für Ausgaben vor der Umstellung, eine ISO-Woche wie `2026-W46`.
 */
export interface WeeklyRecord {
  week: string;
  /** Erster und letzter gewerteter Tag; in der Übergangswoche beginnt sie nach dem letzten Tag der alten Ausgaben. */
  from: string;
  to: string;
  generatedAt: string;
  titles: TitleAward[];
  /**
   * Je Titel die ganze Rangliste der Woche als [Charakter-ID, Wert], bester zuerst; alle mit einem Wert ab 1.
   * Fehlt in Wochen, die vor der Rangliste ausgewertet wurden.
   */
  rankings?: Record<string, [id: number, value: number][]>;
  zeitung: ZeitungIssue;
  /** Nur, wenn lokale Beispieldaten eingeflossen sind. */
  testdaten?: boolean;
  /** Woche in Zahlen; fehlt in Ausgaben davor. */
  zahlen?: WochenZahlen;
}

/** Blob `weekly/index`: ausgewertete Wochen, aufsteigend nach ihrem letzten Tag, mit dem Nötigsten fürs Archiv. */
export interface WeeklyIndex {
  weeks: string[];
  /**
   * Je Woche die Schlagzeile des Aufmachers und der gewertete Zeitraum; fehlt für Wochen vor dem Archiv.
   * Der Zeitraum fehlt in Einträgen vor der Umstellung auf Wertungswochen.
   */
  entries?: Record<string, { headline: string; dialekte?: Dialekte<string>; from?: string; to?: string; testdaten?: boolean }>;
}

/**
 * Ein Feld der Charakterwerte (Endpunkt `/statistics` des Profils): eine Zahl oder die Zahlen eines Objekts,
 * etwa `{ base, effective }` bei Primärwerten oder `{ rating, rating_bonus, value }` bei Krit und Ausweichen.
 */
export type AttributeField = number | Record<string, number>;

/** Blob `attributes/<Charakter-ID>`: Grundwerte eines Charakters, vom statischen Sammler alle vier Stunden geholt. */
export interface CharacterAttributesRecord {
  fetchedAt: string;
  /** Zahlenfelder der Antwort, Schlüssel wie bei Blizzard; null, wenn Blizzard keine Werte liefert (404). */
  fields: Record<string, AttributeField> | null;
  /** Ressource (Mana, Wut, Energie, Runenmacht ...); null ohne Angabe. */
  powerType: { id: number; name: string } | null;
  /** Nur bei erfundenen Werten aus den lokalen Beispieldaten. */
  testdaten?: boolean;
}

/** Blob `attributes/index`: je Charakter-ID der Zeitpunkt des letzten Abrufs der Werte. */
export type AttributesIndex = Record<string, string>;

/**
 * Was `collect-static` aus einem Charakterdatensatz braucht, damit er nicht alle `characters/*` lesen muss.
 * Gepflegt von `collect-guild` beim Schreiben eines Charakters.
 */
export interface CharacterIndexEntry {
  slug: string;
  hasProfile: boolean;
  lastLoginAt: string | null;
  /** IDs der angelegten Gegenstände. */
  itemIds: number[];
  /** Gegenstandsstufen, die Blizzard in der Ausrüstung noch mitliefert, Gegenstands-ID auf Stufe. */
  itemLevels: Record<string, number>;
  /** Bekannte Rezepte über alle Berufe. */
  recipeIds: number[];
}

/** Blob `character-index`: Charakter-ID auf `CharacterIndexEntry`. */
export type CharacterIndex = Record<string, CharacterIndexEntry>;
