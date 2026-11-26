// Hilfen für die einmalige Datenübernahme der lokalen Blobs nach Netlify (scripts/blobs-uebernahme.mjs).
import { getStore } from "@netlify/blobs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/**
 * @typedef {{ key: string, pfad: string, groesse: number, metadata: Record<string, unknown> | null }} Eintrag
 * @typedef {{ list(): Promise<string[]>, set(key: string, inhalt: string, metadata?: Record<string, unknown>): Promise<void> }} Ziel
 */

async function dateienUnter(ordner) {
  const ergebnis = [];
  for (const eintrag of await readdir(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, eintrag.name);
    if (eintrag.isDirectory()) ergebnis.push(...(await dateienUnter(pfad)));
    else if (eintrag.isFile()) ergebnis.push(pfad);
  }
  return ergebnis;
}

async function ordnerDa(pfad) {
  try {
    return (await stat(pfad)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Liest alle Einträge eines Stores aus dem Ordner des lokalen Blob-Servers von `netlify dev`
 * (`.netlify/blobs-serve`): Inhalte unter `entries/<site>/site:<store>/<schlüssel>`, Metadaten
 * gleich aufgebaut unter `metadata/`.
 * @param {string} quelle
 * @param {string} [storeName]
 * @returns {Promise<Eintrag[]>}
 */
export async function sammleEintraege(quelle, storeName = "gilde") {
  const entries = join(quelle, "entries");
  if (!(await ordnerDa(entries))) throw new Error(`In ${quelle} gibt es keinen Ordner "entries"`);
  const sites = (await readdir(entries, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  if (sites.length !== 1) {
    throw new Error(
      `Unter ${entries} muss genau ein Site-Ordner liegen, gefunden: ${sites.length ? sites.sort().join(", ") : "keiner"}`,
    );
  }
  const store = `site:${storeName}`;
  const storeOrdner = join(entries, sites[0], store);
  if (!(await ordnerDa(storeOrdner))) throw new Error(`Store ${store} fehlt unter ${join(entries, sites[0])}`);
  const metadataOrdner = join(quelle, "metadata", sites[0], store);

  const eintraege = [];
  for (const pfad of await dateienUnter(storeOrdner)) {
    const key = relative(storeOrdner, pfad).split(sep).join("/");
    eintraege.push({
      key,
      pfad,
      groesse: (await stat(pfad)).size,
      metadata: await metadatenVon(join(metadataOrdner, ...key.split("/"))),
    });
  }
  return eintraege.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

async function metadatenVon(pfad) {
  let roh;
  try {
    roh = await readFile(pfad, "utf8");
  } catch {
    return null;
  }
  const metadata = JSON.parse(roh);
  return metadata && typeof metadata === "object" && Object.keys(metadata).length > 0 ? metadata : null;
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
}

/**
 * Lädt die Einträge in das Ziel hoch. Im Trockenlauf wird nur aufgelistet und das Ziel nicht berührt.
 * Hat das Ziel schon Einträge, bricht die Übernahme ab, außer `ueberschreiben` ist gesetzt.
 * Inhalte von Blobs werden nie ausgegeben, nur Schlüssel und Größen.
 * @param {{ eintraege: Eintrag[], ziel: Ziel, trocken: boolean, ueberschreiben?: boolean, log: (zeile: string) => void, parallel?: number }} optionen
 * @returns {Promise<{ hochgeladen: number, eintraege: number, bytes: number }>}
 */
export async function uebernehmen({ eintraege, ziel, trocken, ueberschreiben = false, log, parallel = 5 }) {
  const bytes = eintraege.reduce((summe, e) => summe + e.groesse, 0);
  if (trocken) {
    for (const e of eintraege) log(`  ${e.key} (${kb(e.groesse)})`);
    log(`Trockenlauf: ${eintraege.length} Einträge, ${kb(bytes)} würden hochgeladen. Nichts wurde verändert.`);
    return { hochgeladen: 0, eintraege: eintraege.length, bytes };
  }

  const vorhanden = await ziel.list();
  if (vorhanden.length > 0 && !ueberschreiben) {
    throw new Error(
      `Der Ziel-Store hat schon ${vorhanden.length} Einträge. Abbruch, damit nichts überschrieben wird. ` +
        "Wer das will, startet erneut mit --ueberschreiben.",
    );
  }

  let hochgeladen = 0;
  const warteschlange = [...eintraege];
  async function arbeiter() {
    for (let e = warteschlange.shift(); e; e = warteschlange.shift()) {
      const inhalt = await readFile(e.pfad, "utf8");
      await ziel.set(e.key, inhalt, e.metadata ?? undefined);
      hochgeladen++;
      if (hochgeladen % 25 === 0 || hochgeladen === eintraege.length) log(`  ${hochgeladen} von ${eintraege.length} hochgeladen`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, arbeiter));
  log(`Fertig: ${hochgeladen} Einträge, ${kb(bytes)} hochgeladen.`);
  return { hochgeladen, eintraege: eintraege.length, bytes };
}

/**
 * Ziel für uebernehmen(): der Store einer Netlify-Site über die Blobs-API.
 * @param {{ siteID: string, token: string, storeName?: string }} optionen
 * @returns {Ziel}
 */
export function netlifyZiel({ siteID, token, storeName = "gilde" }) {
  const store = getStore({ name: storeName, siteID, token });
  return {
    list: async () => (await store.list()).blobs.map((b) => b.key),
    set: async (key, inhalt, metadata) => {
      await store.set(key, inhalt, metadata ? { metadata } : undefined);
    },
  };
}

/**
 * Geführte Übernahme für den Live-Gang: Trockenlauf zeigen, Bestätigung abwarten, erst dann den Token
 * abfragen und hochladen. Liefert null, wenn nicht bestätigt wurde.
 * @param {{
 *   quelle: string,
 *   log: (zeile: string) => void,
 *   bestaetigen: (frage: string) => Promise<string>,
 *   frageToken: () => Promise<string>,
 *   erstelleZiel: (token: string) => Ziel,
 *   ueberschreiben?: boolean,
 * }} optionen
 */
export async function liveUebernahme({ quelle, log, bestaetigen, frageToken, erstelleZiel, ueberschreiben = false }) {
  const eintraege = await sammleEintraege(quelle, "gilde");
  await uebernehmen({ eintraege, ziel: { list: async () => [], set: async () => {} }, trocken: true, log });

  const antwort = await bestaetigen(`${eintraege.length} Einträge in den Store gilde der Netlify-Site hochladen? (ja/nein) `);
  if (!/^(ja|j)$/i.test(antwort.trim())) {
    log("Nicht hochgeladen.");
    return null;
  }
  const token = (await frageToken()).trim();
  if (!token) throw new Error("Kein Netlify-Token eingegeben");
  return uebernehmen({ eintraege, ziel: erstelleZiel(token), trocken: false, ueberschreiben, log });
}
