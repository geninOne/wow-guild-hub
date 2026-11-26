import Anthropic from "@anthropic-ai/sdk";
import type { ZeitungArticle } from "../model";
import { artOf, factCharacters, factNumbers, factTitle, sectionOf, type ZeitungFact } from "./zeitung-facts";
import { isWeek } from "../lib/time";
import {
  bausteinGenerator, schreibeWetter, sprachenFuer, uebersetzungIn, WOCHENTAGE, type Fremdsprache, type TextContext, type TextGenerator,
  type TextResult, type Uebersetzungen,
} from "./zeitung-text";
import { list, Picker, type Alle } from "./bausteine";
import { REKORD_ART, zeitungsName } from "./bausteine-woche";
import { WETTER_BEDEUTUNG } from "./wetter";
import { sentencePatterns } from "./repetition";
import { titleDef } from "./titles";
import { DIALEKTE, fassungIn, type Sprache } from "../sprache";

/** Routername im eigenen AI Gateway; das Gateway wählt dahinter das Modell. */
export const DEFAULT_MODEL = "anthropic-router";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

/** Der Teil des SDK-Clients, den der Texter braucht; in Tests ein gefälschter Client ohne Netzwerk. */
export interface MessagesClient {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
}

const TON: Alle<string> = {
  de: "Ton: freche Lokalzeitung mit Augenzwinkern, in sauberem Hochdeutsch ganz ohne Dialekt.",
  en: 'Schreibe alles auf Englisch: Schlagzeilen, Texte, Spruch und Wetterbericht. Ton: freche Lokalzeitung mit Augenzwinkern, in natürlichem, gut lesbarem Englisch. Verwende die Begriffe des englischen WoW-Clients (zum Beispiel "Guild Master", "item level", "Dungeons & Raids", "reputation", "Spirit Healer", "achievement"). Wortspiele sinngemäß, nicht wörtlich aus dem Deutschen übersetzt. Uhrzeiten schreibst du genau so, wie sie im Fakt stehen (zum Beispiel "20:00").',
  schwaebisch:
    'Ton: freche Lokalzeitung mit Augenzwinkern, auf Schwäbisch. Gut lesbar, mit typischen Wörtern und Wendungen (zum Beispiel "Heilig\'s Blechle", "gell", "des isch", "net", "koi", "a bissle", "hocka", "schaffe", "Ha noi"). Kein Kauderwelsch und nicht in jedem Wort Dialekt.',
  bayrisch:
    'Ton: freche Lokalzeitung mit Augenzwinkern, auf Bayrisch. Gut lesbar, mit typischen Wörtern und Wendungen (zum Beispiel "Servus", "a bisserl", "gell", "fei", "ned", "scho", "Obacht", "mei", "koa", "Gaudi", "schee"). Kein Kauderwelsch und nicht in jedem Wort Dialekt.',
};

const SPRUCH: Alle<string> = {
  de: "Dazu ein kurzer Spruch der Woche auf Hochdeutsch (Redensart oder Lebensweisheit), ohne Namen und ohne Zahlen, anders als die Sprüche der letzten Ausgaben.",
  en: "Dazu ein kurzer Spruch der Woche auf Englisch (eine englische Redensart oder Lebensweisheit), ohne Namen und ohne Zahlen, anders als die Sprüche der letzten Ausgaben.",
  schwaebisch: "Dazu ein kurzer schwäbischer Spruch der Woche ohne Namen und ohne Zahlen, anders als die Sprüche der letzten Ausgaben.",
  bayrisch: "Dazu ein kurzer bayrischer Spruch der Woche ohne Namen und ohne Zahlen, anders als die Sprüche der letzten Ausgaben.",
};

const WETTER_SPRACHE: Alle<string> = {
  de: "auf Hochdeutsch",
  en: "auf Englisch",
  schwaebisch: "auf Schwäbisch",
  bayrisch: "auf Bayrisch",
};

/** Was der Systemprompt über die Installation wissen muss: Name der Zeitung (SEITE_ZEITUNG) und Gildennamen. */
export interface PromptRahmen {
  zeitung?: string;
  gilden?: string[];
}

