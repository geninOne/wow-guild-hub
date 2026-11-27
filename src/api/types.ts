import type { Translations } from "../language";
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
  /** Key: spellId */
  icons: Record<string, string | null>;
}

/** A guild of the community in responses of the read API. */
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
  /** All guilds, main guild first. */
  guilds: GuildRef[];
  classes: { id: number; name: string }[];
  /** Ranks per guild (the rank name depends on the guild), guilds as in `guilds`, ranks ascending. */
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
 * "Dungeons & Raids" of a character, from achievements, boss kill statistics and static definitions. Completed means:
 * own victory over the final boss according to the character's statistics. The achievements apply to the whole
 * account and only show `onAccount`.
 */
export interface InstancesView {
  /** false while the static definitions are missing. */
  available: boolean;
  dungeonTiers: {
    achievementId: number;
    /** e.g. "Novize", part of the achievement name before the colon */
    tier: string;
    /** `image`: tile image (retail artwork) or null, then the UI shows a placeholder. */
    dungeons: {
      criterionId: number;
      name: string;
      /** Label in the achievement, "A oder B" for counterparts of both factions. */
      description: string;
      /** Own victory over the final boss according to this character's statistics. */
      completed: boolean;
      /**
       * Not completed, but done on this account according to the account-wide achievement criterion (another
       * character, or a dungeon whose final boss the statistics do not track). Counts in no guild evaluation.
       */
      onAccount: boolean;
      /** false if the statistics do not track the final boss (`ohneStatistik`): completion per character unknown. */
      tracked: boolean;
      kills: KillRef[];
      image: string | null;
      /** Level range from `config/dungeons.json`, else null. */
      levels: LevelRange | null;
      /** Boss names from `config/dungeons.json`, for information only; null without an entry. */
      bosses: string[] | null;
      /** Final bosses (the last entry of each alternative); only they appear in the Blizzard statistics. */
      finalBosses: string[];
      /** Last victory over the final boss according to the statistics, else null. */
      completedAt: string | null;
      /** How often the final boss was defeated (sum of `quantity`). */
      timesCompleted: number;
    }[];
  }[];
  raids: {
    achievementId: number;
    name: string;
    image: string | null;
    levels: LevelRange | null;
    /** All bosses defeated according to own statistics. */
    completed: boolean;
    /** Not completed, but the achievement is done on this account. */
    onAccount: boolean;
    /** `defeated` only from own statistics. */
    bosses: { name: string; defeated: boolean; lastAt: string | null }[];
  }[];
  /** Boss kills that could not be matched to any shown dungeon or raid boss. */
  otherKills: (KillRef & { instance: string | null })[];
}

/** Reputation of a character, grouped; `available` is false while the record has no reputation yet. */
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
  /** Field name at Blizzard, such as `strength` or `melee_crit`; the page labels by it. */
  key: string;
  kind: "number" | "percent";
  value: number;
  /** Base value without gear, only if it differs from the value. */
  base?: number;
}

export interface AttributesView {
  available: boolean;
  /** Time of the fetch; null if never fetched. */
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
  /** Key: itemId, only for equipped items */
  itemIcons: Record<string, string | null>;
  instances: InstancesView;
  reputation: ReputationView;
  /** Attributes as in the Armory; missing in older responses. */
  attributes?: AttributesView;
  /** Key: recipe ID, only the character's recipes with stored details. */
  recipes: Record<string, RecipeView>;
  /** Fun titles of the last evaluated week; missing in older responses. */
  titles?: CharacterTitle[];
  /** Extra data of registered extensions per id; missing if none provides anything. */
  extensions?: Record<string, unknown>;
}

export interface CharacterRef {
  id: number;
  name: string;
  surname: string | null;
  slug: string;
  classId: number;
  /** Only set in the professions directory. */
  className?: string;
  former: boolean;
  guildSlug: string;
}

export interface ProfessionsView {
  guilds: GuildRef[];
  professions: {
    id: number;
    name: string;
    /** URL slug, e.g. "kraeuterkunde". */
    slug: string;
    /** "Handwerk", "Sammeln", "Nebenberufe" or "Weitere Berufe". */
    group: string;
    icon: string | null;
    primary: boolean;
    members: (CharacterRef & { skill: number; max: number })[];
  }[];
  characters: Record<string, CharacterRef>;
}

