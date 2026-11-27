// Date arithmetic in Europe/Berlin. Deliberately without imports and with only erasable TypeScript syntax,
// so that the scripts under scripts/ can load this file directly.

const berlin = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });
const berlinHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" });

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar day in Europe/Berlin as YYYY-MM-DD. */
export function berlinDate(iso: string): string {
  return berlin.format(new Date(iso));
}

/** Calendar day (as UTC midnight) in milliseconds. */
function dayMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromDayMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Calendar day plus `days` days (may be negative). */
export function addDays(date: string, days: number): string {
  return fromDayMs(dayMs(date) + days * DAY_MS);
}

/** Weekday of a calendar day, Monday 0 to Sunday 6. */
export function weekdayOf(date: string): number {
  return (new Date(dayMs(date)).getUTCDay() + 6) % 7;
}

/** ISO week of a calendar day, e.g. `2026-W47`. The week belongs to the year its Thursday falls in. */
export function isoWeek(date: string): string {
  const thursday = dayMs(date) + (3 - weekdayOf(date)) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * DAY_MS)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Monday and Sunday of an ISO week as calendar days. */
export function weekRange(week: string): { from: string; to: string } {
  const match = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!match) throw new Error(`Invalid week: ${week}`);
  const jan4 = `${match[1]}-01-04`;
  const firstMonday = addDays(jan4, -weekdayOf(jan4));
  const from = addDays(firstMonday, (Number(match[2]) - 1) * 7);
  return { from, to: addDays(from, 6) };
}

/** Checks the format `YYYY-Www` and that the week exists. */
export function isWeek(value: string): boolean {
  if (!/^\d{4}-W\d{2}$/.test(value)) return false;
  return isoWeek(weekRange(value).from) === value;
}

/** Week plus `weeks` weeks (may be negative). */
export function shiftWeek(week: string, weeks: number): string {
  return isoWeek(addDays(weekRange(week).from, weeks * 7));
}

/**
 * Scoring week for titles and newspaper: Sunday 00:00 to Saturday 24:00 Berlin time.
 * Its ID is its Saturday as a calendar day, e.g. `2026-11-21` for 15 to 21 Nov 2026.
 */
export function guildWeek(date: string): string {
  return addDays(date, (5 - weekdayOf(date) + 7) % 7);
}

/** Sunday and Saturday of a scoring week. */
export function guildRange(week: string): { from: string; to: string } {
  return { from: addDays(week, -6), to: week };
}

/** Checks whether the value is a valid Saturday in the form `YYYY-MM-DD`. */
export function isGuildWeek(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || fromDayMs(dayMs(value)) !== value) return false;
  return weekdayOf(value) === 5;
}

/** Scoring week plus `weeks` weeks (may be negative). */
export function shiftGuildWeek(week: string, weeks: number): string {
  return addDays(week, weeks * 7);
}

/**
 * ID of a scoring week: the Saturday of a scoring week (Sunday to Saturday) or, for issues before the switch,
 * an ISO week.
 */
export function isWeekId(value: string): boolean {
  return isGuildWeek(value) || isWeek(value);
}

/** First and last day of a scoring week of either kind. */
export function weekBounds(id: string): { from: string; to: string } {
  return isWeek(id) ? weekRange(id) : guildRange(id);
}

/** Orders scoring weeks by their last day, so old ISO weeks come before the Sunday to Saturday weeks. */
export function compareWeeks(a: string, b: string): number {
  const ea = weekBounds(a).to;
  const eb = weekBounds(b).to;
  return ea < eb ? -1 : ea > eb ? 1 : 0;
}

/** ISO weeks touching the period, ascending. */
export function isoWeeksBetween(from: string, to: string): string[] {
  const weeks: string[] = [];
  for (let d = addDays(from, -weekdayOf(from)); d <= to; d = addDays(d, 7)) weeks.push(isoWeek(d));
  return weeks;
}

/** Berlin calendar day, hour (0 to 23) and weekday (Monday 0) of a point in time. */
export function berlinParts(iso: string): { date: string; hour: number; weekday: number } {
  const date = berlinDate(iso);
  return { date, hour: Number(berlinHour.format(new Date(iso))), weekday: weekdayOf(date) };
}

/** Week and week hour (weekday times 24 plus hour, 0 to 167) of a point in time in Berlin time. */
export function weekHour(iso: string): { week: string; hour: number } {
  const p = berlinParts(iso);
  return { week: isoWeek(p.date), hour: p.weekday * 24 + p.hour };
}

/** Calendar day of a week hour. */
export function dateOfWeekHour(week: string, hour: number): string {
  return addDays(weekRange(week).from, Math.floor(hour / 24));
}

/** Month of a calendar day as YYYY-MM. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Checks the format `YYYY-MM`. */
export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
