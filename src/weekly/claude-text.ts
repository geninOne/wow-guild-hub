import Anthropic from "@anthropic-ai/sdk";
import type { NewspaperArticle } from "../model";
import { factKindOf, factCharacters, factNumbers, factTitle, sectionOf, type NewspaperFact } from "./newspaper-facts";
import { isWeek } from "../lib/time";
import {
  phraseGenerator, writeWeather, languagesFor, storedTranslationIn, WEEKDAY_NAMES, type OtherLanguage, type TextContext, type TextGenerator,
  type TextResult, type StoredTranslations,
} from "./newspaper-text";
import { list, Picker, type AllLanguages } from "./phrases";
import { RECORD_KIND, newspaperName } from "./phrases-extras";
import { WEATHER_MEANING } from "./weather";
import { sentencePatterns } from "./repetition";
import { titleDef } from "./titles";
import { DIALECTS, translationIn, type Language } from "../language";

/** Router name in our own AI gateway; the gateway picks the model behind it. */
export const DEFAULT_MODEL = "anthropic-router";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

/** The part of the SDK client the generator needs; in tests a fake client without network. */
export interface MessagesClient {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
}

const TONE: AllLanguages<string> = {
  de: "Ton: freche Lokalzeitung mit Augenzwinkern, in sauberem Hochdeutsch ganz ohne Dialekt.",
  en: 'Schreibe alles auf Englisch: Schlagzeilen, Texte, Spruch und Wetterbericht. Ton: freche Lokalzeitung mit Augenzwinkern, in natürlichem, gut lesbarem Englisch. Verwende die Begriffe des englischen WoW-Clients (zum Beispiel "Guild Master", "item level", "Dungeons & Raids", "reputation", "Spirit Healer", "achievement"). Wortspiele sinngemäß, nicht wörtlich aus dem Deutschen übersetzt. Uhrzeiten schreibst du genau so, wie sie im Fakt stehen (zum Beispiel "20:00").',
  schwaebisch:
    'Ton: freche Lokalzeitung mit Augenzwinkern, auf Schwäbisch. Gut lesbar, mit typischen Wörtern und Wendungen (zum Beispiel "Heilig\'s Blechle", "gell", "des isch", "net", "koi", "a bissle", "hocka", "schaffe", "Ha noi"). Kein Kauderwelsch und nicht in jedem Wort Dialekt.',
  bayrisch:
    'Ton: freche Lokalzeitung mit Augenzwinkern, auf Bayrisch. Gut lesbar, mit typischen Wörtern und Wendungen (zum Beispiel "Servus", "a bisserl", "gell", "fei", "ned", "scho", "Obacht", "mei", "koa", "Gaudi", "schee"). Kein Kauderwelsch und nicht in jedem Wort Dialekt.',
};

const MOTTO_RULE: AllLanguages<string> = {
  de: "Dazu ein kurzer Spruch der Woche auf Hochdeutsch (Redensart oder Lebensweisheit), ohne Namen und ohne Zahlen, anders als die Sprüche der letzten Ausgaben.",
  en: "Dazu ein kurzer Spruch der Woche auf Englisch (eine englische Redensart oder Lebensweisheit), ohne Namen und ohne Zahlen, anders als die Sprüche der letzten Ausgaben.",
  schwaebisch: "Dazu ein kurzer schwäbischer Spruch der Woche ohne Namen und ohne Zahlen, anders als die Sprüche der letzten Ausgaben.",
  bayrisch: "Dazu ein kurzer bayrischer Spruch der Woche ohne Namen und ohne Zahlen, anders als die Sprüche der letzten Ausgaben.",
};

const WEATHER_LANGUAGE: AllLanguages<string> = {
  de: "auf Hochdeutsch",
  en: "auf Englisch",
  schwaebisch: "auf Schwäbisch",
  bayrisch: "auf Bayrisch",
};

/** What the system prompt needs to know about the installation: newspaper name (WEBSITE_NEWSPAPER) and guild names. */
export interface PromptFrame {
  zeitung?: string;
  gilden?: string[];
}

/**
 * System prompt for one language version of the weekly newspaper; `withWeather` adds the weather report. Newspaper
 * name and guilds come from the frame; without guild names the prompt speaks neutrally of a guild.
 */
