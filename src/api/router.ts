import type {
  CharacterAttributesRecord,
  CharacterRecord,
  GuildRecord,
  IconMap,
  InstanceAchievementsRecord,
  NamedList,
  RecipeDetails,
  RecipeNames,
  ReputationFactionsRecord,
  TalentTreeRecord,
} from "../model";
import type { JsonStore } from "../store";
import { isMonth, isGuildWeek, isWeekId } from "../lib/time";
import { SERVER_START } from "../server-start";
import { loadActivityView } from "./activity-view";
import { loadNewspaperArchive, loadNewspaperView } from "./newspaper-view";
import { buildCharacterView, findMember } from "./character-view";
import { characterTitles, latestWeekly } from "./fun-common";
import { EXTRA_DUNGEONS } from "../instance-images";
import { buildGuildDungeons } from "./dungeons-view";
import { loadStatCardMembers, loadStatsView } from "./stats-view";
import { loadTitleRanking, loadTitlesView } from "./titles-view";
import { loadWrappedView } from "./wrapped-view";
import { SERVER_ERWEITERUNGEN } from "../erweiterungen";
import type { ApiKontext, ServerErweiterung } from "../erweiterungen/typen";
import { RANK_NAMES, TALENT_FIXES } from "./config";
import { buildGuildView, guildRefs } from "./guild-view";
import { json } from "./http";
import { buildProfessionRecipesView, buildProfessionsView } from "./professions-view";
import { layoutTalentTree } from "./talent-layout";
import type { TalentView } from "./types";

const NO_DATA = { error: "No data collected yet" };
const NOT_FOUND = { error: "Not found" };

/**
 * German route segments and query parameters of versions up to 2.x. They keep working as aliases, so bookmarks,
 * cached pages and other clients do not break; the site itself uses the English names.
 */
const LEGACY_RESOURCES: Record<string, string> = { zeitung: "newspaper" };
const LEGACY_KEYS: Record<string, Record<string, string>> = {
  newspaper: { archiv: "archive" },
  stats: { woche: "week", monat: "month" },
};
const LEGACY_PARAMS: Record<string, string> = { guild: "gilde", week: "woche", title: "titel", card: "karte" };

/** Query parameter by its English name, or by its legacy German name. */
function param(query: URLSearchParams, name: string): string | null {
  return query.get(name) ?? (Object.hasOwn(LEGACY_PARAMS, name) ? query.get(LEGACY_PARAMS[name]) : null);
}

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

async function activeRecords(store: JsonStore, guild: GuildRecord): Promise<CharacterRecord[]> {
  const members = guild.members.filter((m) => !m.former && m.hasProfile);
  const records = await Promise.all(members.map((m) => store.get<CharacterRecord>(`characters/${m.id}`)));
  return records.filter((r): r is CharacterRecord => r !== null);
}