/**
 * Systemprompt für eine Sprachfassung der Wochenzeitung; mit `wetter` kommt der Wetterbericht dazu. Name der Zeitung
 * und Gilden kommen aus dem Rahmen, ohne Gildennamen ist neutral von einer Gilde die Rede.
 */
export function systemPrompt(sprache: Sprache, wetter = false, rahmen: PromptRahmen = {}): string {
  const zeitung = zeitungsName(sprache, rahmen.zeitung);
  const gilden = (rahmen.gilden ?? []).filter((g) => g.trim() !== "");
  const wer =
    gilden.length === 0
      ? "einer World-of-Warcraft-Gilde"
      : gilden.length === 1
        ? `der World-of-Warcraft-Gilde ${gilden[0]}`
        : `der World-of-Warcraft-Gilden ${list(gilden)}`;
  const wetterRegel = wetter
    ? `\n- Dazu ein Wetterbericht für Azeroth ${WETTER_SPRACHE[sprache]}, zwei bis drei Sätze im Ton des Wetterberichts einer Lokalzeitung, frei gedichtet aus der mitgelieferten Wetterlage (es ist kein echtes Spielwetter). Jede Wetterart der Lage kommt vor, die stärkste zuerst. Steht bei einer Wetterart "ueber", nenne genau diesen Gildennamen als Ort. Keine Zahlen, keine Charakternamen, und nichts aus den Wetterberichten der letzten Ausgaben wiederholen.`
    : "";
  const form = wetter
    ? '{"artikel": [{"nr": 0, "schlagzeile": "...", "text": "..."}], "spruch": "...", "wetter": "..."}'
    : '{"artikel": [{"nr": 0, "schlagzeile": "...", "text": "..."}], "spruch": "..."}';
  return `Du schreibst "${zeitung}", die Wochenzeitung ${wer}.

${TON[sprache]} Liebevoller Spott über das Spielgeschehen ist erwünscht, aber nie verletzend: keine Beleidigungen, nichts über Aussehen, Herkunft, Geschlecht, Alter oder Gesundheit, und nichts über die realen Menschen hinter den Charakteren. Es geht nur um die Spielfiguren.

Regeln:
- Du bekommst die Fakten der Woche als JSON. Schreibe zu jedem Fakt genau einen Artikel mit Schlagzeile und Text, in derselben Reihenfolge. "nr" ist die Nummer des Fakts.
- Verwende nur Namen und Zahlen, die in den Fakten stehen. Erfinde keine Charaktere, keine Ereignisse, keine Zahlen. Nenne keine Uhrzeit, Stufe oder Anzahl, die nicht im Fakt steht.
- Nenne in jedem Artikel nur die Charaktere seines eigenen Fakts. Titelnamen übernimmst du genau so, wie sie im Fakt stehen.
- Fakt 0 ist der Aufmacher: die stärkste Schlagzeile, Text zwei bis drei Sätze. Alle anderen Texte ein bis zwei Sätze.
- Wiederhole keine Formulierungen zwischen den Artikeln.
- Du bekommst Schlagzeilen, Texte und Sprüche der letzten Ausgaben. Wiederhole daraus keine Formulierungen, keine Pointen, keine Sprüche und keine Schlagzeilenmuster. Jede Woche soll sich frisch lesen, auch wenn dieselben Arten von Meldungen vorkommen.
- Bei der Rubrik "Zahl der Woche" ist die Schlagzeile genau die Zahl, der Text erklärt sie in einem Satz.
- Keine Gedankenstriche, keine Emojis, kein Markdown.
- ${SPRUCH[sprache]}${wetterRegel}
- Antworte ausschließlich mit einem einzigen JSON-Objekt, ohne Text davor oder danach und ohne Codeblock, genau in dieser Form:
  ${form}`;
}

/** Hochdeutscher Systemprompt (Standardfassung). */
export const SYSTEM_PROMPT = systemPrompt("de");

/** Kontext für eine Fassung in Englisch oder Dialekt: frühere Ausgaben in dieser Sprache, soweit vorhanden. */
export function contextFor(ctx: TextContext, sprache: Sprache): TextContext {
  if (sprache === "de") return ctx;
  return {
    ...ctx,
    recent: ctx.recent?.map((r) => {
      const d = uebersetzungIn(r.dialekte, sprache);
      return d ? { ...r, headlines: d.headlines, texts: d.texts, motto: d.motto, wetter: d.wetter ?? r.wetter } : r;
    }),
  };
}