export function systemPrompt(language: Language, withWeather = false, frame: PromptFrame = {}): string {
  const newspaper = newspaperName(language, frame.zeitung);
  const guilds = (frame.gilden ?? []).filter((g) => g.trim() !== "");
  const who =
    guilds.length === 0
      ? "einer World-of-Warcraft-Gilde"
      : guilds.length === 1
        ? `der World-of-Warcraft-Gilde ${guilds[0]}`
        : `der World-of-Warcraft-Gilden ${list(guilds)}`;
  const weatherRule = withWeather
    ? `\n- Dazu ein Wetterbericht für Azeroth ${WEATHER_LANGUAGE[language]}, zwei bis drei Sätze im Ton des Wetterberichts einer Lokalzeitung, frei gedichtet aus der mitgelieferten Wetterlage (es ist kein echtes Spielwetter). Jede Wetterart der Lage kommt vor, die stärkste zuerst. Steht bei einer Wetterart "ueber", nenne genau diesen Gildennamen als Ort. Keine Zahlen, keine Charakternamen, und nichts aus den Wetterberichten der letzten Ausgaben wiederholen.`
    : "";
  const form = withWeather
    ? '{"artikel": [{"nr": 0, "schlagzeile": "...", "text": "..."}], "spruch": "...", "wetter": "..."}'
    : '{"artikel": [{"nr": 0, "schlagzeile": "...", "text": "..."}], "spruch": "..."}';
  return `Du schreibst "${newspaper}", die Wochenzeitung ${who}.

${TONE[language]} Liebevoller Spott über das Spielgeschehen ist erwünscht, aber nie verletzend: keine Beleidigungen, nichts über Aussehen, Herkunft, Geschlecht, Alter oder Gesundheit, und nichts über die realen Menschen hinter den Charakteren. Es geht nur um die Spielfiguren.

Regeln:
- Du bekommst die Fakten der Woche als JSON. Schreibe zu jedem Fakt genau einen Artikel mit Schlagzeile und Text, in derselben Reihenfolge. "nr" ist die Nummer des Fakts.
- Verwende nur Namen und Zahlen, die in den Fakten stehen. Erfinde keine Charaktere, keine Ereignisse, keine Zahlen. Nenne keine Uhrzeit, Stufe oder Anzahl, die nicht im Fakt steht.
- Nenne in jedem Artikel nur die Charaktere seines eigenen Fakts. Titelnamen übernimmst du genau so, wie sie im Fakt stehen.
- Fakt 0 ist der Aufmacher: die stärkste Schlagzeile, Text zwei bis drei Sätze. Alle anderen Texte ein bis zwei Sätze.
- Wiederhole keine Formulierungen zwischen den Artikeln.
- Du bekommst Schlagzeilen, Texte und Sprüche der letzten Ausgaben. Wiederhole daraus keine Formulierungen, keine Pointen, keine Sprüche und keine Schlagzeilenmuster. Jede Woche soll sich frisch lesen, auch wenn dieselben Arten von Meldungen vorkommen.
- Bei der Rubrik "Zahl der Woche" ist die Schlagzeile genau die Zahl, der Text erklärt sie in einem Satz.
- Keine Gedankenstriche, keine Emojis, kein Markdown.
- ${MOTTO_RULE[language]}${weatherRule}
- Antworte ausschließlich mit einem einzigen JSON-Objekt, ohne Text davor oder danach und ohne Codeblock, genau in dieser Form:
  ${form}`;
}

/** Standard German system prompt (default version). */
export const SYSTEM_PROMPT = systemPrompt("de");

/** Context for an English or dialect version: earlier issues in that language, where available. */
export function contextFor(ctx: TextContext, language: Language): TextContext {
  if (language === "de") return ctx;
  return {
    ...ctx,
    recent: ctx.recent?.map((r) => {
      const d = storedTranslationIn(r.dialekte, language);
      return d ? { ...r, headlines: d.headlines, texts: d.texts, motto: d.motto, wetter: d.wetter ?? r.wetter } : r;
    }),
  };
}

/** The latest issues as text for the model, so it does not repeat itself. */
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

