# Erweiterungen

🇬🇧 [English](extensions.md)

Eine Erweiterung (ein Modul) bringt eigene Funktionen auf die Gildenseite, ohne Dateien des Kerns zu ändern. Sie
liegt in eigenen Ordnern und meldet sich mit je einer Zeile in zwei Registry-Dateien an. So lässt sich ein Modul in
einem eigenen (auch privaten) Fork pflegen, während der Fork weiter Änderungen aus diesem Repo zieht
(`git pull upstream main`), ohne dass es zu Konflikten kommt.

Typische Fälle:

- Daten aus einem eigenen WoW-Addon anzeigen: Die Spieler laden ihre SavedVariables hoch, das Modul nimmt sie über
  eine eigene API-Route an, speichert sie und zeigt sie als Reiter auf der Statistik- und der Charakterseite.
- Eine eigene Seite, etwa Umfragen oder ein Kalender.
- Zusätzliche Meldungen für die Wochenzeitung.

## Aufbau

| Wo | Was |
| --- | --- |
| `src/erweiterungen/typen.ts` | Schnittstelle `ServerErweiterung` |
| `src/erweiterungen/index.ts` | Registry `SERVER_ERWEITERUNGEN` |
| `src/erweiterungen/<id>/` | Server-Teil des Moduls |
| `web/src/erweiterungen/typen.ts` | Schnittstelle `OberflaechenErweiterung` |
| `web/src/erweiterungen/index.ts` | Registry `OBERFLAECHEN_ERWEITERUNGEN` |
| `web/src/erweiterungen/<id>/` | Oberfläche des Moduls, auch eigenes CSS |
| `test/erweiterungen/<id>/` | Server-Tests des Moduls |
| `test/web/erweiterungen/<id>/` | Tests der Oberfläche (`.tsx`, dort prüft die Typprüfung von `web/` sie mit) |

Server und Oberfläche teilen sich die Kennung `id` (etwa `"umfragen"`). Typen, die beide brauchen (Antworten der
API), gehören in eine reine Typdatei im Server-Teil, etwa `src/erweiterungen/umfragen/typen.ts`. Die Oberfläche darf
nur Typen von dort importieren, keinen Laufzeitcode, der Node-Module wie `node:crypto` zieht.

## Anmelden

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

Dazu, je nachdem, was das Modul braucht:

- Eigene Seiten brauchen eine Weiterleitung auf `/index.html` in `netlify.toml` (Netlify liefert sonst 404, lokal
  fällt das nicht auf; `test/web/netlify-weiterleitungen.test.ts` prüft es). Seiten, die nicht in Suchmaschinen
  sollen, bekommen dort zusätzlich `X-Robots-Tag = "noindex, nofollow"` und rendern `<meta name="robots">`.
- Umgebungsvariablen: in `.env.example` beschreiben und, wenn sie auf Netlify landen sollen, in
  `scripts/netlify-env-lib.mjs` und `.github/workflows/release.yml` eintragen.
- Eigene Skripte als `npm run <id>:…` in `package.json`.

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

Alles ist freiwillig; ein Modul nutzt nur, was es braucht.

### `api`: eigene Routen

Die Function `/api/*` fragt zuerst alle Erweiterungen, für jede Methode, auch POST. `pfad` ist ohne Schrägstrich am
Ende, etwa `/api/umfragen`. Wer nicht zuständig ist, gibt `null` zurück; dann kommt der Kern dran (der für alles
außer GET und HEAD mit 405 antwortet). Fehler, die die Erweiterung wirft, werden zu einer 500-Antwort.

Der `kontext` enthält:

- `store`: der Speicher (Netlify Blobs, lokal im Speicher von `netlify dev`). Eigene Schlüssel bitte unter einem
  Präfix mit der Kennung, etwa `umfragen/…`.
