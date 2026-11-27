import type { Fassungen } from "../sprache";
import type { CharacterRecord, RecipeDetail, RecipeReagent, TalentNode, WeeklyNumberKind } from "../model";

export interface TalentFix {
  nodeId: number;
  hide?: boolean;
  row?: number;
  col?: number;
  reason: string;
}

export interface PlacedTalent extends TalentNode {
  gridRow: number;
  gridCol: number;
}

export interface UnplacedTalent extends TalentNode {
  hidden: boolean;
}

export interface SpecLayout {
  specId: number;
  name: string;
  nodes: PlacedTalent[];
  unplaced: UnplacedTalent[];
}

export interface TalentLayout {
  classId: number;
  className: string;
  rows: number;
  specs: SpecLayout[];
}

export interface TalentView {
  layout: TalentLayout;
  /** Schlüssel: spellId */
  icons: Record<string, string | null>;
}

/** Eine Gilde der Gemeinschaft in Antworten der Lese-API. */
export interface GuildRef {
  slug: string;
  name: string;
  faction: string;
  memberCount: number;
  main: boolean;
}

export interface MemberRow {
  id: number;
  name: string;
  surname: string | null;
  slug: string;
  level: number;
  classId: number;
  className: string;
  raceId: number;
  raceName: string;
  rank: number;
  rankName: string;
  itemLevel: number | null;
  mainSpecName: string | null;
  hasProfile: boolean;
  former: boolean;
  guildSlug: string;
  guildName: string;
  professions: { id: number; name: string; skill: number }[];
}

export interface GuildView {
  fetchedAt: string;
  name: string;
  faction: string;
  rulesetName: string;
  memberCount: number;
  /** Alle Gilden, Hauptgilde zuerst. */
  guilds: GuildRef[];
  classes: { id: number; name: string }[];
  /** Ränge je Gilde (Rangname hängt von der Gilde ab), Gilden wie in `guilds`, Ränge aufsteigend. */
  ranks: { guildSlug: string; rank: number; name: string }[];
  members: MemberRow[];
}

export interface LevelRange {
  min: number;
  max: number;
}

export interface KillRef {
  boss: string;
  quantity: number;
  lastAt: string | null;
}

/**
 * "Dungeons & Raids" eines Charakters, aus Erfolgen, Boss-Kill-Statistik und statischen Definitionen. Abgeschlossen
 * heißt: eigener Sieg über den Endboss laut Statistik des Charakters. Die Erfolge gelten für den ganzen Account und
 * zeigen nur `onAccount`.
 */
export interface InstancesView {
  /** false, solange die statischen Definitionen fehlen. */
  available: boolean;
  dungeonTiers: {
    achievementId: number;
    /** z.B. "Novize", Teil des Erfolgsnamens vor dem Doppelpunkt */
    tier: string;
    /** `image`: Kachelbild (Retail-Artwork) oder null, dann zeigt die Oberfläche einen Platzhalter. */
    dungeons: {
      criterionId: number;
      name: string;
      /** Bezeichnung im Erfolg, bei Gegenstücken beider Fraktionen "A oder B". */
      description: string;
      /** Eigener Sieg über den Endboss laut Statistik dieses Charakters. */
      completed: boolean;
      /**
       * Nicht abgeschlossen, aber laut accountweitem Erfolgskriterium auf diesem Account erledigt (anderer Charakter
       * oder ein Dungeon, dessen Endboss die Statistik nicht führt). Zählt in keiner Gildenauswertung.
       */
      onAccount: boolean;
      /** false, wenn die Statistik den Endboss gar nicht führt (`ohneStatistik`): Abschluss je Charakter unbekannt. */
      tracked: boolean;
      kills: KillRef[];
      image: string | null;
      /** Levelbereich aus `config/dungeons.json`, sonst null. */
      levels: LevelRange | null;
      /** Bossnamen aus `config/dungeons.json` als reine Info; ohne Eintrag null. */
      bosses: string[] | null;
      /** Endbosse (je Alternative der letzte Eintrag); nur sie erscheinen in der Blizzard-Statistik. */
      finalBosses: string[];
      /** Letzter Sieg über den Endboss laut Statistik, sonst null. */
      completedAt: string | null;
      /** Wie oft der Endboss besiegt wurde (Summe von `quantity`). */
      timesCompleted: number;
    }[];
  }[];
  raids: {
    achievementId: number;
    name: string;
    image: string | null;
    levels: LevelRange | null;
    /** Alle Bosse laut eigener Statistik besiegt. */
    completed: boolean;
    /** Nicht abgeschlossen, aber der Erfolg ist auf diesem Account erledigt. */
    onAccount: boolean;
    /** `defeated` nur über die eigene Statistik. */
    bosses: { name: string; defeated: boolean; lastAt: string | null }[];
  }[];
  /** Boss-Kills, die keinem angezeigten Dungeon oder Raidboss zugeordnet werden konnten. */
  otherKills: (KillRef & { instance: string | null })[];
}

