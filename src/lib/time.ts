// Zeitrechnung in Europe/Berlin. Bewusst ohne Importe und nur mit löschbarer TypeScript-Syntax,
// damit auch die Skripte unter scripts/ die Datei direkt laden können.

const berlin = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });
const berlinHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" });

const DAY_MS = 24 * 60 * 60 * 1000;

/** Kalendertag in Europe/Berlin als YYYY-MM-DD. */
export function berlinDate(iso: string): string {
  return berlin.format(new Date(iso));
}

/** Kalendertag (als UTC-Mitternacht) in Millisekunden. */
function dayMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromDayMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Kalendertag plus `days` Tage (auch negativ). */
export function addDays(date: string, days: number): string {
  return fromDayMs(dayMs(date) + days * DAY_MS);
}

/** Wochentag eines Kalendertags, Montag 0 bis Sonntag 6. */
export function weekdayOf(date: string): number {
  return (new Date(dayMs(date)).getUTCDay() + 6) % 7;
}

/** ISO-Woche eines Kalendertags, z. B. `2026-W47`. Die Woche gehört zu dem Jahr, in dem ihr Donnerstag liegt. */
export function isoWeek(date: string): string {
  const thursday = dayMs(date) + (3 - weekdayOf(date)) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * DAY_MS)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Montag und Sonntag einer ISO-Woche als Kalendertage. */
export function weekRange(week: string): { from: string; to: string } {
  const match = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!match) throw new Error(`Ungültige Woche: ${week}`);
  const jan4 = `${match[1]}-01-04`;
  const firstMonday = addDays(jan4, -weekdayOf(jan4));
  const from = addDays(firstMonday, (Number(match[2]) - 1) * 7);
  return { from, to: addDays(from, 6) };
}

/** Prüft die Schreibweise `JJJJ-Www` und dass es die Woche gibt. */
export function isWeek(value: string): boolean {
  if (!/^\d{4}-W\d{2}$/.test(value)) return false;
  return isoWeek(weekRange(value).from) === value;
}

/** Woche plus `weeks` Wochen (auch negativ). */
export function shiftWeek(week: string, weeks: number): string {
  return isoWeek(addDays(weekRange(week).from, weeks * 7));
}

/**
 * Wertungswoche für Titel und Zeitung: Sonntag 0 Uhr bis Samstag 24 Uhr Berliner Zeit.
 * Kennung ist ihr Samstag als Kalendertag, z. B. `2026-11-21` für den 15. bis 21.11.2026.
 */
export function guildWeek(date: string): string {
  return addDays(date, (5 - weekdayOf(date) + 7) % 7);
}

/** Sonntag und Samstag einer Wertungswoche. */
export function guildRange(week: string): { from: string; to: string } {
  return { from: addDays(week, -6), to: week };
}

/** Prüft, ob der Wert ein gültiger Samstag der Form `JJJJ-MM-TT` ist. */
export function isGuildWeek(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || fromDayMs(dayMs(value)) !== value) return false;
  return weekdayOf(value) === 5;
}

/** Wertungswoche plus `weeks` Wochen (auch negativ). */
export function shiftGuildWeek(week: string, weeks: number): string {
  return addDays(week, weeks * 7);
}

/** Kennung einer Wertungswoche: Samstag einer Wertungswoche (Sonntag bis Samstag) oder, für Ausgaben bis zur Umstellung, ISO-Woche. */
export function isWeekId(value: string): boolean {
  return isGuildWeek(value) || isWeek(value);
}

/** Erster und letzter Tag einer Wertungswoche, egal welcher Art. */
export function weekBounds(id: string): { from: string; to: string } {
  return isWeek(id) ? weekRange(id) : guildRange(id);
}

/** Ordnet Wertungswochen nach ihrem letzten Tag, damit alte ISO-Wochen vor den Wochen Sonntag bis Samstag stehen. */
export function compareWeeks(a: string, b: string): number {
  const ea = weekBounds(a).to;
  const eb = weekBounds(b).to;
  return ea < eb ? -1 : ea > eb ? 1 : 0;
}

/** ISO-Wochen, die den Zeitraum berühren, aufsteigend. */
export function isoWeeksBetween(from: string, to: string): string[] {
  const weeks: string[] = [];
  for (let d = addDays(from, -weekdayOf(from)); d <= to; d = addDays(d, 7)) weeks.push(isoWeek(d));
  return weeks;
}

/** Berliner Kalendertag, Stunde (0 bis 23) und Wochentag (Montag 0) eines Zeitpunkts. */
export function berlinParts(iso: string): { date: string; hour: number; weekday: number } {
  const date = berlinDate(iso);
  return { date, hour: Number(berlinHour.format(new Date(iso))), weekday: weekdayOf(date) };
}

/** Woche und Wochenstunde (Wochentag mal 24 plus Stunde, 0 bis 167) eines Zeitpunkts in Berliner Zeit. */
export function weekHour(iso: string): { week: string; hour: number } {
  const p = berlinParts(iso);
  return { week: isoWeek(p.date), hour: p.weekday * 24 + p.hour };
}

/** Kalendertag einer Wochenstunde. */
export function dateOfWeekHour(week: string, hour: number): string {
  return addDays(weekRange(week).from, Math.floor(hour / 24));
}

/** Monat eines Kalendertags als JJJJ-MM. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Prüft die Schreibweise `JJJJ-MM`. */
export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
