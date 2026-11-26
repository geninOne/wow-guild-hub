import { berlinDate } from "../lib/time";
import type { ActivityWeek, DaySnapshot, MemberSummary, TitleAward, WeekMetrics, WochenZahlArt } from "../model";
import type { Fassungen, Sprache } from "../sprache";
import type { Picker } from "./bausteine";

/** Rubriken der Ausgabe, in dieser Reihenfolge nach dem Aufmacher. */
export const SECTIONS = ["Aufsteiger", "Rekorde", "Handwerk", "Klatsch", "Friedhof", "Zahl der Woche"] as const;
/** Eine Rubrik des Kerns oder, bei Meldungen von Erweiterungen, deren eigene (deutscher Name). */
export type Section = (typeof SECTIONS)[number] | (string & {});

/** Schlagzeile und Text einer Meldung in einer Sprache. */
export interface MeldungsText {
  headline: string;
  text: string;
}

/** Was eine Erweiterung zum Schreiben ihrer Meldung aus Satzbausteinen bekommt. */
export interface SchreibWerkzeug {
  /** Name eines Charakters. */
  name: (id: number) => string;
  /**
   * Wählt Satzbausteine so, dass sie sich nicht aus den letzten Ausgaben wiederholen. Topfnamen der Erweiterung
   * sollten mit ihrer Kennung beginnen, damit sie sich nicht mit denen des Kerns oder anderer Module überschneiden.
   */
  picker: Picker;
  /** Startwert für die Wahl, je Meldung verschieden. */
  seed: string;
}

/**
 * Meldung einer Erweiterung für die Wochenzeitung. Die Erweiterung rechnet alles selbst aus und liefert Texte aus
 * Satzbausteinen; gespeichert wird nur der fertige Artikel mit `art` als Art, wie bei den Meldungen des Kerns.
 */
export interface ErweiterungsFakt {
  kind: "erweiterung";
  /** Art der Meldung, etwa `"umfrage"`; steht im gespeicherten Artikel und zählt für den Wechsel zwischen Ausgaben. */
  art: string;
  /** Rubrik (deutscher Name); Fassungen in anderen Sprachen kommen aus `ServerErweiterung.rubriken`. */
  rubrik: string;
  /** Nachrichtenwert wie bei den eigenen Meldungen: etwa 10 (Kleinkram) bis 80 (ganz groß). */
  nachrichtenwert: number;
  /** Betroffene Charaktere. Meldungen mit Ehemaligen oder Abgemeldeten fallen weg. */
  characterIds: number[];
  /** Alle Zahlen, die ein Text nennen darf (die KI-Texte werden dagegen geprüft). */
  zahlen: number[];
  /** Texte aus Satzbausteinen: Deutsch und Englisch Pflicht, fehlende Dialekte fallen auf Deutsch zurück. */
  schreibe(w: SchreibWerkzeug): Fassungen<MeldungsText>;
  /** Der Fakt für die KI-Texter, ohne `nr`, `rubrik` und `art` (die setzt der Kern), mit Namen statt IDs. */
  fuerKi(name: (id: number) => string, sprache: Sprache): Record<string, unknown>;
}

/** Was in einer Woche passiert ist, noch ohne Worte. Aus Fakten macht ein `TextGenerator` Artikel. */
export type ZeitungFact =
  | { kind: "sprung"; characterId: number; levels: number; from: number; to: number; title: string | null }
  | { kind: "meilensteine"; entries: { characterId: number; level: number }[] }
  | { kind: "ueberholungen"; entries: { characterId: number; passedId: number; level: number }[] }
  | { kind: "titel"; titleId: string; characterId: number; value: number }
  | { kind: "neuzugang"; characterIds: number[] }
  | { kind: "rezepte"; characterId: number; count: number; total: number; crafters: number; title: string | null }
  | { kind: "stosszeit"; weekday: number; hour: number; count: number }
  | { kind: "zahl"; value: number; what: ZahlArt }
  | { kind: "ruhig" }
  | { kind: "rekord"; entries: { art: WochenZahlArt; characterId: number | null; value: number; previous: number }[] }
  | ErweiterungsFakt;

