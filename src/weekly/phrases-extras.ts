// Sentence templates for records and the weather report. Same layout as in `phrases.ts`: per pool four lists of
// equal length (German, English, Swabian, Bavarian); the same number means roughly the same sentence.
// Also the newspaper name, which the web UI needs too; that is why only type imports are used here.

import type { WeeklyNumberKind } from "../model";
import type { Language } from "../language";
import type { AllLanguages } from "./phrases";
import type { WeatherKind } from "./weather";

/** Newspaper name without WEBSITE_NEWSPAPER, per language. */
export const NEWSPAPER_DEFAULT: AllLanguages<string> = { de: "Gildenblatt", en: "Guild Gazette", schwaebisch: "Gildeblatt", bayrisch: "Gildnblatt" };

/** Newspaper name: WEBSITE_NEWSPAPER (one name for all languages) or the default name of the language. */
export function newspaperName(language: Language, siteNewspaper?: string | null): string {
  const name = siteNewspaper?.trim();
  return name ? name : NEWSPAPER_DEFAULT[language];
}

type Make<A> = (a: A) => string;

/* Records: German words in the dative case because they follow „mit“ */
export const RECORD_KIND: AllLanguages<Record<WeeklyNumberKind, string>> = {
  de: { anmeldungen: "Anmeldungen", level: "Level", tode: "Toden", dungeons: "Dungeonbesuchen", rezepte: "neuen Rezepten", erfolge: "Erfolgen", ruf: "Rufstufen", gegenstandsstufe: "Gegenstandsstufen" },
  en: { anmeldungen: "logins", level: "levels", tode: "deaths", dungeons: "dungeon runs", rezepte: "new recipes", erfolge: "achievements", ruf: "reputation levels", gegenstandsstufe: "item levels" },
  schwaebisch: { anmeldungen: "Aameldunga", level: "Level", tode: "Tode", dungeons: "Dungeonbsuch", rezepte: "neie Rezept", erfolge: "Erfolg", ruf: "Rufstufa", gegenstandsstufe: "Gegenstandsstufa" },
  bayrisch: { anmeldungen: "Anmeldungen", level: "Level", tode: "Tode", dungeons: "Dungeonbesuch", rezepte: "neie Rezepte", erfolge: "Erfolge", ruf: "Rufstufn", gegenstandsstufe: "Gegenstandsstufn" },
};
/** One record in an enumeration: `n` is a name, or null for the guild. */
export const RECORD_ENTRY: AllLanguages<Make<{ n: string | null; v: number; art: string; p: number }>> = {
  de: (a) => `${a.n ?? "die Gilde"} mit ${a.v} ${a.art} (bisher ${a.p})`,
  en: (a) => `${a.n ?? "the guild"} with ${a.v} ${a.art} (previously ${a.p})`,
  schwaebisch: (a) => `${a.n ?? "d'Gilde"} mit ${a.v} ${a.art} (bis etzt ${a.p})`,
  bayrisch: (a) => `${a.n ?? "de Gilde"} mit ${a.v} ${a.art} (bislang ${a.p})`,
};
export const RECORD_HEADLINE: AllLanguages<string[]> = {
  de: ["Neuer Rekord!", "Rekordwoche in der Gilde", "So viel war noch nie", "Die Bestmarke fällt", "Rekordalarm!"],
  en: ["New record!", "Record week in the guild", "Never been this many", "The high score falls", "Record alert!"],
  schwaebisch: ["Neier Rekord!", "Rekordwoch in dr Gilde", "So viel war no nia", "D'Bestmarke fällt", "Rekordalarm!"],
  bayrisch: ["Neier Rekord!", "Rekordwoch in da Gilde", "So vui war no nia", "De Bestmarkn fallt", "Rekordalarm!"],
};
export const RECORD_TEXT: AllLanguages<Make<{ l: string }>[]> = {
  de: [
    (a) => `Die Redaktion musste die Bestenliste neu schreiben: ${a.l}.`,
    (a) => `Noch nie war es so viel in einer Woche: ${a.l}. Die alten Werte dürfen in Rente.`,
    (a) => `Neue Bestmarken im Archiv: ${a.l}. Wer das toppen will, muss früh aufstehen.`,
    (a) => `Rekord ist Rekord: ${a.l}. Ein Hoch auf diese Woche!`,
  ],
  en: [
    (a) => `The editors had to rewrite the leaderboard: ${a.l}.`,
    (a) => `Never this much in a single week: ${a.l}. The old marks can retire.`,
    (a) => `New best marks in the archive: ${a.l}. Anyone wanting to top that had better get up early.`,
    (a) => `A record is a record: ${a.l}. Three cheers for this week!`,
  ],
  schwaebisch: [
    (a) => `D'Redaktion hot d'Bestaliste nei schreiba miaßa: ${a.l}.`,
    (a) => `So viel war's no nia in oiner Woch: ${a.l}. Die alte Wert dürfet in Rente.`,
    (a) => `Neie Bestmarka im Archiv: ${a.l}. Wer des toppa will, muss früh aufstande.`,
    (a) => `Rekord isch Rekord: ${a.l}. A Hoch auf die Woch!`,
  ],
  bayrisch: [
    (a) => `De Redaktion hod de Bestnlistn nei schreibn miassn: ${a.l}.`,
    (a) => `So vui war's no nia in oana Woch: ${a.l}. De oidn Wert derfan in Rente.`,
    (a) => `Neie Bestmarkn im Archiv: ${a.l}. Wer des toppn wui, muass fruah aufsteh.`,
    (a) => `Rekord is Rekord: ${a.l}. A Hoch auf de Woch!`,
  ],
};

