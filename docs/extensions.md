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

Identifiers in the code are German (for example `erweiterungen` means extensions, `Reiter` means tab,
`Fassungen` means versions of a text per language). The names below are the real ones from the code.

## Structure

| Where | What |
| --- | --- |
| `src/erweiterungen/typen.ts` | Interface `ServerErweiterung` |
| `src/erweiterungen/index.ts` | Registry `SERVER_ERWEITERUNGEN` |
| `src/erweiterungen/<id>/` | Server part of the module |
| `web/src/erweiterungen/typen.ts` | Interface `OberflaechenErweiterung` |
| `web/src/erweiterungen/index.ts` | Registry `OBERFLAECHEN_ERWEITERUNGEN` |
| `web/src/erweiterungen/<id>/` | Interface of the module, including its own CSS |
| `test/erweiterungen/<id>/` | Server tests of the module |
| `test/web/erweiterungen/<id>/` | Interface tests (`.tsx`, checked there by the type check of `web/`) |

Server and interface share the identifier `id` (e.g. `"umfragen"`). Types that both need (API responses) belong
in a pure type file in the server part, e.g. `src/erweiterungen/umfragen/typen.ts`. The interface may only import
types from there, no runtime code that pulls in Node modules such as `node:crypto`.

## Registering

```ts
// src/erweiterungen/index.ts
import type { ServerErweiterung } from "./typen";
import { umfragen } from "./umfragen";

export const SERVER_ERWEITERUNGEN: readonly ServerErweiterung[] = [
  umfragen,
];
```

```ts
// web/src/erweiterungen/index.ts
import type { OberflaechenErweiterung } from "./typen";
import { umfragen } from "./umfragen";

export const OBERFLAECHEN_ERWEITERUNGEN: readonly OberflaechenErweiterung[] = [
  umfragen,
];
```

In addition, depending on what the module needs:

