import type { MemberRow, MemberValue } from "../../../src/api/types";

/** Ein Eintrag für die Mitgliederliste: nur die ID oder [ID, Wert] wie aus der API. */
export type MemberEntry = number | MemberValue;

/** Eine Zeile der Mitgliederliste, aus Eintrag und Mitgliederdaten von `/api/guild` zusammengesetzt. */
export interface MemberListRow {
  id: number;
  name: string;
  slug: string;
  classId: number;
  className: string;
  raceName: string;
  /** null, wenn der Charakter nicht mehr in der Mitgliederliste steht. */
  level: number | null;
  guildSlug: string;
  former: boolean;
  /** false für Charaktere, die `/api/guild` nicht kennt; sie werden ohne Link gezeigt. */
  known: boolean;
  /** Wert, um den es bei der Karte geht; null ohne Wertspalte. */
  value: number | null;
}

export type MemberListSortKey = "name" | "className" | "raceName" | "level" | "value";

/** Ab so vielen Einträgen gibt es eine Suche nach Namen. */
export const MEMBER_SEARCH_FROM = 15;

/**
 * Setzt die Einträge mit den Mitgliederdaten zusammen. Unbekannte IDs bleiben als Platzhalter "Unbekannt" drin,
 * damit die Liste zur Zahl auf der Karte passt; doppelte IDs zählen einmal.
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
 * Filtert nach Gilde (null: alle, Unbekannte nur dann) und nach Namensteil, ohne Groß- und Kleinschreibung.
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

/** Sortiert nach Spalte; fehlende Werte stehen immer unten, Gleichstand nach Name. */
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

/** Erste Sortierung: Zahlen absteigend, Texte aufsteigend. */
export function defaultDirection(key: MemberListSortKey): "asc" | "desc" {
  return key === "level" || key === "value" ? "desc" : "asc";
}

/** IDs der aktiven Mitglieder ab einem Mindestlevel, etwa alle auf Level 60; Gilde null für alle. */
export function activeMemberIds(members: readonly MemberRow[], guildSlug: string | null, minLevel = 1): number[] {
  return members
    .filter((m) => !m.former && (guildSlug === null || m.guildSlug === guildSlug) && m.level >= minLevel)
    .map((m) => m.id);
}
