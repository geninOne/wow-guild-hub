import data from "../../config/talent-korrekturen.json";
import type { TalentFix } from "./types";

/** Rank names per guild: guild slug, below it rank number to name. */
export type RankNames = Record<string, Record<string, string>>;

export const TALENT_FIXES: TalentFix[] = data.korrekturen;

/**
 * Rank names from the environment variable `GUILD_RANKS` (JSON). Per guild slug either a list whose position is
 * the rank number (0 is the highest rank), or an object mapping rank number to name. Entries with a leading
 * underscore are comments. If the variable is missing or broken, the page shows `Rang N` everywhere.
 */
export function parseRankNames(raw: string | undefined): RankNames {
  if (raw === undefined || raw.trim() === "") return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    console.warn("GUILD_RANKS is not valid JSON, rank names fall back to 'Rang N'");
    return {};
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return {};
  const out: RankNames = {};
  for (const [slug, names] of Object.entries(data)) {
    if (slug.startsWith("_") || names === null || typeof names !== "object") continue;
    const entries = Array.isArray(names) ? names.map((n, i) => [String(i), n] as const) : Object.entries(names);
    const clean = entries.filter((e): e is [string, string] => /^\d+$/.test(e[0]) && typeof e[1] === "string" && e[1].trim() !== "");
    out[slug] = Object.fromEntries(clean.map(([k, v]) => [k, v.trim().slice(0, 40)]));
  }
  return out;
}

export const RANK_NAMES: RankNames = parseRankNames(typeof process === "undefined" ? undefined : process.env.GUILD_RANKS);

function namesOf(names: RankNames, guildSlug: string): Record<string, string> {
  const wanted = guildSlug.normalize("NFC");
  const key = Object.keys(names).find((k) => k.normalize("NFC") === wanted);
  return key === undefined ? {} : names[key];
}

/** Rank name in the guild `guildSlug`; `Rang N` if the guild or the rank is missing. */
export function rankName(rank: number, guildSlug: string, names: RankNames): string {
  return namesOf(names, guildSlug)[String(rank)] ?? `Rang ${rank}`;
}

/** Rank numbers configured for the guild. */
export function configuredRanks(guildSlug: string, names: RankNames): number[] {
  return Object.keys(namesOf(names, guildSlug)).map(Number).filter((n) => !Number.isNaN(n));
}
