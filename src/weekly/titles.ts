import type { MemberSummary, TitleAward, WeekMetrics, WeeklyRecord } from "../model";
import type { Fassungen } from "../sprache";

export interface TitleDef {
  id: string;
  /** Name in allen Sprachfassungen (Deutsch und Englisch Pflicht, Dialekte optional). */
  name: Fassungen;
  /** Regel in einem Satz, für die Übersicht. */
  description: Fassungen;
  /** Mindestwert, darunter wird der Titel nicht vergeben (eine Anmeldung ist keine Meldung wert). */
  min: number;
  /** Wert, nach dem der Titel vergeben wird; null zählt nicht. Fehlt bei Titeln, die aus anderen Titeln folgen. */
  value?(m: WeekMetrics): number | null;
  /** Wert als Text, z. B. "7 Tode". */
  valueText(n: number): Fassungen;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

export const TITLES: TitleDef[] = [
  {
    id: "nachteule",
    min: 3,
    name: { de: "Nachteule", en: "Night Owl", schwaebisch: "Nachteul", bayrisch: "Nachteule" },
    description: {
      de: "Die meisten Anmeldungen zwischen 1 und 5 Uhr nachts.",
      en: "Most logins between 1 and 5 a.m.",
      schwaebisch: "Am öftesten aagmeldet zwischa 1 ond 5 Uhr nachts.",
      bayrisch: "Am öftesten eigloggt zwischen 1 und 5 Uhr in da Nacht.",
    },
    value: (m) => m.nightLogins,
    valueText: (n) => ({
      de: `${plural(n, "Anmeldung", "Anmeldungen")} zwischen 1 und 5 Uhr nachts`,
      en: `${plural(n, "login", "logins")} between 1 and 5 a.m.`,
      schwaebisch: `${plural(n, "Aameldung", "Aameldunga")} zwischa 1 ond 5 Uhr nachts`,
      bayrisch: `${plural(n, "Anmeldung", "Anmeldungen")} zwischen 1 und 5 Uhr in da Nacht`,
    }),
  },
  {
    id: "frueher-vogel",
    min: 3,
    name: { de: "Früher Vogel", en: "Early Bird", schwaebisch: "Früher Vogel", bayrisch: "Frühaufsteher" },
    description: {
      de: "Die meisten Anmeldungen zwischen 5 und 8 Uhr morgens.",
      en: "Most logins between 5 and 8 a.m.",
      schwaebisch: "Am öftesten aagmeldet zwischa 5 ond 8 Uhr morgens.",
      bayrisch: "Am öftesten eigloggt zwischen 5 und 8 Uhr in da Fruah.",
    },
    value: (m) => m.earlyLogins,
    valueText: (n) => ({
      de: `${plural(n, "Anmeldung", "Anmeldungen")} zwischen 5 und 8 Uhr morgens`,
      en: `${plural(n, "login", "logins")} between 5 and 8 a.m.`,
      schwaebisch: `${plural(n, "Aameldung", "Aameldunga")} zwischa 5 ond 8 Uhr morgens`,
      bayrisch: `${plural(n, "Anmeldung", "Anmeldungen")} zwischen 5 und 8 Uhr in da Fruah`,
    }),
  },
  {
    id: "stammgast",
    min: 5,
    name: { de: "Stammgast", en: "The Regular", schwaebisch: "Stammgascht", bayrisch: "Stammtischbruader" },
    description: {
      de: "An den meisten Tagen der Woche angemeldet.",
      en: "Logged in on the most days of the week.",
      schwaebisch: "An de meischte Täg vo dr Woch aagmeldet.",
      bayrisch: "An de meisten Dog vo da Woch eigloggt.",
    },
    value: (m) => m.activeDays,
    valueText: (n) => ({
      de: `an ${plural(n, "Tag", "Tagen")} angemeldet`,
      en: `logged in on ${plural(n, "day", "days")}`,
      schwaebisch: `an ${plural(n, "Tag", "Täg")} aagmeldet`,
      bayrisch: `an ${plural(n, "Dog", "Dog")} eigloggt`,
    }),
  },
  {
    id: "dauerlaeufer",
    min: 3,
    name: { de: "Dauerläufer", en: "Marathon Runner", schwaebisch: "Dauerläufer", bayrisch: "Dauerläufer" },
    description: {
      de: "Die meisten Level in sieben Tagen.",
      en: "Most levels gained in seven days.",
      schwaebisch: "Die meischte Level in siebe Täg.",
      bayrisch: "De meisten Level in siebn Dog.",
    },
    value: (m) => m.levels,
    valueText: (n) => ({ de: `${n} Level`, en: plural(n, "level", "levels"), schwaebisch: `${n} Level`, bayrisch: `${n} Level` }),
  },
  {
    id: "frisch-eingekleidet",
    min: 1,
    name: { de: "Frisch eingekleidet", en: "Freshly Geared", schwaebisch: "Frisch eigkleidet", bayrisch: "Frisch aufbrezlt" },
    description: {
      de: "Der größte Sprung bei der Gegenstandsstufe.",
      en: "Biggest jump in item level.",
      schwaebisch: "Dr greschte Satz bei dr Gegenstandsstufe.",
      bayrisch: "Da gräßte Sprung bei da Gegenstandsstufe.",
    },
    value: (m) => m.itemLevel,
    valueText: (n) => ({
      de: `+${plural(n, "Gegenstandsstufe", "Gegenstandsstufen")}`,
      en: `+${plural(n, "item level", "item levels")}`,
      schwaebisch: `+${plural(n, "Gegenstandsstufe", "Gegenstandsstufa")}`,
      bayrisch: `+${plural(n, "Gegenstandsstufe", "Gegenstandsstufn")}`,
    }),
  },
  {
    id: "pechvogel",
    min: 3,
    name: { de: "Pechvogel", en: "Corpse Runner", schwaebisch: "Pechvogel", bayrisch: "Pechvogl" },
    description: {
      de: "Die meisten Tode der Woche.",
      en: "Most deaths of the week.",
      schwaebisch: "Am öftesten gstorbe in dr Woch.",
      bayrisch: "Am öftesten higwesn in da Woch.",
    },
    value: (m) => m.deaths,
    valueText: (n) => ({
      de: plural(n, "Tod", "Tode"),
      en: plural(n, "death", "deaths"),
      schwaebisch: plural(n, "Tod", "Tode"),
      bayrisch: plural(n, "Tod", "Tode"),
    }),
  },
  {
    id: "schaffe-schaffe",
    min: 3,
    name: { de: "Arbeitstier", en: "Workhorse", schwaebisch: "Schaffe, schaffe", bayrisch: "Hackler" },
    description: {
      de: "Die meisten neuen Rezepte der Woche.",
      en: "Most new recipes learned this week.",
      schwaebisch: "Die meischte neie Rezept in dr Woch.",
      bayrisch: "De meisten neien Rezepte in da Woch.",
    },
    value: (m) => m.recipes,
    valueText: (n) => ({
      de: plural(n, "neues Rezept", "neue Rezepte"),
      en: plural(n, "new recipe", "new recipes"),
      schwaebisch: plural(n, "neis Rezept", "neie Rezept"),
      bayrisch: plural(n, "neis Rezept", "neie Rezepte"),
    }),
  },
  {
    id: "kellerkind",
    min: 3,
    name: { de: "Kellerkind", en: "Dungeon Crawler", schwaebisch: "Kellerkend", bayrisch: "Kellerkind" },
    description: {
      de: "Die meisten betretenen Dungeons der Woche.",
      en: "Most dungeons entered this week.",
      schwaebisch: "In die meischte Dungeons nag'stiege in dr Woch.",
      bayrisch: "In de meisten Dungeons owe gstiegn in da Woch.",
    },
    value: (m) => m.dungeons,
    valueText: (n) => ({
      de: `${plural(n, "Dungeon", "Dungeons")} betreten`,
      en: `${plural(n, "dungeon", "dungeons")} entered`,
      schwaebisch: `${plural(n, "Dungeon", "Dungeons")} betrete`,
      bayrisch: `${plural(n, "Dungeon", "Dungeons")} betretn`,
    }),
  },
  {
    id: "kaepsele",
    min: 3,
    name: { de: "Schlaukopf", en: "Overachiever", schwaebisch: "Käpsele", bayrisch: "Gscheithaferl" },
    description: {
      de: "Die meisten neu abgeschlossenen Erfolge der Woche.",
      en: "Most achievements earned this week.",
      schwaebisch: "Die meischte neie Erfolg in dr Woch.",
      bayrisch: "De meisten neien Erfolge in da Woch.",
    },
    value: (m) => m.achievements,
    valueText: (n) => ({
      de: plural(n, "neuer Erfolg", "neue Erfolge"),
      en: plural(n, "new achievement", "new achievements"),
      schwaebisch: plural(n, "neier Erfolg", "neie Erfolg"),
      bayrisch: plural(n, "neier Erfolg", "neie Erfolge"),
    }),
  },
  {
    id: "schleimer",
    min: 2,
    name: { de: "Schleimer vom Dienst", en: "Resident Brown-Noser", schwaebisch: "Schleimer vom Dienscht", bayrisch: "Oschmierer vom Dienst" },
    description: {
      de: "Die meisten gewonnenen Rufstufen der Woche, über alle Fraktionen.",
      en: "Most reputation levels gained this week, across all factions.",
      schwaebisch: "Die meischte Rufstufa in dr Woch, über älle Fraktiona.",
      bayrisch: "De meisten Rufstufn in da Woch, über olle Fraktionen.",
    },
    value: (m) => m.reputation,
    valueText: (n) => ({
      de: `${plural(n, "Rufstufe", "Rufstufen")} gewonnen`,
      en: `${plural(n, "reputation level", "reputation levels")} gained`,
      schwaebisch: `${plural(n, "Rufstufe", "Rufstufa")} gwonna`,
      bayrisch: `${plural(n, "Rufstufe", "Rufstufn")} gwunna`,
    }),
  },
  {
    id: "verlorener-sohn",
    min: 14,
    name: { de: "Verlorener Sohn", en: "Prodigal Son", schwaebisch: "Verlorener Sohn", bayrisch: "Verlorener Sohn" },
    description: {
      de: "Diese Woche wieder da, nach der längsten Pause (mindestens 14 Tage).",
      en: "Back this week after the longest break (at least 14 days).",
      schwaebisch: "Die Woch wieder do, nach dr längschte Paus (mindeschtens 14 Täg).",
      bayrisch: "De Woch wieda do, nach da längsten Pause (mindestens 14 Dog).",
    },
    value: (m) => m.awayDays,
    valueText: (n) => ({
      de: `nach ${plural(n, "Tag", "Tagen")} Pause zurück`,
      en: `back after a ${n}-day break`,
      schwaebisch: `nach ${plural(n, "Tag", "Täg")} Paus wieder do`,
      bayrisch: `nach ${n} Dog Pause wieda do`,
    }),
  },
  {
    id: "tausendsassa",
    min: 3,
    name: { de: "Tausendsassa", en: "Jack of All Trades", schwaebisch: "Tausendsassa", bayrisch: "Tausendsassa" },
    description: {
      de: "In den meisten anderen Titeln unter den ersten fünf (mindestens drei).",
      en: "In the top five of the most other titles (at least three).",
      schwaebisch: "In de meischte andre Titel onter de erschte fünf (mindeschtens drei).",
      bayrisch: "In de meisten andan Titeln unter de erstn fünf (mindestens drei).",
    },
    valueText: (n) => ({
      de: `in ${plural(n, "Titel", "Titeln")} unter den ersten fünf`,
      en: `top five in ${plural(n, "title", "titles")}`,
      schwaebisch: `in ${n} Titel onter de erschte fünf`,
      bayrisch: `in ${plural(n, "Titel", "Titeln")} unter de erstn fünf`,
    }),
  },
];

/** Plätze, die für den Tausendsassa zählen. */
export const TAUSENDSASSA_TOP = 5;

export function titleDef(id: string): TitleDef | undefined {
  return TITLES.find((t) => t.id === id);
}

/**
 * Abmeldeliste aus der Umgebungsvariable `TITLE_OPT_OUTS`: kommagetrennt Slug, Name oder Charakter-ID der
 * Charaktere, die keine Spaßtitel bekommen sollen. Reine Zahlen gelten als ID.
 */
export function parseOptOuts(raw: string | undefined): (string | number)[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

export const TITLE_OPT_OUTS: (string | number)[] = parseOptOuts(
  typeof process === "undefined" ? undefined : process.env.TITLE_OPT_OUTS,
);

/** Steht das Mitglied (per ID, Slug oder Name, Groß- und Kleinschreibung egal) auf der Abmeldeliste? */
export function isOptedOut(member: MemberSummary, list: (string | number)[]): boolean {
  return list.some((entry) => {
    if (typeof entry === "number") return entry === member.id;
    const wanted = entry.trim().toLowerCase().normalize("NFC");
    if (wanted === "") return false;
    return [String(member.id), member.slug, member.name].some((v) => v.toLowerCase().normalize("NFC") === wanted);
  });
}

/** Rangliste eines Titels: [Charakter-ID, Wert], bester zuerst. */
export type TitleRanking = [id: number, value: number][];

export interface TitleResult {
  awards: TitleAward[];
  /** Je Titel alle Kandidaten mit einem Wert ab 1, bester zuerst (auch unter dem Mindestwert); Titelträger vor den anderen Inhabern. */
  rankings: Record<string, TitleRanking>;
}

/** Alle Inhaber eines vergebenen Titels; ältere Wochen kennen nur den Titelträger. */
export function titleHolders(award: TitleAward): number[] {
  return award.characterIds ?? [award.characterId];
}

/** Fester Zufall für Gleichstände: FNV-1a über den Text, gleiche Eingabe gibt immer denselben Wert. */
export function tieHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Was für die Wahl des Titelträgers bei Gleichstand nötig ist. */
export interface TitleHistory {
  /** Die ausgewertete Woche, Grundlage des festen Zufalls. */
  week: string;
  /** Frühere Wochenergebnisse, die jüngste zuerst. */
  previous: Pick<WeeklyRecord, "titles">[];
}

/**
 * Reihenfolge der Inhaber eines geteilten Titels, Titelträger zuerst: wer den Titel am längsten nicht hatte (noch nie
 * zuerst), dann ein fester Zufall aus Woche, Titel und Charakter. Weder Name noch Spielzeit spielen eine Rolle.
 */
export function orderHolders(ids: number[], titleId: string, history: TitleHistory): number[] {
  const lastHeld = (id: number) => {
    const i = history.previous.findIndex((r) => r.titles.some((a) => a.titleId === titleId && titleHolders(a).includes(id)));
    return i === -1 ? Infinity : i;
  };
  const key = new Map(ids.map((id) => [id, { gap: lastHeld(id), hash: tieHash(`${history.week}:${titleId}:${id}`) }]));
  return [...ids].sort((a, b) => {
    const ka = key.get(a)!;
    const kb = key.get(b)!;
    if (ka.gap !== kb.gap) return ka.gap === Infinity ? -1 : kb.gap === Infinity ? 1 : kb.gap - ka.gap;
    return ka.hash - kb.hash || a - b;
  });
}

/**
 * Vergibt jeden Titel an alle aktiven Charaktere mit dem höchsten Wert (mindestens `min`); bei Gleichstand teilen sie
 * ihn. Auf der Karte steht einer davon, siehe `orderHolders`. Abgemeldete und Ehemalige werden übersprungen.
 * Dazu die ganze Rangliste je Titel, damit die Titelseite zeigen kann, wer wie viel hatte.
 * Für den Tausendsassa zählt der Platz: Wer gleich viel hat, teilt sich den Platz, und jeder Platz bis 5 zählt.
 */
export function rankTitles(
  metrics: Map<number, WeekMetrics>,
  members: MemberSummary[],
  optOuts: (string | number)[] = TITLE_OPT_OUTS,
  history: TitleHistory = { week: "", previous: [] },
): TitleResult {
  const candidates = members.filter((m) => !m.former && metrics.has(m.id) && !isOptedOut(m, optOuts));
  const awards: TitleAward[] = [];
  const rankings: Record<string, TitleRanking> = {};
  const topCount = new Map<number, number>();

  const rank = (title: TitleDef, values: { id: number; value: number }[]) => {
    const all = values.filter((c) => c.value >= 1);
    const best = all.reduce((max, c) => Math.max(max, c.value), 0);
    const holders = best >= Math.max(1, title.min) ? all.filter((c) => c.value === best).map((c) => c.id) : [];
    const ordered = orderHolders(holders, title.id, history);
    const pos = new Map(ordered.map((id, i) => [id, i]));
    // Gleiche Werte in fester, zufälliger Reihenfolge; die Inhaber in der Reihenfolge der Kartenwahl
    const hash = (id: number) => tieHash(`${history.week}:${title.id}:${id}`);
    all.sort((a, b) => b.value - a.value || (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0) || hash(a.id) - hash(b.id) || a.id - b.id);
    rankings[title.id] = all.map((c) => [c.id, c.value]);
    if (ordered.length > 0) {
      awards.push({
        titleId: title.id, characterId: ordered[0], ...(ordered.length > 1 ? { characterIds: ordered } : {}), value: best,
      });
    }
    return all;
  };

  for (const title of TITLES) {
    if (!title.value) continue;
    const value = title.value;
    const all = rank(title, candidates.map((m) => ({ id: m.id, value: value(metrics.get(m.id)!) ?? 0 })));
    const ranked = all.filter((c) => c.value >= Math.max(1, title.min));
    for (const c of ranked) {
      const place = 1 + ranked.filter((o) => o.value > c.value).length;
      if (place <= TAUSENDSASSA_TOP) topCount.set(c.id, (topCount.get(c.id) ?? 0) + 1);
    }
  }
  // Tausendsassa: in den meisten anderen Titeln unter den ersten fünf, zählt sich selbst nicht mit.
  rank(titleDef("tausendsassa")!, candidates.map((m) => ({ id: m.id, value: topCount.get(m.id) ?? 0 })));
  return { awards, rankings };
}

/** Nur die vergebenen Titel, siehe `rankTitles`. */
export function awardTitles(
  metrics: Map<number, WeekMetrics>,
  members: MemberSummary[],
  optOuts: (string | number)[] = TITLE_OPT_OUTS,
  history?: TitleHistory,
): TitleAward[] {
  return rankTitles(metrics, members, optOuts, history).awards;
}