/** Recipe details with icons of the reagents. */
export interface RecipeView extends Omit<RecipeDetail, "reagents"> {
  reagents: (RecipeReagent & { icon: string | null })[];
}

/** A recipe of a profession with all active characters who know it. */
export interface ProfessionRecipe {
  /** null for older data without a recipe ID. */
  id: number | null;
  name: string;
  characterIds: number[];
  /** null while no details are stored. */
  recipe: RecipeView | null;
}

/** Response of `/api/professions/{slug}`, sorted by name. */
export interface ProfessionRecipesView {
  professionId: number;
  slug: string;
  recipes: ProfessionRecipe[];
}

/**
 * A member with their value in a member list, compactly as a pair [character ID, value]. The page takes name, class,
 * race and level from `/api/guild`, so the responses stay lean.
 */
export type MemberValue = [id: number, value: number];

/** Response of `/api/activity`: logins of the last weeks as a grid of weekday by hour. */
export interface ActivityView {
  guilds: GuildRef[];
  /** Weeks considered, oldest first (also without data). */
  weeks: string[];
  /** Weeks for which records exist. */
  weeksWithData: number;
  /** First and last day of the period. */
  from: string;
  to: string;
  /** All guilds: 168 values (Monday 0:00 first), plus the number of characters involved. */
  all: { cells: number[]; characters: number };
  /** Per guild slug, like `all`. */
  byGuild: Record<string, { cells: number[]; characters: number }>;
  /** Per character (all guilds) the number of hours with a login in the period, for the member list. */
  logins: MemberValue[];
  testdaten: boolean;
}

/** An awarded title for display. */
export interface TitleAwardView {
  titleId: string;
  name: Translations;
  description: Translations;
  value: number;
  valueText: Translations;
  /** Title holder on the card. */
  character: CharacterRef;
  /** How many others also hold the title (tie); 0 for a single winner. */
  sharedWith: number;
}

export interface TitleWeekView {
  week: string;
  from: string;
  to: string;
  awards: TitleAwardView[];
  /** true if the full ranking per title is stored for the week (see `/api/titles?title=&week=`). */
  ranked: boolean;
}

/** Response of `/api/titles`. */
export interface TitlesView {
  /** Guilds of the community, for the faction icon of the winners. */
  guilds: GuildRef[];
  /** All titles with a rule, also without winners. */
  titles: { id: string; name: Translations; description: Translations }[];
  /** Last evaluated week, null before the first evaluation. */
  current: TitleWeekView | null;
  /** Previous weeks, newest first. */
  history: TitleWeekView[];
  testdaten: boolean;
}

/** Response of `/api/titles?title=<id>&week=<w>`: who had how much for the title in the week. */
export interface TitleRankingView {
  titleId: string;
  week: string;
  from: string;
  to: string;
  /** All holders of the title, title holder on the card first; empty if the title was not awarded. */
  winnerIds: number[];
  /** [character ID, value], best first. */
  entries: MemberValue[];
  /** Value as text as on the tile, per occurring value (the key is the value). */
  valueTexts: Record<string, Translations>;
  /** false for weeks before the ranking: then only the winner is in it. */
  complete: boolean;
}

/** Title of a character from the last evaluated week, for the badges. */
export interface CharacterTitle {
  titleId: string;
  name: Translations;
  week: string;
  /** First and last scored day of the week. */
  from: string;
  to: string;
  valueText: Translations;
}

export interface NewspaperArticleView {
  kind: string;
  /** Section; "Vermischtes" for issues from before sections. */
  section: Translations;
  /** Fun title of the article with its name, for the badge; null without a title. */
  title: { id: string; name: Translations } | null;
  /** Issues from before the language variants have only one version, which then applies everywhere. */
  headline: Translations;
  text: Translations;
  characters: CharacterRef[];
}