/** Ruf eines Charakters, gruppiert; `available` ist false, solange der Datensatz noch keinen Ruf hat. */
export interface ReputationView {
  available: boolean;
  groups: {
    name: string;
    factions: { id: number; name: string; tier: number; tierName: string; value: number; max: number }[];
  }[];
}

export type AttributeGroupId = "basis" | "angriff" | "zauber" | "verteidigung";
export type ResourceKind = "mana" | "rage" | "focus" | "energy" | "runic_power" | "other";

export interface AttributeRow {
  /** Feldname bei Blizzard, etwa `strength` oder `melee_crit`; die Seite beschriftet danach. */
  key: string;
  kind: "number" | "percent";
  value: number;
  /** Grundwert ohne Ausrüstung, nur wenn er vom Wert abweicht. */
  base?: number;
}

export interface AttributesView {
  available: boolean;
  /** Zeitpunkt des Abrufs; null, wenn noch nie geholt. */
  fetchedAt: string | null;
  resource: { id: number; kind: ResourceKind; name: string } | null;
  groups: { id: AttributeGroupId; rows: AttributeRow[] }[];
}

export interface CharacterView {
  character: CharacterRecord;
  className: string;
  raceName: string;
  guildName: string;
  guildFaction: string;
  rank: number | null;
  rankName: string | null;
  former: boolean;
  /** Schlüssel: itemId, nur für getragene Gegenstände */
  itemIcons: Record<string, string | null>;
  instances: InstancesView;
  reputation: ReputationView;
  /** Grundwerte wie im Arsenal; fehlt bei älteren Antworten. */
  attributes?: AttributesView;
  /** Schlüssel: Rezept-ID, nur Rezepte des Charakters mit gespeicherten Details. */
  recipes: Record<string, RecipeView>;
  /** Spaßtitel der letzten ausgewerteten Woche; fehlt bei älteren Antworten. */
  titles?: CharacterTitle[];
  /** Zusatzdaten angemeldeter Erweiterungen je Kennung; fehlt, wenn keine etwas liefert. */
  erweiterungen?: Record<string, unknown>;
}

export interface CharacterRef {
  id: number;
  name: string;
  surname: string | null;
  slug: string;
  classId: number;
  /** Nur im Berufe-Verzeichnis gesetzt. */
  className?: string;
  former: boolean;
  guildSlug: string;
}

export interface ProfessionsView {
  guilds: GuildRef[];
  professions: {
    id: number;
    name: string;
    /** URL-Kürzel, z.B. "kraeuterkunde". */
    slug: string;
    /** "Handwerk", "Sammeln", "Nebenberufe" oder "Weitere Berufe". */
    group: string;
    icon: string | null;
    primary: boolean;
    members: (CharacterRef & { skill: number; max: number })[];
  }[];
  characters: Record<string, CharacterRef>;
}

/** Rezeptdetails mit Icons der Materialien. */
export interface RecipeView extends Omit<RecipeDetail, "reagents"> {
  reagents: (RecipeReagent & { icon: string | null })[];
}