/** Schema with the required field `wetter` when a weather situation is sent along. */
const SCHEMA_WITH_WEATHER = { ...SCHEMA, required: ["artikel", "spruch", "wetter"] } as const;

/** Facts as the model sees them: names instead of ids, with section and a readable description. */
export function factsForModel(facts: NewspaperFact[], ctx: TextContext, language: Language = "de"): unknown[] {
  const titleName = (id: string | null) => {
    const def = id ? titleDef(id) : undefined;
    return id ? (def ? translationIn(def.name, language) : id) : null;
  };
  return facts.map((f, nr) => {
    const base = { nr, rubrik: nr === 0 ? "Aufmacher" : sectionOf(f), art: factKindOf(f) };
    const n = (id: number) => ctx.name(id);
    switch (f.kind) {
      case "sprung":
        return { ...base, charakter: n(f.characterId), level_gewonnen: f.levels, von_level: f.from, auf_level: f.to, titel: titleName(f.title) };
      case "meilensteine":
        return { ...base, runde_level_erreicht: f.entries.map((e) => ({ charakter: n(e.characterId), level: e.level })) };
      case "ueberholungen":
        return { ...base, im_levelrennen_ueberholt: f.entries.map((e) => ({ charakter: n(e.characterId), ueberholt: n(e.passedId), jetzt_level: e.level })) };
      case "titel": {
        const def = titleDef(f.titleId);
        return {
          ...base,
          titel: titleName(f.titleId),
          regel: def ? translationIn(def.description, language) : undefined,
          charakter: n(f.characterId),
          wert: def ? translationIn(def.valueText(f.value), language) : f.value,
        };
      }
      case "neuzugang":
        return { ...base, neu_in_der_gilde: f.characterIds.map(n) };
      case "rezepte":
        return { ...base, neue_rezepte_gesamt: f.total, beteiligte_charaktere: f.crafters, fleissigster: n(f.characterId), dessen_neue_rezepte: f.count, titel: titleName(f.title) };
      case "stosszeit":
        return {
          ...base,
          wochentag: (language === "en" ? WEEKDAY_NAMES.en : WEEKDAY_NAMES.de)[f.weekday],
          stunde: language === "en" ? `${f.hour}:00 to ${(f.hour + 1) % 24}:00` : `${f.hour} bis ${(f.hour + 1) % 24} Uhr`,
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
            was: `${RECORD_KIND[language][e.art]} in einer Woche`,
            neuer_rekord: e.value,
            alter_rekord: e.previous,
            mehr_als_bisher: e.value - e.previous,
          })),
        };
      case "erweiterung":
        return { ...base, ...f.fuerKi(n, language) };
    }
  });
}

/**
 * Extracts the JSON object from the text response. Without structured output (`output_config.format`) a model
 * behind a router may wrap the JSON in a code block or write a sentence before it, so this reads from the first
 * opening to the last closing curly brace.
 * Throws if there is no valid JSON object in it.
 */
export function jsonFromText(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Response contains no JSON object");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Response is not valid JSON");
  }
}

/** Replaces em and en dashes (Dirk's rule) with a comma. */
export function withoutEmDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ").trim();
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Names from `allNames` that occur in the text (whole words). */
export function mentionedNames(text: string, allNames: string[]): string[] {
  return allNames.filter((name) => name.length > 1 && new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, "u").test(text));
}

/**
 * Checks the model response against the facts and builds the articles. Throws with a reason if something is off:
 * wrong count, foreign names, numbers that are in no fact, empty or overlong texts.
 */