/** Die letzten Ausgaben als Text für das Modell, damit es sich nicht wiederholt. */
export function recentForModel(ctx: TextContext): string {
  const recent = ctx.recent ?? [];
  if (recent.length === 0) return "";
  const blocks = recent.map((r) =>
    [
      `Ausgabe ${r.week}:`,
      ...r.headlines.map((h, i) => `- ${h}: ${r.texts[i] ?? ""}`),
      `- Spruch: ${r.motto}`,
      ...(r.wetter ? [`- Wetter: ${r.wetter}`] : []),
    ].join("\n"),
  );
  return `\n\nBereits erschienen, bitte nichts davon wiederholen:\n${blocks.join("\n\n")}`;
}

const SCHEMA = {
  type: "object",
  properties: {
    artikel: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nr: { type: "integer" },
          schlagzeile: { type: "string" },
          text: { type: "string" },
        },
        required: ["nr", "schlagzeile", "text"],
        additionalProperties: false,
      },
    },
    spruch: { type: "string" },
    wetter: { type: "string" },
  },
  required: ["artikel", "spruch"],
  additionalProperties: false,
} as const;

/** Schema mit Pflichtfeld `wetter`, wenn eine Wetterlage mitgeschickt wird. */
const SCHEMA_MIT_WETTER = { ...SCHEMA, required: ["artikel", "spruch", "wetter"] } as const;

/** Fakten so, wie das Modell sie sieht: Namen statt IDs, Rubrik und lesbare Beschreibung dabei. */
export function factsForModel(facts: ZeitungFact[], ctx: TextContext, sprache: Sprache = "de"): unknown[] {
  const titel = (id: string | null) => {
    const def = id ? titleDef(id) : undefined;
    return id ? (def ? fassungIn(def.name, sprache) : id) : null;
  };
  return facts.map((f, nr) => {
    const base = { nr, rubrik: nr === 0 ? "Aufmacher" : sectionOf(f), art: artOf(f) };
    const n = (id: number) => ctx.name(id);
    switch (f.kind) {
      case "sprung":
        return { ...base, charakter: n(f.characterId), level_gewonnen: f.levels, von_level: f.from, auf_level: f.to, titel: titel(f.title) };
      case "meilensteine":
        return { ...base, runde_level_erreicht: f.entries.map((e) => ({ charakter: n(e.characterId), level: e.level })) };
      case "ueberholungen":
        return { ...base, im_levelrennen_ueberholt: f.entries.map((e) => ({ charakter: n(e.characterId), ueberholt: n(e.passedId), jetzt_level: e.level })) };
      case "titel": {
        const def = titleDef(f.titleId);
        return {
          ...base,
          titel: titel(f.titleId),
          regel: def ? fassungIn(def.description, sprache) : undefined,
          charakter: n(f.characterId),
          wert: def ? fassungIn(def.valueText(f.value), sprache) : f.value,
        };
      }
      case "neuzugang":
        return { ...base, neu_in_der_gilde: f.characterIds.map(n) };
      case "rezepte":
        return { ...base, neue_rezepte_gesamt: f.total, beteiligte_charaktere: f.crafters, fleissigster: n(f.characterId), dessen_neue_rezepte: f.count, titel: titel(f.title) };
      case "stosszeit":
        return {
          ...base,
          wochentag: (sprache === "en" ? WOCHENTAGE.en : WOCHENTAGE.de)[f.weekday],
          stunde: sprache === "en" ? `${f.hour}:00 to ${(f.hour + 1) % 24}:00` : `${f.hour} bis ${(f.hour + 1) % 24} Uhr`,
          anmeldungen: f.count,
        };
      case "zahl":
        return { ...base, zahl: f.value, bedeutung: f.what === "level" ? "gewonnene Level der Gilde" : f.what === "anmeldungen" ? "Anmeldungen der Gilde" : "neue Rezepte der Gilde" };
      case "ruhig":
        return { ...base, hinweis: "In dieser Woche ist nichts Nennenswertes passiert." };
      case "rekord":
        return {
          ...base,
          neue_rekorde: f.entries.map((e) => ({
            wer: e.characterId === null ? "die ganze Gilde" : n(e.characterId),
            was: `${REKORD_ART[sprache][e.art]} in einer Woche`,
            neuer_rekord: e.value,
            alter_rekord: e.previous,
            mehr_als_bisher: e.value - e.previous,
          })),
        };
      case "erweiterung":
        return { ...base, ...f.fuerKi(n, sprache) };
    }
  });
}

