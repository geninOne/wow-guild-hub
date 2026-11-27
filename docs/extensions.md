# Extensions

🇩🇪 [Deutsch](extensions.de.md)

An extension (a module) adds features of its own to the guild site without changing any core files. It lives in
folders of its own and registers itself with one line each in two registry files. That way you can maintain a
module in your own (even private) fork while the fork keeps pulling changes from this repo
(`git pull upstream main`) without conflicts.

Typical cases:

- Showing data from your own WoW addon: players upload their SavedVariables, the module receives them through an
  API route of its own, stores them and shows them as a tab on the statistics page and the character page.
- A page of its own, such as polls or a calendar.
- Additional stories for the weekly newspaper.

This guide describes the interface of version 3.0. Modules written for 2.x keep working until 4.0; see
[Upgrading from 2.x](#upgrading-from-2x).

## Structure

| Where | What |
| --- | --- |
| `src/extensions/types.ts` | Interface `ServerExtension` and its contexts |
| `src/extensions/index.ts` | Registry `SERVER_EXTENSIONS` |
| `src/extensions/<id>/` | Server part of the module |
| `web/src/extensions/types.ts` | Interface `UiExtension` |
| `web/src/extensions/index.ts` | Registry `UI_EXTENSIONS` |
| `web/src/extensions/<id>/` | Interface of the module, including its own CSS |
| `test/extensions/<id>/` | Server tests of the module |
| `test/web/extensions/<id>/` | Interface tests (`.tsx`, checked there by the type check of `web/`) |

Server and interface share the identifier `id` (e.g. `"polls"`). Types that both need (API responses) belong in a
pure type file in the server part, e.g. `src/extensions/polls/types.ts`. The interface may only import types from
there, no runtime code that pulls in Node modules such as `node:crypto`.

## Registering

```ts
// src/extensions/index.ts
import type { ServerExtension } from "./types";
import { polls } from "./polls";

export const SERVER_EXTENSIONS: readonly ServerExtension[] = [
  polls,
];
```

```ts
// web/src/extensions/index.ts
import type { UiExtension } from "./types";
import { polls } from "./polls";

export const UI_EXTENSIONS: readonly UiExtension[] = [
  polls,
];
```

In addition, depending on what the module needs:

- Pages of its own need a redirect to `/index.html` in `netlify.toml` (otherwise Netlify returns 404; locally you
  won't notice; `test/web/netlify-redirects.test.ts` checks it). Pages that should stay out of search
  engines also get `X-Robots-Tag = "noindex, nofollow"` there and render `<meta name="robots">`.
- Environment variables: describe them in `.env.example` and, if they should end up on Netlify, add them to
  `scripts/netlify-env-lib.mjs` and `.github/workflows/release.yml`.
- Scripts of its own as `npm run <id>:…` in `package.json`.

## Server: `ServerExtension`

```ts
interface ServerExtension {
  id: string;
  api?(req: Request, path: string, context: ApiContext): Promise<Response | null>;
  character?(context: CharacterContext): Promise<unknown>;
  characterCacheTags?: string[];
  weeklyArticles?(context: WeeklyContext): Promise<ExtensionFact[]>;
  sections?: Record<string, Translations>;
}
```

Everything is optional; a module uses only what it needs.

### `api`: routes of its own

The `/api/*` function asks all extensions first, for every method, including POST. `path` has no trailing slash,
e.g. `/api/polls`. An extension that is not responsible returns `null`; then the core takes over (which answers 405
for anything except GET and HEAD). Errors thrown by the extension become a 500 response.

The `context` (`ApiContext`) contains:

- `store`: the store (Netlify Blobs, locally the store of `netlify dev`). Please put your own keys under a prefix
  with the identifier, e.g. `polls/…`.
- `now()`: the current time (fixed in tests).
- `env`: the environment variables. Each extension reads only its own, e.g. `env.POLLS_CODE`.
- `clientIp`: IP of the caller or null. Store it only shortened and hashed, never in plain text.
- `purgeCache(tags)`: purges the CDN cache for cache tags. It may be missing (e.g. in tests) and may fail, so call
  it with `?.` and wrap it in `try`/`catch`; an error there should not prevent the actual response.

`env`, `clientIp` and `purgeCache` come from the `ExtensionEnvironment`, which the server passes on from outside
(on Netlify from the function `api.mts`).

The easiest way to build responses is `json(body, status, cache)` from `src/api/http.ts`, like the core does
(`"live"` for views, `"none"` for responses that should never be cached).

#### Upload from your own addon

This is how to connect data from a third-party addon:

1. The interface reads the SavedVariables file in the browser, extracts only the parts it needs and sends them as
   JSON via POST to its own route. The file itself never leaves the computer.
2. The route checks a code from a header of its own against an environment variable (constant-time comparison;
   without the variable, uploads are off), limits the body size, checks every entry (only characters of the guild,
   no timestamps in the future, only known identifiers) and stores it under its own prefix.
3. After a change, it purges its own cache tags with `purgeCache`, so the view and character pages show the new
   state right away.
4. Against guessing the code: count failed attempts per IP hash and block briefly, limit uploads per hour.

Anything an addon wants to show only in game does not belong in the API responses. The safest approach is for the
extension to filter out such entries while building the view and to check this with a test that searches the
JSON response for those identifiers.

### `character`: extra data for the character page

Called on every request to `/api/characters/<slug>` with a `CharacterContext` (`store`, `guild`, `member`).
Whatever the function returns appears in the response under `extensions[id]` (`CharacterView.extensions`). With
`null` or `undefined` the entry is missing; if no extension returns anything, `extensions` is missing entirely.

`characterCacheTags` sets cache tags on every character response. When the extension later purges these tags,
the character pages are refreshed too.

### `weeklyArticles`: stories for the weekly newspaper

Called once per evaluated week. The `WeeklyContext` contains `store`, `guild`, `from` and `to` (first and last day,
Berlin date `YYYY-MM-DD`) and `ids`: the characters that count (active members except those on the opt-out list).
The extension computes everything itself and returns finished facts (`ExtensionFact` from
`src/weekly/newspaper-facts.ts`, also exported by `src/extensions/types.ts`):

```ts
interface ExtensionFact {
  kind: "extension";
  type: string;             // stored in the saved article, e.g. "poll"
  section: string;          // German name of the section, e.g. "Umfragen"
  newsValue: number;        // about 10 (small stuff) to 80 (huge)
  characterIds: number[];   // characters involved
  numbers: number[];        // all numbers a text may mention
  write(tools: WriteTools): Translations<ArticleText>;
  forAi(name: (id: number) => string, language: Language): Record<string, unknown>;
}
```

The stories compete with those of the core for the slots of the issue. Stories involving former members or
opted-out characters are dropped. Types (`type`) that already appeared in recent issues move back a little, so the
issues vary. Only the finished article is stored, with `kind = type` and `section = section`; old issues therefore
stay readable even if the module is removed later.

**Sentence templates (`write`).** Without AI, the site writes from sentence templates. `write` receives
`WriteTools` (`name(id)`, `picker` and `seed`) and returns an `ArticleText` (`headline` and `text`) per language:
German (`de`) and English (`en`) are required, Swabian and Bavarian optional (missing ones fall back to German).
With the `picker` you choose among several variants so that sentences don't repeat from recent issues. Pool names
should start with the module's identifier. `list(names, language)` from `src/weekly/phrases.ts` joins names
("Anna, Bob und Cid" or "Anna, Bob and Cid"):

```ts
import { list } from "../../weekly/phrases";

const HEADLINE = { de: ["Große Umfrage", "Die Gilde hat gewählt"], en: ["Big poll", "The guild has voted"] };

write: ({ name, picker, seed }) => {
  const i = picker.choose("polls-headline", HEADLINE.de.map((_, n) => n), seed);
  const names = characterIds.map(name);
  return {
    de: { headline: HEADLINE.de[i], text: `${list(names, "de")} hat abgestimmt.` },
    en: { headline: HEADLINE.en[i], text: `${list(names, "en")} voted.` },
  };
},
```

If the pools have the same length in all four languages, you can also use `picker.chooseAll(pool, pools, seed)`
with the type `AllLanguages` (and the helper `allLanguages`) from `src/weekly/phrases.ts`; `sameLength` checks this
in the test.

**AI texts (`forAi`).** With an AI key, a language model writes the articles. It receives each fact as JSON:
the core sets `nr`, `rubrik` (section) and `art` (type), and these keys stay German because the model's input is
German. `forAi` supplies the rest with names instead of IDs, e.g.
`{ voters: ["Anna"], votes: 42, hint: language === "en" ? "Poll in the guild forum." : "Umfrage im Gildenforum." }`.
A short hint tells the model what it is about. The response is checked: it may mention only the characters of the
fact and only numbers from `numbers`. If something doesn't match, the sentence templates step in. So `numbers`
should contain every number a good text might mention (including differences or digits from names such as
"Stufe 30").

**Sections (`sections`).** The core's sections are in `SECTIONS` in `src/api/newspaper-view.ts`; `sectionName()`
there looks up a name in all languages. A new section brings its names in all languages through `sections`; the
key is the German name:

```ts
sections: { Umfragen: { de: "Umfragen", en: "Polls" } },
```

## Interface: `UiExtension`

```ts
interface UiExtension {
  id: string;
  statsTabs?: { id: string; label: Translations; Component: ComponentType<{ guild; onGuild }> }[];
  characterTabs?: { id: string; label: Translations; Component: ComponentType<{ data; view }> }[];
  characterHeader?: ComponentType<{ data; view }>;
  routes?: { path: string; Component: ComponentType }[];
  privacy?: ComponentType;
  imprintPage?: ComponentType;
  privacyPage?: ComponentType;
}
```

The element types are exported as `StatsTab`, `CharacterTab`, `CharacterDataProps` (`data` and `view`) and
`ExtensionRoute`.

- `statsTabs`: tabs under `/statistik/<id>`, after those of the core. `guild` is the selected guild from
  `?gilde=`, `onGuild` changes it (for a guild filter like in the core's tabs).
- `characterTabs`: tabs of the character page (`?reiter=<id>`), at the far right. `data` is the entry
  `extensions[id]` from the character API or `undefined`; without data the tab should show a notice.
  Characters without a profile have no tabs; there the component appears below the notice, but only with data.
- `characterHeader`: a badge in the header of the character page, only with data.
- `routes`: pages of its own (paths as in react-router). Don't forget the redirect in `netlify.toml`.
- `privacy`: a section of the privacy policy with its own `h2` heading. If you store personal data (including
  IP hashes), describe here what, what for and for how long.
- `imprintPage`, `privacyPage`: your own complete legal texts (imprint, i.e. Impressum, required in Germany, and
  privacy policy) instead of the core's placeholder templates. The first module that brings such a page wins. That
  way your own texts stay untouched when you update from the public repo. Like the templates, they only appear with
  `WEBSITE_IMPRINT_NAME`.

The page URLs and query parameters of the site (`/statistik`, `?gilde=`, `?reiter=`) stay German so that existing
links keep working.

The module imports its own CSS itself (`import "./polls.css";` in its `index.tsx`), with class names starting
with the identifier. Colors and fonts come from the variables in `web/src/styles/theme.css`.

### Texts in German and English

All visible texts are `Translations` from `src/language.ts` (in the interface also exported by
`web/src/lib/language.tsx`): `de` and `en` are required, `schwaebisch` and `bayrisch` optional. Missing dialects
fall back to German. In components, `useLanguage().t(...)` translates; `useLanguage()` also returns the current
`language` and `setLanguage`:

```tsx
import { useLanguage, type Translations } from "../../lib/language";

const T = {
  title: { de: "Umfragen", en: "Polls" },
  votes: { de: (n: number) => `${n} Stimmen`, en: (n: number) => `${n} votes` },
} satisfies Record<string, Translations<unknown>>;

function PollsTab({ guild }: { guild: string | null }) {
  const { t } = useLanguage();
  return <h2>{t(T.title)}</h2>;
}
```

Texts supplied by the server (such as names from a catalog) are best included in the response as `Translations`
already.

## Example: a complete small module

```ts
// src/extensions/polls/index.ts
import { json } from "../../api/http";
import type { ServerExtension } from "../types";

export const polls: ServerExtension = {
  id: "polls",
  api: async (req, path, { store }) => {
    if (path !== "/api/polls" || req.method !== "GET") return null;
    return json((await store.get("polls/state")) ?? { questions: [] }, 200, "live");
  },
  character: async ({ store, member }) => store.get(`polls/characters/${member.id}`),
};
```

```tsx
// web/src/extensions/polls/index.tsx
import { useLanguage, type Translations } from "../../lib/language";
import type { CharacterDataProps, UiExtension } from "../types";
import { PollsTab } from "./PollsTab";

const T = {
  none: { de: "Noch nichts abgestimmt", en: "No votes yet" },
  voted: { de: "Hat abgestimmt", en: "Has voted" },
} satisfies Record<string, Translations>;

function VotesTab({ data }: CharacterDataProps) {
  const { t } = useLanguage();
  return <p>{t(data === undefined ? T.none : T.voted)}</p>;
}

export const polls: UiExtension = {
  id: "polls",
  statsTabs: [{ id: "polls", label: { de: "Umfragen", en: "Polls" }, Component: PollsTab }],
  characterTabs: [{ id: "polls", label: { de: "Abstimmungen", en: "Votes" }, Component: VotesTab }],
};
```

## Tests

- Server: `handleApi` and `runWeeklyEvaluation` take the list of extensions as an option
  (`{ extensions: [polls] }`), as does `issueExtras`. That way you test the module on its own, without the
  registry. Without the option, the registry applies.
- Interface: the pages read the registered modules through `registeredUiExtensions()` from
  `web/src/extensions/registry.ts`, which reads `UI_EXTENSIONS` from `web/src/extensions` at call time. In tests you
  can replace the list with `vi.mock("…/web/src/extensions", …)`; `test/web/extensions/core.test.tsx` shows how.
- `test/extensions/core.test.ts` and `test/web/extensions/core.test.tsx` test the extension points themselves,
  with a test extension and without any extension. `test/erweiterungen/kern-2x.test.ts` and
  `test/web/erweiterungen/kern-2x.test.tsx` check that modules in the 2.x shape keep working.
- A module should at least test: its routes including error cases, that only characters of the guild are stored,
  that nothing ends up in responses that should not be public, and that `write` returns German and English
  texts without em dashes.

Before every commit: `npm run lint`, `npm test`, `npm run typecheck` and `npm run build`.

## Upgrading from 2.x

Version 3.0 renames the extension interface to English. Nothing has to change right away, but the 2.x names are
deprecated and will be removed in the next major version (4.0).

### What keeps working until 4.0

- **The 2.x registries.** `src/erweiterungen/index.ts` (`SERVER_ERWEITERUNGEN`) and
  `web/src/erweiterungen/index.ts` (`OBERFLAECHEN_ERWEITERUNGEN`) are still read, after the new registries.
- **The 2.x shape.** Modules there may keep the German member names (`ServerErweiterung`,
  `OberflaechenErweiterung`); `src/extensions/legacy.ts` and `web/src/extensions/legacy.tsx` convert them
  automatically, including articles of type `ErweiterungsFakt` and components with the prop `daten`.
- **Deprecated aliases at the old paths:** `src/erweiterungen/typen.ts`, `web/src/erweiterungen/typen.ts`,
  `src/sprache.ts`, `web/src/lib/sprache.tsx`, `src/weekly/zeitung-facts.ts` and `src/weekly/bausteine.ts`. They
  only cover what the 2.x guide documented (for `bausteine.ts`: `alle`, `Alle`, `list`, `gleichLang`, `Picker`).
- **The option `erweiterungen`** of `handleApi`, `runWeeklyEvaluation` and `issueExtras` (deprecated, use
  `extensions`).
- **The German API routes and query parameters** of 2.x (`/api/zeitung`, `/api/zeitung/archiv`,
  `/api/stats/woche`, `/api/stats/monat`, `?gilde=`, `?woche=`, `?titel=`, `?karte=`) still answer.
- Stored articles of 2.x modules stay readable: the stored kind is still the module's own `art`/`type`.

### What breaks

- **The API field `CharacterView.erweiterungen` is now `extensions`.** The `daten` prop of 2.x components is still
  filled, but code that reads `view.erweiterungen` directly gets nothing.
- **Core files without an alias.** Modules that imported core internals (see the last table) must use the new
  paths and names. This includes `rubrik()` and `RUBRIKEN` from `src/api/zeitung-view.ts`.
- **Modules halfway through.** A module with German and English member names works: the English member wins, the
  German one fills the gaps. Articles from `wochenArtikel` are converted, those from `weeklyArticles` must already be
  `ExtensionFact`s with `kind: "extension"`.
- **Each shape belongs in its registry.** `SERVER_EXTENSIONS` and `UI_EXTENSIONS` are typed for the 3.0 shape, the
  2.x registries for the 2.x shape. Move a module to the new registry once it is migrated.

### Extension interface

| 2.x | 3.0 |
| --- | --- |
| `src/erweiterungen/typen.ts` | `src/extensions/types.ts` |
| `src/erweiterungen/index.ts`, `SERVER_ERWEITERUNGEN` | `src/extensions/index.ts`, `SERVER_EXTENSIONS` |
| `src/erweiterungen/<id>/` | `src/extensions/<id>/` |
| `web/src/erweiterungen/typen.ts` | `web/src/extensions/types.ts` |
| `web/src/erweiterungen/index.ts`, `OBERFLAECHEN_ERWEITERUNGEN` | `web/src/extensions/index.ts`, `UI_EXTENSIONS` |
| `web/src/erweiterungen/<id>/` | `web/src/extensions/<id>/` |
| `test/erweiterungen/`, `test/web/erweiterungen/` | `test/extensions/`, `test/web/extensions/` |
| `ServerErweiterung` | `ServerExtension` |
| `ErweiterungsUmgebung` | `ExtensionEnvironment` |
| `ApiKontext` | `ApiContext` |
| `CharakterKontext` | `CharacterContext` |
| `WochenKontext` | `WeeklyContext` |
| `api(req, pfad, kontext)` | `api(req, path, context)` (same position, only the names) |
| `charakter` | `character` |
| `charakterCacheTags` | `characterCacheTags` |
| `wochenArtikel` | `weeklyArticles` |
| `rubriken` | `sections` |
| `OberflaechenErweiterung` | `UiExtension` |
| `StatistikReiter`, `statistikReiter` | `StatsTab`, `statsTabs` |
| `CharakterReiter`, `charakterReiter` | `CharacterTab`, `characterTabs` |
| `charakterKopf` | `characterHeader` |
| `ErweiterungsRoute`, `routen: { pfad, Komponente }` | `ExtensionRoute`, `routes: { path, Component }` |
| `Komponente` | `Component` |
| `CharakterDatenProps`, prop `daten` | `CharacterDataProps`, prop `data` |
| `datenschutz` | `privacy` |
| `impressumSeite` | `imprintPage` |
| `datenschutzSeite` | `privacyPage` |
| `CharacterView.erweiterungen` | `CharacterView.extensions` |
| option `erweiterungen` | option `extensions` |

### Newspaper articles

| 2.x | 3.0 |
| --- | --- |
| `src/weekly/zeitung-facts.ts` | `src/weekly/newspaper-facts.ts` (types also exported by `src/extensions/types.ts`) |
| `ErweiterungsFakt` | `ExtensionFact` |
| `kind: "erweiterung"` | `kind: "extension"` |
| `art` | `type` |
| `rubrik` | `section` |
| `nachrichtenwert` | `newsValue` |
| `zahlen` | `numbers` |
| `schreibe(w)` | `write(tools)` |
| `fuerKi(name, sprache)` | `forAi(name, language)` |
| `SchreibWerkzeug` | `WriteTools` |
| `MeldungsText` | `ArticleText` |
| `src/weekly/bausteine.ts` | `src/weekly/phrases.ts` |
| `alle`, `Alle` | `allLanguages`, `AllLanguages` |
| `gleichLang` | `sameLength` |
| `list`, `Picker` (`choose`, `chooseAll`) | unchanged |
| `src/api/zeitung-view.ts` | `src/api/newspaper-view.ts` |
| `RUBRIKEN`, `rubrik()` | `SECTIONS`, `sectionName()` |

The keys `nr`, `rubrik` and `art` that the core adds to the AI input stay German.

### Languages

| 2.x | 3.0 |
| --- | --- |
| `src/sprache.ts` | `src/language.ts` |
| `Fassungen` | `Translations` |
| `Sprache`, `SPRACHEN` | `Language`, `LANGUAGES` |
| `Dialekt`, `DIALEKTE` | `Dialect`, `DIALECTS` |
| `Dialekte` | `OtherTranslations` |
| `STANDARD_SPRACHE`, `STANDARD_SPRACHEN` | `DEFAULT_LANGUAGE`, `DEFAULT_LANGUAGES` |
| `SPRACH_NAMEN` | `LANGUAGE_NAMES` |
| `istSprache`, `istDialekt` | `isLanguage`, `isDialect` |
| `aktiveSprachen` | `activeLanguages` |
| `fassungIn` | `translationIn` |
| `mitDialekten` | `withDialects` |
| `ueberall` | `sameInAll` |
| `jeSprache` | `perLanguage` |
| `KonfigText`, `ausKonfig` | `ConfigText`, `fromConfig` |
| `web/src/lib/sprache.tsx` | `web/src/lib/language.tsx` |
| `useSprache()` with `sprache`, `setSprache`, `t` | `useLanguage()` with `language`, `setLanguage`, `t` |
| `SpracheProvider` | `LanguageProvider` |
| `SPRACH_SCHLUESSEL` | `LANGUAGE_STORAGE_KEY` |
| `angeboteneSprachen` | `offeredLanguages` |
| `gemerkteSprache`, `spracheMerken` | `storedLanguage`, `storeLanguage` |

### API routes

| 2.x | 3.0 |
| --- | --- |
| `/api/zeitung` | `/api/newspaper` |
| `/api/zeitung/archiv` | `/api/newspaper/archive` |
| `/api/stats/woche`, `/api/stats/monat` | `/api/stats/week`, `/api/stats/month` |
| `?gilde=`, `?woche=`, `?titel=`, `?karte=` | `?guild=`, `?week=`, `?title=`, `?card=` |

The old routes and parameters still answer. Page URLs of the site (`/zeitung`, `/statistik`, `?reiter=`, …) are
unchanged.

### Core internals

These were never part of the documented interface, but a module may have imported them. They were renamed in 3.0
without an alias:

| 2.x | 3.0 |
| --- | --- |
| `web/src/components/Kontakt.tsx` | `web/src/components/Contact.tsx` |
| `Anschrift` (prop `mitEmail`) | `PostalAddress` (prop `withEmail`) |
| `RechtstextHinweis`, `RECHTSTEXT_HINWEIS` | `LegalTextNotice`, `LEGAL_TEXT_NOTICE` |
| `impressum()` | `imprintDetails()` |
| `web/src/pages/DatenschutzPage.tsx` (`DatenschutzPage`) | `web/src/pages/PrivacyPage.tsx` (`PrivacyPage`) |
| `web/src/pages/ImpressumPage.tsx` (`ImpressumPage`) | `web/src/pages/ImprintPage.tsx` (`ImprintPage`) |
| `web/src/pages/ZeitungPage.tsx` (`ZeitungPage`, `ZeitungArchivePage`) | `web/src/pages/NewspaperPage.tsx` (`NewspaperPage`, `NewspaperArchivePage`) |
| `web/src/lib/seite.ts`, `seite()`, `Seite`, `Impressum` | `web/src/lib/site.ts`, `site()`, `Site`, `Imprint` |
| fields `untertitel`, `impressum`, `anschrift` | `tagline`, `imprint`, `address` |
| `zahlLocale()`, `setzeFormatSprache()` in `web/src/lib/format.ts` | `numberLocale()`, `setFormatLanguage()` |
| `src/serverstart.ts`, `src/lib/serverstart.ts` | `src/server-start.ts`, `src/lib/server-start.ts` |
| `src/weekly/zeitung-text.ts`, `bausteinGenerator` | `src/weekly/newspaper-text.ts`, `phraseGenerator` |
| `src/weekly/ausgabe-extras.ts`, `ausgabeExtras` | `src/weekly/issue-extras.ts`, `issueExtras` |

### npm scripts

The old names still work as aliases.

| 2.x | 3.0 |
| --- | --- |
| `daten:beispiel` | `data:sample` |
| `daten:uebernahme` | `data:import` |
| `daten:uebernahme:live` | `data:import:live` |
| `zeitung:neu` | `newspaper:regenerate` |
| `zeitung:ki-test` | `newspaper:ai-test` |
| `netlify:umgebung` | `netlify:env` |
| `statistik:erkunden` | `stats:explore` |