/* Weather report */
export const WEATHER_OPENING: AllLanguages<string[]> = {
  de: ["Der Wetterbericht für Azeroth:", "Die Aussichten für die kommende Woche:", "Unser Wetterfrosch meldet:", "Aus der Wetterküche der Redaktion:"],
  en: ["The weather forecast for Azeroth:", "The outlook for the coming week:", "Our resident weather frog reports:", "Fresh from the editorial weather desk:"],
  schwaebisch: ["Dr Wetterbericht für Azeroth:", "D'Aussichta für die kommende Woch:", "Dr Gildeblatt-Wetterfrosch meldet:", "Aus dr Wetterkuche vo dr Redaktion:"],
  bayrisch: ["Da Wetterbericht für Azeroth:", "De Aussichtn für de kommende Woch:", "Da Gildnblatt-Wetterfrosch meldt:", "Aus da Wetterkuchl vo da Redaktion:"],
};
/** Location of a storm: over a guild or over all of Azeroth. */
export const WEATHER_PLACE: AllLanguages<(guild: string | undefined) => string> = {
  de: (g) => (g ? `über der Gilde ${g}` : "über Azeroth"),
  en: (g) => (g ? `over the guild ${g}` : "over Azeroth"),
  schwaebisch: (g) => (g ? `über dr Gilde ${g}` : "über Azeroth"),
  bayrisch: (g) => (g ? `über da Gilde ${g}` : "über Azeroth"),
};
export const WEATHER: Record<WeatherKind, AllLanguages<Make<{ u: string }>[]>> = {
  sturm: {
    de: [
      (a) => `Ein Sturmtief zieht ${a.u} auf, die Geistheiler schieben Sonderschichten.`,
      (a) => `Orkanböen ${a.u}: Wer rausgeht, sollte vorher seine Reparaturkosten zurücklegen.`,
      (a) => `Schweres Unwetter ${a.u}, auf den Friedhöfen wird es eng.`,
      (a) => `Ein Tiefdruckgebiet hängt ${a.u} fest, Grabsteine bitte gut festbinden.`,
    ],
    en: [
      (a) => `A storm front is moving in ${a.u}, the Spirit Healers are working extra shifts.`,
      (a) => `Gale-force winds ${a.u}: anyone heading out should set aside their repair money first.`,
      (a) => `Severe weather ${a.u}, it's getting crowded in the graveyards.`,
      (a) => `A low-pressure system is stuck ${a.u}, please tie down your gravestones.`,
    ],
    schwaebisch: [
      (a) => `A Sturmtief zieht ${a.u} auf, d'Geischtheiler schaffet Sonderschichta.`,
      (a) => `Orkanböa ${a.u}: Wer naus goht, sott vorher d'Reparaturkoschta auf d'Seit lega.`,
      (a) => `Schwers Unwetter ${a.u}, auf de Kirchhöf wird's eng.`,
      (a) => `A Tief hängt ${a.u} fescht, Grabstoi bitte guat festbinda.`,
    ],
    bayrisch: [
      (a) => `A Sturmtief ziagt ${a.u} auf, de Geistheiler schiabn Sonderschichtn.`,
      (a) => `Orkanböen ${a.u}: Wer nausgeht, soid vorher sei Reparaturgeld auf d'Seitn legn.`,
      (a) => `Schwars Unwetter ${a.u}, auf de Friedhöf werd's eng.`,
      (a) => `A Tief hängt ${a.u} fest, Grabstoa bittschön guad festbindn.`,
    ],
  },
  sternklar: {
    de: [
      () => `Nachts bleibt es sternklar, beste Sicht für alle Nachteulen.`,
      () => `Klare Nächte mit funkelnden Sternen, die Eulen der Gilde freuen sich.`,
      () => `Zwischen eins und fünf Uhr wolkenlos, ideal für Ritte im Mondschein.`,
      () => `In den Nächten funkelt der Himmel, wer nicht schlafen kann, sieht viel.`,
    ],
    en: [
      () => `Clear starry nights ahead, perfect visibility for all night owls.`,
      () => `Clear nights with twinkling stars, the guild's owls are delighted.`,
      () => `Cloudless between one and five in the morning, ideal for moonlit rides.`,
      () => `The sky sparkles at night, and anyone who can't sleep will see plenty.`,
    ],
    schwaebisch: [
      () => `Nachts bleibt's sternklar, beschte Sicht für älle Nachteula.`,
      () => `Klare Nächt mit funkelnde Stern, d'Eula vo dr Gilde freiet sich.`,
      () => `Zwischa oins ond fünfe wolkalos, grad recht für en Ritt im Mondschei.`,
      () => `Nachts funkelt dr Himmel, wer net schlafa ka, sieht viel.`,
    ],
    bayrisch: [
      () => `Nachts bleibt's sternklar, beste Sicht für olle Nachteuln.`,
      () => `Klare Nächt mit funkelnde Stern, de Eulen vo da Gilde gfreun se.`,
      () => `Zwischn oans und fünfe woknlos, grad recht für an Ritt im Mondschein.`,
      () => `Nachts funklt da Himme, wer ned schlafa ko, siagt vui.`,
    ],
  },
  morgennebel: {
    de: [
      () => `Am Morgen dichter Nebel, durch den nur die Frühaufsteher tappen.`,
      () => `Früh am Tag zieht Nebel auf, der Tau glitzert auf frischen Rüstungen.`,
      () => `Morgens neblig, aber die ersten Abenteurer sind schon unterwegs.`,
      () => `Bei Sonnenaufgang Bodennebel, Kaffee hilft.`,
    ],
    en: [
      () => `Dense fog in the morning, with only the early risers groping through it.`,
      () => `Fog rolls in early in the day, dew glitters on fresh armor.`,
      () => `Misty mornings, but the first adventurers are already on their way.`,
      () => `Ground fog at sunrise, coffee helps.`,
    ],
    schwaebisch: [
      () => `Am Morga dicker Nebel, durch den bloß d'Frühaufsteher tappet.`,
      () => `Früh am Dag zieht Nebel auf, dr Tau glitzert auf de frische Rüstunga.`,
      () => `Morgens neblig, aber die erschte Abenteurer sind scho onterwegs.`,
      () => `Bei Sonnaaufgang Bodanebel, a Kaffee hilft.`,
    ],
    bayrisch: [
      () => `In da Fruah dicker Nebe, durch den bloß de Fruahaufsteher tappn.`,
      () => `Fruah am Dog ziagt Nebe auf, da Tau glitzert auf de frischn Rüstungen.`,
      () => `In da Fruah neblig, aber de erstn Abenteurer san scho unterwegs.`,
      () => `Bei Sonnaufgang Bodnnebe, a Kaffee huift.`,
    ],
  },
  sonne: {
    de: [
      () => `Ein kräftiges Hoch sorgt für Sonnenschein und steile Aufstiege.`,
      () => `Strahlender Sonnenschein, die Stufenleiter glänzt.`,
      () => `Hochdruck über dem Land, die Erfahrungsbalken füllen sich wie von selbst.`,
      () => `Sonne satt, beste Bedingungen zum Leveln.`,
    ],
    en: [
      () => `A strong high brings sunshine and steep climbs.`,
      () => `Brilliant sunshine, the level ladder is gleaming.`,
      () => `High pressure across the land, experience bars fill up all by themselves.`,
      () => `Sunshine galore, perfect conditions for leveling.`,
    ],
    schwaebisch: [
      () => `A kräftigs Hoch sorgt für Sonnaschei ond steile Aufstieg.`,
      () => `Strahlender Sonnaschei, d'Stufaloiter glänzt.`,
      () => `Hochdruck überm Ländle, d'Erfahrungsbalka füllet sich wie vo selber.`,
      () => `Sonna satt, beschte Bedingunga zum Leveln.`,
    ],
    bayrisch: [
      () => `A kräftigs Hoch sorgt für Sunnaschein und steile Aufstiege.`,
      () => `Strahlnda Sunnaschein, de Stufnloata glänzt.`,
      () => `Hochdruck überm Land, de Erfahrungsbalkn fülln se wia vo selm.`,
      () => `Sunn satt, beste Bedingungen zum Leveln.`,
    ],
  },
  kellerluft: {
    de: [
      () => `In den Tiefen der Dungeons bleibt es feucht und muffig.`,
      () => `Unter Tage herrscht Kellerluft, Laternen nicht vergessen.`,
      () => `In den Gewölben tropft es von der Decke, festes Schuhwerk empfohlen.`,
      () => `Wer in die Dungeons steigt, erwartet klamme Kühle.`,
    ],
    en: [
      () => `Deep in the dungeons it stays damp and musty.`,
      () => `Cellar air underground, don't forget your lantern.`,
      () => `Water drips from the ceilings of the vaults, sturdy boots recommended.`,
      () => `Anyone descending into the dungeons can expect a clammy chill.`,
    ],
    schwaebisch: [
      () => `Dunta in de Dungeons bleibt's feucht ond muffig.`,
      () => `Onter Dag herrscht Kellerluft, d'Latern net vergessa.`,
      () => `In de Gwölb tropft's vo dr Deck, feschte Schuah empfohla.`,
      () => `Wer in d'Dungeons nagoht, kriegt klamme Kälte.`,
    ],
    bayrisch: [
      () => `Drunt in de Dungeons bleibt's feicht und muffig.`,
      () => `Unter Dog herrscht Kellerluft, Latern ned vergessn.`,
      () => `In de Gwöib tropft's vo da Deckn, gscheite Schua empfohln.`,
      () => `Wer in de Dungeons obisteigt, kriagt a klamme Kälten.`,
    ],
  },
  schmiedehitze: {
    de: [
      () => `Aus den Werkstätten steigt Hitze auf, rund um die Essen wird es tropisch.`,
      () => `Warmluft aus den Schmieden, die Ambosse glühen.`,
      () => `Rund um die Handwerker heiß und trocken, Wasser bereithalten.`,
      () => `Die Schmiedefeuer heizen der ganzen Gegend ein.`,
    ],
    en: [
      () => `Heat rises from the workshops, it's getting tropical around the forges.`,
      () => `Warm air from the smithies, the anvils are glowing.`,
      () => `Hot and dry around the crafters, keep water at hand.`,
      () => `The forge fires are heating up the whole area.`,
    ],
    schwaebisch: [
      () => `Aus de Werkstätta steigt Hitz auf, rom die Essa wird's tropisch.`,
      () => `Warmluft aus de Schmiede, d'Ambosse glühet.`,
      () => `Rom die Handwerker hoiß ond trocka, Wasser bereithalta.`,
      () => `D'Schmiedfeuer heizet dr ganza Gegend ei.`,
    ],
    bayrisch: [
      () => `Aus de Werkstattn steigt Hitz auf, rund um de Essn werd's tropisch.`,
      () => `Warmluft aus de Schmiedn, de Ambosse glüahn.`,
      () => `Rund um de Handwerker hoaß und trocken, Wasser bereithoidn.`,
      () => `De Schmiedfeier heizn da ganzn Gegend ei.`,
    ],
  },
  flaute: {
    de: [
      () => `Totale Flaute, kein Lüftchen regt sich in Azeroth.`,
      () => `Windstille über allen Zonen, selbst die Murlocs dösen.`,
      () => `Ruhiges Wetter, kaum ein Abenteurer ist zu sehen.`,
      () => `Flaute auf ganzer Linie, die Gasthäuser bleiben leer.`,
    ],
    en: [
      () => `Dead calm, not a breath of wind stirs in Azeroth.`,
      () => `No wind across all zones, even the murlocs are dozing.`,
      () => `Quiet weather, hardly an adventurer in sight.`,
      () => `Calm across the board, the inns stay empty.`,
    ],
    schwaebisch: [
      () => `Totale Flaute, koi Lüftle rührt sich in Azeroth.`,
      () => `Windstill über älle Zona, sogar d'Murlocs dösa.`,
      () => `Ruhigs Wetter, kaum a Abenteurer isch zum seha.`,
      () => `Flaute auf ganzer Linie, d'Wirtschafta bleibet leer.`,
    ],
    bayrisch: [
      () => `Totale Flaute, koa Lüfterl rührt se in Azeroth.`,
      () => `Windstui über olle Zonen, sogar de Murlocs dösn.`,
      () => `Ruhigs Wetter, kaum a Abenteurer is zum sehgn.`,
      () => `Flaute auf ganzer Linie, de Wirtshäuser bleibn leer.`,
    ],
  },
  wechselhaft: {
    de: [
      () => `Wechselhaft mit Sonne, Wolken und dem einen oder anderen Schauer.`,
      () => `Mal so, mal so, typisches Abenteurerwetter.`,
      () => `Durchwachsen, aber nichts, was einen Helden aufhält.`,
      () => `Ein bisschen von allem, wie ein gut gefüllter Rucksack.`,
    ],
    en: [
      () => `Changeable, with sun, clouds and the odd shower.`,
      () => `A bit of this, a bit of that, typical adventuring weather.`,
      () => `Mixed, but nothing that stops a hero.`,
      () => `A little of everything, like a well-stuffed backpack.`,
    ],
    schwaebisch: [
      () => `Wechselhaft mit Sonn, Wolka ond em oine oder andre Schauer.`,
      () => `Mol so, mol so, typischs Abenteurerwetter.`,
      () => `Durchwachsa, aber nix, was en Held aufhält.`,
      () => `A bissle vo ällem, wie a guate Portion Maultascha.`,
    ],
    bayrisch: [
      () => `Wechslhaft mit Sunn, Woikn und am oan oder andern Schauer.`,
      () => `Moi so, moi so, typischs Abenteurerwetter.`,
      () => `Durchwachsn, aber nix, wos an Heldn aufhoit.`,
      () => `A bisserl vo ois, wia a guade Portion Kasspatzn.`,
    ],
  },
};
export const WEATHER_CLOSING: AllLanguages<string[]> = {
  de: ["Die Redaktion übernimmt keine Gewähr.", "Regenschirm einpacken schadet nie.", "Weitere Aussichten: Eintopf im Gasthaus.", "Ohne Gewähr, aber mit Herz."],
  en: ["The editors accept no liability.", "Packing an umbrella never hurts.", "Further outlook: stew at the inn.", "No guarantees, but with heart."],
  schwaebisch: ["D'Redaktion übernimmt koi Gwähr.", "A Schirm eipacka schadet nia.", "Weitere Aussichta: Schupfnudla mit Kraut.", "Ohne Gwähr, aber mit Herz."],
  bayrisch: ["De Redaktion übernimmt koa Gwähr.", "A Schirm eipacka schod nia.", "Weidane Aussichtn: Spatzn mit Soß.", "Ohne Gwähr, aber mit Herz."],
};
