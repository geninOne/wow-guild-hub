// Einmalige Datenübernahme für den Live-Gang, ein Befehl im Hauptcheckout (Container läuft):
//   npm run daten:uebernahme:live
//   npm run daten:uebernahme:live -- --quelle pfad      vorhandene Kopie statt Kopie aus dem Container
//   npm run daten:uebernahme:live -- --ueberschreiben   auch wenn der Store der Site schon Einträge hat
// Ablauf: Kopie von .netlify/blobs-serve aus dem Container "app" ziehen, Trockenlauf zeigen, nach "ja"
// den Netlify-Token verdeckt abfragen und hochladen. Site-ID aus NETLIFY_SITE_ID. Der Token erscheint
// weder in der Ausgabe noch in der Shell-History; ist NETLIFY_AUTH_TOKEN gesetzt, wird nicht gefragt.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { liveUebernahme, netlifyZiel } from "./blobs-lib.mjs";

// NETLIFY_SITE_ID und andere Angaben dürfen auch in der .env stehen.
try {
  process.loadEnvFile(".env");
} catch {
  // keine .env, dann zählt nur die Umgebung
}

const wurzel = new URL("../", import.meta.url);

async function bestaetigen(frage) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(frage);
  } finally {
    rl.close();
  }
}

/** Liest eine Eingabe ohne Echo (Rohmodus des Terminals). */
function frageVerdeckt(frage) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error("Die Token-Abfrage braucht ein Terminal (oder NETLIFY_AUTH_TOKEN in der Umgebung)"));
      return;
    }
    let wert = "";
    const ende = () => {
      stdin.off("data", beiDaten);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    function beiDaten(teil) {
      for (const zeichen of teil) {
        if (zeichen === "\r" || zeichen === "\n") {
          ende();
          resolve(wert);
          return;
        }
        if (zeichen === "\u0003") {
          ende();
          reject(new Error("Abgebrochen"));
          return;
        }
        if (zeichen === "\u007f" || zeichen === "\b") wert = wert.slice(0, -1);
        else wert += zeichen;
      }
    }
    stdout.write(frage);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", beiDaten);
  });
}

let temp;
try {
  const { values } = parseArgs({
    options: { quelle: { type: "string" }, ueberschreiben: { type: "boolean", default: false } },
  });
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!siteId) throw new Error("NETLIFY_SITE_ID fehlt (ID der Netlify-Site, z. B. in der .env)");

  let quelle = values.quelle;
  if (!quelle) {
    temp = mkdtempSync(join(tmpdir(), "guild-hub-blobs-"));
    quelle = join(temp, "blobs-serve");
    console.log("Kopiere .netlify/blobs-serve aus dem Container app ...");
    execFileSync("docker", ["compose", "cp", "app:/app/.netlify/blobs-serve", quelle], {
      cwd: new URL(".", wurzel),
      stdio: ["ignore", "ignore", "inherit"],
    });
  }
  console.log(`Quelle: ${values.quelle ?? "Kopie aus dem Container"}`);

  const ergebnis = await liveUebernahme({
    quelle,
    ueberschreiben: values.ueberschreiben,
    log: (zeile) => console.log(zeile),
    bestaetigen,
    frageToken: async () => process.env.NETLIFY_AUTH_TOKEN || frageVerdeckt("Netlify-Token (Eingabe bleibt unsichtbar): "),
    erstelleZiel: (token) => netlifyZiel({ siteID: siteId, token }),
  });
  if (ergebnis) console.log("Datenübernahme abgeschlossen.");
} catch (error) {
  console.error(`Abbruch: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (temp) rmSync(temp, { recursive: true, force: true });
}