/** Response of `/api/newspaper` and `/api/newspaper/{week}`. */
export interface NewspaperView {
  /** Running number of the issue, from 1. */
  issue: number;
  week: string;
  from: string;
  to: string;
  lead: NewspaperArticleView;
  articles: NewspaperArticleView[];
  motto: Translations;
  /** `claude` if a language model wrote it, else `bausteine`. */
  generator: string;
  /** Character image (avatar) per character ID of the issue, null without an image. */
  avatars: Record<string, string | null>;
  /** Neighboring issues for paging. */
  previous: string | null;
  next: string | null;
  testdaten: boolean;
  /** Week in numbers; null in issues from before. */
  zahlen?: NewspaperNumbersView | null;
  /** Weather report; null in issues from before. */
  wetter?: Translations | null;
  /** Headline from four weeks ago; null if that issue does not exist. */
  rueckblick?: NewspaperLookbackView | null;
}

/** A row in the info box "Woche in Zahlen" (week in numbers). */
export interface NewspaperNumberView {
  art: WeeklyNumberKind;
  wert: number;
  /** Value of the previous week; null without a comparison (then no arrow). */
  vorwoche: number | null;
}

export interface NewspaperNumbersView {
  guilds: GuildRef[];
  gesamt: NewspaperNumberView[];
  /** Per guild slug. */
  gilden: Record<string, NewspaperNumberView[]>;
}

export interface NewspaperLookbackView {
  week: string;
  /** Number of the issue back then. */
  issue: number | null;
  from: string;
  to: string;
  headline: Translations;
  characters: CharacterRef[];
}

/** Response of `/api/wrapped/{character}[/{month}]`: monthly summary. Values of null mean "no data". */
export interface WrappedView {
  character: CharacterRef & { level: number; className: string };
  /** YYYY-MM */
  month: string;
  /** Months with data, newest first. */
  months: string[];
  /** Current month: interim result. */
  running: boolean;
  /** First and last daily snapshot compared for this character. */
  from: string | null;
  to: string | null;
  /** Joined at a higher level: date from which counting starts; else null. */
  since: string | null;
  /** Month of the server start: its date. Then everything counts from level 1 and counters at 0; else null. */
  serverStart: string | null;
  levels: { gained: number; start: number; end: number } | null;
  /** Place in the community by levels gained. */
  rank: { place: number; of: number } | null;
  /** Gain in item level; in the month of the server start the current value. */
  itemLevel: number | null;
  professionPoints: number | null;
  dungeons: number | null;
  recipes: number | null;
  deaths: number | null;
  logins: number;
  activeDays: number;
  /** Most frequent hour (0 to 23) and most frequent weekday (Monday 0); null without logins. */
  favoriteHour: number | null;
  favoriteWeekday: number | null;
  titles: CharacterTitle[];
  testdaten: boolean;
}

/** Response of `/api/newspaper/archive`: all issues, newest first. */
export interface NewspaperArchiveView {
  issues: { issue: number; week: string; from: string; to: string; headline: Translations; testdaten: boolean }[];
}

/** A leader of a statistic. */
export interface StatLeaderView {
  character: CharacterRef;
  value: number;
}

/** Conversion for the did-you-know card: `total / per` gives the amount in `unit`. */
export interface StatConversionView {
  per: number;
  unit: Translations<[string, string]>;
  /** Explanation of the conversion, such as "wenn ein Fass hundert Krüge hergibt". */
  text: Translations;
}

/** A statistic in the chosen period and for the chosen guild. */
export interface StatEntryView {
  id: number;
  name: string;
  art: "zaehler" | "stand";
  /** Counter: sum in the period. Current value: highest value of a character. */
  total: number;
  /** Like `total`, but per guild (slug) and always across all guilds, for comparing Horde against Alliance. */
  perGuild: Record<string, number>;
  /** Leaders, highest value first, only values above 0. */
  leaders: StatLeaderView[];
  /** How many characters (of the chosen guild) have a value above 0. */
  holders: number;
  /** Sum over the characters (of the chosen guild); `total` for counters, e.g. all pets together for current values. */
  sum: number;
  /** Class for the color, such as Paladin for redemptions; null without. */
  classId: number | null;
  /** Short label in the chart; null, then the official name. */
  short: Translations | null;
  /** Unit as [singular, plural], null without. */
  unit: Translations<[string, string]> | null;
  /** Honor for the leader, null without. */
  honor: Translations | null;
  conversion: StatConversionView | null;
}

/** Display form of a guild statistics card. */
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

