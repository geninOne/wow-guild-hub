import data from "../../config/talent-korrekturen.json";
import type { TalentFix } from "./types";

/** Rangnamen je Gilde: Gilden-Slug, darunter Rangnummer auf Name. */
export type RankNames = Record<string, Record<string, string>>;

export const TALENT_FIXES: TalentFix[] = data.korrekturen;

/**
 * Rangnamen aus der Umgebungsvariable `GUILD_RANKS` (JSON). Je Gilden-Slug entweder eine Liste, deren Position
 * die Rangnummer ist (0 ist der höchste Rang), oder ein Objekt Rangnummer auf Name. Einträge mit Unterstrich
 * vorn sind Kommentare. Fehlt die Variable oder ist sie kaputt, zeigt die Seite überall `Rang N`.
 */
export function parseRankNames(raw: string | undefined): RankNames {
  if (raw === undefined || raw.trim() === "") return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    console.warn("GUILD_RANKS ist kein gültiges JSON, Rangnamen fallen auf 'Rang N' zurück");
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

/** Rangname in der Gilde `guildSlug`; fehlt Gilde oder Rang, `Rang N`. */
export function rankName(rank: number, guildSlug: string, names: RankNames): string {
  return namesOf(names, guildSlug)[String(rank)] ?? `Rang ${rank}`;
}

/** Rangnummern, die für die Gilde in der Konfiguration stehen. */
export function configuredRanks(guildSlug: string, names: RankNames): number[] {
  return Object.keys(namesOf(names, guildSlug)).map(Number).filter((n) => !Number.isNaN(n));
}
