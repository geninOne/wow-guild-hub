// Auswertung für scripts/statistik-erkunden.mjs: reine Funktionen, ohne Netz und Dateien.

/** Median einer Zahlenliste (bei gerader Anzahl Mittel der beiden mittleren Werte). */
export function median(werte) {
  if (werte.length === 0) return null;
  const s = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mitte] : (s[mitte - 1] + s[mitte]) / 2;
}

/** Feldnamen eines Objekts (bei Listen die des ersten Eintrags), für die Suche nach Zusatzfeldern. */
export function felderVon(daten) {
  if (daten === null || typeof daten !== "object") return [];
  return Object.keys(Array.isArray(daten) ? (daten[0] ?? {}) : daten).sort();
}

/**
 * Durchläuft alle Kategorien und Unterkategorien einer Statistik-Antwort.
 * @returns {{ kategorie: {id:number,name:string}, ober: {id:number,name:string}|null, stat: any }[]}
 */
export function statistikEintraege(daten) {
  const ergebnis = [];
  for (const k of daten?.categories ?? []) {
    for (const s of k.statistics ?? []) ergebnis.push({ kategorie: { id: k.id, name: k.name }, ober: null, stat: s });
    for (const u of k.sub_categories ?? []) {
      for (const s of u.statistics ?? []) ergebnis.push({ kategorie: { id: u.id, name: u.name }, ober: { id: k.id, name: k.name }, stat: s });
    }
  }
  return ergebnis;
}

/**
 * Wertet Statistik-Antworten aus.
 * @param {{ mitglied: { id: number, name: string, level: number }, daten: any }[]} antworten
 */
export function auswerten(antworten) {
  const stats = new Map();
  const kategorien = new Map();
  const statFelder = new Set();
  const kategorieFelder = new Set();
  const antwortFelder = new Set();
  let mitText = 0;
  for (const { mitglied, daten } of antworten) {
    felderVon(daten).forEach((f) => antwortFelder.add(f));
    for (const k of daten?.categories ?? []) {
      felderVon(k).forEach((f) => kategorieFelder.add(f));
      if (!kategorien.has(k.id)) kategorien.set(k.id, { id: k.id, name: k.name, ober: null });
      for (const u of k.sub_categories ?? []) {
        felderVon(u).forEach((f) => kategorieFelder.add(f));
        if (!kategorien.has(u.id)) kategorien.set(u.id, { id: u.id, name: u.name, ober: k.id });
      }
    }
    for (const { kategorie, ober, stat } of statistikEintraege(daten)) {
      felderVon(stat).forEach((f) => statFelder.add(f));
      if (typeof stat.description === "string") mitText++;
      const eintrag = stats.get(stat.id) ?? {
        id: stat.id,
        name: stat.name,
        kategorie: kategorie.id,
        ober: ober?.id ?? null,
        werte: [],
        spitze: null,
        textBeispiel: null,
      };
      const wert = typeof stat.quantity === "number" ? stat.quantity : 0;
      eintrag.werte.push(wert);
      if (eintrag.spitze === null || wert > eintrag.spitze.wert) eintrag.spitze = { wert, name: mitglied.name };
      if (eintrag.textBeispiel === null && typeof stat.description === "string") eintrag.textBeispiel = stat.description;
      stats.set(stat.id, eintrag);
    }
  }
  const liste = [...stats.values()].map((s) => ({
    id: s.id,
    name: s.name,
    kategorie: s.kategorie,
    ober: s.ober,
    anzahl: s.werte.length,
    summe: s.werte.reduce((a, b) => a + b, 0),
    maximum: Math.max(...s.werte),
    median: median(s.werte),
    spitze: s.spitze,
    textBeispiel: s.textBeispiel,
  }));
  const reihenfolge = [...kategorien.keys()];
  liste.sort((a, b) => reihenfolge.indexOf(a.kategorie) - reihenfolge.indexOf(b.kategorie) || a.id - b.id);
  return {
    charaktere: antworten.length,
    kategorien: [...kategorien.values()],
    statistiken: liste,
    felder: {
      antwort: [...antwortFelder].sort(),
      kategorie: [...kategorieFelder].sort(),
      statistik: [...statFelder].sort(),
      statistikenMitText: mitText,
    },
  };
}

