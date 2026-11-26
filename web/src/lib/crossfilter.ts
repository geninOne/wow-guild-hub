import type { MemberRow } from "../../../src/api/types";
import { LEVEL_BANDS } from "./members";

/**
 * Gemeinsame Auswahl des Reiters Allgemein: Volk, Klasse und Levelstufe, jeweils leer (null) oder ein Wert.
 * `bandIndex` ist der Index in `LEVEL_BANDS`.
 */
export interface Selection {
  raceId: number | null;
  classId: number | null;
  bandIndex: number | null;
}

/** Eine Achse der Auswahl; jedes Diagramm gehört zu genau einer. */
export type Axis = "race" | "class" | "level";

export const EMPTY_SELECTION: Selection = { raceId: null, classId: null, bandIndex: null };

const KEY: Record<Axis, keyof Selection> = { race: "raceId", class: "classId", level: "bandIndex" };

/** Passt das Mitglied zur Auswahl? Mit `skip` zählt diese eine Achse nicht mit (für das Diagramm dieser Achse). */
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
  /** Grundlage der Völkertorte: gefiltert nach Klasse und Level. */
  forRaces: MemberRow[];
  /** Grundlage der Klassenbalken: gefiltert nach Volk und Level. */
  forClasses: MemberRow[];
  /** Grundlage der Levelsäulen: gefiltert nach Volk und Klasse. */
  forLevels: MemberRow[];
  /** Alle drei Auswahlen zusammen: Grundlage der Kennzahlen und der Mitgliederliste. */
  selected: MemberRow[];
}

/**
 * Kreuzfilter: Jedes Diagramm zeigt die aktiven Mitglieder, gefiltert nach den Auswahlen der beiden anderen.
 * Seine eigene Auswahl hebt es nur hervor. Ehemalige fallen immer heraus.
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

/** Wählt einen Wert auf einer Achse; derselbe Wert noch einmal hebt die Wahl auf, null ebenso. */
export function toggleSelection(s: Selection, axis: Axis, value: number | null): Selection {
  const key = KEY[axis];
  return { ...s, [key]: value === null || s[key] === value ? null : value };
}

export function isEmptySelection(s: Selection): boolean {
  return s.raceId === null && s.classId === null && s.bandIndex === null;
}

/**
 * Hängt den gewählten Eintrag mit Anzahl 0 an, wenn ihn die Filter der anderen Achsen gerade ausblenden,
 * damit er sichtbar und per Klick abwählbar bleibt.
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

/** Kennzahlen einer Menge: Anzahl, Durchschnittslevel, Anzahl auf Level 60, Anzahl verschiedener Klassen. */
export function memberFigures(rows: readonly MemberRow[]): MemberFigures {
  return {
    members: rows.length,
    average: rows.length === 0 ? 0 : rows.reduce((sum, m) => sum + m.level, 0) / rows.length,
    capped: rows.filter((m) => m.level >= 60).length,
    classes: new Set(rows.map((m) => m.classId)).size,
  };
}
