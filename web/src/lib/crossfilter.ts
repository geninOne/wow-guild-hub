import type { MemberRow } from "../../../src/api/types";
import { LEVEL_BANDS } from "./members";

/**
 * Shared selection of the General tab: race, class and level band, each empty (null) or one value.
 * `bandIndex` is the index into `LEVEL_BANDS`.
 */
export interface Selection {
  raceId: number | null;
  classId: number | null;
  bandIndex: number | null;
}

/** One axis of the selection; every chart belongs to exactly one. */
export type Axis = "race" | "class" | "level";

export const EMPTY_SELECTION: Selection = { raceId: null, classId: null, bandIndex: null };

const KEY: Record<Axis, keyof Selection> = { race: "raceId", class: "classId", level: "bandIndex" };

/** Does the member match the selection? With `skip` that one axis is ignored (for the chart of that axis). */
export function matchesSelection(m: MemberRow, s: Selection, skip?: Axis): boolean {
  if (skip !== "race" && s.raceId !== null && m.raceId !== s.raceId) return false;
  if (skip !== "class" && s.classId !== null && m.classId !== s.classId) return false;
  if (skip !== "level" && s.bandIndex !== null) {
    const band = LEVEL_BANDS[s.bandIndex];
    if (!band || m.level < band.from || m.level > band.to) return false;
  }
  return true;
}

export interface CrossFiltered {
  /** Basis of the race pie: filtered by class and level. */
  forRaces: MemberRow[];
  /** Basis of the class bars: filtered by race and level. */
  forClasses: MemberRow[];
  /** Basis of the level columns: filtered by race and class. */
  forLevels: MemberRow[];
  /** All three selections combined: basis of the figures and the member list. */
  selected: MemberRow[];
}

/**
 * Cross filter: every chart shows the active members, filtered by the selections of the other two.
 * It only highlights its own selection. Former members are always left out.
 */
export function crossFilter(rows: readonly MemberRow[], s: Selection): CrossFiltered {
  const active = rows.filter((m) => !m.former);
  return {
    forRaces: active.filter((m) => matchesSelection(m, s, "race")),
    forClasses: active.filter((m) => matchesSelection(m, s, "class")),
    forLevels: active.filter((m) => matchesSelection(m, s, "level")),
    selected: active.filter((m) => matchesSelection(m, s)),
  };
}

/** Selects a value on an axis; the same value again clears the selection, as does null. */
export function toggleSelection(s: Selection, axis: Axis, value: number | null): Selection {
  const key = KEY[axis];
  return { ...s, [key]: value === null || s[key] === value ? null : value };
}

export function isEmptySelection(s: Selection): boolean {
  return s.raceId === null && s.classId === null && s.bandIndex === null;
}

/**
 * Appends the selected entry with count 0 when the filters of the other axes currently hide it,
 * so it stays visible and can be deselected with a click.
 */
export function keepSelected<T extends { count: number }>(
  list: readonly T[],
  selectedId: number | null,
  idOf: (entry: T) => number,
  make: (id: number) => T | null,
): T[] {
  if (selectedId === null || list.some((e) => idOf(e) === selectedId)) return [...list];
  const missing = make(selectedId);
  return missing ? [...list, missing] : [...list];
}

export interface MemberFigures {
  members: number;
  average: number;
  capped: number;
  classes: number;
}

/** Figures of a set: count, average level, count at level 60, number of distinct classes. */
export function memberFigures(rows: readonly MemberRow[]): MemberFigures {
  return {
    members: rows.length,
    average: rows.length === 0 ? 0 : rows.reduce((sum, m) => sum + m.level, 0) / rows.length,
    capped: rows.filter((m) => m.level >= 60).length,
    classes: new Set(rows.map((m) => m.classId)).size,
  };
}
