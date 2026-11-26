// Beispieldaten NUR für die lokale Entwicklung: füllt Aktivität (fünf abgeschlossene Wertungswochen, Sonntag bis
// Samstag, und die laufende)
// und fehlende Tagesstände, dann löst die Wochenauswertung (Titel und Zeitung) aus.
// Vor dem Serverstart (config/serverstart.json) entsteht nichts: Dort beginnen alle Charaktere mit Level 1.
// Alles Erzeugte trägt "testdaten": true und lässt sich mit --entfernen wieder löschen.
//
// Aufruf im Container:  docker compose exec app npm run daten:beispiel
//                       docker compose exec app npm run daten:beispiel -- --entfernen
//
// Schutz: Das Skript schreibt ausschließlich Dateien im Ordner des lokalen Blob-Servers (.netlify/blobs-serve),
// kennt keinen Netlify-Zugang, bricht in einer Netlify-Umgebung ab und löst nur über localhost aus.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseServerStart } from "../src/lib/serverstart.ts";
import { entferneBeispieldaten, fuelleBeispieldaten, lokalerSpeicher, pruefeUmgebung } from "./beispieldaten-lib.mjs";

const basis = process.env.TRIGGER_BASE_URL ?? "http://localhost:8888";
const quelle = resolve(process.env.BLOBS_ORDNER ?? ".netlify/blobs-serve");
const entfernen = process.argv.includes("--entfernen");
const log = (zeile) => console.log(zeile);

async function serverstart() {
  return parseServerStart(JSON.parse(await readFile(new URL("../config/serverstart.json", import.meta.url), "utf8")));
}

try {
  pruefeUmgebung(process.env, basis);
  const speicher = await lokalerSpeicher(quelle);
  log(`Lokaler Speicher: ${quelle}`);
  if (entfernen) await entferneBeispieldaten(speicher, log);
  else await fuelleBeispieldaten(speicher, new Date().toISOString(), log, await serverstart());

  const res = await fetch(`${basis}/.netlify/functions/collect-weekly`);
  await res.text();
  log(`Wochenauswertung ausgelöst (HTTP ${res.status}). Bericht im Log: docker compose logs app | grep '"job":"collect-weekly"'`);
  if (!res.ok) process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