/** Ein Rezept eines Berufs mit allen aktiven Charakteren, die es kennen. */
export interface ProfessionRecipe {
  /** null bei älteren Daten ohne Rezept-ID. */
  id: number | null;
  name: string;
  characterIds: number[];
  /** null, solange keine Details gespeichert sind. */
  recipe: RecipeView | null;
}

/** Antwort von `/api/professions/{slug}`, nach Name sortiert. */
export interface ProfessionRecipesView {
  professionId: number;
  slug: string;
  recipes: ProfessionRecipe[];
}

/** Antwort von `/api/activity`: Logins der letzten Wochen als Raster Wochentag mal Stunde. */
/**
 * Ein Mitglied mit seinem Wert in einer Mitgliederliste, kompakt als Paar [Charakter-ID, Wert]. Name, Klasse, Volk
 * und Level holt die Seite aus `/api/guild`, damit die Antworten schlank bleiben.
 */
export type MemberValue = [id: number, value: number];

export interface ActivityView {
  guilds: GuildRef[];
  /** Betrachtete Wochen, älteste zuerst (auch ohne Daten). */
  weeks: string[];
  /** Wochen, für die Aufzeichnungen vorliegen. */
  weeksWithData: number;
  /** Erster und letzter Tag des Zeitraums. */
  from: string;
  to: string;
  /** Alle Gilden: 168 Werte (Montag 0 Uhr zuerst), dazu die Zahl der beteiligten Charaktere. */
  all: { cells: number[]; characters: number };
  /** Je Gildenslug wie `all`. */
  byGuild: Record<string, { cells: number[]; characters: number }>;
  /** Je Charakter (alle Gilden) die Zahl der Stunden mit Anmeldung im Zeitraum, für die Mitgliederliste. */
  logins: MemberValue[];
  testdaten: boolean;
}

/** Ein vergebener Titel für die Anzeige. */
export interface TitleAwardView {
  titleId: string;
  name: Fassungen;
  description: Fassungen;
  value: number;
  valueText: Fassungen;
  /** Titelträger auf der Karte. */
  character: CharacterRef;
  /** Wie viele den Titel noch haben (Gleichstand); 0 bei einem Gewinner. */
  sharedWith: number;
}

export interface TitleWeekView {
  week: string;
  from: string;
  to: string;
  awards: TitleAwardView[];
  /** true, wenn für die Woche die ganze Rangliste je Titel gespeichert ist (siehe `/api/titles?titel=&woche=`). */
  ranked: boolean;
}

/** Antwort von `/api/titles`. */
export interface TitlesView {
  /** Gilden der Gemeinschaft, für das Fraktionssymbol der Gewinner. */
  guilds: GuildRef[];
  /** Alle Titel mit Regel, auch ohne Gewinner. */
  titles: { id: string; name: Fassungen; description: Fassungen }[];
  /** Letzte ausgewertete Woche, null vor der ersten Auswertung. */
  current: TitleWeekView | null;
  /** Vorwochen, neueste zuerst. */
  history: TitleWeekView[];
  testdaten: boolean;
}

/** Antwort von `/api/titles?titel=<id>&woche=<w>`: wer in der Woche wie viel für den Titel hatte. */
export interface TitleRankingView {
  titleId: string;
  week: string;
  from: string;
  to: string;
  /** Alle Inhaber des Titels, Titelträger zuerst; leer, wenn der Titel nicht vergeben wurde. */
  winnerIds: number[];
  /** [Charakter-ID, Wert], bester zuerst. */
  entries: MemberValue[];
  /** Wert als Text wie auf der Kachel, je vorkommendem Wert (Schlüssel ist der Wert). */
  valueTexts: Record<string, Fassungen>;
  /** false für Wochen vor der Rangliste: dann steht nur der Gewinner drin. */
  complete: boolean;
}

