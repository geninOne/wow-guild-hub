// Hilfen für scripts/netlify-umgebung.mjs: Umgebungsvariablen der Netlify-Site setzen, aus der lokalen .env
// oder (im Release-Workflow) aus GitHub-Secrets und GitHub-Variables.
import { parseEnv } from "node:util";

/**
 * Wochenzeitung über das eigene AI Gateway, alle freiwillig: Fehlen sie, schreiben die Satzbausteine.
 * Bewusst nicht ANTHROPIC_API_KEY, denn den setzt Netlifys eigenes AI Gateway von selbst.
 */
export const KI_VARIABLEN = ["ZEITUNG_KI_URL", "ZEITUNG_KI_SCHLUESSEL", "ZEITUNG_MODELL", "ZEITUNG_AUFWAND", "ZEITUNG_KI_OUTPUT_CONFIG"];

/** Angaben zur Seite, freiwillig, werden beim Bauen in Oberfläche und index.html eingesetzt (siehe .env.example). */
export const SEITE_VARIABLEN = [
  "SEITE_NAME",
  "SEITE_SPRACHEN",
  "SEITE_ZEITUNG",
  "SEITE_BESCHREIBUNG",
  "SEITE_UNTERTITEL",
  "SEITE_LOGO",
  "SEITE_LOGO_ALT",
  "SEITE_FAVICON",
  "SEITE_APPLE_ICON",
  "SEITE_OG_BILD",
  "SEITE_THEME_COLOR",
  "SEITE_FARBEN",
  "SEITE_DISCORD",
  "SEITE_IMPRESSUM_NAME",
  "SEITE_IMPRESSUM_ANSCHRIFT",
  "SEITE_IMPRESSUM_EMAIL",
  "SEITE_UMAMI_ID",
  "SEITE_UMAMI_DOMAINS",
];

/** Variablen, die die Functions auf Netlify brauchen. Der lokale Taktgeber (TAKT*) gehört nicht dazu. */
export const NETLIFY_VARIABLEN = [
  "BNET_CLIENT_ID",
  "BNET_CLIENT_SECRET",
  "GUILD_SLUGS",
  "GUILD_RANKS",
  "TITEL_ABMELDUNGEN",
  "WOW_VERSION",
  "BNET_REGION",
  "BNET_LOCALE",
  "COLLECT_CONCURRENCY",
  "COLLECT_BUDGET_MS",
  ...KI_VARIABLEN,
  ...SEITE_VARIABLEN,
];

/** Pflichtangaben ohne Standardwert. */
export const ZUGANGSDATEN = ["BNET_CLIENT_ID", "BNET_CLIENT_SECRET", "GUILD_SLUGS"];

/** Standardwerte der übrigen Einstellungen (wie in src/config.ts), falls keine GitHub-Variable gesetzt ist. */
export const STANDARDWERTE = {
  BNET_REGION: "eu",
  BNET_LOCALE: "de_DE",
  COLLECT_CONCURRENCY: "10",
  COLLECT_BUDGET_MS: "12000",
};

const API = "https://api.netlify.com/api/v1";

/**
 * Erlaubte Variablen mit Wert aus dem Inhalt einer .env-Datei, in der Reihenfolge von NETLIFY_VARIABLEN.
 * @param {string} text
 * @returns {{ key: string, value: string }[]}
 */
export function variablenAusEnv(text) {
  const env = parseEnv(text);
  return NETLIFY_VARIABLEN.filter((key) => (env[key] ?? "") !== "").map((key) => ({ key, value: env[key] }));
}

/**
 * Alle Variablen für Netlify aus einer Umgebung (process.env im Workflow). Leere oder fehlende Einstellungen
 * bekommen ihren Standardwert, fehlende Zugangsdaten brechen mit deren Namen ab. Freiwillige Variablen ohne
 * Standardwert (KI_VARIABLEN) kommen nur mit, wenn sie gesetzt sind; auf Netlify bleiben sie dann, wie sie sind.
 * @param {Record<string, string | undefined>} env
 * @returns {{ key: string, value: string }[]}
 */
export function variablenAusUmgebung(env) {
  const fehlend = ZUGANGSDATEN.filter((key) => !env[key]);
  if (fehlend.length) throw new Error(`Pflichtangaben fehlen: ${fehlend.join(", ")}`);
  return NETLIFY_VARIABLEN.map((key) => ({ key, value: env[key] || STANDARDWERTE[key] })).filter((v) => v.value);
}

/** true, wenn die vorhandene Variable genau einen Wert für alle Kontexte mit diesem Inhalt hat. */
function gleich(vorhanden, value) {
  return vorhanden.values?.length === 1 && vorhanden.values[0].context === "all" && vorhanden.values[0].value === value;
}

/**
 * Setzt die Variablen für alle Kontexte der Site, idempotent: neue werden angelegt, abweichende ersetzt
 * (ohne vorher zu löschen, damit laufende Functions nie ohne Variable sind), gleiche bleiben unverändert.
 * Ausgegeben werden nur Schlüssel; Fehler nennen Methode, Pfad und Status, nie Werte oder den Token.
 * @param {{ siteId: string, token: string, variablen: { key: string, value: string }[], fetchFn?: typeof fetch, log: (zeile: string) => void }} optionen
 */
export async function setzeVariablen({ siteId, token, variablen, fetchFn = fetch, log }) {
  if (variablen.length === 0) throw new Error("Keine passenden Variablen mit Wert in der .env gefunden");

  async function anfrage(methode, pfad, body) {
    const res = await fetchFn(`${API}${pfad}`, {
      method: methode,
      headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`Netlify-API ${methode} ${pfad.split("?")[0]} antwortet mit HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  const site = encodeURIComponent(siteId);
  const seite = await anfrage("GET", `/sites/${site}`);
  const konto = encodeURIComponent(seite.account_slug ?? seite.account_id);
  const vorhanden = new Map((await anfrage("GET", `/accounts/${konto}/env?site_id=${site}`)).map((v) => [v.key, v]));

  const neu = [];
  for (const { key, value } of variablen) {
    const alt = vorhanden.get(key);
    const body = { key, values: [{ value, context: "all" }] };
    if (!alt) {
      neu.push(body);
    } else if (gleich(alt, value)) {
      log(`  ${key}: unverändert`);
    } else {
      await anfrage("PUT", `/accounts/${konto}/env/${encodeURIComponent(key)}?site_id=${site}`, body);
      log(`  ${key}: geändert`);
    }
  }
  if (neu.length) {
    await anfrage("POST", `/accounts/${konto}/env?site_id=${site}`, neu);
    for (const { key } of neu) log(`  ${key}: angelegt`);
  }
}