export function validateModelOutput(raw: unknown, facts: NewspaperFact[], ctx: TextContext): { articles: NewspaperArticle[]; motto: string } {
  if (!raw || typeof raw !== "object") throw new Error("Response is not an object");
  const { artikel: items, spruch: rawMotto } = raw as { artikel?: unknown; spruch?: unknown };
  if (!Array.isArray(items) || typeof rawMotto !== "string") throw new Error("Response does not have the expected format");
  if (items.length !== facts.length) throw new Error(`${items.length} articles for ${facts.length} facts`);

  const allNames = ctx.allNames ?? [];
  // Old ISO weeks were allowed to name their calendar week; Sunday to Saturday weeks have no number.
  const weekNo = isWeek(ctx.week) ? Number(ctx.week.slice(6)) : null;
  const articles = facts.map((fact, nr): NewspaperArticle => {
    const a = items.find((x: unknown) => (x as { nr?: unknown })?.nr === nr) as { schlagzeile?: unknown; text?: unknown } | undefined;
    if (!a || typeof a.schlagzeile !== "string" || typeof a.text !== "string") throw new Error(`Article ${nr} is missing`);
    const headline = withoutEmDashes(a.schlagzeile);
    const text = withoutEmDashes(a.text);
    if (headline.length < 1 || headline.length > 140 || text.length < 5 || text.length > 700) {
      throw new Error(`Article ${nr} is empty or too long`);
    }
    const ids = factCharacters(fact);
    const own = new Set(ids.map((id) => ctx.name(id)));
    const foreign = mentionedNames(`${headline} ${text}`, allNames).filter((name) => !own.has(name));
    if (foreign.length > 0) throw new Error(`Article ${nr} names foreign names: ${foreign.join(", ")}`);
    // For the rush hour, full hours like "20:00" are allowed, hence also the 00.
    const allowed = new Set<number>([...factNumbers(fact), ...(weekNo === null ? [] : [weekNo]), ...(fact.kind === "stosszeit" ? [0] : [])]);
    const numbers = `${headline} ${text}`.match(/\d+/g) ?? [];
    const unknown = numbers.filter((x) => !allowed.has(Number(x)));
    if (unknown.length > 0) throw new Error(`Article ${nr} names numbers that are not in the facts: ${unknown.join(", ")}`);
    const titleId = factTitle(fact);
    return { kind: factKindOf(fact), section: sectionOf(fact), headline, text, characterIds: ids, ...(titleId ? { titleId } : {}) };
  });

  // No sentence may come verbatim (apart from names and numbers) from one of the latest issues.
  const recent = ctx.recent ?? [];
  if (recent.length > 0) {
    const old = new Set(recent.flatMap((r) => [...r.headlines, ...r.texts, r.motto].flatMap((t) => sentencePatterns(t, allNames))));
    for (const [nr, a] of articles.entries()) {
      const repeated = [a.headline, a.text].flatMap((t) => sentencePatterns(t, allNames)).find((p) => old.has(p));
      if (repeated) throw new Error(`Article ${nr} repeats a sentence from an earlier issue`);
    }
    if (sentencePatterns(rawMotto, allNames).some((p) => old.has(p))) throw new Error("Motto of the week already appeared in an earlier issue");
  }
  const motto = withoutEmDashes(rawMotto);
  if (motto.length < 3 || motto.length > 160 || /\d/.test(motto) || mentionedNames(motto, allNames).length > 0) {
    throw new Error("Motto of the week is unsuitable");
  }
  return { articles, motto };
}

/**
 * Checks the weather report like the motto: no digits, no character names, fitting length, no sentence from the
 * weather reports of the latest issues. Throws with a reason.
 */
export function validateWeather(raw: unknown, ctx: TextContext): string {
  if (typeof raw !== "string") throw new Error("Weather report is missing");
  const report = withoutEmDashes(raw);
  const allNames = ctx.allNames ?? [];
  if (report.length < 20 || report.length > 500) throw new Error("Weather report is empty or too long");
  if (/\d/.test(report)) throw new Error("Weather report names numbers");
  if (mentionedNames(report, allNames).length > 0) throw new Error("Weather report names characters");
  const old = new Set((ctx.recent ?? []).flatMap((r) => (r.wetter ? sentencePatterns(r.wetter, allNames) : [])));
  if (sentencePatterns(report, allNames).some((p) => old.has(p))) throw new Error("Weather report repeats an earlier sentence");
  return report;
}

/** Weather situation as the model sees it. */
export function weatherForModel(ctx: TextContext): unknown[] {
  return (ctx.wetter?.elemente ?? []).map((e) => ({ wetter: WEATHER_MEANING[e.art], ...(e.ueber ? { ueber: e.ueber } : {}) }));
}