/**
 * Holt das JSON-Objekt aus der Textantwort. Ohne strukturierte Ausgabe (`output_config.format`) kann ein Modell
 * hinter einem Router das JSON in einen Codeblock packen oder einen Satz davor schreiben; gelesen wird deshalb
 * von der ersten öffnenden bis zur letzten schließenden geschweiften Klammer.
 * Wirft, wenn kein gültiges JSON-Objekt darin steht.
 */
export function jsonAusText(text: string): unknown {
  const start = text.indexOf("{");
  const ende = text.lastIndexOf("}");
  if (start < 0 || ende <= start) throw new Error("Antwort enthält kein JSON-Objekt");
  try {
    return JSON.parse(text.slice(start, ende + 1));
  } catch {
    throw new Error("Antwort ist kein gültiges JSON");
  }
}

/** Ersetzt Gedankenstriche (Dirks Regel) durch ein Komma. */
export function ohneGedankenstriche(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ").trim();
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Namen aus `allNames`, die im Text vorkommen (ganze Wörter). */
export function mentionedNames(text: string, allNames: string[]): string[] {
  return allNames.filter((name) => name.length > 1 && new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, "u").test(text));
}

/**
 * Prüft die Modellantwort gegen die Fakten und baut die Artikel. Wirft mit einem Grund, wenn etwas nicht passt:
 * falsche Anzahl, fremde Namen, Zahlen, die in keinem Fakt stehen, leere oder überlange Texte.
 */
export function validateModelOutput(raw: unknown, facts: ZeitungFact[], ctx: TextContext): { articles: ZeitungArticle[]; motto: string } {
  if (!raw || typeof raw !== "object") throw new Error("Antwort ist kein Objekt");
  const { artikel, spruch } = raw as { artikel?: unknown; spruch?: unknown };
  if (!Array.isArray(artikel) || typeof spruch !== "string") throw new Error("Antwort hat nicht das erwartete Format");
  if (artikel.length !== facts.length) throw new Error(`${artikel.length} Artikel für ${facts.length} Fakten`);

  const allNames = ctx.allNames ?? [];
  // Alte ISO-Wochen durften ihre Kalenderwoche nennen; Wochen von Sonntag bis Samstag haben keine Nummer.
  const weekNo = isWeek(ctx.week) ? Number(ctx.week.slice(6)) : null;
  const articles = facts.map((fact, nr): ZeitungArticle => {
    const a = artikel.find((x: unknown) => (x as { nr?: unknown })?.nr === nr) as { schlagzeile?: unknown; text?: unknown } | undefined;
    if (!a || typeof a.schlagzeile !== "string" || typeof a.text !== "string") throw new Error(`Artikel ${nr} fehlt`);
    const headline = ohneGedankenstriche(a.schlagzeile);
    const text = ohneGedankenstriche(a.text);
    if (headline.length < 1 || headline.length > 140 || text.length < 5 || text.length > 700) {
      throw new Error(`Artikel ${nr} ist leer oder zu lang`);
    }
    const ids = factCharacters(fact);
    const own = new Set(ids.map((id) => ctx.name(id)));
    const foreign = mentionedNames(`${headline} ${text}`, allNames).filter((name) => !own.has(name));
    if (foreign.length > 0) throw new Error(`Artikel ${nr} nennt fremde Namen: ${foreign.join(", ")}`);
    // Bei der Stoßzeit sind volle Stunden wie "20:00" erlaubt, deshalb auch die 00.
    const allowed = new Set<number>([...factNumbers(fact), ...(weekNo === null ? [] : [weekNo]), ...(fact.kind === "stosszeit" ? [0] : [])]);
    const numbers = `${headline} ${text}`.match(/\d+/g) ?? [];
    const unknown = numbers.filter((x) => !allowed.has(Number(x)));
    if (unknown.length > 0) throw new Error(`Artikel ${nr} nennt Zahlen, die nicht in den Fakten stehen: ${unknown.join(", ")}`);
    const titleId = factTitle(fact);
    return { kind: artOf(fact), section: sectionOf(fact), headline, text, characterIds: ids, ...(titleId ? { titleId } : {}) };
  });

  // Kein Satz darf wörtlich (Namen und Zahlen ausgenommen) aus einer der letzten Ausgaben stammen.
  const recent = ctx.recent ?? [];
  if (recent.length > 0) {
    const old = new Set(recent.flatMap((r) => [...r.headlines, ...r.texts, r.motto].flatMap((t) => sentencePatterns(t, allNames))));
    for (const [nr, a] of articles.entries()) {
      const repeated = [a.headline, a.text].flatMap((t) => sentencePatterns(t, allNames)).find((p) => old.has(p));
      if (repeated) throw new Error(`Artikel ${nr} wiederholt einen Satz aus einer früheren Ausgabe`);
    }
    if (sentencePatterns(spruch, allNames).some((p) => old.has(p))) throw new Error("Spruch der Woche stand schon in einer früheren Ausgabe");
  }
  const motto = ohneGedankenstriche(spruch);
  if (motto.length < 3 || motto.length > 160 || /\d/.test(motto) || mentionedNames(motto, allNames).length > 0) {
    throw new Error("Spruch der Woche ist ungeeignet");
  }
  return { articles, motto };
}