- `now()`: die aktuelle Zeit (in Tests fest).
- `env`: die Umgebungsvariablen. Jede Erweiterung liest nur ihre eigenen, etwa `env.UMFRAGEN_CODE`.
- `clientIp`: IP des Aufrufers oder null. Nur gekürzt gehasht speichern, nie im Klartext.
- `purgeCache(tags)`: leert den CDN-Cache für Cache-Tags. Kann fehlen (etwa in Tests) und fehlschlagen, also
  mit `?.` aufrufen und in `try`/`catch` packen; ein Fehler dabei sollte die eigentliche Antwort nicht verhindern.

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

### `charakter`: Zusatzdaten für die Charakterseite

Wird bei jeder Anfrage an `/api/characters/<slug>` aufgerufen (`store`, `guild`, `member`). Was die Funktion
liefert, steht in der Antwort unter `erweiterungen[id]`. Bei `null` oder `undefined` fehlt der Eintrag; liefert keine
Erweiterung etwas, fehlt `erweiterungen` ganz.

`charakterCacheTags` setzt Cache-Tags auf jede Charakterantwort. Leert die Erweiterung später diese Tags, erneuern
sich auch die Charakterseiten.

### `wochenArtikel`: Meldungen für die Wochenzeitung

Wird einmal je ausgewerteter Woche aufgerufen. Der Kontext enthält `store`, `guild`, `from` und `to` (erster und
letzter Tag, Berliner Datum `YYYY-MM-DD`) und `ids`: die Charaktere, die zählen (aktive Mitglieder ohne die von der
Abmeldeliste). Die Erweiterung rechnet alles selbst aus und liefert fertige Fakten:

```ts
interface ErweiterungsFakt {
  kind: "erweiterung";
  art: string;              // steht im gespeicherten Artikel, z. B. "umfrage"
  rubrik: string;           // deutscher Name der Rubrik, z. B. "Umfragen"
  nachrichtenwert: number;  // etwa 10 (Kleinkram) bis 80 (ganz groß)
  characterIds: number[];   // betroffene Charaktere
  zahlen: number[];         // alle Zahlen, die ein Text nennen darf
  schreibe(w: SchreibWerkzeug): Fassungen<MeldungsText>;
  fuerKi(name: (id: number) => string, sprache: Sprache): Record<string, unknown>;
}
```

Die Meldungen konkurrieren mit denen des Kerns um die Plätze der Ausgabe. Meldungen mit Ehemaligen oder Abgemeldeten
fallen weg. Arten, die in den letzten Ausgaben schon vorkamen, rücken etwas nach hinten, damit die Ausgaben wechseln.
Gespeichert wird nur der fertige Artikel mit `kind = art` und `section = rubrik`; alte Ausgaben bleiben also auch
dann lesbar, wenn das Modul später fehlt.

**Satzbausteine (`schreibe`).** Ohne KI schreibt die Seite aus Satzbausteinen. `schreibe` bekommt `name(id)`,
`picker` und `seed` und liefert Schlagzeile und Text je Sprache: Deutsch (`de`) und Englisch (`en`) sind Pflicht,
Schwäbisch und Bayrisch freiwillig (fehlende fallen auf Deutsch zurück). Mit dem `picker` wählt man aus mehreren
Varianten so, dass sich Sätze nicht aus den letzten Ausgaben wiederholen. Topfnamen beginnen am besten mit der
Kennung des Moduls:

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

Gibt es die Töpfe in allen vier Sprachen gleich lang, geht auch `picker.chooseAll(topf, toepfe, seed)` mit dem Typ
`Alle` aus `src/weekly/phrases.ts`; `sameLength` prüft das im Test.

**KI-Texte (`fuerKi`).** Mit KI-Schlüssel schreibt ein Sprachmodell die Artikel. Es bekommt jeden Fakt als JSON:
`nr`, `rubrik` und `art` setzt der Kern, den Rest liefert `fuerKi` mit Namen statt IDs, etwa
`{ abstimmende: ["Anna"], stimmen: 42, hinweis: "Umfrage im Gildenforum." }`. Ein kurzer `hinweis` erklärt dem
Modell, worum es geht. Die Antwort wird geprüft: Sie darf nur die Charaktere des Fakts nennen und nur Zahlen aus
`zahlen`. Passt etwas nicht, springen die Satzbausteine ein. In `zahlen` gehört deshalb jede Zahl, die ein guter
Text nennen könnte (auch Differenzen oder Ziffern aus Namen wie „Stufe 30“).

