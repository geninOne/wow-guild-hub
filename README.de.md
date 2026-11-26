# WoW Guild Hub

🇬🇧 [English](README.md)

Eine Webseite für deine World-of-Warcraft-Gilde: Mitglieder, Charaktere, Berufe, Dungeons und Raids, Statistiken,
Spaßtitel der Woche und eine eigene Wochenzeitung. Die Daten kommen stündlich aus der Blizzard-API, gespeichert
wird in Netlify Blobs, eine Datenbank braucht es nicht. Fork, Schlüssel eintragen, fertig.

Entstanden für eine Gemeinschaft aus zwei Gilden in WoW Forever, jetzt offen für alle Gilden.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/geninOne/wow-guild-hub)
[![Prüfung](https://github.com/geninOne/wow-guild-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/geninOne/wow-guild-hub/actions/workflows/ci.yml)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](LICENSE)

## Screenshots

<!-- Platzhalter: Screenshots unter docs/bilder/ ablegen und hier einbinden, z. B.
     ![Gildenübersicht](docs/bilder/gilde.png) -->

| Gildenübersicht | Charakterseite | Wochenzeitung |
|---|---|---|
| *Screenshot folgt* | *Screenshot folgt* | *Screenshot folgt* |

## Funktionen

- **Gilde:** alle Mitglieder mit Klasse, Volk, Stufe, Rang und Gegenstandsstufe, mit Filtern und Sortierung.
  Mehrere Gilden (etwa eine Horde- und eine Allianzgilde) lassen sich zu einer Gemeinschaft zusammenfassen.
- **Charakterseite:** Ausrüstung mit Tooltips, Werte wie im Arsenal (Gesundheit, Ressource, Primärwerte, Angriff,
  Zauber, Verteidigung), Talentbäume, Berufe, Ruf, Fortschritt in Dungeons und Raids und
  ein monatlicher Rückblick.
- **Berufe:** Verzeichnis aller Rezepte der Gilde, wer was herstellen kann, mit Materialien.
- **Statistik:** Klassen- und Levelverteilung, Heatmap der Aktivität, Gildenstatistik als Kuriositätenwand
  (Woche, Monat, gesamt), Dungeons und Raids der ganzen Gilde.
- **Spaßtitel der Woche:** zwölf Titel wie Nachteule, Früher Vogel oder Tausendsassa, mit Ehrentafel.
- **Wochenzeitung** (standardmäßig das "Gildenblatt", unter `/zeitung`): erscheint jeden Sonntag mit
  Levelaufstiegen, Rekorden, Neuzugängen, Wetter und Rückblick. Die Texte kommen aus Satzbausteinen oder, mit
  eigenem KI-Gateway, von Claude.
- **Sprachen:** Deutsch und Englisch, auf Wunsch zusätzlich Schwäbisch und Bayrisch.
- **Erweiterbar:** Module für eigene Reiter, Routen und Zeitungsartikel, zum Beispiel für Daten aus einem
  eigenen Addon (siehe [docs/extensions.de.md](docs/extensions.de.md)).
- **Datensparsam:** keine Cookies, keine Anmeldung, optional Umami für eine einfache Besucherstatistik.

Unterstützt wird derzeit **WoW Forever** (`WOW_VERSION=forever`). Retail und Classic mit Realms sind geplant.

## Installation in fünf Schritten

1. **Fork anlegen:** Oben rechts auf GitHub "Fork". Oder direkt den Knopf "Deploy to Netlify" oben nutzen, der
   den Fork und die Netlify-Seite in einem Rutsch anlegt (dann weiter bei Schritt 3).
2. **Netlify-Seite anlegen:** Bei [Netlify](https://app.netlify.com) "Add new site", "Import an existing project"
   und den Fork wählen. Build-Befehl und Ordner stehen schon in `netlify.toml`.
3. **API-Schlüssel bei Blizzard holen:** Im [Battle.net Developer Portal](https://develop.battle.net/access/clients)
   anmelden, "Create Client" wählen und einen Namen eingeben (eine Redirect-URL ist nicht nötig). Client-ID und
   Client-Secret notieren. Das Secret niemandem zeigen und nie ins Repository schreiben.
4. **Umgebungsvariablen setzen:** In Netlify unter "Site configuration", "Environment variables" mindestens
   eintragen:

   | Variable | Wert |
   |---|---|
   | `BNET_CLIENT_ID` | Client-ID aus Schritt 3 |
   | `BNET_CLIENT_SECRET` | Client-Secret aus Schritt 3 |
   | `GUILD_SLUGS` | Slug deiner Gilde, z. B. `meine-gilde` (Kleinbuchstaben, Leerzeichen als Bindestrich) |
   | `WEBSITE_NAME` | Name, der auf der Seite steht |

5. **Gilde gestalten und neu bauen:** Weitere Angaben wie Logo, Farben, Rangnamen, Sprachen, Discord und
   Impressum stehen kommentiert in [.env.example](.env.example). Danach in Netlify "Deploys", "Trigger deploy".

Fertig. Der Sammler läuft stündlich (`collect-guild`), statische Spieldaten täglich (`collect-static`), die
Wochenauswertung sonntags früh (`collect-weekly`). Nach dem ersten Lauf, spätestens nach einer Stunde, sind
Daten da. Wer nicht warten will, löst die Läufe in Netlify unter "Functions" einmal von Hand aus.

**Kosten:** Netlify baut bei jedem Push auf `main` neu. Wer Credits sparen will, schaltet unter "Build & deploy"
die automatischen Builds ab und veröffentlicht nur über den Release-Workflow (siehe unten).

## Konfiguration

Alles läuft über Umgebungsvariablen, eine Konfigurationsdatei braucht es nicht. Die vollständige, kommentierte
Liste steht in [.env.example](.env.example). Die wichtigsten:

| Bereich | Variablen |
|---|---|
| Pflicht | `BNET_CLIENT_ID`, `BNET_CLIENT_SECRET`, `GUILD_SLUGS` |
| Spiel und API | `WOW_VERSION`, `BNET_REGION`, `BNET_LOCALE` |
| Gilde | `GUILD_RANKS` (Rangnamen als JSON), `TITLE_OPT_OUTS` |
| Aussehen | `WEBSITE_NAME`, `WEBSITE_DESCRIPTION`, `WEBSITE_TAGLINE`, `WEBSITE_LOGO`, `WEBSITE_FAVICON`, `WEBSITE_OG_IMAGE`, `WEBSITE_COLORS` |
| Sprachen | `WEBSITE_LANGUAGES` (`de,en` oder mit `schwaebisch`, `bayrisch`), `WEBSITE_NEWSPAPER` |
| Rechtliches | `WEBSITE_IMPRINT_NAME`, `WEBSITE_IMPRINT_ADDRESS`, `WEBSITE_IMPRINT_EMAIL` |
| Extras | `WEBSITE_DISCORD`, `WEBSITE_UMAMI_ID`, `WEBSITE_UMAMI_DOMAINS`, `NEWSPAPER_AI_URL`, `NEWSPAPER_AI_KEY` |

Hinweise:

- `WEBSITE_…`-Variablen werden beim Bauen eingesetzt. Nach einer Änderung neu deployen.
- Eigene Bilder (Logo, Teilen-Bild) in einen eigenen Ordner unter `web/public/` legen, z. B.
  `web/public/meine-gilde/logo.png`, und als `/meine-gilde/logo.png` eintragen. So gibt es beim Aktualisieren
  keine Konflikte.
- Impressum und Datenschutzerklärung erscheinen nur mit `WEBSITE_IMPRINT_NAME`. Mitgeliefert werden nur
  **Vorlagen mit Platzhaltern**: Name, Anschrift und E-Mail kommen aus den Variablen, die Texte musst du selbst
  verfassen und prüfen. Eigene Rechtstexte setzt du am besten als Modul ein (`impressumSeite`, `datenschutzSeite`,
  siehe [docs/extensions.de.md](docs/extensions.de.md)), dann bleiben sie beim Aktualisieren unberührt. Wer in
  Deutschland eine solche Seite betreibt, braucht beides. Das ist keine Rechtsberatung.
- Netlify gibt den Functions zusammen nur rund 4 KB an Umgebungsvariablen mit. `GUILD_RANKS` deshalb knapp halten.
- Die Wochenzeitung schreibt mit Claude, wenn `NEWSPAPER_AI_URL` und `NEWSPAPER_AI_KEY` auf ein
  Anthropic-kompatibles Gateway zeigen. Ohne beides schreiben die Satzbausteine, kostenlos.

## Lokale Entwicklung

Voraussetzung: Docker (oder Node.js 22).

```bash
cp .env.example .env
```

In `.env` Zugangsdaten und Gilde eintragen, dann:

```bash
docker compose up -d --build
```

Die Seite läuft unter http://localhost:8888, nur auf diesem Rechner erreichbar. Ein Taktgeber im Container
startet die Sammler wie auf Netlify (abschalten mit `LOCAL_SCHEDULER=off`). Von Hand:

```bash
docker compose exec app npm run collect:guild
```

```bash
docker compose exec app npm run collect:static
```

```bash
docker compose exec app npm run collect:weekly
```

Nach Änderungen an `package.json` den Container mit frischen Paketen neu bauen:

```bash
docker compose up -d --build --renew-anon-volumes
```

Zum Ausprobieren ohne lange Wartezeit füllt ein Skript den lokalen Bestand mit erfundener Aktivität (die Seiten
zeigen dann einen roten Hinweis), mit `-- --entfernen` ist alles wieder weg:

```bash
docker compose exec app npm run daten:beispiel
```

Nur die Oberfläche mit Hot Reload (ohne `/api`) unter http://127.0.0.1:5173:

```bash
npm run dev:web
```

Prüfen wie in der GitHub Action:

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

## Aktualisieren

Neue Versionen holst du in deinen Fork mit "Sync fork" auf GitHub oder lokal:

```bash
git remote add upstream https://github.com/geninOne/wow-guild-hub.git
```

```bash
git pull upstream main
```

Was sich geändert hat, steht in [CHANGELOG.md](CHANGELOG.md). Bei einer neuen Hauptversion (z. B. 2.0.0) dort
nachlesen, ob neue Variablen nötig sind.

## Veröffentlichen per Release-Workflow (optional)

Statt bei jedem Push kann die Seite nur bei einer neuen Version live gehen. Dafür in GitHub unter "Settings",
"Secrets and variables", "Actions" eintragen:

- **Secrets:** `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `BNET_CLIENT_ID`, `BNET_CLIENT_SECRET`, optional
  `NEWSPAPER_AI_KEY`
- **Variables:** `GUILD_SLUGS` und nach Bedarf alle übrigen Einstellungen aus `.env.example`

Dann "Actions", "Release", "Run workflow" mit `patch`, `minor` oder `major`. Der Workflow prüft, erhöht die
Version, schreibt den Changelog-Abschnitt, setzt die Netlify-Variablen, deployt und legt ein GitHub-Release an.
Schlägt ein Lauf fehl, "Re-run failed jobs" nutzen, nicht "Re-run all jobs".

## Aufbau

| Ordner | Inhalt |
|---|---|
| `netlify/functions/` | Lese-API (`/api/*`) und die geplanten Sammler |
| `src/` | Sammeln, Aufbereiten, API, Wochenauswertung, Wochenzeitung |
| `web/` | Oberfläche (Vite, React, React Router) |
| `config/` | Spieldaten, die die API nicht liefert (Dungeons, Statistiken, Talentkorrekturen, Statistikkarten) |
| `scripts/` | Werkzeuge für Release, Beispieldaten und Datenübernahme |
| `test/` | Tests (vitest) mit gespeicherten API-Antworten |

## Mitmachen

Fehler melden, Ideen einbringen, Code beitragen: siehe [CONTRIBUTING.de.md](CONTRIBUTING.de.md) und den
[Verhaltenskodex](CODE_OF_CONDUCT.de.md). Sicherheitslücken bitte privat melden, siehe
[SECURITY.de.md](SECURITY.de.md).

## Lizenz und Blizzard

Der Code steht unter der [MIT-Lizenz](LICENSE).

Dies ist ein Fanprojekt. Es ist nicht mit Blizzard Entertainment verbunden und wird von Blizzard weder
unterstützt noch geprüft. World of Warcraft und Blizzard Entertainment sind Marken oder eingetragene Marken von
Blizzard Entertainment, Inc. Spieldaten und Bilder stammen aus der Blizzard-API und gehören Blizzard.

Wer die Seite betreibt, nutzt die Blizzard-API mit eigenen Zugangsdaten und ist selbst dafür verantwortlich,
deren Nutzungsbedingungen einzuhalten. Nach unserem Verständnis gehört dazu etwa, Blizzard als Quelle zu nennen,
für Funktionen mit API-Daten kein Geld zu verlangen und gespeicherte Daten nicht unbegrenzt ungeprüft
aufzubewahren. Das ist keine Rechtsberatung; maßgeblich sind allein die aktuellen Bedingungen im
[Battle.net Developer Portal](https://develop.battle.net).
