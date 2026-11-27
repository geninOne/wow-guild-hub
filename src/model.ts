// All data types stored in Netlify Blobs. Contract for the read API and the frontend.

import type { OtherTranslations } from "./language";

export interface ItemTooltip {
  binding: string | null;
  unique: string | null;
  slotType: string | null;
  subclass: string | null;
  /** Bags: the container slot line. Missing in data from before the recipe details. */
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
  /** English recipe names from the character data (fallback for display). */
  recipes: string[];
  /** Recipe IDs parallel to `recipes`. Missing in data from before the UI addendum. */
  recipeIds?: number[];
}

/** Progress of an achievement: only the IDs of the completed child criteria. */
export interface AchievementProgress {
  id: number;
  completed: boolean;
  criteria: number[];
}

/** One entry of the `Boss-Kills` statistic, i.e. a `Siege über BOSS (INSTANCE)` line (victories over a boss). */
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

/** Reputation with a faction; `value` of `max` is the progress within the tier. */
export interface CharacterReputation {
  factionId: number;
  /** Name from the character data, partly English; the read API translates it. */
  name: string;
  tier: number;
  tierName: string;
  value: number;
  max: number;
}

/** Counters from the character statistics; null when the statistics do not provide the value. */
export interface CharacterStats {
  /** Total deaths. */
  deaths: number | null;
  /** 5-player dungeons entered. */
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
  /** Dungeon and raid progress; null without data, missing in data from before the UI addendum. */
  instances?: InstanceProgress | null;
  /** Reputation; null without data, missing in data from before the UI addendum. */
  reputations?: CharacterReputation[] | null;
  /** Counters for titles and Wrapped; null without statistics, missing in data from before the fun titles. */
  stats?: CharacterStats | null;
  /** Complete statistics, statistic ID to value (missing = 0); null without statistics, missing in data from before the statistic snapshots. */
  statValues?: Record<string, number> | null;
  /** Texts of the "most often" statistics, statistic ID to text (such as a creature type). */
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
  /** Guild the member was last seen in. Missing only in data from before the first run with several guilds. */
  guildSlug?: string;
  /** Counters for the daily snapshot; missing in data from before the fun titles, null without profile or statistics. */
  deaths?: number | null;
  dungeonsEntered?: number | null;
  /** Number of known recipes across all professions. */
  recipeCount?: number | null;
  /**
   * Completed achievements. For alts (`TWINK_RANKS`) without account-wide achievements (`static/achievement-account-wide`),
   * which count only for the main character. Achievements without known information count until the static collector knows them.
   * null without data.
   */
  achievementCount?: number | null;
  /** `achievementCount` without account-wide achievements because the character had an alt rank when fetched. */
  achievementsTwink?: boolean;
  /** Sum of reputation tiers across all factions; null without data. */
  reputationTiers?: number | null;
}

/** One of the community's guilds; `main` is the main guild (first in `GUILD_SLUGS`). */
export interface GuildInfo {
  slug: string;
  id: number;
  name: string;
  faction: string;
  memberCount: number;
  rulesetName: string;
  main: boolean;
}

/** Header fields describe the main guild, `members` covers all guilds. */
export interface GuildRecord {
  fetchedAt: string;
  id: number;
  name: string;
  faction: string;
  memberCount: number;
  rulesetName: string;
  members: MemberSummary[];
  /** All guilds, main guild first. Missing only in data from before the first run with several guilds. */
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
      /** Counters since the fun titles; missing in older snapshots and for characters without statistics. */
      deaths?: number;
      dungeons?: number;
      recipes?: number;
      /** Completed achievements. */
      achievements?: number;
      /** `achievements` without account-wide achievements (alt rank); missing for everyone else. */
      achievementsTwink?: true;
      /** Sum of reputation tiers across all factions. */
      reputation?: number;
    }
  >;
  /** Only for local sample data. */
  testdaten?: boolean;
}

/**
 * Blob `activity/{week}`: who had a login in which hour of the week (Monday 0:00 = 0, Berlin time).
 * Stored per ISO week; the weekly evaluation assembles its scoring weeks from these (see `weekActivity`).
 */
