export interface Config {
  clientId: string;
  clientSecret: string;
  /** Gildenslugs, die erste ist die Hauptgilde. Nie leer. */
  guildSlugs: string[];
  /** Spielversion für die Namespaces der Blizzard-API, derzeit nur `forever`. */
  gameVersion: GameVersion;
  region: string;
  locale: string;
  concurrency: number;
  budgetMs: number;
}

type Env = Record<string, string | undefined>;

/** Unterstützte Spielversionen. Retail und Classic brauchen Realm-Pfade und folgen später. */
export const GAME_VERSIONS = ["forever"] as const;
export type GameVersion = (typeof GAME_VERSIONS)[number];

function gameVersion(env: Env): GameVersion {
  const raw = (env.WOW_VERSION ?? "").trim().toLowerCase();
  if (raw === "") return "forever";
  if ((GAME_VERSIONS as readonly string[]).includes(raw)) return raw as GameVersion;
  throw new Error(`Umgebungsvariable WOW_VERSION ist ungültig, erlaubt: ${GAME_VERSIONS.join(", ")}`);
}

function required(env: Env, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Umgebungsvariable ${name} fehlt`);
  return value;
}

/** Zahl aus der Umgebung; ungültige Werte brechen mit dem Variablennamen ab (der Wert selbst wird nicht ausgegeben). */
function number(env: Env, name: string, fallback: number, opts: { min: number; integer?: boolean }): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < opts.min || (opts.integer && !Number.isInteger(value))) {
    throw new Error(`Umgebungsvariable ${name} ist ungültig`);
  }
  return value;
}

/** `GUILD_SLUGS` (kommagetrennt) vor `GUILD_SLUG`; eines von beiden ist Pflicht. */
function guildSlugs(env: Env): string[] {
  if (env.GUILD_SLUGS === undefined || env.GUILD_SLUGS === "") {
    if (env.GUILD_SLUG) return [env.GUILD_SLUG];
    throw new Error("Umgebungsvariable GUILD_SLUGS fehlt");
  }
  const slugs = [...new Set(env.GUILD_SLUGS.split(",").map((s) => s.trim()).filter((s) => s !== ""))];
  if (slugs.length === 0) throw new Error("Umgebungsvariable GUILD_SLUGS ist ungültig");
  return slugs;
}

export function loadConfig(env: Env): Config {
  return {
    clientId: required(env, "BNET_CLIENT_ID"),
    clientSecret: required(env, "BNET_CLIENT_SECRET"),
    guildSlugs: guildSlugs(env),
    gameVersion: gameVersion(env),
    region: env.BNET_REGION || "eu",
    locale: env.BNET_LOCALE || "de_DE",
    concurrency: number(env, "COLLECT_CONCURRENCY", 10, { min: 1, integer: true }),
    budgetMs: number(env, "COLLECT_BUDGET_MS", 12000, { min: 0 }),
  };
}
