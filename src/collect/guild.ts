import { BlizzardError, type BlizzardClient } from "../blizzard/client";
import type { Config } from "../config";
import { runPool } from "../lib/pool";
import { berlinDate } from "../lib/time";
import type { AchievementAccountWide, CharacterIndex, CharacterRecord, GuildInfo, GuildRecord, LevelUpEvent, LevelUpLog, MemberSummary } from "../model";
import type { JsonStore } from "../store";
import { workEndOf } from "./budget";
import { CHARACTER_INDEX_KEY, toCharacterIndexEntry } from "./character-index";
import { detectLogin, recordActivity, type LoginSeen } from "./activity";
import { fetchCharacter } from "./fetch-character";
import { appendLevelUps, detectLevelUps } from "./levelups";
import { ACCOUNT_WIDE_KEY, applyRecord, fetchOrder, isTwink, mergeRoster, parseRoster, type GuildRosterEntry } from "./roster";
import { buildSnapshot } from "./snapshot";
import { saveStatsSnapshot, type StatValues } from "../stats/snapshot";

export interface CollectDeps {
  client: BlizzardClient;
  store: JsonStore;
  config: Config;
  now: () => Date;
}

export interface GuildRunReport {
  at: string;
  fetched: number;
  failed: number;
  skipped: number;
  levelUps: number;
  /** Newly recorded logins (character and week hour). */
  logins: number;
  durationMs: number;
  errors: { id: number; message: string }[];
  /** Secondary guilds that could not be fetched; their members stayed unchanged. */
  guildErrors: { slug: string; message: string }[];
  /** Scoring week (Saturday) whose stats snapshot this run wrote. */
  statsWeek: string;
  /** Weeks without a run whose stats snapshot was filled with the last known one. */
  statsFilled: string[];
  /** Duration per phase in milliseconds: guild fetch, characters, writes at the end. */
  phases: { guild: number; characters: number; write: number };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw API response */
type RawGuild = any;

/** Guild data and roster of one guild; throws on anything but 200. */
async function fetchGuild(client: BlizzardClient, slug: string): Promise<{ guild: RawGuild; roster: unknown }> {
  const guildPath = `/data/wow/guild/${encodeURIComponent(slug)}`;
  const guildRes = await client.get(guildPath, "profile");
  if (guildRes.status !== 200) throw new BlizzardError(`Guild ${slug} not available: HTTP ${guildRes.status}`);
  const rosterRes = await client.get(`${guildPath}/roster`, "profile");
  if (rosterRes.status !== 200) throw new BlizzardError(`Roster ${slug} not available: HTTP ${rosterRes.status}`);
  return { guild: guildRes.data, roster: rosterRes.data };
}

function guildInfo(slug: string, g: RawGuild, members: MemberSummary[], main: boolean): GuildInfo {
  return {
    slug,
    id: g.id,
    name: g.name,
    faction: g.faction?.type ?? "",
    memberCount: g.member_count ?? members.filter((m) => !m.former && m.guildSlug === slug).length,
    rulesetName: g.ruleset?.name ?? "",
    main,
  };
}

export async function runGuildCollection(deps: CollectDeps): Promise<GuildRunReport> {
  const { client, store, config } = deps;
  const started = Date.now();
  // New characters only until shortly before the budget ends; the rest belongs to running fetches and the final writes.
  const deadline = workEndOf(started, config.budgetMs);
  const at = deps.now().toISOString();

  // The main guild must succeed, otherwise the run fails without writing. Secondary guilds may fail.
  const [mainSlug] = config.guildSlugs;
  const fetched: { slug: string; guild: RawGuild }[] = [];
  const roster: GuildRosterEntry[] = [];
  const guildErrors: GuildRunReport["guildErrors"] = [];
  for (const slug of config.guildSlugs) {
    try {
      const res = await fetchGuild(client, slug);
      fetched.push({ slug, guild: res.guild });
      roster.push(...parseRoster(res.roster).map((e) => ({ ...e, guildSlug: slug })));
    } catch (error) {
      if (slug === mainSlug) throw error;
      guildErrors.push({ slug, message: errorMessage(error) });
    }
  }
  const unavailable = guildErrors.map((e) => e.slug);

  const tGuild = Date.now() - started;
  const tCharacters = Date.now();
  const [prev, characterIndex, accountWideStored] = await Promise.all([
    store.get<GuildRecord>("guild"),
    store.get<CharacterIndex>(CHARACTER_INDEX_KEY),
    store.get<AchievementAccountWide>(ACCOUNT_WIDE_KEY),
  ]);
  const accountWide = accountWideStored ?? {};
  // What collect-static needs from the characters; replaces reading all records there.
  const nextIndex: CharacterIndex = { ...characterIndex };
  // Baseline only for members fetched successfully at least once: the roster level of a new member can lag
  // behind the real level and would otherwise invent level-ups from before they joined.
  const prevLevels = new Map(
    (prev?.members ?? []).filter((m) => !m.former && m.lastFetchedAt !== null).map((m) => [m.id, m.level]),
  );
  const members = mergeRoster(prev?.members ?? [], roster, at, mainSlug, unavailable);
  const index = new Map(members.map((m, i) => [m.id, i]));

  const seen: LoginSeen[] = [];
  const statUpdates: Record<string, StatValues> = {};
  const pool = await runPool(
    fetchOrder(members),
    async (member: MemberSummary) => {
      const previous = await store.get<CharacterRecord>(`characters/${member.id}`);
      const record = await fetchCharacter(client, { ...member }, at, previous);
      if (member.hasProfile && !record.hasProfile) {
        throw new Error("Profile no longer available, last state is kept");
      }
      await store.set(`characters/${member.id}`, record);
      nextIndex[String(member.id)] = toCharacterIndexEntry(record);
      if (record.statValues) statUpdates[String(member.id)] = record.statValues;
      const login = detectLogin(previous, record);
      if (login) seen.push(login);
      members[index.get(member.id)!] = applyRecord(member, record, at, { accountWide, twink: isTwink(member, mainSlug, config.twinkRanks) });
    },
    { concurrency: config.concurrency, deadline },
  );

  const events: LevelUpEvent[] = members
    .filter((m) => !m.former && prevLevels.has(m.id))
    .flatMap((m) => detectLevelUps(m.id, prevLevels.get(m.id), m.level, at));

  // For failed secondary guilds the entry from the previous run is kept.
  const guilds = config.guildSlugs.flatMap((slug): GuildInfo[] => {
    const hit = fetched.find((f) => f.slug === slug);
    if (hit) return [guildInfo(slug, hit.guild, members, slug === mainSlug)];
    return (prev?.guilds ?? []).filter((info) => info.slug === slug);
  });
  // Header fields from the main guild so readers from plan 1 and 2 keep working unchanged.
  const main = guilds[0];
  const guild: GuildRecord = {
    fetchedAt: at,
    id: main.id,
    name: main.name,
    faction: main.faction,
    memberCount: main.memberCount,
    rulesetName: main.rulesetName,
    members,
    guilds,
  };

  // The blobs at the end do not depend on each other and are written concurrently; this keeps the run
  // safely below the wait time of the Netlify scheduler (about 15 s).
  const tWrite = Date.now();
  const appendEvents = async (): Promise<number> => {
    if (events.length === 0) return 0;
    const log = (await store.get<LevelUpLog>("levelups")) ?? { events: [] };
    const next = appendLevelUps(log, events);
    const added = next.events.length - log.events.length;
    if (added > 0) await store.set("levelups", next);
    return added;
  };
  const [levelUps, , , logins, stats] = await Promise.all([
    appendEvents(),
    store.set("guild", guild),
    store.set(`history/${berlinDate(at)}`, buildSnapshot(members, at)),
    recordActivity(store, seen),
    saveStatsSnapshot(store, {
      at,
      active: members.filter((m) => !m.former).map((m) => m.id),
      updates: statUpdates,
    }),
    pool.completed.length > 0 ? store.set(CHARACTER_INDEX_KEY, nextIndex) : null,
  ]);
  const phases = { guild: tGuild, characters: tWrite - tCharacters, write: Date.now() - tWrite };

  return {
    at,
    fetched: pool.completed.length,
    failed: pool.failed.length,
    skipped: pool.skipped.length,
    levelUps,
    logins,
    durationMs: Date.now() - started,
    errors: pool.failed.map((f) => ({ id: f.item.id, message: errorMessage(f.error) })),
    guildErrors,
    statsWeek: stats.week,
    statsFilled: stats.filled,
    phases,
  };
}
