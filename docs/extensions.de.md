# Erweiterungen

🇬🇧 [English](extensions.md)

> Übersetzung von [extensions.md](extensions.md). Bei Abweichungen gilt die englische Fassung.

Eine Erweiterung (ein Modul) bringt eigene Funktionen auf die Gildenseite, ohne Dateien des Kerns zu ändern. Sie
liegt in eigenen Ordnern und meldet sich mit je einer Zeile in zwei Registry-Dateien an. So lässt sich ein Modul in
einem eigenen (auch privaten) Fork pflegen, während der Fork weiter Änderungen aus diesem Repo zieht
(`git pull upstream main`), ohne dass es zu Konflikten kommt.

Typische Fälle:

- Daten aus einem eigenen WoW-Addon anzeigen: Die Spieler laden ihre SavedVariables hoch, das Modul nimmt sie über
  eine eigene API-Route an, speichert sie und zeigt sie als Reiter auf der Statistik- und der Charakterseite.
- Eine eigene Seite, etwa Umfragen oder ein Kalender.
- Zusätzliche Meldungen für die Wochenzeitung.

Diese Anleitung beschreibt die Schnittstelle von Version 3.0. Module, die für 2.x geschrieben sind, laufen bis 4.0
weiter; siehe [Upgrade von 2.x](#upgrade-von-2x).

## Aufbau

| Wo | Was |
| --- | --- |
| `src/extensions/types.ts` | Schnittstelle `ServerExtension` und ihre Kontexte |
| `src/extensions/index.ts` | Registry `SERVER_EXTENSIONS` |
| `src/extensions/<id>/` | Server-Teil des Moduls |
| `web/src/extensions/types.ts` | Schnittstelle `UiExtension` |
| `web/src/extensions/index.ts` | Registry `UI_EXTENSIONS` |
| `web/src/extensions/<id>/` | Oberfläche des Moduls, auch eigenes CSS |
| `test/extensions/<id>/` | Server-Tests des Moduls |
| `test/web/extensions/<id>/` | Tests der Oberfläche (`.tsx`, dort prüft die Typprüfung von `web/` sie mit) |

Server und Oberfläche teilen sich die Kennung `id` (etwa `"polls"`). Typen, die beide brauchen (Antworten der API),
gehören in eine reine Typdatei im Server-Teil, etwa `src/extensions/polls/types.ts`. Die Oberfläche darf nur Typen
von dort importieren, keinen Laufzeitcode, der Node-Module wie `node:crypto` zieht.

## Anmelden

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

Dazu, je nachdem, was das Modul braucht:

- Eigene Seiten brauchen eine Weiterleitung auf `/index.html` in `netlify.toml` (sonst liefert Netlify 404; lokal
  merkt man das nicht; `test/web/netlify-redirects.test.ts` prüft es). Seiten, die nicht in Suchmaschinen sollen,
  bekommen dort zusätzlich `X-Robots-Tag = "noindex, nofollow"` und rendern `<meta name="robots">`.
- Umgebungsvariablen: in `.env.example` beschreiben und, wenn sie auf Netlify landen sollen, in
  `scripts/netlify-env-lib.mjs` und `.github/workflows/release.yml` eintragen.
- Eigene Skripte als `npm run <id>:…` in `package.json`.

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

Alles ist optional; ein Modul nutzt nur, was es braucht.

### `api`: eigene Routen

Die Funktion `/api/*` fragt zuerst alle Erweiterungen, bei jeder Methode, auch POST. `path` hat keinen Schrägstrich
am Ende, etwa `/api/polls`. Eine Erweiterung, die nicht zuständig ist, gibt `null` zurück; dann übernimmt der Kern
(der außer GET und HEAD mit 405 antwortet). Fehler, die die Erweiterung wirft, werden zu einer Antwort 500.

Der `context` (`ApiContext`) enthält:

- `store`: den Speicher (Netlify Blobs, lokal den Speicher von `netlify dev`). Eigene Schlüssel bitte unter einem
  Präfix mit der Kennung ablegen, etwa `polls/…`.
- `now()`: die aktuelle Zeit (in Tests fest).
- `env`: die Umgebungsvariablen. Jede Erweiterung liest nur ihre eigenen, etwa `env.POLLS_CODE`.
- `clientIp`: IP des Aufrufers oder null. Nur gekürzt und gehasht speichern, nie im Klartext.
- `purgeCache(tags)`: leert den CDN-Cache für Cache-Tags. Kann fehlen (etwa in Tests) und scheitern, daher mit `?.`
  aufrufen und in `try`/`catch` packen; ein Fehler dort soll die eigentliche Antwort nicht verhindern.

`env`, `clientIp` und `purgeCache` stammen aus der `ExtensionEnvironment`, die der Server von außen weiterreicht
(auf Netlify aus der Funktion `api.mts`).

Antworten baut man am einfachsten mit `json(body, status, cache)` aus `src/api/http.ts`, wie der Kern
(`"live"` für Ansichten, `"none"` für Antworten, die nie im Cache landen sollen).

#### Upload aus einem eigenen Addon

So lassen sich Daten eines fremden Addons anbinden:

1. Die Oberfläche liest die SavedVariables-Datei im Browser, holt nur die nötigen Teile heraus und schickt sie als
   JSON per POST an die eigene Route. Die Datei selbst verlässt den Rechner nicht.
2. Die Route prüft einen Code aus einem eigenen Header gegen eine Umgebungsvariable (zeitkonstanter Vergleich, ohne
   Variable ist der Upload aus), begrenzt die Größe des Bodys, prüft jeden Eintrag (nur Charaktere der Gilde, keine
   Zeitpunkte in der Zukunft, nur bekannte Kennungen) und speichert ihn unter dem eigenen Präfix.
3. Nach einer Änderung leert sie mit `purgeCache` die eigenen Cache-Tags, damit Ansicht und Charakterseiten sofort
   den neuen Stand zeigen.
4. Gegen Raten des Codes: Fehlversuche je IP-Hash zählen und kurz sperren, Uploads je Stunde begrenzen.

Was ein Addon nur im Spiel zeigen will, gehört nicht in die API-Antworten. Am sichersten filtert die Erweiterung
solche Einträge schon beim Bauen der Ansicht heraus und prüft das mit einem Test, der die JSON-Antwort nach den
Kennungen durchsucht.

### `character`: Zusatzdaten für die Charakterseite

Wird bei jeder Anfrage an `/api/characters/<slug>` mit einem `CharacterContext` (`store`, `guild`, `member`)
aufgerufen. Was die Funktion liefert, steht in der Antwort unter `extensions[id]` (`CharacterView.extensions`). Bei
`null` oder `undefined` fehlt der Eintrag; liefert keine Erweiterung etwas, fehlt `extensions` ganz.

`characterCacheTags` setzt Cache-Tags auf jede Charakterantwort. Leert die Erweiterung später diese Tags, erneuern
sich auch die Charakterseiten.

### `weeklyArticles`: Meldungen für die Wochenzeitung

Wird einmal je ausgewerteter Woche aufgerufen. Der `WeeklyContext` enthält `store`, `guild`, `from` und `to` (erster
und letzter Tag, Berliner Datum `YYYY-MM-DD`) und `ids`: die Charaktere, die zählen (aktive Mitglieder ohne die von
der Abmeldeliste). Die Erweiterung rechnet alles selbst aus und liefert fertige Fakten (`ExtensionFact` aus
`src/weekly/newspaper-facts.ts`, auch von `src/extensions/types.ts` exportiert):

```ts
interface ExtensionFact {
  kind: "extension";
  type: string;             // steht im gespeicherten Artikel, z. B. "poll"
  section: string;          // deutscher Name der Rubrik, z. B. "Umfragen"
  newsValue: number;        // etwa 10 (Kleinkram) bis 80 (ganz groß)
  characterIds: number[];   // betroffene Charaktere
  numbers: number[];        // alle Zahlen, die ein Text nennen darf
  write(tools: WriteTools): Translations<ArticleText>;
  forAi(name: (id: number) => string, language: Language): Record<string, unknown>;
}
```

Die Meldungen konkurrieren mit denen des Kerns um die Plätze der Ausgabe. Meldungen mit ehemaligen Mitgliedern oder
abgemeldeten Charakteren fallen weg. Arten (`type`), die in den letzten Ausgaben schon vorkamen, rücken etwas nach
hinten, damit die Ausgaben abwechseln. Gespeichert wird nur der fertige Artikel, mit `kind = type` und
`section = section`; alte Ausgaben bleiben daher lesbar, auch wenn das Modul später entfernt wird.

**Satzbausteine (`write`).** Ohne KI schreibt die Seite aus Satzbausteinen. `write` bekommt `WriteTools`
(`name(id)`, `picker` und `seed`) und liefert je Sprache einen `ArticleText` (`headline` und `text`): Deutsch (`de`)
und Englisch (`en`) sind Pflicht, Schwäbisch und Bairisch optional (fehlende fallen auf Deutsch zurück). Mit dem
`picker` wählt man unter mehreren Varianten, damit sich Sätze aus den letzten Ausgaben nicht wiederholen. Die Namen
der Töpfe sollten mit der Kennung des Moduls beginnen. `list(names, language)` aus `src/weekly/phrases.ts` reiht
Namen aneinander ("Anna, Bob und Cid" oder "Anna, Bob and Cid"):

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

Haben die Töpfe in allen vier Sprachen dieselbe Länge, geht auch `picker.chooseAll(pool, pools, seed)` mit dem Typ
`AllLanguages` (und der Hilfsfunktion `allLanguages`) aus `src/weekly/phrases.ts`; `sameLength` prüft das im Test.

**KI-Texte (`forAi`).** Mit KI-Schlüssel schreibt ein Sprachmodell die Artikel. Es bekommt jeden Fakt als JSON:
Der Kern setzt `nr`, `rubrik` (Rubrik) und `art` (Art), und diese Schlüssel bleiben deutsch, weil die Eingabe des
Modells deutsch ist. `forAi` liefert den Rest mit Namen statt IDs, etwa
`{ voters: ["Anna"], votes: 42, hint: language === "en" ? "Poll in the guild forum." : "Umfrage im Gildenforum." }`.
Ein kurzer Hinweis sagt dem Modell, worum es geht. Die Antwort wird geprüft: Sie darf nur die Charaktere des Fakts
nennen und nur Zahlen aus `numbers`. Passt etwas nicht, springen die Satzbausteine ein. `numbers` sollte daher jede
Zahl enthalten, die ein guter Text nennen könnte (auch Differenzen oder Ziffern aus Namen wie "Stufe 30").

**Rubriken (`sections`).** Die Rubriken des Kerns stehen in `SECTIONS` in `src/api/newspaper-view.ts`;
`sectionName()` schlägt dort einen Namen in allen Sprachen nach. Eine neue Rubrik bringt ihre Namen in allen
Sprachen über `sections` mit; der Schlüssel ist der deutsche Name:

```ts
sections: { Umfragen: { de: "Umfragen", en: "Polls" } },
```

## Oberfläche: `UiExtension`

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

Die Typen der Einträge sind als `StatsTab`, `CharacterTab`, `CharacterDataProps` (`data` und `view`) und
`ExtensionRoute` exportiert.

- `statsTabs`: Reiter unter `/statistik/<id>`, hinter denen des Kerns. `guild` ist die gewählte Gilde aus
  `?gilde=`, `onGuild` ändert sie (für einen Gildenfilter wie in den Reitern des Kerns).
- `characterTabs`: Reiter der Charakterseite (`?reiter=<id>`), ganz rechts. `data` ist der Eintrag
  `extensions[id]` aus der Charakter-API oder `undefined`; ohne Daten sollte der Reiter einen Hinweis zeigen.
  Charaktere ohne Profil haben keine Reiter; dort steht die Komponente unter dem Hinweis, aber nur mit Daten.
- `characterHeader`: ein Abzeichen in der Kopfzeile der Charakterseite, nur mit Daten.
- `routes`: eigene Seiten (Pfade wie bei react-router). Die Weiterleitung in `netlify.toml` nicht vergessen.
- `privacy`: ein Abschnitt der Datenschutzerklärung mit eigener Überschrift `h2`. Wer personenbezogene Daten
  speichert (auch IP-Hashes), beschreibt hier, was, wofür und wie lange.
- `imprintPage`, `privacyPage`: eigene, vollständige Rechtstexte (Impressum und Datenschutzerklärung) statt der
  Platzhalter-Vorlagen des Kerns. Es gilt das erste Modul, das eine solche Seite mitbringt. So bleiben die eigenen
  Texte unberührt, wenn man aus dem öffentlichen Repo aktualisiert. Wie die Vorlagen erscheinen sie nur mit
  `WEBSITE_IMPRINT_NAME`.

Die Adressen und Abfrageparameter der Seiten (`/statistik`, `?gilde=`, `?reiter=`) bleiben deutsch, damit bestehende
Links weiter funktionieren.

Das Modul importiert sein CSS selbst (`import "./polls.css";` in seiner `index.tsx`), mit Klassennamen, die mit der
Kennung beginnen. Farben und Schriften kommen aus den Variablen in `web/src/styles/theme.css`.

### Texte auf Deutsch und Englisch

Alle sichtbaren Texte sind `Translations` aus `src/language.ts` (in der Oberfläche auch von
`web/src/lib/language.tsx` exportiert): `de` und `en` sind Pflicht, `schwaebisch` und `bayrisch` optional. Fehlende
Dialekte fallen auf Deutsch zurück. In Komponenten übersetzt `useLanguage().t(...)`; `useLanguage()` liefert außerdem
die aktuelle `language` und `setLanguage`:

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

Texte, die vom Server kommen (etwa Namen aus einem Katalog), liefert man am besten gleich als `Translations` in der
Antwort mit.

## Beispiel: ein vollständiges kleines Modul

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

- Server: `handleApi` und `runWeeklyEvaluation` nehmen die Liste der Erweiterungen als Option
  (`{ extensions: [polls] }`), ebenso `issueExtras`. So testet man das Modul für sich, ohne die Registry. Ohne die
  Option gilt die Registry.
- Oberfläche: Die Seiten lesen die angemeldeten Module über `registeredUiExtensions()` aus
  `web/src/extensions/registry.ts`, das `UI_EXTENSIONS` aus `web/src/extensions` erst beim Aufruf liest. In Tests
  lässt sich die Liste mit `vi.mock("…/web/src/extensions", …)` ersetzen; `test/web/extensions/core.test.tsx` zeigt,
  wie.
- `test/extensions/core.test.ts` und `test/web/extensions/core.test.tsx` testen die Erweiterungspunkte selbst, mit
  einer Test-Erweiterung und ganz ohne Erweiterung. `test/erweiterungen/kern-2x.test.ts` und
  `test/web/erweiterungen/kern-2x.test.tsx` prüfen, dass Module in der Form von 2.x weiter laufen.
- Ein Modul sollte mindestens testen: seine Routen samt Fehlerfällen, dass nur Charaktere der Gilde gespeichert
  werden, dass nichts in Antworten landet, was nicht öffentlich sein soll, und dass `write` deutsche und englische
  Texte ohne Gedankenstriche liefert.

Vor jedem Commit: `npm run lint`, `npm test`, `npm run typecheck` und `npm run build`.

## Upgrade von 2.x

Version 3.0 benennt die Schnittstelle für Erweiterungen auf Englisch um. Sofort ändern muss man nichts, aber die
Namen von 2.x sind veraltet und fallen in der nächsten Hauptversion (4.0) weg.

### Was bis 4.0 weiter funktioniert

- **Die Registries von 2.x.** `src/erweiterungen/index.ts` (`SERVER_ERWEITERUNGEN`) und
  `web/src/erweiterungen/index.ts` (`OBERFLAECHEN_ERWEITERUNGEN`) werden weiter gelesen, nach den neuen Registries.
- **Die Form von 2.x.** Module dort dürfen die deutschen Namen der Mitglieder behalten (`ServerErweiterung`,
  `OberflaechenErweiterung`); `src/extensions/legacy.ts` und `web/src/extensions/legacy.tsx` wandeln sie
  automatisch um, auch Artikel vom Typ `ErweiterungsFakt` und Komponenten mit der Prop `daten`.
- **Veraltete Aliase an den alten Pfaden:** `src/erweiterungen/typen.ts`, `web/src/erweiterungen/typen.ts`,
  `src/sprache.ts`, `web/src/lib/sprache.tsx`, `src/weekly/zeitung-facts.ts` und `src/weekly/bausteine.ts`. Sie
  decken nur ab, was die Anleitung von 2.x beschrieben hat (bei `bausteine.ts`: `alle`, `Alle`, `list`,
  `gleichLang`, `Picker`).
- **Die Option `erweiterungen`** von `handleApi`, `runWeeklyEvaluation` und `issueExtras` (veraltet, besser
  `extensions`).
- **Die deutschen API-Routen und Abfrageparameter** von 2.x (`/api/zeitung`, `/api/zeitung/archiv`,
  `/api/stats/woche`, `/api/stats/monat`, `?gilde=`, `?woche=`, `?titel=`, `?karte=`) antworten weiter.
- Gespeicherte Artikel von Modulen aus 2.x bleiben lesbar: Als Art wird weiter das eigene `art`/`type` des Moduls
  gespeichert.

### Was bricht

- **Das API-Feld `CharacterView.erweiterungen` heißt jetzt `extensions`.** Die Prop `daten` von Komponenten aus 2.x
  wird weiter gefüllt, aber Code, der `view.erweiterungen` direkt liest, bekommt nichts mehr.
- **Dateien des Kerns ohne Alias.** Module, die Interna des Kerns importiert haben (siehe letzte Tabelle), müssen
  die neuen Pfade und Namen verwenden. Dazu gehören auch `rubrik()` und `RUBRIKEN` aus `src/api/zeitung-view.ts`.
- **Halb umgestellte Module.** Ein Modul mit deutschen und englischen Namen von Mitgliedern funktioniert: Das
  englische Mitglied gewinnt, das deutsche füllt die Lücken. Artikel aus `wochenArtikel` werden umgewandelt, die aus
  `weeklyArticles` müssen schon `ExtensionFact`s mit `kind: "extension"` sein.
- **Jede Form gehört in ihre Registry.** `SERVER_EXTENSIONS` und `UI_EXTENSIONS` sind für die Form von 3.0
  typisiert, die Registries von 2.x für die Form von 2.x. Ein umgestelltes Modul zieht in die neue Registry um.

### Schnittstelle der Erweiterungen

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
| `api(req, pfad, kontext)` | `api(req, path, context)` (gleiche Reihenfolge, nur die Namen) |
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
| `CharakterDatenProps`, Prop `daten` | `CharacterDataProps`, Prop `data` |
| `datenschutz` | `privacy` |
| `impressumSeite` | `imprintPage` |
| `datenschutzSeite` | `privacyPage` |
| `CharacterView.erweiterungen` | `CharacterView.extensions` |
| Option `erweiterungen` | Option `extensions` |

### Artikel der Zeitung

| 2.x | 3.0 |
| --- | --- |
| `src/weekly/zeitung-facts.ts` | `src/weekly/newspaper-facts.ts` (Typen auch von `src/extensions/types.ts` exportiert) |
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
| `list`, `Picker` (`choose`, `chooseAll`) | unverändert |
| `src/api/zeitung-view.ts` | `src/api/newspaper-view.ts` |
| `RUBRIKEN`, `rubrik()` | `SECTIONS`, `sectionName()` |

Die Schlüssel `nr`, `rubrik` und `art`, die der Kern der Eingabe der KI hinzufügt, bleiben deutsch.

### Sprachen

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
| `useSprache()` mit `sprache`, `setSprache`, `t` | `useLanguage()` mit `language`, `setLanguage`, `t` |
| `SpracheProvider` | `LanguageProvider` |
| `SPRACH_SCHLUESSEL` | `LANGUAGE_STORAGE_KEY` |
| `angeboteneSprachen` | `offeredLanguages` |
| `gemerkteSprache`, `spracheMerken` | `storedLanguage`, `storeLanguage` |

### API-Routen

| 2.x | 3.0 |
| --- | --- |
| `/api/zeitung` | `/api/newspaper` |
| `/api/zeitung/archiv` | `/api/newspaper/archive` |
| `/api/stats/woche`, `/api/stats/monat` | `/api/stats/week`, `/api/stats/month` |
| `?gilde=`, `?woche=`, `?titel=`, `?karte=` | `?guild=`, `?week=`, `?title=`, `?card=` |

Die alten Routen und Parameter antworten weiter. Die Adressen der Seiten (`/zeitung`, `/statistik`, `?reiter=`, …)
bleiben unverändert.

### Interna des Kerns

Diese gehörten nie zur beschriebenen Schnittstelle, ein Modul könnte sie aber importiert haben. Sie wurden in 3.0
ohne Alias umbenannt:

| 2.x | 3.0 |
| --- | --- |
| `web/src/components/Kontakt.tsx` | `web/src/components/Contact.tsx` |
| `Anschrift` (Prop `mitEmail`) | `PostalAddress` (Prop `withEmail`) |
| `RechtstextHinweis`, `RECHTSTEXT_HINWEIS` | `LegalTextNotice`, `LEGAL_TEXT_NOTICE` |
| `impressum()` | `imprintDetails()` |
| `web/src/pages/DatenschutzPage.tsx` (`DatenschutzPage`) | `web/src/pages/PrivacyPage.tsx` (`PrivacyPage`) |
| `web/src/pages/ImpressumPage.tsx` (`ImpressumPage`) | `web/src/pages/ImprintPage.tsx` (`ImprintPage`) |
| `web/src/pages/ZeitungPage.tsx` (`ZeitungPage`, `ZeitungArchivePage`) | `web/src/pages/NewspaperPage.tsx` (`NewspaperPage`, `NewspaperArchivePage`) |
| `web/src/lib/seite.ts`, `seite()`, `Seite`, `Impressum` | `web/src/lib/site.ts`, `site()`, `Site`, `Imprint` |
| Felder `untertitel`, `impressum`, `anschrift` | `tagline`, `imprint`, `address` |
| `zahlLocale()`, `setzeFormatSprache()` in `web/src/lib/format.ts` | `numberLocale()`, `setFormatLanguage()` |
| `src/serverstart.ts`, `src/lib/serverstart.ts` | `src/server-start.ts`, `src/lib/server-start.ts` |
| `src/weekly/zeitung-text.ts`, `bausteinGenerator` | `src/weekly/newspaper-text.ts`, `phraseGenerator` |
| `src/weekly/ausgabe-extras.ts`, `ausgabeExtras` | `src/weekly/issue-extras.ts`, `issueExtras` |

### npm-Skripte

Die alten Namen funktionieren weiter als Aliase.

| 2.x | 3.0 |
| --- | --- |
| `daten:beispiel` | `data:sample` |
| `daten:uebernahme` | `data:import` |
| `daten:uebernahme:live` | `data:import:live` |
| `zeitung:neu` | `newspaper:regenerate` |
| `zeitung:ki-test` | `newspaper:ai-test` |
| `netlify:umgebung` | `netlify:env` |
| `statistik:erkunden` | `stats:explore` |