async function route(
  path: string,
  query: URLSearchParams,
  store: JsonStore,
  now: () => Date,
  options: ApiOptions,
  erweiterungen: readonly ServerErweiterung[],
): Promise<Response> {
  const parts = path.split("/").filter(Boolean); // ["api", ...]
  if (parts[0] !== "api") return json(NOT_FOUND, 404, "none");
  if (parts[1] !== undefined && Object.hasOwn(LEGACY_RESOURCES, parts[1])) parts[1] = LEGACY_RESOURCES[parts[1]];
  const legacyKeys = parts[1] !== undefined && Object.hasOwn(LEGACY_KEYS, parts[1]) ? LEGACY_KEYS[parts[1]] : undefined;
  if (legacyKeys && parts[2] !== undefined && Object.hasOwn(legacyKeys, parts[2])) parts[2] = legacyKeys[parts[2]];
  const [, resource, key] = parts;

  if (resource === "talents" && key && parts.length === 3) {
    const classId = safeDecode(key);
    if (classId === null) return json(NOT_FOUND, 404, "none");
    const [index, icons] = await Promise.all([
      store.get<Record<string, number>>("static/talent-trees/index"),
      store.get<IconMap>("static/spell-icons"),
    ]);
    const treeId = index && Object.hasOwn(index, classId) ? index[classId] : undefined;
    const tree = treeId === undefined ? null : await store.get<TalentTreeRecord>(`static/talent-trees/${treeId}`);
    if (!tree) return json(NOT_FOUND, 404, "none");
    const spellIcons: Record<string, string | null> = {};
    for (const spec of tree.specs) {
      for (const node of spec.nodes) {
        spellIcons[String(node.spellId)] = icons?.[String(node.spellId)] ?? null;
      }
    }
    const view: TalentView = { layout: layoutTalentTree(tree, TALENT_FIXES), icons: spellIcons };
    return json(view, 200, "static");
  }

  const isKnown =
    (resource === "guild" && parts.length === 2) ||
    (resource === "characters" && key && parts.length === 3) ||
    (resource === "professions" && (parts.length === 2 || parts.length === 3)) ||
    (resource === "activity" && parts.length === 2) ||
    (resource === "titles" && parts.length === 2) ||
    (resource === "dungeons" && parts.length === 2) ||
    (resource === "stats" && (parts.length === 2 || ((key === "week" || key === "month") && parts.length <= 4))) ||
    (resource === "newspaper" && (parts.length === 2 || parts.length === 3)) ||
    (resource === "wrapped" && key && (parts.length === 3 || parts.length === 4));
  if (!isKnown) return json(NOT_FOUND, 404, "none");

  const guild = await store.get<GuildRecord>("guild");
  if (!guild) return json(NO_DATA, 503, "none");

  switch (resource) {
    case "activity":
      return json(await loadActivityView(store, guild, now().toISOString()), 200, "live");
    case "titles": {
      const titleId = param(query, "title");
      if (titleId !== null) {
        const week = param(query, "week");
        if (week === null || !isWeekId(week)) return json(NOT_FOUND, 404, "none");
        const ranking = await loadTitleRanking(store, titleId, week);
        return ranking ? json(ranking, 200, "live") : json(NOT_FOUND, 404, "none");
      }
      return json(await loadTitlesView(store, guild), 200, "live");
    }
    case "stats": {
      // `kind` keeps its German values: they are part of the API response (`StatsView.kind`).
      const kind = key === "week" ? "woche" : key === "month" ? "monat" : "gesamt";
      const id = parts[3] ?? null;
      if (id !== null && !(kind === "woche" ? isGuildWeek(id) : isMonth(id))) return json(NOT_FOUND, 404, "none");
      const serverStart = options.serverStart === undefined ? SERVER_START : options.serverStart;
      const card = param(query, "card");
      if (card !== null) {
        const members = await loadStatCardMembers(store, kind, id, serverStart, card);
        return members ? json(members, 200, "live") : json(NOT_FOUND, 404, "none");
      }
      const view = await loadStatsView(store, guild, kind, id, serverStart, param(query, "guild"));
      return view ? json(view, 200, "live") : json(NOT_FOUND, 404, "none");
    }
    case "dungeons": {
      const slug = param(query, "guild");
      if (slug !== null && !guildRefs(guild).some((g) => g.slug === slug)) return json(NOT_FOUND, 404, "none");
      const [records, defs, images] = await Promise.all([
        activeRecords(store, guild),
        store.get<InstanceAchievementsRecord>("static/instance-achievements"),
        store.get<IconMap>("static/instance-images"),
      ]);
      return json(buildGuildDungeons(guild, records, defs, images, slug, EXTRA_DUNGEONS), 200, "live");
    }
    case "newspaper": {
      if (key === "archive") return json(await loadNewspaperArchive(store), 200, "live");
      const week = key ? safeDecode(key) : null;
      if (key && (week === null || !isWeekId(week))) return json(NOT_FOUND, 404, "none");
      const view = await loadNewspaperView(store, guild, week);
      return view ? json(view, 200, "live") : json(NOT_FOUND, 404, "none");
    }
    case "wrapped": {
      const decoded = safeDecode(key);
      const member = decoded === null ? undefined : findMember(guild, decoded);
      const month = parts[3] ?? null;
      if (!member || (month !== null && !isMonth(month))) return json(NOT_FOUND, 404, "none");
      return json(await loadWrappedView(store, guild, member, month, now().toISOString(), options.serverStart), 200, "live");
    }
    case "guild": {
      const [classes, races] = await Promise.all([
        store.get<NamedList>("static/classes"),
        store.get<NamedList>("static/races"),
      ]);
      return json(buildGuildView(guild, classes, races, RANK_NAMES), 200, "live");
    }
    case "characters": {
      const decoded = safeDecode(key);
      const member = decoded === null ? undefined : findMember(guild, decoded);
      if (!member) return json(NOT_FOUND, 404, "none");
      const extras = Promise.all(erweiterungen.map(async (e) => [e.id, await e.charakter?.({ store, guild, member })] as const));
      const [record, classes, races, itemIcons, recipeNames, recipeDetails, instanceDefs, reputationFactions, instanceImages, weekly, extraData, attributes, itemLevels] =
        await Promise.all([
        store.get<CharacterRecord>(`characters/${member.id}`),
        store.get<NamedList>("static/classes"),
        store.get<NamedList>("static/races"),
        store.get<IconMap>("static/item-icons"),
        store.get<RecipeNames>("static/recipe-names"),
        store.get<RecipeDetails>("static/recipes"),
        store.get<InstanceAchievementsRecord>("static/instance-achievements"),
        store.get<ReputationFactionsRecord>("static/reputation-factions"),
        store.get<IconMap>("static/instance-images"),
        latestWeekly(store),
        extras,
        store.get<CharacterAttributesRecord>(`attributes/${member.id}`),
        store.get<Record<string, number | null>>("static/item-levels"),
      ]);
      const view = buildCharacterView({
        member, record, guild, classes, races, itemIcons, itemLevels, rankNames: RANK_NAMES, recipeNames, recipeDetails, instanceDefs,
        reputationFactions, instanceImages, attributes,
      });
      if (!view) return json(NOT_FOUND, 404, "none");
      view.titles = weekly ? characterTitles(weekly, member.id) : [];
      const provided = extraData.filter(([, d]) => d !== null && d !== undefined);
      if (provided.length > 0) view.erweiterungen = Object.fromEntries(provided);
      const response = json(view, 200, "live");
      // Extensions with their own cache tag can have the character pages refreshed after a change.
      const tags = [...new Set(erweiterungen.flatMap((e) => e.charakterCacheTags ?? []))];
      if (tags.length > 0) response.headers.set("Netlify-Cache-Tag", tags.join(","));
      return response;
    }
    default: {
      // professions
      if (key) {
        const slug = safeDecode(key);
        if (slug === null) return json(NOT_FOUND, 404, "none");
        const [records, recipeNames, recipeDetails, itemIcons] = await Promise.all([
          activeRecords(store, guild),
          store.get<RecipeNames>("static/recipe-names"),
          store.get<RecipeDetails>("static/recipes"),
          store.get<IconMap>("static/item-icons"),
        ]);
        const view = buildProfessionRecipesView(guild.members, records, slug, { recipeNames, recipeDetails, itemIcons });
        return view ? json(view, 200, "live") : json(NOT_FOUND, 404, "none");
      }
      const [records, classes, icons] = await Promise.all([
        activeRecords(store, guild),
        store.get<NamedList>("static/classes"),
        store.get<IconMap>("static/profession-icons"),
      ]);
      const view = buildProfessionsView(guild.members, records, { guilds: guildRefs(guild), classes, icons });
      return json(view, 200, "live");
    }
  }
}

