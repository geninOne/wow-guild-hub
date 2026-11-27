import type { GuildRef, GuildView, MemberRow } from "../../../src/api/types";

export interface MemberFilter {
  text: string;
  classId: number | null;
  rank: number | null;
  /** The rank applies only in this guild (rank names differ per guild); missing or null: in every guild. */
  rankGuildSlug?: string | null;
  /** Slug of the guild, null for all guilds. */
  guildSlug: string | null;
  showFormer: boolean;
}

export type SortKey = "name" | "guildName" | "className" | "level" | "itemLevel" | "mainSpecName" | "rank";

export function filterMembers(rows: MemberRow[], f: MemberFilter): MemberRow[] {
  const text = f.text.trim().toLowerCase();
  return rows.filter((r) => {
    if (r.former && !f.showFormer) return false;
    if (f.classId !== null && r.classId !== f.classId) return false;
    if (f.rank !== null && r.rank !== f.rank) return false;
    if (f.rank !== null && f.rankGuildSlug && r.guildSlug !== f.rankGuildSlug) return false;
    if (f.guildSlug !== null && r.guildSlug !== f.guildSlug) return false;
    if (text) {
      const hit = r.name.toLowerCase().includes(text) || (r.surname ?? "").toLowerCase().includes(text);
      if (!hit) return false;
    }
    return true;
  });
}

export interface RankOption {
  /** Value for the select field: `3` (any guild) or `bärenklaue:3` (only this guild). */
  value: string;
  label: string;
}

export interface RankGroup {
  /** Guild name as group title, null for a plain list. */
  label: string | null;
  options: RankOption[];
}

/**
 * Options for the rank filter. A plain list for a selected guild, and for "Alle" when every rank number has
 * the same name in all guilds. Grouped by guild when the same number has different names per guild.
 */
export function rankGroups(ranks: GuildView["ranks"], guilds: GuildRef[], guildSlug: string | null): RankGroup[] {
  const relevant = guildSlug === null ? ranks : ranks.filter((r) => r.guildSlug === guildSlug);
  const nameByRank = new Map<number, Set<string>>();
  for (const r of relevant) nameByRank.set(r.rank, (nameByRank.get(r.rank) ?? new Set()).add(r.name));
  const differs = [...nameByRank.values()].some((names) => names.size > 1);

  if (!differs) {
    return [
      {
        label: null,
        options: [...nameByRank]
          .sort(([a], [b]) => a - b)
          .map(([rank, names]) => ({ value: String(rank), label: [...names][0] })),
      },
    ];
  }
  return guilds
    .map((g) => ({
      label: g.name,
      options: relevant
        .filter((r) => r.guildSlug === g.slug)
        .sort((a, b) => a.rank - b.rank)
        .map((r) => ({ value: `${g.slug}:${r.rank}`, label: r.name })),
    }))
    .filter((g) => g.options.length > 0);
}

/** Turns a select value from `rankGroups` back into rank and optional guild. */
export function parseRankValue(value: string): { rank: number | null; rankGuildSlug: string | null } {
  if (value === "") return { rank: null, rankGuildSlug: null };
  const at = value.lastIndexOf(":");
  if (at < 0) return { rank: Number(value), rankGuildSlug: null };
  return { rank: Number(value.slice(at + 1)), rankGuildSlug: value.slice(0, at) };
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "de", { sensitivity: "base" });
}

export function sortMembers(rows: MemberRow[], key: SortKey, dir: "asc" | "desc"): MemberRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x === null && y !== null) return 1;
    if (y === null && x !== null) return -1;
    if (x !== null && y !== null && x !== y) {
      const c = typeof x === "number" && typeof y === "number" ? x - y : compareText(String(x), String(y));
      if (c !== 0) return c * sign;
    }
    return compareText(a.name, b.name);
  });
}

export function classDistribution(rows: MemberRow[]): { classId: number; className: string; count: number }[] {
  const byClass = new Map<number, { classId: number; className: string; count: number }>();
  for (const r of rows) {
    if (r.former) continue;
    const entry = byClass.get(r.classId) ?? { classId: r.classId, className: r.className, count: 0 };
    entry.count += 1;
    byClass.set(r.classId, entry);
  }
  return [...byClass.values()].sort((a, b) => b.count - a.count || compareText(a.className, b.className));
}

/** Level bands of the level distribution: steps of ten, the maximum level 60 on its own. */
export const LEVEL_BANDS: { from: number; to: number }[] = [
  { from: 1, to: 9 },
  { from: 10, to: 19 },
  { from: 20, to: 29 },
  { from: 30, to: 39 },
  { from: 40, to: 49 },
  { from: 50, to: 59 },
  { from: 60, to: 60 },
];

/** Active members per level band, lowest band first, including empty bands. */
export function levelDistribution(rows: MemberRow[]): { label: string; from: number; to: number; count: number }[] {
  const active = rows.filter((r) => !r.former);
  return LEVEL_BANDS.map((b) => ({
    ...b,
    label: b.from === b.to ? `Level ${b.from}` : `${b.from} bis ${b.to}`,
    count: active.filter((r) => r.level >= b.from && r.level <= b.to).length,
  }));
}

export interface RaceFilter {
  /** Class, null for all classes. */
  classId: number | null;
  /** Level range (both ends inclusive), null for all levels. */
  band: { from: number; to: number } | null;
}

export interface RaceSlice {
  raceId: number;
  raceName: string;
  count: number;
  /** Share of all hits, 0 to 1. */
  share: number;
}

/** Active members per race by class and level range, most common race first, ties alphabetically. */
export function raceDistribution(rows: MemberRow[], filter: RaceFilter): RaceSlice[] {
  const { classId, band } = filter;
  const hits = rows.filter(
    (r) =>
      !r.former &&
      (classId === null || r.classId === classId) &&
      (band === null || (r.level >= band.from && r.level <= band.to)),
  );
  const byRace = new Map<number, RaceSlice>();
  for (const r of hits) {
    const entry = byRace.get(r.raceId) ?? { raceId: r.raceId, raceName: r.raceName, count: 0, share: 0 };
    entry.count += 1;
    byRace.set(r.raceId, entry);
  }
  return [...byRace.values()]
    .map((s) => ({ ...s, share: s.count / hits.length }))
    .sort((a, b) => b.count - a.count || compareText(a.raceName, b.raceName));
}
