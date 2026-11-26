const ZONE = "Europe/Berlin";

/**
 * Sprache für Zahlen und Datumsangaben. Setzt der SpracheProvider bei jedem Wechsel, damit die Formatierer nicht
 * an jeder Stelle eine Sprache durchgereicht bekommen müssen. Englisch nutzt britische Schreibweise (1,234 und
 * 26 Nov 2026), Deutsch und die Dialekte die deutsche (1.234 und 26.11.2026).
 */
let englisch = false;

export function setzeFormatSprache(sprache: string): void {
  englisch = sprache === "en";
}

/** Locale für `toLocaleString` und `Intl` passend zur gewählten Sprache. */
export function zahlLocale(): string {
  return englisch ? "en-GB" : "de-DE";
}

const MONATE_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monatEn = (mm: string) => MONATE_EN[Number(mm) - 1] ?? mm;

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

/** Zeitpunkt auf die Minute genau, z. B. `06.11.2026, 10:13 Uhr` bzw. `6 Nov 2026, 10:13`. */
export function formatDateTime(iso: string): string {
  const p = partsOf(iso);
  if (englisch) return `${Number(p.day)} ${monatEn(p.month)} ${p.year}, ${p.hour}:${p.minute}`;
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute} Uhr`;
}

/** Kalendertag eines ISO-Zeitstempels in Europe/Berlin, z. B. `06.11.2026`. */
export function formatDate(iso: string): string {
  const p = partsOf(iso);
  if (englisch) return `${Number(p.day)} ${monatEn(p.month)} ${p.year}`;
  return `${p.day}.${p.month}.${p.year}`;
}

/** Tag und Monat eines ISO-Zeitstempels in Europe/Berlin, z. B. `05.11.`. */
export function formatDayMonth(iso: string): string {
  const p = partsOf(iso);
  if (englisch) return `${Number(p.day)} ${monatEn(p.month)}`;
  return `${p.day}.${p.month}.`;
}
