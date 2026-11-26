// Beispieldaten für die lokale Entwicklung (scripts/beispieldaten.mjs): Aktivität und Tagesstände.
// Schreibt nur in den Dateiordner des lokalen Blob-Servers von netlify dev, nie über eine Netlify-API.
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { addDays, berlinDate, isoWeeksBetween, isWeek, isWeekId, shiftGuildWeek, guildRange, guildWeek, weekBounds, weekRange } from "../src/lib/time.ts";

/** Erlaubte Hosts für das Auslösen der Wochenauswertung. */
const LOKALE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Bricht ab, wenn das Skript in einer Netlify-Umgebung läuft oder die Auswertung nicht lokal ausgelöst würde.
 * @param {Record<string, string | undefined>} env
 * @param {string} basisUrl
 */
export function pruefeUmgebung(env, basisUrl) {
  for (const name of ["NETLIFY", "CONTEXT", "DEPLOY_ID", "BUILD_ID", "NETLIFY_BUILD_BASE"]) {
    if (env[name]) throw new Error(`Abbruch: ${name} ist gesetzt. Beispieldaten sind nur für die lokale Umgebung gedacht.`);
  }
  let host;
  try {
    host = new URL(basisUrl).hostname;
  } catch {
    throw new Error(`Abbruch: ${basisUrl} ist keine gültige Adresse.`);
  }
  if (!LOKALE_HOSTS.has(host)) {
    throw new Error(`Abbruch: Die Wochenauswertung wird nur lokal ausgelöst, nicht über ${host}.`);
  }
}

