// Einmalige Datenübernahme: lädt alle Einträge des lokalen Blob-Stores "gilde" in den Store "gilde"
// der Netlify-Site hoch, damit Verlauf und Levelaufstiege erhalten bleiben.
//
//   node scripts/blobs-uebernahme.mjs --trocken                    nur auflisten, braucht keine Zugangsdaten
//   node scripts/blobs-uebernahme.mjs                              hochladen
//   node scripts/blobs-uebernahme.mjs --quelle ./blobs-kopie       andere Quelle als .netlify/blobs-serve
//   node scripts/blobs-uebernahme.mjs --ueberschreiben             auch wenn der Ziel-Store schon Einträge hat
//
// Zum Hochladen müssen NETLIFY_SITE_ID und NETLIFY_AUTH_TOKEN gesetzt sein. Ausgegeben werden nur
// Schlüssel, Größen und Zahlen, nie Zugangsdaten oder Inhalte.
import { parseArgs } from "node:util";
import { netlifyZiel, sammleEintraege, uebernehmen } from "./blobs-lib.mjs";

const STORE = "gilde";

try {
  const { values } = parseArgs({
    options: {
      quelle: { type: "string", default: ".netlify/blobs-serve" },
      trocken: { type: "boolean", default: false },
      ueberschreiben: { type: "boolean", default: false },
    },
  });

  const eintraege = await sammleEintraege(values.quelle, STORE);
  console.log(`Quelle ${values.quelle}: ${eintraege.length} Einträge im Store ${STORE}.`);

  let ziel = { list: async () => [], set: async () => {} };
  if (!values.trocken) {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_AUTH_TOKEN;
    const fehlend = [!siteID && "NETLIFY_SITE_ID", !token && "NETLIFY_AUTH_TOKEN"].filter(Boolean);
    if (fehlend.length) throw new Error(`Umgebungsvariable fehlt: ${fehlend.join(", ")}`);
    ziel = netlifyZiel({ siteID, token, storeName: STORE });
    console.log(`Ziel: Store ${STORE} der Netlify-Site.`);
  }

  await uebernehmen({
    eintraege,
    ziel,
    trocken: values.trocken,
    ueberschreiben: values.ueberschreiben,
    log: (zeile) => console.log(zeile),
  });
} catch (error) {
  // Nur die Meldung, keine Objekte mit Anfragedetails (Kopfzeilen könnten den Token enthalten).
  console.error(`Abbruch: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