/** Woraus die Zahl der Woche bestehen kann. */
export type ZahlArt = "level" | "anmeldungen" | "rezepte" | "dungeons" | "tode" | "erfolge";

/** Was eine frühere Ausgabe enthielt, damit die nächste anders aussieht. Die jüngste zuerst. */
export interface RecentFacts {
  /** Meldungsarten der Ausgabe, Titel als `titel:<id>`. */
  kinds: string[];
  /** Art der Zahl der Woche. */
  zahl?: string;
}

/** Mindestwerte, ab denen etwas eine Meldung wert ist. */
export const MIN = {
  sprung: 3,
  rezepteGesamt: 3,
  stosszeit: 5,
} as const;

const MILESTONES = [60, 50, 40, 30, 20, 10];
const MAX_MILESTONES = 6;
const MAX_OVERTAKES = 3;
const RACE_TOP = 15;
/** Höchstzahl der Meldungen einer Ausgabe, Aufmacher eingeschlossen. */
export const MAX_ARTICLES = 10;

/** Rubrik eines Fakts. */
export function sectionOf(fact: ZeitungFact): Section {
  switch (fact.kind) {
    case "sprung":
    case "meilensteine":
    case "ueberholungen":
      return "Aufsteiger";
    case "rezepte":
      return "Handwerk";
    case "titel":
      if (["dauerlaeufer", "kellerkind", "kaepsele", "frisch-eingekleidet"].includes(fact.titleId)) return "Aufsteiger";
      if (fact.titleId === "schaffe-schaffe") return "Handwerk";
      if (fact.titleId === "pechvogel") return "Friedhof";
      return "Klatsch";
    case "zahl":
      return "Zahl der Woche";
    case "rekord":
      return "Rekorde";
    case "erweiterung":
      return fact.rubrik;
    default:
      return "Klatsch";
  }
}

/** Art eines Fakts für den Abgleich mit früheren Ausgaben. */
export function factKey(fact: ZeitungFact): string {
  return fact.kind === "titel" ? `titel:${fact.titleId}` : artOf(fact);
}

/** Art, wie sie im gespeicherten Artikel steht: bei Erweiterungen deren eigene. */
export function artOf(fact: ZeitungFact): string {
  return fact.kind === "erweiterung" ? fact.art : fact.kind;
}

/** Nachrichtenwert: wie groß das Ereignis dieser Woche ist. Höher kommt weiter nach vorn. */
export function newsValue(fact: ZeitungFact): number {
  switch (fact.kind) {
    case "meilensteine":
      return 30 + 5 * Math.min(4, fact.entries.length) + (fact.entries.some((e) => e.level === 60) ? 45 : 0);
    case "sprung":
      return 40 + 3 * fact.levels;
    case "neuzugang":
      return 38 + 6 * fact.characterIds.length;
    case "ueberholungen":
      return 26 + 6 * fact.entries.length;
    case "titel": {
      const special = fact.titleId === "verlorener-sohn" ? 15 : fact.titleId === "pechvogel" ? 5 : 0;
      return 20 + special + Math.min(25, 4 * fact.value);
    }
    case "rezepte":
      return 15 + Math.min(30, Math.floor(fact.total / 5));
    case "stosszeit":
      return 10 + Math.min(20, fact.count);
    case "rekord":
      return 50 + 5 * fact.entries.length;
    case "erweiterung":
      return fact.nachrichtenwert;
    default:
      return 0;
  }
}

/** Abschlag für Meldungsarten, die in den letzten Ausgaben schon vorkamen, damit die Ausgaben wechseln. */
function freshness(key: string, recent: RecentFacts[]): number {
  if (recent[0]?.kinds.includes(key)) return 0.7;
  if (recent[1]?.kinds.includes(key)) return 0.85;
  return 1;
}