/** Titel eines Charakters aus der letzten ausgewerteten Woche, für die Abzeichen. */
export interface CharacterTitle {
  titleId: string;
  name: Fassungen;
  week: string;
  /** Erster und letzter gewerteter Tag der Woche. */
  from: string;
  to: string;
  valueText: Fassungen;
}

export interface ZeitungArticleView {
  kind: string;
  /** Rubrik; "Vermischtes" bei Ausgaben vor den Rubriken. */
  section: Fassungen;
  /** Spaßtitel der Meldung mit Namen, für das Abzeichen; null ohne Titel. */
  title: { id: string; name: Fassungen } | null;
  /** Ausgaben vor den Sprachvarianten haben nur eine Fassung, die dann überall steht. */
  headline: Fassungen;
  text: Fassungen;
  characters: CharacterRef[];
}

/** Antwort von `/api/zeitung` und `/api/zeitung/{Woche}`. */
export interface ZeitungView {
  /** Fortlaufende Nummer der Ausgabe, ab 1. */
  issue: number;
  week: string;
  from: string;
  to: string;
  lead: ZeitungArticleView;
  articles: ZeitungArticleView[];
  motto: Fassungen;
  /** `claude`, wenn ein Sprachmodell geschrieben hat, sonst `bausteine`. */
  generator: string;
  /** Charakterbild (Avatar) je Charakter-ID der Ausgabe, null ohne Bild. */
  avatars: Record<string, string | null>;
  /** Nachbarausgaben zum Blättern. */
  previous: string | null;
  next: string | null;
  testdaten: boolean;
  /** Woche in Zahlen; null in Ausgaben davor. */
  zahlen?: ZeitungZahlenView | null;
  /** Wetterbericht; null in Ausgaben davor. */
  wetter?: Fassungen | null;
  /** Schlagzeile von vor vier Wochen; null, wenn es die Ausgabe nicht gibt. */
  rueckblick?: ZeitungRueckblickView | null;
}

/** Eine Zeile im Infokasten „Woche in Zahlen“. */
export interface ZeitungZahlView {
  art: WeeklyNumberKind;
  wert: number;
  /** Wert der Vorwoche; null ohne Vergleich (dann kein Pfeil). */
  vorwoche: number | null;
}

export interface ZeitungZahlenView {
  guilds: GuildRef[];
  gesamt: ZeitungZahlView[];
  /** Je Gilden-Slug. */
  gilden: Record<string, ZeitungZahlView[]>;
}

export interface ZeitungRueckblickView {
  week: string;
  /** Nummer der damaligen Ausgabe. */
  issue: number | null;
  from: string;
  to: string;
  headline: Fassungen;
  characters: CharacterRef[];
}

/** Antwort von `/api/wrapped/{Charakter}[/{Monat}]`: Monatsbilanz. Werte null heißen "keine Daten". */
export interface WrappedView {
  character: CharacterRef & { level: number; className: string };
  /** JJJJ-MM */
  month: string;
  /** Monate mit Daten, neueste zuerst. */
  months: string[];
  /** Laufender Monat: Zwischenstand. */
  running: boolean;
  /** Erster und letzter Tagesstand, die für diesen Charakter verglichen wurden. */
  from: string | null;
  to: string | null;
  /** Mit höherem Level beigetreten: Datum, ab dem gezählt wird; sonst null. */
  since: string | null;
  /** Monat des Serverstarts: sein Datum. Dann zählt alles ab Level 1 und Zählerstand 0, sonst null. */
  serverStart: string | null;
  levels: { gained: number; start: number; end: number } | null;
  /** Platz in der Gemeinschaft nach gewonnenen Leveln. */
  rank: { place: number; of: number } | null;
  /** Zuwachs der Gegenstandsstufe; im Monat des Serverstarts der aktuelle Wert. */
  itemLevel: number | null;
  professionPoints: number | null;
  dungeons: number | null;
  recipes: number | null;
  deaths: number | null;
  logins: number;
  activeDays: number;
  /** Häufigste Stunde (0 bis 23) und häufigster Wochentag (Montag 0); null ohne Logins. */
  favoriteHour: number | null;
  favoriteWeekday: number | null;
  titles: CharacterTitle[];
  testdaten: boolean;
}

