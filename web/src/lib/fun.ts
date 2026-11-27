// Helpers for activity, titles, newspaper and Wrapped.

import { newspaperName as defaultNewspaperName } from "../../../src/weekly/phrases-extras";
import { translationIn, type Translations, type Language } from "./language";

const WEEKDAY_NAMES: Translations<string[]> = {
  de: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  schwaebisch: ["Mendig", "Dienschdig", "Mittwoch", "Donnerschdig", "Freidig", "Samschdig", "Sonndig"],
  bayrisch: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
};
const WEEKDAY_NAMES_SHORT: Translations<string[]> = {
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  schwaebisch: ["Me", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  bayrisch: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
};
const MONTH_NAMES: Translations<string[]> = {
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  schwaebisch: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "Auguscht", "September", "Oktober", "November", "Dezember"],
  bayrisch: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};
const TO: Translations = { de: "bis", en: "to", schwaebisch: "bis", bayrisch: "bis" };
const WEEK_OF: Translations = { de: "Woche vom", en: "Week of", schwaebisch: "Woch vom", bayrisch: "Woch vom" };

/** Weekdays from Monday; Standard German when no language is given. */
export const WEEKDAYS = WEEKDAY_NAMES.de;
export const WEEKDAYS_SHORT = WEEKDAY_NAMES_SHORT.de;
export const weekdayNames = (language: Language = "de"): string[] => translationIn(WEEKDAY_NAMES, language);
export const weekdayNamesShort = (language: Language = "de"): string[] => translationIn(WEEKDAY_NAMES_SHORT, language);

/** `2026-11-09` as `09.11.2026`. */
export function formatPlainDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

/** `2026-11-09` as `09.11.`. */
export function formatPlainDayMonth(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}.${m}.`;
}

/** Range `09.11. bis 15.11.2026`. */
export function formatRange(from: string, to: string, language: Language = "de"): string {
  return `${formatPlainDayMonth(from)} ${translationIn(TO, language)} ${formatPlainDate(to)}`;
}

/** Scored week, short: `Woche vom 15.11. bis 21.11.`. */
export function weekLabel(from: string, to: string, language: Language = "de"): string {
  return `${translationIn(WEEK_OF, language)} ${formatPlainDayMonth(from)} ${translationIn(TO, language)} ${formatPlainDayMonth(to)}`;
}

/** Scored week with year: `Woche vom 15.11. bis 21.11.2026`. */
export function weekRangeLabel(from: string, to: string, language: Language = "de"): string {
  return `${translationIn(WEEK_OF, language)} ${formatRange(from, to, language)}`;
}

/** When titles and newspaper are published; the scored week runs Sunday to Saturday. */
export const PUBLISHED_WHEN: Translations = {
  de: "jeden Sonntag ab 10 Uhr",
  en: "every Sunday from 10:00",
  schwaebisch: "jeden Sonndig ab 10 Uhr",
  bayrisch: "jeden Sonntag ab 10 Uhr",
};
export const PUBLISHED_WHEN_DE = PUBLISHED_WHEN.de;

/** Name of the weekly newspaper: WEBSITE_NEWSPAPER for all languages, otherwise the language's default name. */
export function newspaperName(language: Language = "de"): string {
  return defaultNewspaperName(language, import.meta.env.WEBSITE_NEWSPAPER);
}

/** `2026-11` as `November 2026`. */
export function monthLabel(month: string, language: Language = "de"): string {
  const [y, m] = month.split("-").map(Number);
  return `${translationIn(MONTH_NAMES, language)[m - 1]} ${y}`;
}

/** Hour as a time slot, e.g. `20 bis 21 Uhr`, in English `20:00 to 21:00`. */
export function hourRange(hour: number, language: Language = "de"): string {
  const next = (hour + 1) % 24;
  if (language === "en") return `${hour}:00 to ${next}:00`;
  return `${hour} ${translationIn(TO, language)} ${next} Uhr`;
}

/** Colour level 0 to 5 relative to the maximum; 0 only for empty cells. */
export function heatLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(1, Math.ceil((value / max) * 5));
}

/** Largest value and its position; on a tie the first. null when everything is 0. */
export function peak(values: number[]): { index: number; value: number } | null {
  const value = Math.max(0, ...values);
  return value > 0 ? { index: values.indexOf(value), value } : null;
}

/** Totals per weekday from 168 hours of the week. */
export function dayTotals(cells: number[]): number[] {
  return WEEKDAYS.map((_, d) => cells.slice(d * 24, d * 24 + 24).reduce((a, b) => a + b, 0));
}

/** Splits a text so that every occurrence of a name becomes its own part with that name's key. Longer names first. */
export function splitByNames<T extends { name: string }>(text: string, people: T[]): (string | T)[] {
  const named = [...people].filter((p) => p.name.length > 0).sort((a, b) => b.name.length - a.name.length);
  if (named.length === 0) return [text];
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${named.map((p) => escape(p.name)).join("|")})`, "g");
  return text
    .split(pattern)
    .filter((part) => part !== "")
    .map((part) => named.find((p) => p.name === part) ?? part);
}