export interface ClaudeGeneratorOptions {
  client: MessagesClient;
  model?: string;
  /**
   * Sends `output_config` (effort and JSON schema). The Claude API and gateways that pass Anthropic fields through
   * unchanged understand it; a simple router may reject unknown fields.
   * Without this setting the format is only in the prompt, and `jsonFromText` plus the validation catch errors.
   */
  outputConfig?: boolean;
  /** Effort, only with `outputConfig`. */
  effort?: Effort;
  /** Substitute if the call fails or the response does not pass validation. */
  fallback?: TextGenerator;
  log?: (message: string) => void;
}

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Generator using the Claude API. If anything fails, the phrases write; the weekly run never fails because of it. */
export function createClaudeGenerator(options: ClaudeGeneratorOptions): TextGenerator {
  const model = options.model ?? DEFAULT_MODEL;
  const fallback = options.fallback ?? phraseGenerator;
  const log = options.log ?? ((m: string) => console.warn(m));

  /** Requests one language version from the model and validates it; throws with a reason if something is off. */
  async function writeVersion(facts: NewspaperFact[], context: TextContext, language: Language) {
    const ctx = contextFor(context, language);
    // Deliberately only fields every Anthropic-compatible interface knows: no betas and no server fallback,
    // since those exist only at Anthropic itself. output_config only when explicitly switched on.
    const response = await options.client.messages.create({
      model,
      max_tokens: 8000,
      ...(options.outputConfig
        ? { output_config: { effort: options.effort ?? "low", format: { type: "json_schema" as const, schema: ctx.wetter ? SCHEMA_WITH_WEATHER : SCHEMA } } }
        : {}),
      system: systemPrompt(language, Boolean(ctx.wetter), { zeitung: ctx.zeitung ?? process.env.WEBSITE_NEWSPAPER, gilden: ctx.gilden }),
      messages: [
        {
          role: "user",
          content: `Fakten der Woche ${context.week} (${facts.length} Artikel):\n${JSON.stringify(factsForModel(facts, ctx, language), null, 2)}${
            ctx.wetter ? `\n\nWetterlage für den Wetterbericht:\n${JSON.stringify(weatherForModel(ctx), null, 2)}` : ""
          }${recentForModel(ctx)}`,
        },
      ],
    });
    if (response.stop_reason !== "end_turn") throw new Error(`Stopped: ${response.stop_reason}`);
    const text = response.content?.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
    if (!text) throw new Error("Response without text");
    const raw = jsonFromText(text);
    // A failed weather report does not cost the whole version: the phrases write it instead.
    let weather: string | null = null;
    let weatherError: string | null = null;
    if (ctx.wetter) {
      try {
        weather = validateWeather((raw as { wetter?: unknown })?.wetter, ctx);
      } catch (error) {
        weatherError = reasonOf(error);
      }
    }
    return { ...validateModelOutput(raw, facts, ctx), model: response.model || model, weather, weatherError };
  }

  // All versions at once, so it takes no longer than one: standard German, English and the offered dialects
  // (WEBSITE_LANGUAGES), so other installations do not pay for dialect calls. If standard German fails, the phrases
  // write everything; if another language fails, the phrases step in for it.
  return async (facts, context): Promise<TextResult> => {
    const languages = languagesFor(context);
    const ctx: TextContext = { ...context, sprachen: languages };
    const others: OtherLanguage[] = ["en", ...DIALECTS.filter((d) => languages.includes(d))];
    const [de, ...rest] = await Promise.allSettled([writeVersion(facts, ctx, "de"), ...others.map((s) => writeVersion(facts, ctx, s))]);
    if (de.status === "rejected") {
      const reason = reasonOf(de.reason);
      log(JSON.stringify({ job: "zeitung", week: context.week, fallback: reason }));
      return { ...(await fallback(facts, ctx)), fallback: reason };
    }
    let substitute: TextResult | null = null;
    const reasons: string[] = [];
    const versions = new Map<OtherLanguage, { articles: NewspaperArticle[]; motto: string }>();
    for (const [i, s] of others.entries()) {
      const r = rest[i];
      if (r.status === "fulfilled") {
        versions.set(s, r.value);
        continue;
      }
      reasons.push(`${s}: ${reasonOf(r.reason)}`);
      substitute ??= await fallback(facts, ctx);
      const articles = substitute.articles.map((a) => {
        const f = storedTranslationIn(a.dialekte, s);
        return { ...a, headline: f?.headline ?? a.headline, text: f?.text ?? a.text };
      });
      versions.set(s, { articles, motto: storedTranslationIn(substitute.mottoDialekte, s) ?? substitute.motto });
    }
    if (reasons.length > 0) log(JSON.stringify({ job: "zeitung", week: context.week, fallback: reasons.join("; ") }));
    const articles = de.value.articles.map((a, nr) => {
      const translations: StoredTranslations<{ headline: string; text: string }> = Object.fromEntries(
        others.map((s) => {
          const f = versions.get(s)!.articles[nr];
          return [s, { headline: f.headline, text: f.text }];
        }),
      );
      return { ...a, dialekte: translations };
    });
    const mottoDialekte: StoredTranslations<string> = Object.fromEntries(others.map((s) => [s, versions.get(s)!.motto]));
    // Weather report per version from the model; if it is missing or failed, the phrases step in.
    let weatherDe: string | undefined;
    const weatherTranslations: StoredTranslations<string> = {};
    if (context.wetter) {
      const weatherReasons: string[] = [];
      const fallbackWeather = writeWeather(context.wetter, new Picker(context.week, (context.recent ?? []).map((r) => r.bausteine)));
      if (de.value.weatherError) weatherReasons.push(`weather: ${de.value.weatherError}`);
      weatherDe = de.value.weather ?? fallbackWeather.de;
      for (const [i, s] of others.entries()) {
        const r = rest[i];
        if (r.status === "fulfilled" && r.value.weatherError) weatherReasons.push(`weather ${s}: ${r.value.weatherError}`);
        weatherTranslations[s] = (r.status === "fulfilled" ? r.value.weather : null) ?? fallbackWeather[s];
      }
      if (weatherReasons.length > 0) {
        log(JSON.stringify({ job: "zeitung", week: context.week, fallback: weatherReasons.join("; ") }));
        reasons.push(...weatherReasons);
      }
    }
    return {
      articles,
      motto: de.value.motto,
      mottoDialekte,
      generator: "claude",
      model: de.value.model,
      ...(reasons.length > 0 ? { fallback: reasons.join("; ") } : {}),
      ...(weatherDe ? { wetter: weatherDe, wetterDialekte: weatherTranslations } : {}),
    };
  };
}