export interface ApiOptions {
  /** Day of the server start; defaults to `config/serverstart.json`, null turns the rule off. */
  serverStart?: string | null;
  /** Environment variables for extensions (on Netlify `process.env`); none if not given. */
  env?: Readonly<Record<string, string | undefined>>;
  /** IP of the caller (on Netlify `context.ip`), for extensions. */
  clientIp?: string | null;
  /** Purges the CDN cache for cache tags (on Netlify `purgeCache`), for extensions. */
  purgeCache?: (tags: string[]) => Promise<void>;
  /** Registered extensions; defaults to `src/erweiterungen/index.ts`. */
  erweiterungen?: readonly ServerErweiterung[];
}

export async function handleApi(
  req: Request,
  store: JsonStore,
  now: () => Date = () => new Date(),
  options: ApiOptions = {},
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const erweiterungen = options.erweiterungen ?? SERVER_ERWEITERUNGEN;
  const context: ApiKontext = {
    store,
    now,
    env: options.env ?? {},
    clientIp: options.clientIp ?? null,
    ...(options.purgeCache ? { purgeCache: options.purgeCache } : {}),
  };
  try {
    // Extensions first: they may take over their own paths and methods (such as POST for an upload).
    for (const e of erweiterungen) {
      const answer = e.api ? await e.api(req, path, context) : null;
      if (answer) return answer;
    }
    if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "Method not allowed" }, 405, "none");
    return await route(path, url.searchParams, store, now, options, erweiterungen);
  } catch (error) {
    console.error(
      JSON.stringify({ job: "api", path, error: error instanceof Error ? error.message : String(error) }),
    );
    return json({ error: "Internal error" }, 500, "none");
  }
}
