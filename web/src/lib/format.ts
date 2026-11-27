const ZONE = "Europe/Berlin";

/**
 * Language for numbers and dates. Set by the SpracheProvider on every change, so the formatters do not need
 * a language passed in everywhere. English uses British notation (1,234 and 26 Nov 2026), German and the
 * dialects use German notation (1.234 and 26.11.2026).
 */
let english = false;

export function setFormatLanguage(language: string): void {
  english = language === "en";
}

/** Locale for `toLocaleString` and `Intl` matching the chosen language. */
export function numberLocale(): string {
  return english ? "en-GB" : "de-DE";
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthEn = (mm: string) => MONTHS_EN[Number(mm) - 1] ?? mm;

const dateTimeParts = new Intl.DateTimeFormat("de-DE", {
  timeZone: ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsOf(iso: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of dateTimeParts.formatToParts(new Date(iso))) parts[part.type] = part.value;
  return parts;
}

/** Point in time to the minute, e.g. `06.11.2026, 10:13 Uhr` or `6 Nov 2026, 10:13`. */
export function formatDateTime(iso: string): string {
  const p = partsOf(iso);
  if (english) return `${Number(p.day)} ${monthEn(p.month)} ${p.year}, ${p.hour}:${p.minute}`;
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute} Uhr`;
}

/** Calendar day of an ISO timestamp in Europe/Berlin, e.g. `06.11.2026`. */
export function formatDate(iso: string): string {
  const p = partsOf(iso);
  if (english) return `${Number(p.day)} ${monthEn(p.month)} ${p.year}`;
  return `${p.day}.${p.month}.${p.year}`;
}

/** Day and month of an ISO timestamp in Europe/Berlin, e.g. `05.11.`. */
export function formatDayMonth(iso: string): string {
  const p = partsOf(iso);
  if (english) return `${Number(p.day)} ${monthEn(p.month)}`;
  return `${p.day}.${p.month}.`;
}