- Pages of its own need a redirect to `/index.html` in `netlify.toml` (otherwise Netlify returns 404; locally you
  won't notice; `test/web/netlify-weiterleitungen.test.ts` checks it). Pages that should stay out of search
  engines also get `X-Robots-Tag = "noindex, nofollow"` there and render `<meta name="robots">`.
- Environment variables: describe them in `.env.example` and, if they should end up on Netlify, add them to
  `scripts/netlify-env-lib.mjs` and `.github/workflows/release.yml`.
- Scripts of its own as `npm run <id>:…` in `package.json`.

## Server: `ServerErweiterung`

```ts
interface ServerErweiterung {
  id: string;
  api?(req: Request, pfad: string, kontext: ApiKontext): Promise<Response | null>;
  charakter?(kontext: CharakterKontext): Promise<unknown>;
  charakterCacheTags?: string[];
  wochenArtikel?(kontext: WochenKontext): Promise<ErweiterungsFakt[]>;
  rubriken?: Record<string, Fassungen>;
}
```

Everything is optional; a module uses only what it needs.

### `api`: routes of its own

The `/api/*` function asks all extensions first, for every method, including POST. `pfad` has no trailing slash,
e.g. `/api/umfragen`. An extension that is not responsible returns `null`; then the core takes over (which
answers 405 for anything except GET and HEAD). Errors thrown by the extension become a 500 response.

The `kontext` contains:

- `store`: the store (Netlify Blobs, locally the store of `netlify dev`). Please put your own keys under a prefix
  with the identifier, e.g. `umfragen/…`.
- `now()`: the current time (fixed in tests).
- `env`: the environment variables. Each extension reads only its own, e.g. `env.UMFRAGEN_CODE`.
- `clientIp`: IP of the caller or null. Store it only shortened and hashed, never in plain text.
- `purgeCache(tags)`: purges the CDN cache for cache tags. It may be missing (e.g. in tests) and may fail, so call
  it with `?.` and wrap it in `try`/`catch`; an error there should not prevent the actual response.

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

### `charakter`: extra data for the character page

Called on every request to `/api/characters/<slug>` (`store`, `guild`, `member`). Whatever the function returns
appears in the response under `erweiterungen[id]`. With `null` or `undefined` the entry is missing; if no
extension returns anything, `erweiterungen` is missing entirely.

`charakterCacheTags` sets cache tags on every character response. When the extension later purges these tags,
the character pages are refreshed too.

### `wochenArtikel`: stories for the weekly newspaper

Called once per evaluated week. The context contains `store`, `guild`, `from` and `to` (first and last day,
Berlin date `YYYY-MM-DD`) and `ids`: the characters that count (active members except those on the opt-out list).
The extension computes everything itself and returns finished facts:

```ts
interface ErweiterungsFakt {
  kind: "erweiterung";
  art: string;              // stored in the saved article, e.g. "umfrage"
  rubrik: string;           // German name of the section, e.g. "Umfragen"
  nachrichtenwert: number;  // about 10 (small stuff) to 80 (huge)
  characterIds: number[];   // characters involved
  zahlen: number[];         // all numbers a text may mention
  schreibe(w: SchreibWerkzeug): Fassungen<MeldungsText>;
  fuerKi(name: (id: number) => string, sprache: Sprache): Record<string, unknown>;
}
```

The stories compete with those of the core for the slots of the issue. Stories involving former members or
opted-out characters are dropped. Kinds (`art`) that already appeared in recent issues move back a little, so the
issues vary. Only the finished article is stored, with `kind = art` and `section = rubrik`; old issues therefore
stay readable even if the module is removed later.

**Sentence templates (`schreibe`).** Without AI, the site writes from sentence templates. `schreibe` receives
`name(id)`, `picker` and `seed` and returns headline and text per language: German (`de`) and English (`en`) are
required, Swabian and Bavarian optional (missing ones fall back to German). With the `picker` you choose among
several variants so that sentences don't repeat from recent issues. Pool names should start with the module's
identifier:

```ts
const KOPF = { de: ["Große Umfrage", "Die Gilde hat gewählt"], en: ["Big poll", "The guild has voted"] };

schreibe: ({ name, picker, seed }) => {
  const i = picker.choose("umfrage-kopf", KOPF.de.map((_, n) => n), seed);
  const wer = characterIds.map(name).join(", ");
  return {
    de: { headline: KOPF.de[i], text: `${wer} hat abgestimmt.` },
    en: { headline: KOPF.en[i], text: `${wer} voted.` },
  };
},
```

If the pools have the same length in all four languages, you can also use `picker.chooseAll(topf, toepfe, seed)`
with the type `Alle` from `src/weekly/phrases.ts`; `sameLength` checks this in the test.

**AI texts (`fuerKi`).** With an AI key, a language model writes the articles. It receives each fact as JSON:
the core sets `nr`, `rubrik` and `art`, `fuerKi` supplies the rest with names instead of IDs, e.g.
`{ abstimmende: ["Anna"], stimmen: 42, hinweis: "Umfrage im Gildenforum." }`. A short `hinweis` (hint) tells the
model what it is about. The response is checked: it may mention only the characters of the fact and only numbers
from `zahlen`. If something doesn't match, the sentence templates step in. So `zahlen` should contain every number
a good text might mention (including differences or digits from names such as "Stufe 30").

**Sections (`rubriken`).** The core's sections are in `src/api/zeitung-view.ts`. A new section brings its names
in all languages through `rubriken`; the key is the German name:

```ts
rubriken: { Umfragen: { de: "Umfragen", en: "Polls" } },
```

## Interface: `OberflaechenErweiterung`

```ts
interface OberflaechenErweiterung {
  id: string;
  statistikReiter?: { id: string; label: Fassungen; Komponente: ComponentType<{ guild; onGuild }> }[];
  charakterReiter?: { id: string; label: Fassungen; Komponente: ComponentType<{ daten; view }> }[];
  charakterKopf?: ComponentType<{ daten; view }>;
  routen?: { pfad: string; Komponente: ComponentType }[];
  datenschutz?: ComponentType;
  impressumSeite?: ComponentType;
  datenschutzSeite?: ComponentType;
}
```

- `statistikReiter`: tabs under `/statistik/<id>`, after those of the core. `guild` is the selected guild from
  `?gilde=`, `onGuild` changes it (for a guild filter like in the core's tabs).
- `charakterReiter`: tabs of the character page (`?reiter=<id>`), at the far right. `daten` is the entry
  `erweiterungen[id]` from the character API or `undefined`; without data the tab should show a notice.
  Characters without a profile have no tabs; there the component appears below the notice, but only with data.
- `charakterKopf`: a badge in the header of the character page, only with data.
- `routen`: pages of its own (paths as in react-router). Don't forget the redirect in `netlify.toml`.
- `datenschutz`: a section of the privacy policy with its own `h2` heading. If you store personal data (including
  IP hashes), describe here what, what for and for how long.
- `impressumSeite`, `datenschutzSeite`: your own complete legal texts (imprint, i.e. Impressum, required in
  Germany, and privacy policy) instead of the core's placeholder templates. The first module that brings such a
  page wins. That way your own texts stay untouched when you update from the public repo. Like the templates, they
  only appear with `WEBSITE_IMPRINT_NAME`.

The module imports its own CSS itself (`import "./umfragen.css";` in its `index.tsx`), with class names starting
with the identifier. Colors and fonts come from the variables in `web/src/styles/theme.css`.

### Texts in German and English

All visible texts are `Fassungen` from `src/sprache.ts`: `de` and `en` are required, `schwaebisch` and `bayrisch`
optional. Missing dialects fall back to German. In components, `useSprache().t(...)` translates:

```tsx
const T = {
  titel: { de: "Umfragen", en: "Polls" },
  stimmen: { de: (n: number) => `${n} Stimmen`, en: (n: number) => `${n} votes` },
} satisfies Record<string, Fassungen<unknown>>;

function UmfragenReiter({ guild }: { guild: string | null }) {
  const { t } = useSprache();
  return <h2>{t(T.titel)}</h2>;
}
```

Texts supplied by the server (such as names from a catalog) are best included in the response as `Fassungen`
already.

## Example: a complete small module

```ts
// src/erweiterungen/umfragen/index.ts
import { json } from "../../api/http";
import type { ServerErweiterung } from "../typen";

export const umfragen: ServerErweiterung = {
  id: "umfragen",
  api: async (req, pfad, { store }) => {
    if (pfad !== "/api/umfragen" || req.method !== "GET") return null;
    return json((await store.get("umfragen/stand")) ?? { fragen: [] }, 200, "live");
  },
  charakter: async ({ store, member }) => store.get(`umfragen/charaktere/${member.id}`),
};
```

```tsx
// web/src/erweiterungen/umfragen/index.tsx
import type { OberflaechenErweiterung } from "../typen";
import { UmfragenReiter } from "./UmfragenReiter";

export const umfragen: OberflaechenErweiterung = {
  id: "umfragen",
  statistikReiter: [{ id: "umfragen", label: { de: "Umfragen", en: "Polls" }, Komponente: UmfragenReiter }],
  charakterReiter: [
    {
      id: "umfragen",
      label: { de: "Abstimmungen", en: "Votes" },
      Komponente: ({ daten }) => <p>{daten === undefined ? "Noch nichts abgestimmt" : "Hat abgestimmt"}</p>,
    },
  ],
};
```

## Tests

- Server: `handleApi` and `runWeeklyEvaluation` take the list of extensions as an option
  (`{ erweiterungen: [umfragen] }`), as does `ausgabeExtras`. That way you test the module on its own, without
  the registry. Without the option, the registry applies.
- Interface: the pages read `OBERFLAECHEN_ERWEITERUNGEN` from `web/src/erweiterungen`. In tests you can replace
  the list with `vi.mock("…/web/src/erweiterungen", …)`; `test/web/erweiterungen/kern.test.tsx` shows how.
- `test/erweiterungen/kern.test.ts` and `test/web/erweiterungen/kern.test.tsx` test the extension points
  themselves, with a test extension and without any extension.
- A module should at least test: its routes including error cases, that only characters of the guild are stored,
  that nothing ends up in responses that should not be public, and that `schreibe` returns German and English
  texts without em dashes.

Before every commit: `npm run lint`, `npm test`, `npm run typecheck` and `npm run build`.