**Rubriken.** Die Rubriken des Kerns stehen in `src/api/newspaper-view.ts`. Eine neue Rubrik bringt ihre Namen in
allen Sprachen über `rubriken` mit, Schlüssel ist der deutsche Name:

```ts
rubriken: { Umfragen: { de: "Umfragen", en: "Polls" } },
```

## Oberfläche: `OberflaechenErweiterung`

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

- `statistikReiter`: Reiter unter `/statistik/<id>`, hinter denen des Kerns. `guild` ist die gewählte Gilde aus
  `?gilde=`, `onGuild` ändert sie (für einen Gildenfilter wie in den Reitern des Kerns).
- `charakterReiter`: Reiter der Charakterseite (`?reiter=<id>`), ganz rechts. `daten` ist der Eintrag
  `erweiterungen[id]` aus der Charakter-API oder `undefined`; ohne Daten zeigt der Reiter am besten einen Hinweis.
  Charaktere ohne Profil haben keine Reiter, dort steht die Komponente unter dem Hinweis, aber nur mit Daten.
- `charakterKopf`: Abzeichen in der Kopfzeile der Charakterseite, nur mit Daten.
- `routen`: eigene Seiten (Pfade wie bei react-router). Weiterleitung in `netlify.toml` nicht vergessen.
- `datenschutz`: Abschnitt der Datenschutzerklärung mit eigener `h2`-Überschrift. Wer personenbezogene Daten
  speichert (auch IP-Hashes), beschreibt hier, was, wozu und wie lange.
- `impressumSeite`, `datenschutzSeite`: eigene, vollständige Rechtstexte statt der Platzhalter-Vorlagen des Kerns.
  Es gilt das erste Modul, das eine solche Seite mitbringt. So bleiben die eigenen Texte beim Aktualisieren aus dem
  öffentlichen Repo unberührt. Wie die Vorlagen erscheinen sie nur mit `WEBSITE_IMPRINT_NAME`.

Eigenes CSS importiert das Modul selbst (`import "./umfragen.css";` in seiner `index.tsx`), mit Klassennamen, die mit
der Kennung beginnen. Farben und Schriften kommen aus den Variablen von `web/src/styles/theme.css`.

### Texte in Deutsch und Englisch

Alle sichtbaren Texte sind `Fassungen` aus `src/sprache.ts`: `de` und `en` sind Pflicht, `schwaebisch` und `bayrisch`
freiwillig. Fehlende Dialekte fallen auf Deutsch zurück. In Komponenten übersetzt `useSprache().t(...)`:

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

Texte, die der Server liefert (etwa Namen aus einem Katalog), kommen am besten schon als `Fassungen` in der Antwort.

## Beispiel: ein vollständiges kleines Modul

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

- Server: `handleApi` und `runWeeklyEvaluation` nehmen die Liste der Erweiterungen als Option
  (`{ erweiterungen: [umfragen] }`), ebenso `ausgabeExtras`. So testet man das Modul allein, ohne die Registry.
  Ohne Option gilt die Registry.
- Oberfläche: Die Seiten lesen `OBERFLAECHEN_ERWEITERUNGEN` aus `web/src/erweiterungen`. In Tests lässt sich die
  Liste mit `vi.mock("…/web/src/erweiterungen", …)` ersetzen; `test/web/erweiterungen/kern.test.tsx` zeigt wie.
- `test/erweiterungen/kern.test.ts` und `test/web/erweiterungen/kern.test.tsx` prüfen die Erweiterungspunkte selbst,
  mit einer Test-Erweiterung und ohne jede Erweiterung.
- Ein Modul sollte mindestens prüfen: seine Routen samt Fehlerfällen, dass nur Charaktere der Gilde gespeichert
  werden, dass nichts in Antworten landet, was nicht öffentlich sein soll, und dass `schreibe` in Deutsch und
  Englisch Texte ohne Gedankenstriche liefert.

Vor jedem Commit: `npm run lint`, `npm test`, `npm run typecheck` und `npm run build`.
