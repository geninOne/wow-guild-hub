// Setzt die Umgebungsvariablen der Netlify-Site (nur die für die Functions nötigen), idempotent:
//   node scripts/netlify-umgebung.mjs                 aus der lokalen .env
//   node scripts/netlify-umgebung.mjs --env pfad      aus einer anderen Datei
//   node scripts/netlify-umgebung.mjs --aus-umgebung  aus Umgebungsvariablen (Release-Workflow: GitHub-Secrets
//                                                     und GitHub-Variables, fehlende Einstellungen mit Standardwert)
// Braucht NETLIFY_SITE_ID und NETLIFY_AUTH_TOKEN in der Umgebung. Ausgegeben werden nur Variablennamen.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { NETLIFY_VARIABLEN, setzeVariablen, variablenAusEnv, variablenAusUmgebung, ZUGANGSDATEN } from "./netlify-umgebung-lib.mjs";

try {
  const { values } = parseArgs({
    options: { env: { type: "string", default: ".env" }, "aus-umgebung": { type: "boolean", default: false } },
  });
  const siteId = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const fehlend = [!siteId && "NETLIFY_SITE_ID", !token && "NETLIFY_AUTH_TOKEN"].filter(Boolean);
  if (fehlend.length) throw new Error(`Umgebungsvariable fehlt: ${fehlend.join(", ")}`);

  let variablen;
  let herkunft;
  if (values["aus-umgebung"]) {
    variablen = variablenAusUmgebung(process.env);
    herkunft = "der Umgebung";
  } else {
    variablen = variablenAusEnv(readFileSync(values.env, "utf8"));
    herkunft = values.env;
    for (const pflicht of ZUGANGSDATEN) {
      if (!variablen.some((v) => v.key === pflicht)) throw new Error(`${pflicht} fehlt in ${values.env} oder ist leer`);
    }
    const ohneWert = NETLIFY_VARIABLEN.filter((key) => !variablen.some((v) => v.key === key));
    if (ohneWert.length) console.log(`Ohne Wert in ${values.env}, auf Netlify gilt der Standard im Code: ${ohneWert.join(", ")}`);
  }
  console.log(`Netlify-Umgebungsvariablen aus ${herkunft}:`);
  await setzeVariablen({ siteId, token, variablen, log: (zeile) => console.log(zeile) });
} catch (error) {
  console.error(`Abbruch: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