/** Antwort von `/api/zeitung/archiv`: alle Ausgaben, neueste zuerst. */
export interface ZeitungArchiveView {
  issues: { issue: number; week: string; from: string; to: string; headline: Fassungen; testdaten: boolean }[];
}

/** Ein Spitzenreiter einer Statistik. */
export interface StatLeaderView {
  character: CharacterRef;
  value: number;
}

/** Umrechnung für die Wusstest-du-Karte: `total / per` ergibt die Menge in `unit`. */
export interface StatConversionView {
  per: number;
  unit: Fassungen<[string, string]>;
  /** Erklärung der Umrechnung, etwa "wenn ein Fass hundert Krüge hergibt". */
  text: Fassungen;
}

/** Eine Statistik im gewählten Zeitraum und für die gewählte Gilde. */
export interface StatEntryView {
  id: number;
  name: string;
  art: "zaehler" | "stand";
  /** Zähler: Summe im Zeitraum. Stand: höchster Wert eines Charakters. */
  total: number;
  /** Wie `total`, aber je Gilde (Slug) und immer über alle Gilden, für den Vergleich Horde gegen Allianz. */
  perGuild: Record<string, number>;
  /** Spitzenreiter, höchster Wert zuerst, nur Werte über 0. */
  leaders: StatLeaderView[];
  /** Wie viele Charaktere (der gewählten Gilde) einen Wert über 0 haben. */
  holders: number;
  /** Summe über die Charaktere (der gewählten Gilde); bei Zählern gleich `total`, bei Ständen etwa alle Haustiere zusammen. */
  sum: number;
  /** Klasse für die Farbe, etwa Paladin bei Erlösungen; null ohne. */
  classId: number | null;
  /** Kurze Beschriftung im Diagramm; null, dann der amtliche Name. */
  short: Fassungen | null;
  /** Einheit als [Einzahl, Mehrzahl], null ohne. */
  unit: Fassungen<[string, string]> | null;
  /** Auszeichnung für den Spitzenreiter, null ohne. */
  honor: Fassungen | null;
  conversion: StatConversionView | null;
}

/** Darstellungsform einer Karte der Gildenstatistik. */
export type StatCardForm =
  | "grabsteinfeld"
  | "piktogramm"
  | "waage"
  | "wusstest-du"
  | "podium"
  | "fraktionsduell"
  | "torte"
  | "zahl"
  | "flaeschle"
  | "fahrplan"
  | "ekg"
  | "stall"
  | "schredder"
  | "verband";

/** Eine Karte der Gildenstatistik mit ihren Statistiken in der Reihenfolge aus `config/statistik-karten.json`. */
export interface StatCardView {
  slug: string;
  form: StatCardForm;
  title: Fassungen;
  /** Lockere Unterzeile, null ohne. */
  blurb: Fassungen | null;
  /** Breite in Spalten der Wand, 1 bis 3. */
  span: 1 | 2 | 3;
  stats: StatEntryView[];
}

/** Ein Dungeon über die ganze Gilde (oder die gewählte Gilde) zusammengezählt. */
export interface GuildDungeonView {
  /** Erste Alternative der Erfolgsbezeichnung, kleingeschrieben; fasst Gegenstücke beider Fraktionen zusammen. */
  key: string;
  /** Angezeigter Name: die Alternativen, die jemand abgeschlossen hat, sonst die erste. */
  name: string;
  /** "Novize", "Erfahren" oder "Meister". */
  tier: string;
  image: string | null;
  levels: LevelRange | null;
  /** Charaktere, die den Dungeon abgeschlossen haben (eigener Endboss-Sieg laut Statistik). */
  completed: number;
  /** false, wenn die Statistik den Endboss nicht führt: `completed` ist dann immer 0 und sagt nichts aus. */
  tracked: boolean;
  /** Endboss-Siege aller Charaktere zusammen. */
  timesCompleted: number;
  /** Wer den Endboss am öftesten gelegt hat, null ohne Siege. */
  best: { character: CharacterRef; times: number } | null;
  /** Letzter Endboss-Sieg in der Gilde. */
  lastAt: string | null;
  /** Wer durch ist, mit seinen Endboss-Siegen. */
  who: MemberValue[];
}