const zahl = (n) => (n === null ? "" : Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Tabellen je Kategorie für den Bericht, ohne Namen einzelner Charaktere. */
export function markdownTabellen(auswertung) {
  const zeilen = [];
  for (const k of auswertung.kategorien) {
    const eigene = auswertung.statistiken.filter((s) => s.kategorie === k.id);
    if (eigene.length === 0) continue;
    const ober = k.ober === null ? "" : `${auswertung.kategorien.find((o) => o.id === k.ober)?.name ?? k.ober} / `;
    zeilen.push(`#### ${ober}${k.name} (${k.id})`, "", "| ID | Statistik | Charaktere | Summe | Maximum | Median |", "|---:|---|---:|---:|---:|---:|");
    for (const s of eigene) {
      zeilen.push(`| ${s.id} | ${s.name} | ${s.anzahl} | ${zahl(s.summe)} | ${zahl(s.maximum)} | ${zahl(s.median)} |`);
    }
    zeilen.push("");
  }
  return zeilen.join("\n");
}

/**
 * Art einer Statistik für spätere Seiten: "zaehler" wächst mit jedem Ereignis (Differenzen sind Taten im Zeitraum),
 * "stand" ist ein aktueller Stand oder Höchstwert (Fertigkeit, Rezepte, Reittiere), "text" zählt das Häufigste einer
 * Sorte und trägt dessen Namen als Text, "schnitt" ist ein Durchschnitt (Differenzen sind sinnlos).
 */
export function artVon(stat) {
  if (stat.textBeispiel) return "text";
  if (/^Durchschnittlich/.test(stat.name)) return "schnitt";
  if (/^(Höchste|Meiste|Erlernte|Bekannte)|fertigkeit$|Fertigkeit$|besessen|besessenen|auf maximaler|begegnet insgesamt|Unterschiedliche/.test(stat.name)) return "stand";
  return "zaehler";
}

/**
 * Schreibt die statische Liste fort: Neue Kategorien und Statistiken kommen dazu, bekannte behalten ihre Angaben
 * (auch wenn sie in dieser Auswertung fehlen, weil Blizzard Nullwerte weglässt), Namen werden aktualisiert.
 */
export function fortschreiben(liste, auswertung) {
  const kategorien = new Map((liste?.kategorien ?? []).map((k) => [k.id, k]));
  for (const k of auswertung.kategorien) kategorien.set(k.id, { id: k.id, name: k.name, ober: k.ober });
  const statistiken = new Map((liste?.statistiken ?? []).map((s) => [s.id, s]));
  for (const s of auswertung.statistiken) {
    const alt = statistiken.get(s.id);
    statistiken.set(s.id, { id: s.id, name: s.name, kategorie: s.kategorie, art: alt?.art ?? artVon(s) });
  }
  const reihenfolge = [...kategorien.keys()];
  return {
    _hinweis: liste?._hinweis ?? HINWEIS,
    kategorien: [...kategorien.values()],
    statistiken: [...statistiken.values()].sort(
      (a, b) => reihenfolge.indexOf(a.kategorie) - reihenfolge.indexOf(b.kategorie) || a.id - b.id,
    ),
  };
}

const HINWEIS =
  "Namen und Kategorien der Charakterstatistik (Blizzard-Endpunkt achievements/statistics, deutsch). Einen Endpunkt mit allen Definitionen gibt es für WoW Forever nicht, deshalb wird die Liste aus den gesehenen Antworten fortgeschrieben: npm run statistik:erkunden. Die Wochenstände unter stats/<Samstag> enthalten nur Statistik-ID und Wert. art: zaehler (Ereignisse, Differenz sinnvoll), stand (aktueller Stand oder Höchstwert), text (Häufigstes einer Sorte, Name im Charakterdatensatz unter statTexts), schnitt (Durchschnitt, Differenz sinnlos).";
