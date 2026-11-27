import { parseRankNames } from "./api/config";
export interface Config {
  clientId: string;
  clientSecret: string;
  /** Guild slugs, the first one is the main guild. Never empty. */
  guildSlugs: string[];
  /** Game version for the Blizzard API namespaces, currently only `forever`. */
  gameVersion: GameVersion;
  region: string;
  locale: string;
  concurrency: number;
  budgetMs: number;
  /**
   * Alt ranks per guild slug (rank numbers), resolved from `TWINK_RANKS` and `GUILD_RANKS`. Account-wide
   * achievements are not counted for alts because they inherit them from the main character. If missing, they
   * count everywhere.
   */
  twinkRanks?: Record<string, number[]>;
}

type Env = Record<string, string | undefined>;

/** Supported game versions. Retail and Classic need realm paths and follow later. */
export const GAME_VERSIONS = ["forever"] as const;
export type GameVersion = (typeof GAME_VERSIONS)[number];

function gameVersion(env: Env): GameVersion {
  const raw = (env.WOW_VERSION ?? "").trim().toLowerCase();
  if (raw === "") return "forever";
  if ((GAME_VERSIONS as readonly string[]).includes(raw)) return raw as GameVersion;
  throw new Error(`Environment variable WOW_VERSION is invalid, allowed: ${GAME_VERSIONS.join(", ")}`);
}

function required(env: Env, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Environment variable ${name} is missing`);
  return value;
}

/** Number from the environment; invalid values abort with the variable name (the value itself is not printed). */
function number(env: Env, name: string, fallback: number, opts: { min: number; integer?: boolean }): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < opts.min || (opts.integer && !Number.isInteger(value))) {
    throw new Error(`Environment variable ${name} is invalid`);
  }
  return value;
}

/** `GUILD_SLUGS` (comma-separated) before `GUILD_SLUG`; one of the two is required. */
function guildSlugs(env: Env): string[] {
  if (env.GUILD_SLUGS === undefined || env.GUILD_SLUGS === "") {
    if (env.GUILD_SLUG) return [env.GUILD_SLUG];
    throw new Error("Environment variable GUILD_SLUGS is missing");
  }
  const slugs = [...new Set(env.GUILD_SLUGS.split(",").map((s) => s.trim()).filter((s) => s !== ""))];
  if (slugs.length === 0) throw new Error("Environment variable GUILD_SLUGS is invalid");
  return slugs;
}

/**
 * `TWINK_RANKS`: comma-separated rank names as they appear in `GUILD_RANKS` (case-insensitive).
 * Result per guild: the matching rank numbers; empty without a match.
 */
export function twinkRanks(env: Env): Record<string, number[]> {
  const wanted = new Set(
    (env.TWINK_RANKS ?? "").split(",").map((n) => n.trim().toLowerCase()).filter((n) => n !== ""),
  );
  if (wanted.size === 0) return {};
  const out: Record<string, number[]> = {};
  for (const [slug, names] of Object.entries(parseRankNames(env.GUILD_RANKS))) {
    const ranks = Object.entries(names).filter(([, name]) => wanted.has(name.toLowerCase())).map(([rank]) => Number(rank));
    if (ranks.length > 0) out[slug.normalize("NFC")] = ranks;
  }
  return out;
}

export function loadConfig(env: Env): Config {
  const twinks = twinkRanks(env);
  return {
    clientId: required(env, "BNET_CLIENT_ID"),
    clientSecret: required(env, "BNET_CLIENT_SECRET"),
    guildSlugs: guildSlugs(env),
    gameVersion: gameVersion(env),
    region: env.BNET_REGION || "eu",
    locale: env.BNET_LOCALE || "de_DE",
    concurrency: number(env, "COLLECT_CONCURRENCY", 10, { min: 1, integer: true }),
    budgetMs: number(env, "COLLECT_BUDGET_MS", 12000, { min: 0 }),
    ...(Object.keys(twinks).length > 0 ? { twinkRanks: twinks } : {}),
  };
}