/** A guild statistics card with its statistics in the order from `config/statistik-karten.json`. */
export interface StatCardView {
  slug: string;
  form: StatCardForm;
  title: Translations;
  /** Casual subtitle, null without. */
  blurb: Translations | null;
  /** Width in columns of the wall, 1 to 3. */
  span: 1 | 2 | 3;
  stats: StatEntryView[];
}

/** A dungeon totaled across the whole guild (or the chosen guild). */
export interface GuildDungeonView {
  /** First alternative of the achievement label, lowercase; merges counterparts of both factions. */
  key: string;
  /** Displayed name: the alternatives someone has completed, else the first. */
  name: string;
  /** "Novize", "Erfahren" or "Meister". */
  tier: string;
  image: string | null;
  levels: LevelRange | null;
  /** Characters who have completed the dungeon (own final boss victory according to the statistics). */
  completed: number;
  /** false if the statistics do not track the final boss: `completed` is then always 0 and means nothing. */
  tracked: boolean;
  /** Final boss victories of all characters together. */
  timesCompleted: number;
  /** Who defeated the final boss most often, null without victories. */
  best: { character: CharacterRef; times: number } | null;
  /** Last final boss victory in the guild. */
  lastAt: string | null;
  /** Who has completed it, with their final boss victories. */
  who: MemberValue[];
}

export interface GuildRaidView {
  name: string;
  image: string | null;
  levels: LevelRange | null;
  /** Characters who have defeated all bosses according to their own statistics. */
  completed: number;
  bosses: { name: string; defeated: number }[];
  /** Who has defeated at least one boss, with the number of bosses they defeated. */
  who: MemberValue[];
}

/** Response of `/api/dungeons[?guild=slug]`: dungeons and raids across all characters with a profile. */
export interface GuildDungeonsView {
  /** false while the static definitions are missing. */
  available: boolean;
  guilds: GuildRef[];
  guild: string | null;
  /** Evaluated characters (active members with a profile, only its own for a chosen guild). */
  characters: number;
  /** By minimum level, then name. */
  dungeons: GuildDungeonView[];
  raids: GuildRaidView[];
  /** Got the furthest: who has completed the dungeon with the highest minimum level. */
  frontier: { dungeon: string; characters: CharacterRef[] } | null;
}

export type StatsPeriodKind = "woche" | "monat" | "gesamt";

/**
 * Response of `/api/stats`, `/api/stats/week[/saturday]` and `/api/stats/month[/YYYY-MM]`: guild statistics as the
 * difference of weekly snapshots. `status` says whether the numbers are usable: `keine` (no snapshot at all yet),
 * `zu-wenig` (the baseline snapshot for this period is missing), else `ok`. Only with `ok` are there cards. With
 * `?guild=<slug>` only the characters of that guild count.
 */
export interface StatsView {
  kind: StatsPeriodKind;
  /** Saturday of the week or YYYY-MM of the month, null for total. */
  id: string | null;
  status: "ok" | "zu-wenig" | "keine";
  /** Earlier snapshot compared (Saturday), null for the server start. */
  before: string | null;
  /** Newer snapshot (Saturday), null without a snapshot. */
  after: string | null;
  /** Time of the last run in the newer snapshot. */
  takenAt: string | null;
  /** Day of the server start, null without. */
  serverStart: string | null;
  /** The newer snapshot is a copy because no collector ran that week. */
  nachgeholt: boolean;
  /** Characters in the newer snapshot (only its own for a chosen guild). */
  characters: number;
  /** Weeks and months with a snapshot, newest first, for the selection. */
  weeks: string[];
  months: string[];
  /** Guilds of the community for the guild filter, main guild first. */
  guilds: GuildRef[];
  /** Chosen guild (slug), null for all. */
  guild: string | null;
  cards: StatCardView[];
}

/**
 * Response of `/api/stats…?card=<slug>`: the members behind a guild statistics card, per statistic in the card's
 * order. Values as on the card (gain in the period or current value), always across all guilds, so the list can filter
 * by guild itself. Only values above 0; for the stable also those on foot with 0.
 */
export interface StatCardMembersView {
  slug: string;
  stats: { id: number; entries: MemberValue[] }[];
}
