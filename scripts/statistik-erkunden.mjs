// Testlauf gegen die Blizzard-API: Was liefert der Statistik-Endpunkt für WoW Forever wirklich?
// Nur lokal, nichts davon geht live. Holt für alle aktuellen Mitglieder beider Gilden mit Profil die Statistik
// (gedrosselt wie der Sammler), wertet je Statistik Anzahl, Summe, Maximum und Median aus und prüft Stichproben
// weiterer Endpunkte (Definitionen, Erfolge, Sammlungen).
//
// Aufruf aus dem Projektordner:  npm run statistik:erkunden
// Zugangsdaten kommen aus der lokalen .env und werden nie ausgegeben.
// Rohantworten und Auswertung landen in .erkundung/ (nicht versioniert); die statische Namensliste
// config/statistiken.json wird fortgeschrieben (neue Statistiken kommen dazu, bekannte bleiben).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createBlizzardClient } from "../src/blizzard/client.ts";
import { runPool } from "../src/lib/pool.ts";
import { auswerten, felderVon, fortschreiben, markdownTabellen } from "./statistik-erkunden-lib.mjs";

const ziel = resolve(process.env.ERKUNDUNG_ORDNER ?? ".erkundung");
const log = (zeile) => console.log(zeile);

try {
  process.loadEnvFile(".env");
} catch {
  // ohne .env gelten die Werte aus der Umgebung
}
const env = process.env;
if (!env.BNET_CLIENT_ID || !env.BNET_CLIENT_SECRET) {
  console.error("BNET_CLIENT_ID und BNET_CLIENT_SECRET fehlen (lokale .env).");
  process.exit(2);
}
const region = env.BNET_REGION || "eu";
const locale = env.BNET_LOCALE || "de_DE";
const gilden = (env.GUILD_SLUGS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (gilden.length === 0) {
  console.error("GUILD_SLUGS fehlt (lokale .env), z. B. GUILD_SLUGS=meine-gilde,zweite-gilde.");
  process.exit(2);
}
const parallel = Number(env.COLLECT_CONCURRENCY || 10);

const client = createBlizzardClient({ clientId: env.BNET_CLIENT_ID, clientSecret: env.BNET_CLIENT_SECRET, region, locale });

await mkdir(join(ziel, "statistik"), { recursive: true });
await mkdir(join(ziel, "proben"), { recursive: true });
const speichern = (datei, daten) => writeFile(join(ziel, datei), JSON.stringify(daten, null, 2));

// 1. Mitglieder beider Gilden
const mitglieder = new Map();
for (const slug of gilden) {
  const res = await client.get(`/data/wow/guild/${encodeURIComponent(slug)}/roster`, "profile");
  if (res.status !== 200) throw new Error(`Roster ${slug}: HTTP ${res.status}`);
  for (const m of res.data?.members ?? []) {
    const c = m.character ?? {};
    if (c.id && c.slug) mitglieder.set(c.id, { id: c.id, name: c.name, slug: c.slug, level: c.level ?? 0, gilde: slug });
  }
}
log(`${mitglieder.size} Mitglieder in ${gilden.length} Gilden`);

// 2. Profil und Statistik je Mitglied, so gedrosselt wie der Sammler
const antworten = [];
const status = { ohneProfil: 0, ohneStatistik: 0, fehler: 0 };
const pool = await runPool(
  [...mitglieder.values()],
  async (m) => {
    const basis = `/profile/wow/character/${encodeURIComponent(m.slug)}`;
    const profil = await client.get(basis, "profile");
    if (profil.status !== 200) {
      status.ohneProfil++;
      return;
    }
    const stat = await client.get(`${basis}/achievements/statistics`, "profile");
    if (stat.status !== 200) {
      status.ohneStatistik++;
      return;
    }
    await speichern(`statistik/${m.id}.json`, stat.data);
    antworten.push({ mitglied: { ...m, level: profil.data?.level ?? m.level }, daten: stat.data });
  },
  { concurrency: parallel, deadline: Date.now() + 10 * 60_000 },
);
status.fehler = pool.failed.length;
log(`${antworten.length} Statistiken geholt, ohne Profil ${status.ohneProfil}, ohne Statistik ${status.ohneStatistik}, Fehler ${status.fehler}`);

// 3. Auswertung
const auswertung = auswerten(antworten);
await speichern("auswertung.json", { status, ...auswertung });
await writeFile(join(ziel, "tabellen.md"), markdownTabellen(auswertung));
log(`${auswertung.statistiken.length} verschiedene Statistiken in ${auswertung.kategorien.length} Kategorien`);
const listenPfad = resolve("config/statistiken.json");
const alteListe = await readFile(listenPfad, "utf-8").then(JSON.parse, () => null);
const liste = fortschreiben(alteListe, auswertung);
await writeFile(listenPfad, `${JSON.stringify(liste, null, 2)}\n`);
log(`config/statistiken.json: ${liste.statistiken.length} Statistiken (vorher ${alteListe?.statistiken?.length ?? 0})`);

// 4. Stichproben weiterer Endpunkte
const probe = async (name, pfad, ns) => {
  const res = await client.get(pfad, ns);
  await speichern(`proben/${name}.json`, res);
  return { name, pfad, ns, status: res.status, felder: felderVon(res.data) };
};
const reich = [...antworten].sort((a, b) => b.mitglied.level - a.mitglied.level);
const beispiele = reich.slice(0, 3).map((a) => a.mitglied);
const proben = [];
// Definitionen: Statistiken sind im Spiel Erfolge mit Statistik-Kennzeichen, die Kategorie 1 ist "Statistik".
for (const [name, pfad] of [
  ["kategorie-index", "/data/wow/achievement-category/index"],
  ["kategorie-1", "/data/wow/achievement-category/1"],
  ["kategorie-130", "/data/wow/achievement-category/130"],
  ["kategorie-122", "/data/wow/achievement-category/122"],
  ["erfolg-60", "/data/wow/achievement/60"],
  ["erfolg-index", "/data/wow/achievement/index"],
]) {
  proben.push(await probe(name, pfad, "static"));
}
for (const m of beispiele) {
  const basis = `/profile/wow/character/${encodeURIComponent(m.slug)}`;
  for (const [teil, pfad] of [
    ["profil", ""],
    ["erfolge", "/achievements"],
    ["reittiere", "/collections/mounts"],
    ["haustiere", "/collections/pets"],
    ["sammlungen", "/collections"],
    ["spielzeug", "/collections/toys"],
    ["quests", "/quests/completed"],
    ["titel", "/titles"],
    ["dungeons", "/encounters/dungeons"],
    ["pvp", "/pvp-summary"],
    ["jagdbegleiter", "/hunter-pets"],
  ]) {
    proben.push(await probe(`${m.id}-${teil}`, basis + pfad, "profile"));
  }
}
await speichern("proben.json", proben);
for (const p of proben) log(`${String(p.status).padStart(3)} ${p.ns.padEnd(7)} ${p.pfad}`);
log(`Fertig. Ergebnisse in ${ziel}`);