/**
 * Prüft den Wetterbericht wie den Spruch: keine Ziffern, keine Charakternamen, passende Länge, kein Satz aus den
 * Wetterberichten der letzten Ausgaben. Wirft mit Grund.
 */
export function validateWetter(raw: unknown, ctx: TextContext): string {
  if (typeof raw !== "string") throw new Error("Wetterbericht fehlt");
  const wetter = ohneGedankenstriche(raw);
  const allNames = ctx.allNames ?? [];
  if (wetter.length < 20 || wetter.length > 500) throw new Error("Wetterbericht ist leer oder zu lang");
  if (/\d/.test(wetter)) throw new Error("Wetterbericht nennt Zahlen");
  if (mentionedNames(wetter, allNames).length > 0) throw new Error("Wetterbericht nennt Charaktere");
  const old = new Set((ctx.recent ?? []).flatMap((r) => (r.wetter ? sentencePatterns(r.wetter, allNames) : [])));
  if (sentencePatterns(wetter, allNames).some((p) => old.has(p))) throw new Error("Wetterbericht wiederholt einen früheren Satz");
  return wetter;
}

/** Wetterlage so, wie das Modell sie sieht. */
export function wetterForModel(ctx: TextContext): unknown[] {
  return (ctx.wetter?.elemente ?? []).map((e) => ({ wetter: WETTER_BEDEUTUNG[e.art], ...(e.ueber ? { ueber: e.ueber } : {}) }));
}

export interface ClaudeGeneratorOptions {
  client: MessagesClient;
  model?: string;
  /**
   * Schickt `output_config` mit (Aufwand und JSON-Schema). Das verstehen die Claude API und Gateways, die
   * Anthropic-Felder unverändert durchreichen; ein einfacher Router lehnt unbekannte Felder womöglich ab.
   * Ohne diese Einstellung steht das Format nur im Prompt, und `jsonAusText` plus die Prüfung fangen Fehler ab.
   */
  outputConfig?: boolean;
  /** Aufwand, nur mit `outputConfig`. */
  effort?: Effort;
  /** Ersatz, wenn der Aufruf scheitert oder die Antwort die Prüfung nicht besteht. */
  fallback?: TextGenerator;
  log?: (message: string) => void;
}