/**
 * Generator by environment. Claude writes only through our own AI gateway: `NEWSPAPER_AI_URL` (base URL) and
 * `NEWSPAPER_AI_KEY` (sent as `x-api-key`). If either is missing, the phrases write.
 *
 * `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` are deliberately not read: Netlify's own AI gateway sets both in
 * every function by itself, and then the AI would run on Netlify credits instead of through our gateway.
 *
 * Further settings: `NEWSPAPER_AI_MODEL` (default anthropic-router), `NEWSPAPER_AI_OUTPUT_CONFIG=on` sends effort
 * and JSON schema, `NEWSPAPER_AI_EFFORT` (default low) applies only then.
 */
export function generatorFromEnv(
  env: Record<string, string | undefined> = process.env,
  options: { fetch?: typeof fetch } = {},
): TextGenerator {
  const baseURL = env.NEWSPAPER_AI_URL?.trim();
  const apiKey = env.NEWSPAPER_AI_KEY?.trim();
  if (!baseURL || !apiKey) return phraseGenerator;
  const effort = EFFORTS.find((e) => e === env.NEWSPAPER_AI_EFFORT) ?? "low";
  const client = new Anthropic({
    // Everything explicit, so the SDK loads nothing from ANTHROPIC_* variables or profiles.
    apiKey,
    baseURL,
    // The SDK sends apiKey as "Authorization: Bearer"; like the Claude API, the gateway expects x-api-key.
    defaultHeaders: { "x-api-key": apiKey, Authorization: null },
    // No retries and little time: scheduled functions may run for at most 30 seconds.
    maxRetries: 0,
    timeout: 25_000,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  return createClaudeGenerator({
    client,
    model: env.NEWSPAPER_AI_MODEL?.trim() || DEFAULT_MODEL,
    outputConfig: env.NEWSPAPER_AI_OUTPUT_CONFIG === "on",
    effort,
  });
}
