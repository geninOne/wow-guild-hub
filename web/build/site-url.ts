/** Placeholder in `index.html` for the public address of the site (Open Graph requires absolute image addresses). */
export const SITE_URL_PLACEHOLDER = "{{SITE_URL}}";

/**
 * Fills in the address. Netlify provides it as `URL` during the build; locally it is missing, so the paths stay
 * relative. A trailing slash is removed so that no double slashes appear.
 */
export function withSiteUrl(html: string, url: string | undefined): string {
  const base = (url ?? "").trim().replace(/\/+$/, "");
  return html.replaceAll(SITE_URL_PLACEHOLDER, base);
}
