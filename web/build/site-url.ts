/** Platzhalter in `index.html` für die öffentliche Adresse der Seite (Open Graph verlangt absolute Bildadressen). */
export const SITE_URL_PLACEHOLDER = "{{SITE_URL}}";

/**
 * Setzt die Adresse ein. Netlify stellt sie beim Bauen als `URL` bereit; lokal fehlt sie, dann bleiben die
 * Pfade relativ. Ein abschließender Schrägstrich wird entfernt, damit keine doppelten entstehen.
 */
export function withSiteUrl(html: string, url: string | undefined): string {
  const base = (url ?? "").trim().replace(/\/+$/, "");
  return html.replaceAll(SITE_URL_PLACEHOLDER, base);
}