export interface GuildRaidView {
  name: string;
  image: string | null;
  levels: LevelRange | null;
  /** Charaktere, die laut eigener Statistik alle Bosse besiegt haben. */
  completed: number;
  bosses: { name: string; defeated: number }[];
  /** Wer mindestens einen Boss gelegt hat, mit der Zahl seiner besiegten Bosse. */
  who: MemberValue[];
}

/** Antwort von `/api/dungeons[?gilde=Slug]`: Dungeons und Raids über alle Charaktere mit Profil. */
export interface GuildDungeonsView {
  /** false, solange die statischen Definitionen fehlen. */
  available: boolean;
  guilds: GuildRef[];
  guild: string | null;
  /** Ausgewertete Charaktere (aktive Mitglieder mit Profil, bei gewählter Gilde nur ihre). */
  characters: number;
  /** Nach Mindestlevel, dann Name. */
  dungeons: GuildDungeonView[];
  raids: GuildRaidView[];
  /** Am weitesten gekommen: wer den Dungeon mit dem höchsten Mindestlevel abgeschlossen hat. */
  frontier: { dungeon: string; characters: CharacterRef[] } | null;
}

export type StatsPeriodKind = "woche" | "monat" | "gesamt";

/**
 * Antwort von `/api/stats`, `/api/stats/woche[/Samstag]` und `/api/stats/monat[/JJJJ-MM]`: Gildenstatistik als
 * Differenz der Wochenstände. `status` sagt, ob die Zahlen taugen: `keine` (noch gar kein Stand), `zu-wenig` (für
 * diesen Zeitraum fehlt der Vergleichsstand), sonst `ok`. Nur bei `ok` stehen Karten drin. Mit `?gilde=<Slug>`
 * zählen nur die Charaktere dieser Gilde.
 */
export interface StatsView {
  kind: StatsPeriodKind;
  /** Samstag der Woche bzw. JJJJ-MM des Monats, null bei Gesamt. */
  id: string | null;
  status: "ok" | "zu-wenig" | "keine";
  /** Verglichener früherer Stand (Samstag), null für den Serverstart. */
  before: string | null;
  /** Neuerer Stand (Samstag), null ohne Stand. */
  after: string | null;
  /** Zeitpunkt des letzten Laufs im neueren Stand. */
  takenAt: string | null;
  /** Tag des Serverstarts, null ohne. */
  serverStart: string | null;
  /** Der neuere Stand ist eine Kopie, weil in der Woche kein Sammler lief. */
  nachgeholt: boolean;
  /** Charaktere im neueren Stand (bei gewählter Gilde nur ihre). */
  characters: number;
  /** Wochen und Monate mit Stand, neueste zuerst, für die Auswahl. */
  weeks: string[];
  months: string[];
  /** Gilden der Gemeinschaft für den Gildenfilter, Hauptgilde zuerst. */
  guilds: GuildRef[];
  /** Gewählte Gilde (Slug), null für alle. */
  guild: string | null;
  cards: StatCardView[];
}

/**
 * Antwort von `/api/stats…?karte=<Slug>`: die Mitglieder hinter einer Karte der Gildenstatistik, je Statistik in der
 * Reihenfolge der Karte. Werte wie auf der Karte (Zuwachs im Zeitraum bzw. aktueller Stand), immer über alle Gilden,
 * damit die Liste selbst nach Gilde filtern kann. Nur Werte über 0, beim Stall auch die Fußgänger mit 0.
 */
export interface StatCardMembersView {
  slug: string;
  stats: { id: number; entries: MemberValue[] }[];
}
