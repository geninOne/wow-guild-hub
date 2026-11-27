// Weather report for Azeroth: no real in-game weather (no API provides it), but a weather situation derived
// deterministically from the weekly numbers. Writers (AI or phrases) only come up with the words.
import type { GuildRecord, MemberSummary, WeekMetrics, WeeklySums } from "../model";

export type WeatherKind = "sturm" | "sternklar" | "morgennebel" | "sonne" | "kellerluft" | "schmiedehitze" | "flaute" | "wechselhaft";

export interface WeatherElement {
  art: WeatherKind;
  /** How pronounced the situation is (value divided by threshold), for the order. */
  strength: number;
  /** For a storm, the guild with the most deaths, if there are several guilds. */
  ueber?: string;
}

export interface WeatherSituation {
  elemente: WeatherElement[];
}

/** At most this many weather elements per report. */
export const MAX_WEATHER = 3;

/** Meaning of each weather kind in words, for the language model. */
export const WEATHER_MEANING: Record<WeatherKind, string> = {
  sturm: "Sturmtief, weil auffällig viele Charaktere gestorben sind",
  sternklar: "sternklare Nächte, weil viele Nachteulen tief in der Nacht unterwegs waren",
  morgennebel: "Morgennebel, weil viele Frühaufsteher am frühen Morgen unterwegs waren",
  sonne: "Hochdruck und Sonnenschein, weil viele Level gewonnen wurden",
  kellerluft: "feuchte Kellerluft, weil viele Dungeons betreten wurden",
  schmiedehitze: "Hitze aus den Schmieden, weil viele Rezepte gelernt wurden",
  flaute: "Flaute, weil kaum jemand unterwegs war",
  wechselhaft: "wechselhaftes Wetter ohne besondere Auffälligkeiten",
};

/** From this many earlier weeks on, the situation is measured against the guild's own history instead of fixed thresholds. */
export const WEATHER_MIN_WEEKS = 2;
/** From this share of all logins on, night owls and early birds make weather. */
const SHARE = { night: 0.08, early: 0.08 } as const;
/** A value must lie this far above the average of earlier weeks to make weather. */
const ABOVE_AVERAGE = 1.1;

/**
 * Weather situation of the week. With enough earlier weeks, what lies above the guild's own average counts (deaths,
 * levels, dungeons, recipes), so the weather changes even in a growing guild. Without history, thresholds apply that
 * grow with the number of active characters. Night owls and early birds count as a share of all logins. Doldrums
 * (`flaute`) if hardly anyone was around or the logins lie far below the average. The strongest situations first, at
 * most three; without anything notable, changeable (`wechselhaft`).
 */
export function weatherSituation(input: {
  weeklySums: WeeklySums;
  metrics: Map<number, WeekMetrics>;
  members: MemberSummary[];
  guild: GuildRecord;
  /** Deaths per guild slug. */
  deathsByGuild?: Record<string, number | null>;
  /** Sums of earlier weeks. */
  earlier?: WeeklySums[];
}): WeatherSituation {
  const { weeklySums, metrics } = input;
  const ms = input.members.map((m) => metrics.get(m.id)).filter((x): x is WeekMetrics => x !== undefined);
  const active = ms.filter((x) => x.logins > 0).length;
  const night = ms.reduce((s, x) => s + x.nightLogins, 0);
  const early = ms.reduce((s, x) => s + x.earlyLogins, 0);
  const logins = weeklySums.anmeldungen ?? 0;
  const earlier = input.earlier ?? [];
  const average = (kind: keyof WeeklySums) => {
    const values = earlier.map((s) => s[kind]).filter((v): v is number => typeof v === "number");
    return values.length >= WEATHER_MIN_WEEKS ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const averageLogins = average("anmeldungen");
  if (active < 3 || logins < 10 || (averageLogins !== null && logins < 0.5 * averageLogins)) {
    return { elemente: [{ art: "flaute", strength: 1 }] };
  }

  /** A strength of 1 or more means: makes weather. With history against the average, else against the fixed threshold. */
  const strength = (kind: keyof WeeklySums, min: number, perActive: number) => {
    const value = weeklySums[kind] ?? 0;
    const avg = average(kind);
    if (avg !== null) return avg > 0 ? value / (avg * ABOVE_AVERAGE) : value > 0 ? 2 : 0;
    return value / Math.max(min, perActive * active);
  };
  const candidates: WeatherElement[] = [
    { art: "sturm", strength: strength("tode", 5, 0.5) },
    { art: "sternklar", strength: night / logins / SHARE.night },
    { art: "morgennebel", strength: early / logins / SHARE.early },
    { art: "sonne", strength: strength("level", 10, 1.5) },
    { art: "kellerluft", strength: strength("dungeons", 5, 0.5) },
    { art: "schmiedehitze", strength: strength("rezepte", 5, 0.5) },
  ];
  const elements = candidates
    .filter((c) => c.strength >= 1)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_WEATHER);
  const storm = elements.find((e) => e.art === "sturm");
  const guilds = input.guild.guilds ?? [];
  if (storm && guilds.length > 1 && input.deathsByGuild) {
    const top = guilds
      .map((g) => ({ g, deaths: input.deathsByGuild?.[g.slug] ?? 0 }))
      .sort((a, b) => b.deaths - a.deaths)[0];
    if (top.deaths > 0) storm.ueber = top.g.name;
  }
  return { elemente: elements.length > 0 ? elements : [{ art: "wechselhaft", strength: 1 }] };
}