/**
 * Fakten einer Woche: Aufmacher zuerst, danach nach Rubriken. Ähnliche Meldungen sind zusammengefasst
 * (alle runden Level in einer Meldung, alle Überholungen in einer), Kleinkram unter den Mindestwerten
 * fällt weg, höchstens `MAX_ARTICLES` Meldungen. Charaktere aus `excluded` (Abmeldeliste) kommen nicht vor.
 * Ohne Ereignisse genau ein Fakt `ruhig`.
 */
export function collectFacts(input: {
  from: string;
  to: string;
  metrics: Map<number, WeekMetrics>;
  members: MemberSummary[];
  before: DaySnapshot | null;
  end: DaySnapshot | null;
  activity: ActivityWeek | null;
  titles: TitleAward[];
  excluded?: Set<number>;
  /** Frühere Ausgaben, die jüngste zuerst. */
  recent?: RecentFacts[];
  /** Fertige Meldungen aus anderen Quellen (Rekorde, Erweiterungen), die mit um die Plätze konkurrieren. */
  zusatz?: ZeitungFact[];
}): ZeitungFact[] {
  const recent = input.recent ?? [];
  const { metrics, before, end } = input;
  const excluded = input.excluded ?? new Set<number>();
  const active = input.members.filter((m) => !m.former && !excluded.has(m.id));
  const byName = (a: MemberSummary, b: MemberSummary) => a.name.localeCompare(b.name, "de") || a.id - b.id;
  const levelOf = (snap: DaySnapshot | null, id: number) => snap?.characters[String(id)]?.level;
  const titleOf = (titleId: string, id: number) => input.titles.find((t) => t.titleId === titleId && t.characterId === id);
  // Bei Gleichstand an der Spitze zuerst der Titelträger von der Karte, damit Zeitung und Titelseite denselben Namen nennen
  const cardFirst = (titleId: string, a: MemberSummary, b: MemberSummary) =>
    Number(titleOf(titleId, b.id) !== undefined) - Number(titleOf(titleId, a.id) !== undefined);
  const facts: ZeitungFact[] = [];
  const used = new Set<string>(); // Titel, die schon in einer anderen Meldung stecken

  // Größter Levelsprung, ab Mindestwert; der Dauerläufer-Titel steckt dann mit drin.
  const climbers = active
    .map((m) => ({ m, levels: metrics.get(m.id)?.levels ?? 0 }))
    .filter((c) => c.levels >= MIN.sprung)
    .sort((a, b) => b.levels - a.levels || cardFirst("dauerlaeufer", a.m, b.m) || byName(a.m, b.m));
  if (climbers.length > 0) {
    const { m, levels } = climbers[0];
    const title = titleOf("dauerlaeufer", m.id) ? "dauerlaeufer" : null;
    if (title) used.add(title);
    facts.push({ kind: "sprung", characterId: m.id, levels, from: levelOf(before, m.id)!, to: levelOf(end, m.id)!, title });
  }

  // Runde Level, alle in einer Meldung: je Charakter das höchste, das in der Woche erreicht wurde.
  const milestones = active
    .flatMap((m) => {
      const a = levelOf(before, m.id);
      const b = levelOf(end, m.id);
      if (a === undefined || b === undefined) return [];
      const level = MILESTONES.find((l) => a < l && l <= b);
      return level === undefined ? [] : [{ m, level }];
    })
    .sort((a, b) => b.level - a.level || byName(a.m, b.m))
    .slice(0, MAX_MILESTONES);
  if (milestones.length > 0) {
    facts.push({ kind: "meilensteine", entries: milestones.map(({ m, level }) => ({ characterId: m.id, level })) });
  }

  // Überholungen unter den Höchsten am Wochenende, jeder Charakter nur einmal beteiligt.
  const race = active
    .flatMap((m) => {
      const a = levelOf(before, m.id);
      const b = levelOf(end, m.id);
      return a === undefined || b === undefined ? [] : [{ m, a, b }];
    })
    .sort((x, y) => y.b - x.b || byName(x.m, y.m))
    .slice(0, RACE_TOP);
  const involved = new Set<number>();
  const overtakes: { characterId: number; passedId: number; level: number }[] = [];
  for (const x of race) {
    if (overtakes.length >= MAX_OVERTAKES) break;
    if (involved.has(x.m.id)) continue;
    const passed = race.find((y) => !involved.has(y.m.id) && x.a < y.a && x.b > y.b);
    if (!passed) continue;
    involved.add(x.m.id).add(passed.m.id);
    overtakes.push({ characterId: x.m.id, passedId: passed.m.id, level: x.b });
  }
  if (overtakes.length > 0) facts.push({ kind: "ueberholungen", entries: overtakes });

  // Handwerk: Summe und der Fleißigste; der Titel "Schaffe, schaffe" steckt mit drin, wenn er derselbe ist.
  const crafters = active
    .map((m) => ({ m, count: metrics.get(m.id)?.recipes ?? 0 }))
    .filter((c) => c.count >= 1)
    .sort((a, b) => b.count - a.count || cardFirst("schaffe-schaffe", a.m, b.m) || byName(a.m, b.m));
  const totalRecipes = crafters.reduce((sum, c) => sum + c.count, 0);
  if (totalRecipes >= MIN.rezepteGesamt) {
    const top = crafters[0];
    const title = titleOf("schaffe-schaffe", top.m.id) ? "schaffe-schaffe" : null;
    if (title) used.add(title);
    facts.push({
      kind: "rezepte", characterId: top.m.id, count: top.count, total: totalRecipes, crafters: crafters.length, title,
    });
  }

  const activeIds = new Set(active.map((m) => m.id));
  for (const t of input.titles) {
    if (used.has(t.titleId) || !activeIds.has(t.characterId)) continue;
    facts.push({ kind: "titel", titleId: t.titleId, characterId: t.characterId, value: t.value });
  }

  // Am ersten Tag der Aufzeichnung gelten alle als "neu"; das ist kein Neuzugang.
  const recordingStart = input.members.reduce((min, m) => {
    const day = berlinDate(m.firstSeenAt);
    return day < min ? day : min;
  }, "9999-12-31");
  const newcomers = active
    .filter((m) => {
      const day = berlinDate(m.firstSeenAt);
      return day >= input.from && day <= input.to && day > recordingStart;
    })
    .sort(byName);
  if (newcomers.length > 0) facts.push({ kind: "neuzugang", characterIds: newcomers.map((m) => m.id) });

  // Stoßzeit: stärkste Stunde, erst ab Mindestwert eine Meldung wert.
  const cells = new Array<number>(168).fill(0);
  let logins = 0;
  for (const [id, hours] of Object.entries(input.activity?.characters ?? {})) {
    if (!activeIds.has(Number(id))) continue;
    for (const h of hours) {
      if (h >= 0 && h < 168) {
        cells[h]++;
        logins++;
      }
    }
  }
  const peak = Math.max(...cells);
  if (peak >= MIN.stosszeit) {
    const hour = cells.indexOf(peak);
    facts.push({ kind: "stosszeit", weekday: Math.floor(hour / 24), hour: hour % 24, count: peak });
  }

  // Zahl der Woche: wechselt zwischen den Kennzahlen, die diesmal groß genug sind.
  const sum = (field: "levels" | "deaths" | "dungeons" | "achievements") =>
    active.reduce((total, m) => total + (metrics.get(m.id)?.[field] ?? 0), 0);
  const zahlen: { what: ZahlArt; value: number }[] = [
    { what: "level", value: sum("levels") },
    { what: "anmeldungen", value: logins },
    { what: "rezepte", value: totalRecipes },
    { what: "dungeons", value: sum("dungeons") },
    { what: "erfolge", value: sum("achievements") },
    { what: "tode", value: sum("deaths") },
  ];
  const eligible = zahlen.filter((z) => z.value >= 10);
  const recentZahl = recent.slice(0, 3).map((r) => r.zahl);
  const zahl = eligible.find((z) => !recentZahl.includes(z.what)) ?? eligible.find((z) => z.what !== recentZahl[0]) ?? eligible[0];

  facts.push(...(input.zusatz ?? []).filter((f) => factCharacters(f).every((id) => activeIds.has(id))));

  if (facts.length === 0 && !zahl) return [{ kind: "ruhig" }];
  if (facts.length === 0) return [{ kind: "ruhig" }, { kind: "zahl", ...zahl! }];

  // Nach Nachrichtenwert, mit Abschlag für das, was zuletzt schon drin war. Der stärkste Fakt wird Aufmacher,
  // die übrigen werden nach ihrer stärksten Meldung je Rubrik geordnet, die Zahl der Woche bildet den Schluss.
  // Der Aufmacher der letzten Ausgabe macht diesmal nur ungern wieder auf.
  const lastLead = recent[0]?.kinds[0];
  const scored = facts
    .map((f, i) => ({ f, i, score: newsValue(f) * freshness(factKey(f), recent) }))
    .map((x) => ({ ...x, leadScore: x.score * (factKey(x.f) === lastLead ? 0.6 : 1) }))
    .sort((a, b) => b.leadScore - a.leadScore || a.i - b.i);
  const [lead, ...others] = scored;
  // Aus der Rubrik des Aufmachers kommt der Rest etwas weiter hinten, damit die Ausgabe gemischt wirkt.
  const rest = others
    .map((x) => ({ ...x, score: x.score * (sectionOf(x.f) === sectionOf(lead.f) ? 0.75 : 1) }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const body = rest.slice(0, MAX_ARTICLES - 1 - (zahl ? 1 : 0));
  const sectionRank = new Map<Section, number>();
  for (const [i, x] of body.entries()) if (!sectionRank.has(sectionOf(x.f))) sectionRank.set(sectionOf(x.f), i);
  body.sort((a, b) => sectionRank.get(sectionOf(a.f))! - sectionRank.get(sectionOf(b.f))! || b.score - a.score || a.i - b.i);
  return [lead.f, ...body.map((x) => x.f), ...(zahl ? [{ kind: "zahl" as const, ...zahl }] : [])];
}

/** Spaßtitel, um den es in einem Fakt geht, sonst null. */
export function factTitle(fact: ZeitungFact): string | null {
  if (fact.kind === "titel") return fact.titleId;
  if (fact.kind === "sprung" || fact.kind === "rezepte") return fact.title;
  return null;
}

/** Charaktere, die ein Fakt betrifft. */
export function factCharacters(fact: ZeitungFact): number[] {
  switch (fact.kind) {
    case "neuzugang":
    case "erweiterung":
      return fact.characterIds;
    case "rekord":
      return [...new Set(fact.entries.flatMap((e) => (e.characterId === null ? [] : [e.characterId])))];
    case "meilensteine":
      return fact.entries.map((e) => e.characterId);
    case "ueberholungen":
      return [...new Set(fact.entries.flatMap((e) => [e.characterId, e.passedId]))];
    case "stosszeit":
    case "zahl":
    case "ruhig":
      return [];
    default:
      return [fact.characterId];
  }
}

/** Alle Zahlen, die in einem Fakt vorkommen (für die Prüfung von Fremdtexten). */
export function factNumbers(fact: ZeitungFact): number[] {
  switch (fact.kind) {
    case "sprung":
      return [fact.levels, fact.from, fact.to];
    case "meilensteine":
      return fact.entries.map((e) => e.level);
    case "ueberholungen":
      return fact.entries.map((e) => e.level);
    case "titel":
      return [fact.value];
    case "neuzugang":
      return [fact.characterIds.length];
    case "rezepte":
      return [fact.count, fact.total, fact.crafters];
    case "stosszeit":
      return [fact.hour, (fact.hour + 1) % 24, fact.count];
    case "zahl":
      return [fact.value];
    case "ruhig":
      return [];
    case "rekord":
      return fact.entries.flatMap((e) => [e.value, e.previous, e.value - e.previous]);
    case "erweiterung":
      return fact.zahlen;
  }
}
