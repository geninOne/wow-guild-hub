/**
 * Versionszeile für den Fußbereich, z. B. `Version 1.0.0 vom 06.11.2026`. Version und Datum (JJJJ-MM-TT)
 * setzt Vite beim Bauen ein (siehe `web/vite.config.ts`). Ohne Version gibt es keine Zeile.
 */
export function versionsText(version: string | undefined, isoDatum: string | undefined, englisch = false): string | null {
  if (!version) return null;
  const datum = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDatum ?? "");
  if (!datum) return `Version ${version}`;
  return englisch ? `Version ${version}, ${datum[1]}-${datum[2]}-${datum[3]}` : `Version ${version} vom ${datum[3]}.${datum[2]}.${datum[1]}`;
}
