// Hilfen für Aktivität, Titel, Zeitung und Wrapped.

import { newspaperName as zeitungsNameFuer } from "../../../src/weekly/phrases-extras";
import { fassungIn, type Fassungen, type Sprache } from "./sprache";

const WEEKDAY_NAMES: Fassungen<string[]> = {
  de: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  schwaebisch: ["Mendig", "Dienschdig", "Mittwoch", "Donnerschdig", "Freidig", "Samschdig", "Sonndig"],
  bayrisch: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
};
const WOCHENTAGE_KURZ: Fassungen<string[]> = {
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  schwaebisch: ["Me", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  bayrisch: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
};
const MONATE: Fassungen<string[]> = {
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  schwaebisch: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "Auguscht", "September", "Oktober", "November", "Dezember"],
  bayrisch: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};
const BIS: Fassungen = { de: "bis", en: "to", schwaebisch: "bis", bayrisch: "bis" };
const WOCHE_VOM: Fassungen = { de: "Woche vom", en: "Week of", schwaebisch: "Woch vom", bayrisch: "Woch vom" };

/** Wochentage ab Montag; Hochdeutsch, wenn keine Sprache angegeben ist. */
export const WEEKDAYS = WEEKDAY_NAMES.de;
export const WEEKDAYS_SHORT = WOCHENTAGE_KURZ.de;
export const wochentage = (sprache: Sprache = "de"): string[] => fassungIn(WEEKDAY_NAMES, sprache);
export const wochentageKurz = (sprache: Sprache = "de"): string[] => fassungIn(WOCHENTAGE_KURZ, sprache);

/** `2026-11-09` als `09.11.2026`. */
export function formatPlainDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

/** `2026-11-09` als `09.11.`. */
export function formatPlainDayMonth(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}.${m}.`;
}

/** Zeitraum `09.11. bis 15.11.2026`. */
export function formatRange(from: string, to: string, sprache: Sprache = "de"): string {
  return `${formatPlainDayMonth(from)} ${fassungIn(BIS, sprache)} ${formatPlainDate(to)}`;
}

/** Gewertete Woche kurz: `Woche vom 15.11. bis 21.11.`. */
export function weekLabel(from: string, to: string, sprache: Sprache = "de"): string {
  return `${fassungIn(WOCHE_VOM, sprache)} ${formatPlainDayMonth(from)} ${fassungIn(BIS, sprache)} ${formatPlainDayMonth(to)}`;
}

/** Gewertete Woche mit Jahr: `Woche vom 15.11. bis 21.11.2026`. */
export function weekRangeLabel(from: string, to: string, sprache: Sprache = "de"): string {
  return `${fassungIn(WOCHE_VOM, sprache)} ${formatRange(from, to, sprache)}`;
}

/** Wann Titel und Zeitung erscheinen; gewertet wird Sonntag bis Samstag. */
export const ERSCHEINT_FASSUNGEN: Fassungen = {
  de: "jeden Sonntag ab 10 Uhr",
  en: "every Sunday from 10:00",
  schwaebisch: "jeden Sonndig ab 10 Uhr",
  bayrisch: "jeden Sonntag ab 10 Uhr",
};
export const ERSCHEINT = ERSCHEINT_FASSUNGEN.de;

/** Name der Wochenzeitung: WEBSITE_NEWSPAPER für alle Sprachen, sonst der Standardname der Sprache. */
export function newspaperName(sprache: Sprache = "de"): string {
  return zeitungsNameFuer(sprache, import.meta.env.WEBSITE_NEWSPAPER);
}

/** `2026-11` als `November 2026`. */
export function monthLabel(month: string, sprache: Sprache = "de"): string {
  const [y, m] = month.split("-").map(Number);
  return `${fassungIn(MONATE, sprache)[m - 1]} ${y}`;
}

/** Stunde als Zeitfenster, z. B. `20 bis 21 Uhr`, auf Englisch `20:00 to 21:00`. */
export function hourRange(hour: number, sprache: Sprache = "de"): string {
  const next = (hour + 1) % 24;
  if (sprache === "en") return `${hour}:00 to ${next}:00`;
  return `${hour} ${fassungIn(BIS, sprache)} ${next} Uhr`;
}

/** Farbstufe 0 bis 5 relativ zum Höchstwert; 0 nur für leere Zellen. */
export function heatLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(1, Math.ceil((value / max) * 5));
}

/** Größter Wert und seine Position; bei Gleichstand die erste. null, wenn alles 0 ist. */
export function peak(values: number[]): { index: number; value: number } | null {
  const value = Math.max(0, ...values);
  return value > 0 ? { index: values.indexOf(value), value } : null;
}

/** Summen je Wochentag aus 168 Wochenstunden. */
export function dayTotals(cells: number[]): number[] {
  return WEEKDAYS.map((_, d) => cells.slice(d * 24, d * 24 + 24).reduce((a, b) => a + b, 0));
}

/** Zerlegt einen Text so, dass jedes Vorkommen eines Namens ein eigener Teil mit dessen Schlüssel wird. Längere Namen zuerst. */
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
