import type { MemberRow, MemberValue } from "../../../src/api/types";

/** An entry for the member list: just the ID or [ID, value] as from the API. */
export type MemberEntry = number | MemberValue;

/** A row of the member list, combined from the entry and the member data from `/api/guild`. */
export interface MemberListRow {
  id: number;
  name: string;
  slug: string;
  classId: number;
  className: string;
  raceName: string;
  /** null when the character is no longer on the member list. */
  level: number | null;
  guildSlug: string;
  former: boolean;
  /** false for characters unknown to `/api/guild`; they are shown without a link. */
  known: boolean;
  /** The value the card is about; null without a value column. */
  value: number | null;
}

export type MemberListSortKey = "name" | "className" | "raceName" | "level" | "value";

/** From this many entries on there is a name search. */
export const MEMBER_SEARCH_FROM = 15;

/**
 * Combines the entries with the member data. Unknown IDs stay in as an "Unbekannt" placeholder so the list
 * matches the number on the card; duplicate IDs count once.
 */
export function resolveMembers(entries: readonly MemberEntry[], members: readonly MemberRow[], unknownName = "Unbekannt"): MemberListRow[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const seen = new Set<number>();
  const rows: MemberListRow[] = [];
  for (const entry of entries) {
    const [id, value] = typeof entry === "number" ? [entry, null] : entry;
    if (seen.has(id)) continue;
    seen.add(id);
    const m = byId.get(id);
    rows.push(
      m
        ? {
            id, name: m.name, slug: m.slug, classId: m.classId, className: m.className, raceName: m.raceName, level: m.level,
            guildSlug: m.guildSlug, former: m.former, known: true, value,
          }
        : {
            id, name: unknownName, slug: String(id), classId: 0, className: "", raceName: "", level: null, guildSlug: "",
            former: true, known: false, value,
          },
    );
  }
  return rows;
}

/**
 * Filters by guild (null: all, unknown ones only then) and by part of the name, case-insensitive.
 */
export function filterMemberList(rows: readonly MemberListRow[], guildSlug: string | null, text: string): MemberListRow[] {
  const needle = text.trim().toLocaleLowerCase("de");
  return rows.filter(
    (r) =>
      (guildSlug === null || r.guildSlug === guildSlug) &&
      (needle === "" || r.name.toLocaleLowerCase("de").includes(needle)),
  );
}

const compareText = (a: string, b: string) => a.localeCompare(b, "de", { sensitivity: "base" });

/** Sorts by column; missing values always come last, ties by name. */
export function sortMemberList(rows: readonly MemberListRow[], key: MemberListSortKey, dir: "asc" | "desc"): MemberListRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    const xMissing = x === null || x === "";
    const yMissing = y === null || y === "";
    if (xMissing !== yMissing) return xMissing ? 1 : -1;
    if (!xMissing && !yMissing && x !== y) {
      const c = typeof x === "number" && typeof y === "number" ? x - y : compareText(String(x), String(y));
      if (c !== 0) return c * sign;
    }
    return compareText(a.name, b.name) || a.id - b.id;
  });
}

/** Initial sort direction: numbers descending, texts ascending. */
export function defaultDirection(key: MemberListSortKey): "asc" | "desc" {
  return key === "level" || key === "value" ? "desc" : "asc";
}

/** IDs of the active members from a minimum level on, e.g. all at level 60; guild null for all. */
export function activeMemberIds(members: readonly MemberRow[], guildSlug: string | null, minLevel = 1): number[] {
  return members
    .filter((m) => !m.former && (guildSlug === null || m.guildSlug === guildSlug) && m.level >= minLevel)
    .map((m) => m.id);
}