export interface ActivityWeek {
  /** ISO week, e.g. `2026-W47`; in the weekly evaluation also the scoring week the hours come from. */
  week: string;
  /** Character ID to hours of the week 0 to 167, ascending, without duplicates. */
  characters: Record<string, number[]>;
  /** Returners: character ID to days of absence before the login in this week (only from 7 days, longest absence). */
  returns?: Record<string, number>;
  /** Only for local sample data. */
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

/** Definition of a dungeon or raid achievement (categories 15593 and 15594), names in German. */
export interface InstanceAchievement {
  id: number;
  name: string;
  kind: "dungeon" | "raid";
  /** Position within the category. */
  order: number;
  /** Description of the root criterion, e.g. completing a raid or killing its final boss. */
  rootDescription: string | null;
  criteria: { id: number; description: string }[];
}

/** Blob `static/instance-achievements`, order: dungeons, then raids, each in category order. */
export interface InstanceAchievementsRecord {
  achievements: InstanceAchievement[];
}

/** Blob `static/recipe-names`: recipe ID to German name, null on 404. Only a fallback for older data now, the new one is `static/recipes`. */
export type RecipeNames = Record<string, string | null>;

/** Blob `static/reputation-factions`: names from the index and groups of the root factions. */
export interface ReputationFactionsRecord {
  names: Record<string, string>;
  /** In the order of the root factions. */
  groups: { id: number; name: string; factionIds: number[] }[];
  /** Root factions whose details have already been fetched (also those without subfactions). */
  checkedRoots: number[];
}

export interface RecipeReagent {
  id: number;
  name: string;
  quantity: number;
}

/** Crafted item; quality, level and tooltip are missing when the item could not be fetched. */
export interface CraftedItem {
  id: number;
  name: string;
  quality: string | null;
  /** Only for items with a displayed level, not for consumables. */
  itemLevel: number | null;
  tooltip: ItemTooltip | null;
}

export interface RecipeDetail {
  id: number;
  /** German recipe name. */
  name: string;
  /** For recipes without an item (e.g. enchantments) the effect. */
  description: string | null;
  icon: string | null;
  craftedQuantity: number;
  item: CraftedItem | null;
  reagents: RecipeReagent[];
}

/** Blob `static/recipes`: recipe ID to details, null on 404. */
export type RecipeDetails = Record<string, RecipeDetail | null>;

/** Weekly metrics of a character; null when the daily snapshots do not yield the value. */
export interface WeekMetrics {
  /** Hours of the week with a login. */
  logins: number;
  /** Logins between 1:00 and 5:00. */
  nightLogins: number;
  /** Logins between 5:00 and 8:00. */
  earlyLogins: number;
  /** Days with at least one login. */
  activeDays: number;
  levels: number | null;
  deaths: number | null;
  recipes: number | null;
  dungeons: number | null;
  /** Newly completed achievements. */
  achievements: number | null;
  /** Increase of the equipped item level; null without a value to compare. */
  itemLevel: number | null;
  /** Reputation tiers gained, summed across all factions. */
  reputation: number | null;
  /** Longest absence in days before a login in this week, 0 without a return. */
  awayDays: number;
}

export interface TitleAward {
  titleId: string;
  /** Title holder on the card; on a tie the one who has gone longest without the title. */
  characterId: number;
  /**
   * All holders with the top value, the title holder first. Missing in weeks before shared titles and with only one
   * holder; then `characterId` alone applies, see `titleHolders`.
   */
  characterIds?: number[];
  value: number;
}

export interface NewspaperArticle {
  /** Kind of fact, e.g. `sprung`, `titel`, `neuzugang`. */
  kind: string;
  /** Section heading shown in the UI; missing in issues from before the sections. */
  section?: string;
  /** Fun title the article is about (for the badge); missing without a title and in older issues. */
  titleId?: string;
  /** Standard German version. */
  headline: string;
  text: string;
  /** Swabian and Bavarian versions; missing in issues from before the language variants. */
  dialekte?: OtherTranslations<{ headline: string; text: string }>;
  /** Characters involved, so the UI can link to them. */
  characterIds: number[];
}

export interface NewspaperIssue {
  lead: NewspaperArticle;
  articles: NewspaperArticle[];
  /** Motto of the week, Standard German. */
  motto: string;
  /** Motto of the week in Swabian and Bavarian; missing in issues from before the language variants. */
  mottoDialekte?: OtherTranslations<string>;
  /** Who wrote the texts: `bausteine` or `claude`; missing in older issues. */
  generator?: string;
  /** Model, if a language model wrote the texts. */
  model?: string;
  /** Reason, if a configured language model did not write and the text templates stepped in. */
  fallback?: string;
  /** Text template IDs used, so the next issues pick different ones. */
  bausteine?: string[];
  /** Kind of the number of the week, e.g. `level` or `tode`. */
  zahl?: string;
  /** Weather report for Azeroth, Standard German, composed from the weekly numbers; missing in earlier issues. */
  wetter?: string;
  /** Weather report in Swabian and Bavarian. */
  wetterDialekte?: OtherTranslations<string>;
  /** Headline of the issue from four weeks ago; missing when there is none, and in earlier issues. */
  rueckblick?: NewspaperLookback;
}

/** A headline from an earlier issue, as it appeared at the time. */
export interface NewspaperLookback {
  week: string;
  from: string;
  to: string;
  headline: string;
  dialekte?: OtherTranslations<string>;
  characterIds: number[];
}

/** What the week in numbers counts. */
export type WeeklyNumberKind = "anmeldungen" | "level" | "tode" | "dungeons" | "rezepte" | "erfolge" | "ruf" | "gegenstandsstufe";

/** Sums of a week; null when no character had a value. */
export type WeeklySums = Record<WeeklyNumberKind, number | null>;

/** Guild sums of a week, computed deterministically (not by the AI). */
export interface WeeklyNumbers {
  /** All guilds combined. */
  gesamt: WeeklySums;
  /** Per guild slug. */
  gilden: Record<string, WeeklySums>;
  /** Best individual value of the week per kind as [character ID, value], for records. */
  spitze: Partial<Record<WeeklyNumberKind, [id: number, value: number]>>;
  /** The same sums for the previous week; missing without a previous week. */
  vorwoche?: { gesamt: WeeklySums; gilden: Record<string, WeeklySums> };
}

/**
 * Blob `weekly/{week}`: result of the weekly evaluation. The week is a scoring week (Sunday to Saturday,
 * identified by the Saturday, e.g. `2026-11-21`) or, for issues from before the switch, an ISO week such as `2026-W46`.
 */
export interface WeeklyRecord {
  week: string;
  /** First and last scored day; in the transition week it starts after the last day of the old issues. */
  from: string;
  to: string;
  generatedAt: string;
  titles: TitleAward[];
  /**
   * Per title the full ranking of the week as [character ID, value], best first; everyone with a value of 1 or more.
   * Missing in weeks evaluated before the ranking existed.
   */
  rankings?: Record<string, [id: number, value: number][]>;
  zeitung: NewspaperIssue;
  /** Only when local sample data was included. */
  testdaten?: boolean;
  /** Week in numbers; missing in earlier issues. */
  zahlen?: WeeklyNumbers;
}

/** Blob `weekly/index`: evaluated weeks, ascending by their last day, with the essentials for the archive. */
export interface WeeklyIndex {
  weeks: string[];
  /**
   * Per week the headline of the lead article and the scored period; missing for weeks before the archive.
   * The period is missing in entries from before the switch to scoring weeks.
   */
  entries?: Record<string, { headline: string; dialekte?: OtherTranslations<string>; from?: string; to?: string; testdaten?: boolean }>;
}

/**
 * One field of the character attributes (profile endpoint `/statistics`): a number or the numbers of an object,
 * such as `{ base, effective }` for primary stats or `{ rating, rating_bonus, value }` for crit and dodge.
 */
export type AttributeField = number | Record<string, number>;

/** Blob `attributes/<character ID>`: base attributes of a character, fetched by the static collector every four hours. */
export interface CharacterAttributesRecord {
  fetchedAt: string;
  /** Number fields of the response, keys as from Blizzard; null when Blizzard returns no values (404). */
  fields: Record<string, AttributeField> | null;
  /** Resource (mana, rage, energy, runic power ...); null when not given. */
  powerType: { id: number; name: string } | null;
  /** Only for made-up values from the local sample data. */
  testdaten?: boolean;
}

/** Blob `attributes/index`: per character ID the time the attributes were last fetched. */
export type AttributesIndex = Record<string, string>;

/**
 * What `collect-static` needs from a character record so it does not have to read all `characters/*`.
 * Maintained by `collect-guild` when it writes a character.
 */
export interface CharacterIndexEntry {
  slug: string;
  hasProfile: boolean;
  lastLoginAt: string | null;
  /** IDs of the equipped items. */
  itemIds: number[];
  /** Item levels Blizzard still includes in the equipment, item ID to level. */
  itemLevels: Record<string, number>;
  /** Known recipes across all professions. */
  recipeIds: number[];
  /** Completed achievements; missing in entries from before account-wide achievements were detected. */
  achievementIds?: number[];
}

/**
 * Blob `static/achievement-account-wide`: achievement ID to `is_account_wide` from `/data/wow/achievement/{id}`,
 * null on 404 or when not given.
 */
export type AchievementAccountWide = Record<string, boolean | null>;

/** Blob `character-index`: character ID to `CharacterIndexEntry`. */
export type CharacterIndex = Record<string, CharacterIndexEntry>;