async function istOrdner(pfad) {
  try {
    return (await stat(pfad)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Speicher auf dem Dateiordner des lokalen Blob-Servers: `entries/<site>/site:<store>/<schlüssel>`,
 * Metadaten gleich aufgebaut unter `metadata/`.
 * @param {string} quelle Ordner `.netlify/blobs-serve`
 */
export async function lokalerSpeicher(quelle, storeName = "gilde") {
  const entries = join(quelle, "entries");
  if (!(await istOrdner(entries))) {
    throw new Error(`Kein lokaler Blob-Speicher unter ${quelle}. Läuft netlify dev und hat der Sammler schon Daten geschrieben?`);
  }
  const sites = (await readdir(entries, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  if (sites.length !== 1) throw new Error(`Unter ${entries} muss genau ein Site-Ordner liegen, gefunden: ${sites.length}`);
  const store = `site:${storeName}`;
  const daten = join(entries, sites[0], store);
  const meta = join(quelle, "metadata", sites[0], store);
  if (!(await istOrdner(daten))) throw new Error(`Store ${store} fehlt unter ${join(entries, sites[0])}`);
  const pfad = (wurzel, key) => join(wurzel, ...key.split("/"));

  async function dateien(ordner) {
    if (!(await istOrdner(ordner))) return [];
    const out = [];
    for (const e of await readdir(ordner, { withFileTypes: true })) {
      const p = join(ordner, e.name);
      if (e.isDirectory()) out.push(...(await dateien(p)));
      else if (e.isFile()) out.push(p);
    }
    return out;
  }

  return {
    async get(key) {
      try {
        return JSON.parse(await readFile(pfad(daten, key), "utf8"));
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw error;
      }
    },
    async set(key, wert) {
      for (const [wurzel, inhalt] of [[daten, JSON.stringify(wert)], [meta, "{}"]]) {
        await mkdir(dirname(pfad(wurzel, key)), { recursive: true });
        await writeFile(pfad(wurzel, key), inhalt);
      }
    },
    async delete(key) {
      await rm(pfad(daten, key), { force: true });
      await rm(pfad(meta, key), { force: true });
    },
    async list(prefix) {
      return (await dateien(daten))
        .map((p) => relative(daten, p).split(sep).join("/"))
        .filter((k) => k.startsWith(prefix))
        .sort();
    },
  };
}

/** Deterministischer Zufall (mulberry32) aus einem Text. */
export function zufall(saat) {
  let h = 1779033703 ^ saat.length;
  for (let i = 0; i < saat.length; i++) {
    h = Math.imul(h ^ saat.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Spielertypen: Wahrscheinlichkeit je Stunde (Berliner Zeit) an Werktagen und am Wochenende. */
const TYPEN = {
  feierabend: (h, wochenende) => (h >= 18 && h <= 23 ? 0.32 : wochenende && h >= 10 && h < 18 ? 0.14 : 0.015),
  nachteule: (h) => (h >= 21 || h < 4 ? 0.3 : h < 6 ? 0.08 : 0.01),
  fruehaufsteher: (h, wochenende) => (h >= 5 && h < 9 ? 0.32 : h >= 17 && h < 21 ? 0.12 : wochenende && h < 14 && h >= 9 ? 0.1 : 0.01),
  wochenende: (h, wochenende) => (wochenende ? (h >= 10 && h <= 23 ? 0.28 : 0.03) : h >= 19 && h <= 22 ? 0.06 : 0.005),
  gelegentlich: (h) => (h >= 19 && h <= 22 ? 0.08 : 0.005),
};
const TYPNAMEN = Object.keys(TYPEN);

/**
 * Aktivität für ISO-Wochen (so speichert sie auch der Sammler), nur bis `bisIso` (keine Logins in der Zukunft)
 * und nie vor `serverstart`.
 * @param {{ id: number, former: boolean }[]} mitglieder
 * @param {string[]} wochen ISO-Wochen
 * @param {string} bisIso
 * @param {string | null} serverstart frühester Kalendertag mit Anmeldungen, meist der Serverstart
 */
export function erzeugeAktivitaet(mitglieder, wochen, bisIso, serverstart = null) {
  const heute = berlinDate(bisIso);
  const jetztStunde = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(new Date(bisIso)));
  const aktive = mitglieder.filter((m) => !m.former);
  return wochen.map((week) => {
    const { from } = weekRange(week);
    const characters = {};
    const returns = {};
    for (const m of aktive) {
      const r = zufall(`aktivitaet:${m.id}`);
      const typ = TYPEN[TYPNAMEN[Math.floor(r() * TYPNAMEN.length)]];
      const fleiss = 0.4 + r() * 0.9;
      const w = zufall(`aktivitaet:${m.id}:${week}`);
      if (w() < 0.25) continue; // Woche ausgesetzt
      const stunden = [];
      for (let tag = 0; tag < 7; tag++) {
        const datum = addDays(from, tag);
        if (datum > heute) break;
        for (let h = 0; h < 24; h++) {
          if (datum === heute && h > jetztStunde) break;
          // Immer würfeln, damit die Folge an späteren Tagen nicht vom Serverstart abhängt.
          const dabei = w() < typ(h, tag >= 5) * fleiss;
          if (dabei && (serverstart === null || datum >= serverstart)) stunden.push(tag * 24 + h);
        }
      }
      if (stunden.length > 0) characters[String(m.id)] = stunden;
      // Ab und zu kommt jemand nach langer Pause zurück (für den Titel "Verlorener Sohn").
      // Die Pause muss seit dem Serverstart überhaupt möglich gewesen sein.
      const rueck = zufall(`rueckkehr:${m.id}:${week}`);
      if (stunden.length > 0 && rueck() < 0.05) {
        const pause = 14 + Math.floor(rueck() * 60);
        if (serverstart === null || addDays(from, -pause) >= serverstart) returns[String(m.id)] = pause;
      }
    }
    return { week, characters, ...(Object.keys(returns).length > 0 ? { returns } : {}), testdaten: true };
  });
}

/**
 * Tagesstände für fehlende Tage: Jeder Charakter steigt vom ersten Tag an in zufälligen Tagesschritten
 * auf seinen heutigen Stand. Ist der erste Tag der Serverstart, beginnt er dort mit Level 1, ohne Beruf
 * und mit allen Zählern auf 0; sonst mit einem Teil seines heutigen Stands.
 * Vorhandene echte Stände bleiben unberührt; erzeugte Werte liegen nie über dem nächsten und nie unter
 * dem vorigen echten Stand.
 * @param {any[]} mitglieder MemberSummary
 * @param {string[]} tage Kalendertage, aufsteigend
 * @param {Map<string, any>} echte vorhandene DaySnapshots nach Datum
 * @param {Record<string, any>} datensaetze Charakterdatensätze nach ID (für Zählerstände)
 * @param {string | null} serverstart Kalendertag des Serverstarts
 */
export function erzeugeTagesstaende(mitglieder, tage, echte, datensaetze = {}, serverstart = null) {
  const aktive = mitglieder.filter((m) => !m.former);
  const letzter = tage[tage.length - 1];
  const echteTage = [...echte.keys()].sort();
  const ergebnis = new Map();
  const abNull = serverstart !== null && tage[0] <= serverstart;

  // Je Charakter der Anteil am heutigen Stand, der an jedem Tag schon erreicht ist (0 bis 1, steigend).
  const verlauf = new Map();
  for (const m of aktive) {
    const r = zufall(`stand:${m.id}`);
    const rec = datensaetze[String(m.id)];
    const ziel = {
      level: m.level,
      deaths: m.deaths ?? rec?.stats?.deaths ?? Math.floor(5 + r() * 40),
      recipes: m.recipeCount ?? rec?.professions?.reduce((n, p) => n + (p.recipes?.length ?? 0), 0) ?? Math.floor(r() * 40),
      dungeons: m.dungeonsEntered ?? rec?.stats?.dungeonsEntered ?? Math.floor(r() * 12),
      achievements:
        m.achievementCount ?? rec?.instances?.achievements?.filter((a) => a.completed).length ?? Math.floor(10 + r() * 50),
      reputation: m.reputationTiers ?? rec?.reputations?.reduce((n, x) => n + (x.tier ?? 0), 0) ?? Math.floor(20 + r() * 40),
      ilvl: m.equippedItemLevel,
      professions: (m.professions ?? []).map((p) => [String(p.id), p.skill]),
    };
    const basis = abNull ? 0 : 0.3 + r() * 0.5;
    const spielfreude = 0.45 + r() * 0.5;
    // Zuwachs je Tag: an manchen Tagen gar nicht gespielt, an anderen viel.
    const schritte = tage.map((tag, i) => {
      if (i === 0) return 0;
      const t = zufall(`stand:${m.id}:${tag}`);
      return t() < spielfreude ? 0.3 + t() * 1.7 : 0;
    });
    const summe = schritte.reduce((a, b) => a + b, 0);
    let bisher = 0;
    const jeTag = new Map();
    tage.forEach((tag, i) => {
      bisher += schritte[i];
      const anteil = tage.length === 1 ? 1 : summe > 0 ? bisher / summe : i / (tage.length - 1);
      const f = basis + (1 - basis) * anteil;
      // Die ersten Level gehen schnell, Tode, Dungeons und Erfolge häufen sich erst später.
      const frueh = f ** 0.7;
      const spaet = f ** 1.3;
      const level = Math.max(1, Math.round(1 + (ziel.level - 1) * frueh));
      jeTag.set(tag, {
        level,
        deaths: Math.round(ziel.deaths * spaet),
        recipes: Math.round(ziel.recipes * f),
        dungeons: Math.round(ziel.dungeons * spaet),
        achievements: Math.round(ziel.achievements * spaet),
        reputation: Math.round(ziel.reputation * f),
        ilvl: ziel.ilvl === null || ziel.ilvl === undefined ? ziel.ilvl : Math.max(1, Math.round(ziel.ilvl * frueh)),
        professions: Object.fromEntries(ziel.professions.map(([id, skill]) => [id, Math.round(skill * f)]).filter(([, skill]) => skill >= 1)),
      });
    });
    verlauf.set(m.id, jeTag);
  }

  for (const tag of tage) {
    if (echte.has(tag)) continue;
    const naechsterEchter = echteTage.find((d) => d > tag);
    const vorigerEchter = echteTage.findLast((d) => d < tag);
    const obergrenze = naechsterEchter ? echte.get(naechsterEchter) : null;
    const untergrenze = vorigerEchter ? echte.get(vorigerEchter) : null;
    const characters = {};
    for (const m of aktive) {
      const s = verlauf.get(m.id).get(tag);
      const decke = obergrenze?.characters?.[String(m.id)];
      const boden = untergrenze?.characters?.[String(m.id)];
      const begrenzt = (wert, feld) => {
        const unten = typeof boden?.[feld] === "number" ? Math.max(wert, boden[feld]) : wert;
        return typeof decke?.[feld] === "number" ? Math.min(unten, decke[feld]) : unten;
      };
      characters[String(m.id)] = {
        level: begrenzt(s.level, "level"),
        equippedItemLevel: s.ilvl ?? null,
        professions: s.professions,
        deaths: begrenzt(s.deaths, "deaths"),
        dungeons: begrenzt(s.dungeons, "dungeons"),
        recipes: begrenzt(s.recipes, "recipes"),
        achievements: begrenzt(s.achievements, "achievements"),
        reputation: begrenzt(s.reputation, "reputation"),
      };
    }
    ergebnis.set(tag, { date: tag, takenAt: `${tag}T${tag === letzter ? "08" : "21"}:00:00.000Z`, characters, testdaten: true });
  }
  return ergebnis;
}

/**
 * Wertungswochen (5 abgeschlossene und die laufende, Sonntag bis Samstag) und alle Tage vom Samstag vor der
 * ersten bis heute. Dazu die ISO-Wochen, in denen die Aktivität dieser Tage gespeichert wird, und der erste Tag,
 * an dem es Anmeldungen geben soll (Sonntag der ersten Woche).
 * Mit Serverstart beginnt alles frühestens dort: keine Woche, die davor endet, und kein Tag davor.
 * @param {string} jetztIso
 * @param {string | null} serverstart Kalendertag des Serverstarts
 */
export function zeitraum(jetztIso, serverstart = null, abgeschlossen = 5) {
  const heute = berlinDate(jetztIso);
  const aktuell = guildWeek(heute);
  const wochen = Array.from({ length: abgeschlossen + 1 }, (_, i) => shiftGuildWeek(aktuell, i - abgeschlossen)).filter(
    (w) => serverstart === null || w >= serverstart,
  );
  const tage = [];
  const wochenstart = wochen.length > 0 ? guildRange(wochen[0]).from : heute;
  let erster = addDays(wochenstart, -1);
  if (serverstart !== null && erster < serverstart) erster = serverstart;
  for (let d = erster; d <= heute; d = addDays(d, 1)) tage.push(d);
  const anmeldungenAb = serverstart !== null && serverstart > wochenstart ? serverstart : wochenstart;
  return { wochen, aktivitaetsWochen: isoWeeksBetween(tage[0], heute), anmeldungenAb, tage, heute };
}

/**
 * Entfernt Beispieldaten aus der Zeit vor dem Serverstart (Tagesstände, Aktivitätswochen und Wochenergebnisse,
 * die vorher enden). Echte Daten bleiben stehen. Gibt die Zahl der gelöschten Einträge zurück.
 */
export async function entferneBeispieldatenVor(speicher, serverstart) {
  let entfernt = 0;
  const wochen = [];
  for (const prefix of ["history/", "activity/", "weekly/"]) {
    for (const key of await speicher.list(prefix)) {
      if (key === "weekly/index") continue;
      const name = key.slice(prefix.length);
      // Tagesstände heißen nach ihrem Tag, Aktivität nach ISO-Wochen, Wochenergebnisse nach Wertungs- oder alten ISO-Wochen.
      const ende = prefix === "history/" ? name : prefix === "activity/" ? (isWeek(name) ? weekRange(name).to : null) : isWeekId(name) ? weekBounds(name).to : null;
      if (ende === null || ende >= serverstart) continue;
      if ((await speicher.get(key))?.testdaten !== true) continue;
      await speicher.delete(key);
      if (prefix === "weekly/") wochen.push(name);
      entfernt++;
    }
  }
  const index = await speicher.get("weekly/index");
  if (index && wochen.length > 0) await speicher.set("weekly/index", ohneWochen(index, wochen));
  return entfernt;
}

/**
 * Füllt den Speicher mit Beispieldaten. Echte Aktivitätswochen und Tagesstände bleiben unberührt.
 * Wochenergebnisse im Zeitraum werden gelöscht, damit die Auswertung sie neu berechnet.
 * Mit Serverstart entsteht nichts davor, und ältere Beispieldaten aus der Zeit davor werden entfernt.
 * @param {any} speicher
 * @param {string} jetztIso
 * @param {(zeile: string) => void} log
 * @param {string | null} serverstart Kalendertag des Serverstarts
 */
export async function fuelleBeispieldaten(speicher, jetztIso, log = () => {}, serverstart = null) {
  const gilde = await speicher.get("guild");
  if (!gilde) throw new Error("Noch keine Gildendaten. Erst einmal den Sammler laufen lassen (npm run collect:guild).");
  const { wochen, aktivitaetsWochen, anmeldungenAb, tage } = zeitraum(jetztIso, serverstart);
  if (serverstart !== null) {
    const alt = await entferneBeispieldatenVor(speicher, serverstart);
    if (alt > 0) log(`${alt} Beispieldaten aus der Zeit vor dem Serverstart (${serverstart}) entfernt.`);
  }

  const datensaetze = {};
  for (const m of gilde.members.filter((x) => !x.former && x.hasProfile)) {
    datensaetze[String(m.id)] = await speicher.get(`characters/${m.id}`);
  }

  let aktivitaet = 0;
  for (const woche of erzeugeAktivitaet(gilde.members, aktivitaetsWochen, jetztIso, anmeldungenAb)) {
    const vorhanden = await speicher.get(`activity/${woche.week}`);
    if (vorhanden && !vorhanden.testdaten) {
      log(`  activity/${woche.week}: echte Aufzeichnung vorhanden, bleibt unverändert`);
      continue;
    }
    await speicher.set(`activity/${woche.week}`, woche);
    aktivitaet++;
  }

  const echte = new Map();
  for (const key of await speicher.list("history/")) {
    const stand = await speicher.get(key);
    if (stand && !stand.testdaten) echte.set(key.slice("history/".length), stand);
  }
  const staende = erzeugeTagesstaende(gilde.members, tage, echte, datensaetze, serverstart);
  for (const [tag, stand] of staende) await speicher.set(`history/${tag}`, stand);

  // Erzeugte Ausgaben alter ISO-Wochen im Zeitraum fallen mit weg, sonst begänne die Zählung erst nach ihnen.
  // Echte alte Ausgaben bleiben wie live stehen; die Auswertung setzt dann am Tag nach ihnen an.
  const alteWochen = [];
  for (const w of ((await speicher.get("weekly/index")) ?? { weeks: [] }).weeks.filter((x) => isWeek(x) && weekRange(x).to >= tage[0])) {
    if ((await speicher.get(`weekly/${w}`))?.testdaten === true) alteWochen.push(w);
  }
  const geloescht = await loescheWochenergebnisse(speicher, [...alteWochen, ...wochen]);
  log(`${aktivitaet} Aktivitätswochen, ${staende.size} Tagesstände geschrieben, ${echte.size} echte Tagesstände unverändert.`);
  log(`${geloescht} Wochenergebnisse zur Neuberechnung entfernt.`);
  return { aktivitaet, tagesstaende: staende.size, wochen };
}

/** Index ohne die genannten Wochen, samt ihrer Archiv-Einträge. */
function ohneWochen(index, wochen) {
  const entries = Object.fromEntries(Object.entries(index.entries ?? {}).filter(([w]) => !wochen.includes(w)));
  return { weeks: index.weeks.filter((w) => !wochen.includes(w)), ...(index.entries ? { entries } : {}) };
}

/**
 * Löscht Wochenergebnisse (Titel und Zeitung) samt Index-Eintrag, damit die nächste Wochenauswertung sie
 * neu berechnet. Gibt die Zahl der gelöschten Ergebnisse zurück.
 */
export async function loescheWochenergebnisse(speicher, wochen) {
  const index = (await speicher.get("weekly/index")) ?? { weeks: [] };
  let geloescht = 0;
  for (const w of wochen) {
    if (await speicher.get(`weekly/${w}`)) {
      await speicher.delete(`weekly/${w}`);
      geloescht++;
    }
  }
  await speicher.set("weekly/index", ohneWochen(index, wochen));
  return geloescht;
}

/** Entfernt alles mit `testdaten: true` (Aktivität, Tagesstände, Wochenergebnisse). */
export async function entferneBeispieldaten(speicher, log = () => {}) {
  let entfernt = 0;
  const wochen = [];
  for (const prefix of ["activity/", "history/", "weekly/"]) {
    for (const key of await speicher.list(prefix)) {
      if (key === "weekly/index") continue;
      const wert = await speicher.get(key);
      if (wert?.testdaten !== true) continue;
      await speicher.delete(key);
      if (prefix === "weekly/") wochen.push(key.slice("weekly/".length));
      entfernt++;
    }
  }
  const index = await speicher.get("weekly/index");
  if (index) await speicher.set("weekly/index", ohneWochen(index, wochen));
  log(`${entfernt} Einträge mit Beispieldaten entfernt.`);
  return entfernt;
}
