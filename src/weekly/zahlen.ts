// Woche in Zahlen: Gildensummen je Gilde und gesamt, fest berechnet aus den Wochenkennzahlen.
import type { GuildRecord, MemberSummary, WeekMetrics, WochenSummen, WochenZahlArt, WochenZahlen } from "../model";

export const WOCHEN_ZAHL_ARTEN: WochenZahlArt[] = ["anmeldungen", "level", "tode", "dungeons", "rezepte", "erfolge", "ruf", "gegenstandsstufe"];

/** Woher eine Summe ihre Werte nimmt. */
const FELD: Record<WochenZahlArt, keyof WeekMetrics> = {
  anmeldungen: "logins",
  level: "levels",
  tode: "deaths",
  dungeons: "dungeons",
  rezepte: "recipes",
  erfolge: "achievements",
  ruf: "reputation",
  gegenstandsstufe: "itemLevel",
};

/**
 * Wer in die Zahlen der Woche eingeht: aktive Mitglieder ohne Abgemeldete. Dieselbe Menge zählt auch für die
 * Zahl der Woche, damit der Infokasten und die Meldung nie verschiedene Werte zeigen.
 */
export function zaehlende(members: MemberSummary[], excluded: Set<number> = new Set()): MemberSummary[] {
  return members.filter((m) => !m.former && !excluded.has(m.id));
}

/** Summen über die Mitglieder; null, wenn keiner einen Wert hat. */
export function summen(metrics: Map<number, WeekMetrics>, members: MemberSummary[]): WochenSummen {
  const out = {} as WochenSummen;
  for (const art of WOCHEN_ZAHL_ARTEN) {
    let total: number | null = null;
    for (const m of members) {
      const v = metrics.get(m.id)?.[FELD[art]];
      if (typeof v === "number") total = (total ?? 0) + v;
    }
    out[art] = total;
  }
  return out;
}

/** Slug der Gilde eines Mitglieds wie in der Lese-API: ohne oder mit unbekanntem Slug die Hauptgilde. */
export function gildeVon(guild: GuildRecord, m: MemberSummary): string {
  const slugs = (guild.guilds ?? []).map((g) => g.slug);
  if (slugs.length === 0) return "";
  return m.guildSlug && slugs.includes(m.guildSlug) ? m.guildSlug : slugs[0];
}

/** Zahlen einer Woche: Summen gesamt und je Gilde, dazu der beste Einzelwert je Art. */
export function wochenZahlen(
  metrics: Map<number, WeekMetrics>,
  guild: GuildRecord,
  excluded: Set<number> = new Set(),
): Omit<WochenZahlen, "vorwoche"> {
  const members = zaehlende(guild.members, excluded);
  const gilden: Record<string, WochenSummen> = {};
  const slugs = (guild.guilds ?? []).map((g) => g.slug);
  for (const slug of slugs.length > 0 ? slugs : [""]) {
    gilden[slug] = summen(metrics, members.filter((m) => gildeVon(guild, m) === slug));
  }
  const spitze: WochenZahlen["spitze"] = {};
  const byName = (a: MemberSummary, b: MemberSummary) => a.name.localeCompare(b.name, "de") || a.id - b.id;
  for (const art of WOCHEN_ZAHL_ARTEN) {
    const best = members
      .map((m) => ({ m, v: metrics.get(m.id)?.[FELD[art]] }))
      .filter((x): x is { m: MemberSummary; v: number } => typeof x.v === "number" && x.v > 0)
      .sort((a, b) => b.v - a.v || byName(a.m, b.m))[0];
    if (best) spitze[art] = [best.m.id, best.v];
  }
  return { gesamt: summen(metrics, members), gilden, spitze };
}