/** Texter mit der Claude API. Scheitert irgendetwas, schreiben die Satzbausteine; die Wochenauswertung scheitert nie daran. */
const grund = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createClaudeGenerator(options: ClaudeGeneratorOptions): TextGenerator {
  const model = options.model ?? DEFAULT_MODEL;
  const fallback = options.fallback ?? bausteinGenerator;
  const log = options.log ?? ((m: string) => console.warn(m));

  /** Eine Sprachfassung beim Modell bestellen und prüfen; wirft mit Grund, wenn etwas nicht passt. */
  async function schreibe(facts: ZeitungFact[], context: TextContext, sprache: Sprache) {
    const ctx = contextFor(context, sprache);
    // Bewusst nur Felder, die jede Anthropic-kompatible Schnittstelle kennt: keine Betas und kein Server-Fallback,
    // denn die gibt es nur bei Anthropic selbst. output_config nur, wenn ausdrücklich eingeschaltet.
    const response = await options.client.messages.create({
      model,
      max_tokens: 8000,
      ...(options.outputConfig
        ? { output_config: { effort: options.effort ?? "low", format: { type: "json_schema" as const, schema: ctx.wetter ? SCHEMA_MIT_WETTER : SCHEMA } } }
        : {}),
      system: systemPrompt(sprache, Boolean(ctx.wetter), { zeitung: ctx.zeitung ?? process.env.SEITE_ZEITUNG, gilden: ctx.gilden }),
      messages: [
        {
          role: "user",
          content: `Fakten der Woche ${context.week} (${facts.length} Artikel):\n${JSON.stringify(factsForModel(facts, ctx, sprache), null, 2)}${
            ctx.wetter ? `\n\nWetterlage für den Wetterbericht:\n${JSON.stringify(wetterForModel(ctx), null, 2)}` : ""
          }${recentForModel(ctx)}`,
        },
      ],
    });
    if (response.stop_reason !== "end_turn") throw new Error(`Abbruch: ${response.stop_reason}`);
    const text = response.content?.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
    if (!text) throw new Error("Antwort ohne Text");
    const raw = jsonAusText(text);
    // Ein misslungener Wetterbericht kostet nicht die ganze Fassung: dann schreiben ihn die Satzbausteine.
    let wetter: string | null = null;
    let wetterFehler: string | null = null;
    if (ctx.wetter) {
      try {
        wetter = validateWetter((raw as { wetter?: unknown })?.wetter, ctx);
      } catch (error) {
        wetterFehler = grund(error);
      }
    }
    return { ...validateModelOutput(raw, facts, ctx), model: response.model || model, wetter, wetterFehler };
  }

  // Alle Fassungen gleichzeitig, damit es nicht länger dauert als eine: Hochdeutsch, Englisch und die angebotenen
  // Dialekte (SEITE_SPRACHEN), damit fremde Installationen keine Dialekt-Aufrufe bezahlen. Scheitert Hochdeutsch,
  // schreiben die Satzbausteine alles; scheitert eine andere Sprache, springen die Satzbausteine für sie ein.
  return async (facts, context): Promise<TextResult> => {
    const sprachen = sprachenFuer(context);
    const ctx: TextContext = { ...context, sprachen };
    const andere: Fremdsprache[] = ["en", ...DIALEKTE.filter((d) => sprachen.includes(d))];
    const [de, ...weitere] = await Promise.allSettled([schreibe(facts, ctx, "de"), ...andere.map((s) => schreibe(facts, ctx, s))]);
    if (de.status === "rejected") {
      const reason = grund(de.reason);
      log(JSON.stringify({ job: "zeitung", week: context.week, fallback: reason }));
      return { ...(await fallback(facts, ctx)), fallback: reason };
    }
    let ersatz: TextResult | null = null;
    const gruende: string[] = [];
    const fassungen = new Map<Fremdsprache, { articles: ZeitungArticle[]; motto: string }>();
    for (const [i, s] of andere.entries()) {
      const r = weitere[i];
      if (r.status === "fulfilled") {
        fassungen.set(s, r.value);
        continue;
      }
      gruende.push(`${s}: ${grund(r.reason)}`);
      ersatz ??= await fallback(facts, ctx);
      const articles = ersatz.articles.map((a) => {
        const f = uebersetzungIn(a.dialekte, s);
        return { ...a, headline: f?.headline ?? a.headline, text: f?.text ?? a.text };
      });
      fassungen.set(s, { articles, motto: uebersetzungIn(ersatz.mottoDialekte, s) ?? ersatz.motto });
    }
    if (gruende.length > 0) log(JSON.stringify({ job: "zeitung", week: context.week, fallback: gruende.join("; ") }));
    const articles = de.value.articles.map((a, nr) => {
      const dialekte: Uebersetzungen<{ headline: string; text: string }> = Object.fromEntries(
        andere.map((s) => {
          const f = fassungen.get(s)!.articles[nr];
          return [s, { headline: f.headline, text: f.text }];
        }),
      );
      return { ...a, dialekte };
    });
    const mottoDialekte: Uebersetzungen<string> = Object.fromEntries(andere.map((s) => [s, fassungen.get(s)!.motto]));
    // Wetterbericht je Fassung vom Modell; fehlt er oder fiel er durch, springen die Satzbausteine ein.
    let wetterDe: string | undefined;
    const wetterDialekte: Uebersetzungen<string> = {};
    if (context.wetter) {
      const wetterGruende: string[] = [];
      const ersatzWetter = schreibeWetter(context.wetter, new Picker(context.week, (context.recent ?? []).map((r) => r.bausteine)));
      if (de.value.wetterFehler) wetterGruende.push(`wetter: ${de.value.wetterFehler}`);
      wetterDe = de.value.wetter ?? ersatzWetter.de;
      for (const [i, s] of andere.entries()) {
        const r = weitere[i];
        if (r.status === "fulfilled" && r.value.wetterFehler) wetterGruende.push(`wetter ${s}: ${r.value.wetterFehler}`);
        wetterDialekte[s] = (r.status === "fulfilled" ? r.value.wetter : null) ?? ersatzWetter[s];
      }
      if (wetterGruende.length > 0) {
        log(JSON.stringify({ job: "zeitung", week: context.week, fallback: wetterGruende.join("; ") }));
        gruende.push(...wetterGruende);
      }
    }
    return {
      articles,
      motto: de.value.motto,
      mottoDialekte,
      generator: "claude",
      model: de.value.model,
      ...(gruende.length > 0 ? { fallback: gruende.join("; ") } : {}),
      ...(wetterDe ? { wetter: wetterDe, wetterDialekte } : {}),
    };
  };
}

