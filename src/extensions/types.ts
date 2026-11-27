// Interfaces for server modules (extensions). A module registers in `index.ts` and hooks into fixed points: its own
// API routes, extra data for the character page and articles for the weekly newspaper. Guide: docs/extensions.md.
import type { Translations } from "../language";
import type { GuildRecord, MemberSummary } from "../model";
import type { JsonStore } from "../store";
import type { ExtensionFact } from "../weekly/newspaper-facts";

export type { ArticleText, ExtensionFact, WriteTools } from "../weekly/newspaper-facts";

/** What the server passes on to an extension from outside (on Netlify from the function `api.mts`). */
export interface ExtensionEnvironment {
  /** Environment variables; on Netlify `process.env`. Each extension reads only its own. */
  env: Readonly<Record<string, string | undefined>>;
  /** IP of the caller (on Netlify `context.ip`), null if unknown. */
  clientIp: string | null;
  /** Purges the CDN cache for these cache tags (on Netlify `purgeCache`); missing locally and in tests. */
  purgeCache?: (tags: string[]) => Promise<void>;
}

export interface ApiContext extends ExtensionEnvironment {
  store: JsonStore;
  now: () => Date;
}

export interface CharacterContext {
  store: JsonStore;
  guild: GuildRecord;
  member: MemberSummary;
}

export interface WeeklyContext {
  store: JsonStore;
  guild: GuildRecord;
  /** First and last day of the evaluated week (Berlin date, `YYYY-MM-DD`). */
  from: string;
  to: string;
  /** Characters that count: active members without those on the title opt-out list. */
  ids: ReadonlySet<number>;
}

export interface ServerExtension {
  /** Unique id, such as `"polls"`; key of the extra data in `CharacterView.extensions`. */
  id: string;
  /**
   * Own routes below `/api`. Asked before the core's routes, for every method (also POST). `path` has no trailing
   * slash, such as `/api/polls`. Returns a response, or null if the extension is not responsible.
   */
  api?(req: Request, path: string, context: ApiContext): Promise<Response | null>;
  /** Extra data for the character API, ends up in `view.extensions[id]`; null or undefined leaves the field out. */
  character?(context: CharacterContext): Promise<unknown>;
  /** Cache tags on every character response, so the extension can refresh them through `purgeCache`. */
  characterCacheTags?: string[];
  /** Articles for the weekly newspaper; they compete with the core's own for the places. */
  weeklyArticles?(context: WeeklyContext): Promise<ExtensionFact[]>;
  /** Names of own sections per language; the key is the German name from `ExtensionFact.section`. */
  sections?: Record<string, Translations>;
}
