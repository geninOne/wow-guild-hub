// Wetterbericht für Azeroth: kein echtes Spielwetter (das liefert keine API), sondern eine Wetterlage, die fest
// aus den Wochenzahlen abgeleitet wird. Texter (KI oder Satzbausteine) dichten daraus nur noch die Worte.
import type { GuildRecord, MemberSummary, WeekMetrics, WochenSummen } from "../model";

export type WetterArt = "sturm" | "sternklar" | "morgennebel" | "sonne" | "kellerluft" | "schmiedehitze" | "flaute" | "wechselhaft";

export interface WetterElement {
  art: WetterArt;
  /** Wie deutlich die Lage ist (Wert durch Schwelle), für die Reihenfolge. */
  staerke: number;
  /** Beim Sturm die Gilde mit den meisten Toden, wenn es mehrere Gilden gibt. */
  ueber?: string;
}

export interface WetterLage {
  elemente: WetterElement[];
}

/** Höchstens so viele Wetterelemente je Bericht. */
export const MAX_WETTER = 3;

/** Bedeutung jeder Wetterart in Worten, für das Sprachmodell. */
export const WETTER_BEDEUTUNG: Record<WetterArt, string> = {
  sturm: "Sturmtief, weil auffällig viele Charaktere gestorben sind",
  sternklar: "sternklare Nächte, weil viele Nachteulen tief in der Nacht unterwegs waren",
  morgennebel: "Morgennebel, weil viele Frühaufsteher am frühen Morgen unterwegs waren",
  sonne: "Hochdruck und Sonnenschein, weil viele Level gewonnen wurden",
  kellerluft: "feuchte Kellerluft, weil viele Dungeons betreten wurden",
  schmiedehitze: "Hitze aus den Schmieden, weil viele Rezepte gelernt wurden",
  flaute: "Flaute, weil kaum jemand unterwegs war",
  wechselhaft: "wechselhaftes Wetter ohne besondere Auffälligkeiten",
};

/** Ab so vielen früheren Wochen misst sich die Lage an der eigenen Geschichte statt an festen Schwellen. */
export const WETTER_MIN_WOCHEN = 2;
/** Ab diesem Anteil an allen Anmeldungen sind Nachteulen und Frühaufsteher Wetter. */
const ANTEIL = { nacht: 0.08, frueh: 0.08 } as const;
/** So weit über dem Schnitt früherer Wochen muss ein Wert liegen, um Wetter zu machen. */
const UEBER_SCHNITT = 1.1;

/**
 * Wetterlage der Woche. Mit genug früheren Wochen zählt, was über dem eigenen Schnitt liegt (Tode, Level, Dungeons,
 * Rezepte), so wechselt das Wetter auch in einer wachsenden Gilde. Ohne Geschichte gelten Schwellen, die mit der Zahl
 * der aktiven Charaktere wachsen. Nachteulen und Frühaufsteher zählen als Anteil an allen Anmeldungen. Flaute, wenn
 * kaum jemand da war oder die Anmeldungen weit unter dem Schnitt liegen. Die stärksten Lagen zuerst, höchstens drei;
 * ohne Auffälliges wechselhaft.
 */
export function wetterLage(input: {
  summen: WochenSummen;
  metrics: Map<number, WeekMetrics>;
  members: MemberSummary[];
  guild: GuildRecord;
  /** Tode je Gilden-Slug. */
  todeJeGilde?: Record<string, number | null>;
  /** Summen früherer Wochen. */
  frueher?: WochenSummen[];
}): WetterLage {
  const { summen, metrics } = input;
  const ms = input.members.map((m) => metrics.get(m.id)).filter((x): x is WeekMetrics => x !== undefined);
  const aktiv = ms.filter((x) => x.logins > 0).length;
  const nacht = ms.reduce((s, x) => s + x.nightLogins, 0);
  const frueh = ms.reduce((s, x) => s + x.earlyLogins, 0);
  const anmeldungen = summen.anmeldungen ?? 0;
  const frueher = input.frueher ?? [];
  const schnitt = (art: keyof WochenSummen) => {
    const werte = frueher.map((s) => s[art]).filter((v): v is number => typeof v === "number");
    return werte.length >= WETTER_MIN_WOCHEN ? werte.reduce((a, b) => a + b, 0) / werte.length : null;
  };
  const schnittAnmeldungen = schnitt("anmeldungen");
  if (aktiv < 3 || anmeldungen < 10 || (schnittAnmeldungen !== null && anmeldungen < 0.5 * schnittAnmeldungen)) {
    return { elemente: [{ art: "flaute", staerke: 1 }] };
  }

  /** Stärke ab 1 heißt: macht Wetter. Mit Geschichte gegen den Schnitt, sonst gegen die feste Schwelle. */
  const staerke = (art: keyof WochenSummen, min: number, jeAktivem: number) => {
    const wert = summen[art] ?? 0;
    const s = schnitt(art);
    if (s !== null) return s > 0 ? wert / (s * UEBER_SCHNITT) : wert > 0 ? 2 : 0;
    return wert / Math.max(min, jeAktivem * aktiv);
  };
  const kandidaten: WetterElement[] = [
    { art: "sturm", staerke: staerke("tode", 5, 0.5) },
    { art: "sternklar", staerke: nacht / anmeldungen / ANTEIL.nacht },
    { art: "morgennebel", staerke: frueh / anmeldungen / ANTEIL.frueh },
    { art: "sonne", staerke: staerke("level", 10, 1.5) },
    { art: "kellerluft", staerke: staerke("dungeons", 5, 0.5) },
    { art: "schmiedehitze", staerke: staerke("rezepte", 5, 0.5) },
  ];
  const elemente = kandidaten
    .filter((k) => k.staerke >= 1)
    .sort((a, b) => b.staerke - a.staerke)
    .slice(0, MAX_WETTER);
  const sturm = elemente.find((e) => e.art === "sturm");
  const gilden = input.guild.guilds ?? [];
  if (sturm && gilden.length > 1 && input.todeJeGilde) {
    const top = gilden
      .map((g) => ({ g, tode: input.todeJeGilde?.[g.slug] ?? 0 }))
      .sort((a, b) => b.tode - a.tode)[0];
    if (top.tode > 0) sturm.ueber = top.g.name;
  }
  return { elemente: elemente.length > 0 ? elemente : [{ art: "wechselhaft", staerke: 1 }] };
}