/**
 * Texter nach Umgebung. Claude schreibt nur über das eigene AI Gateway: `ZEITUNG_KI_URL` (Basis-URL) und
 * `ZEITUNG_KI_SCHLUESSEL` (geht als `x-api-key` mit). Fehlt eines davon, schreiben die Satzbausteine.
 *
 * `ANTHROPIC_API_KEY` und `ANTHROPIC_BASE_URL` werden absichtlich nicht gelesen: Netlifys eigenes AI Gateway
 * setzt beide in jeder Function von selbst, und dann liefe die KI über Netlify-Credits statt über unser Gateway.
 *
 * Weitere Einstellungen: `ZEITUNG_MODELL` (Vorgabe anthropic-router), `ZEITUNG_KI_OUTPUT_CONFIG=an` schickt
 * Aufwand und JSON-Schema mit, `ZEITUNG_AUFWAND` (Vorgabe low) gilt nur dann.
 */
export function generatorFromEnv(
  env: Record<string, string | undefined> = process.env,
  optionen: { fetch?: typeof fetch } = {},
): TextGenerator {
  const baseURL = env.ZEITUNG_KI_URL?.trim();
  const schluessel = env.ZEITUNG_KI_SCHLUESSEL?.trim();
  if (!baseURL || !schluessel) return bausteinGenerator;
  const effort = EFFORTS.find((e) => e === env.ZEITUNG_AUFWAND) ?? "low";
  const client = new Anthropic({
    // Alles ausdrücklich, damit das SDK nichts aus ANTHROPIC_*-Variablen oder Profilen nachlädt.
    apiKey: schluessel,
    baseURL,
    // Das SDK schickt apiKey als "Authorization: Bearer"; das Gateway erwartet wie die Claude API x-api-key.
    defaultHeaders: { "x-api-key": schluessel, Authorization: null },
    // Kein Wiederholen und knappe Zeit: Geplante Functions dürfen höchstens 30 Sekunden laufen.
    maxRetries: 0,
    timeout: 25_000,
    ...(optionen.fetch ? { fetch: optionen.fetch } : {}),
  });
  return createClaudeGenerator({
    client,
    model: env.ZEITUNG_MODELL?.trim() || DEFAULT_MODEL,
    outputConfig: env.ZEITUNG_KI_OUTPUT_CONFIG === "an",
    effort,
  });
}
