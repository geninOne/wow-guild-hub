/**
 * Version line for the footer, e.g. `Version 1.0.0 vom 06.11.2026`. Vite inserts version and date (YYYY-MM-DD)
 * at build time (see `web/vite.config.ts`). Without a version there is no line.
 */
export function versionText(version: string | undefined, isoDate: string | undefined, english = false): string | null {
  if (!version) return null;
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  if (!date) return `Version ${version}`;
  return english ? `Version ${version}, ${date[1]}-${date[2]}-${date[3]}` : `Version ${version} vom ${date[3]}.${date[2]}.${date[1]}`;
}
