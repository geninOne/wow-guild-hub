// Erzeugt Zeitungsausgaben (und die Titel derselben Woche) NUR in der lokalen Umgebung neu, z. B. nachdem
// das eigene AI Gateway (ZEITUNG_KI_URL, ZEITUNG_KI_SCHLUESSEL) hinterlegt wurde. Normalerweise wird eine Ausgabe genau einmal erzeugt und nie wieder.
//
// Aufruf im Container:  docker compose exec app npm run zeitung:neu                 (neueste Ausgabe)
//                       docker compose exec app npm run zeitung:neu -- 2026-11-21   (bestimmte Wochen, benannt nach ihrem Samstag)
//                       docker compose exec app npm run zeitung:neu -- --alle       (alle Ausgaben)
//
// Wie scripts/beispieldaten.mjs: schreibt nur in .netlify/blobs-serve, bricht in einer Netlify-Umgebung ab
// und löst die Wochenauswertung nur über localhost aus. Ausgewertet werden höchstens die letzten 8 Wochen.
// Ausgaben alter ISO-Wochen (vor der Umstellung auf Sonntag bis Samstag, z. B. 2026-W46) entstehen nicht neu
// und bleiben deshalb immer stehen.
import { resolve } from "node:path";
import { isGuildWeek, isWeek } from "../src/lib/time.ts";
import { loescheWochenergebnisse, lokalerSpeicher, pruefeUmgebung } from "./beispieldaten-lib.mjs";

const basis = process.env.TRIGGER_BASE_URL ?? "http://localhost:8888";
const quelle = resolve(process.env.BLOBS_ORDNER ?? ".netlify/blobs-serve");
const argumente = process.argv.slice(2);
const log = (zeile) => console.log(zeile);

try {
  pruefeUmgebung(process.env, basis);
  const speicher = await lokalerSpeicher(quelle);
  const index = (await speicher.get("weekly/index")) ?? { weeks: [] };
  const alt = argumente.filter((a) => isWeek(a));
  if (alt.length > 0) throw new Error(`${alt.join(" ")}: Ausgaben aus der Zeit vor der Umstellung auf Sonntag bis Samstag lassen sich nicht neu erzeugen.`);
  const genannt = argumente.filter((a) => isGuildWeek(a));
  const unbekannt = argumente.filter((a) => a !== "--alle" && !isGuildWeek(a));
  if (unbekannt.length > 0) throw new Error(`Unbekannte Angabe: ${unbekannt.join(" ")}. Erlaubt: Samstag einer Woche wie 2026-11-21 oder --alle.`);
  const neu = index.weeks.filter((w) => isGuildWeek(w));
  const wochen = argumente.includes("--alle") ? neu : genannt.length > 0 ? genannt : neu.slice(-1);
  if (wochen.length === 0) throw new Error("Es gibt noch keine Ausgabe einer Wertungswoche. Erst die Wochenauswertung laufen lassen.");

  const geloescht = await loescheWochenergebnisse(speicher, wochen);
  log(`${geloescht} Ausgaben zum Neu-Erzeugen entfernt: ${wochen.join(", ")}`);
  log(process.env.ZEITUNG_KI_URL && process.env.ZEITUNG_KI_SCHLUESSEL ? "Texte schreibt Claude über das eigene AI Gateway." : "ZEITUNG_KI_URL oder ZEITUNG_KI_SCHLUESSEL fehlt: Texte kommen aus den Satzbausteinen.");

  const res = await fetch(`${basis}/.netlify/functions/collect-weekly`);
  await res.text();
  log(`Wochenauswertung ausgelöst (HTTP ${res.status}). Bericht im Log: docker compose logs app | grep -E '"job":"(collect-weekly|zeitung)"'`);
  if (!res.ok) process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
