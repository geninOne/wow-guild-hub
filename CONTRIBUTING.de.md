# Mitmachen

🇬🇧 [English](CONTRIBUTING.md)

Schön, dass du helfen willst! Fehlerberichte, Ideen, Übersetzungen und Code sind gleichermaßen willkommen.
Mit deiner Teilnahme stimmst du dem [Verhaltenskodex](CODE_OF_CONDUCT.de.md) zu.

## Issues

- **Fehler:** Vorlage "Report a bug" nutzen. Bitte Version (Fuß der Seite), Schritte zum Nachstellen und, wenn
  möglich, Logs angeben. Nie Geheimnisse (Client-Secret, Codes, Tokens) posten.
- **Ideen:** Vorlage "Request a feature" nutzen. Bei größeren Vorhaben bitte zuerst ein Issue öffnen und
  abstimmen, bevor du viel Code schreibst.
- **Sicherheitslücken:** nie öffentlich, sondern wie in [SECURITY.de.md](SECURITY.de.md) beschrieben.

## Pull Requests

1. Repository forken und einen Branch von `main` anlegen, z. B. `berufe-filter` oder `fix-talentbaum`.
2. Klein bleiben: ein Thema je Pull Request, gern in mehreren kleinen Commits.
3. Lokal prüfen (siehe unten). Die GitHub Action führt dieselben Schritte bei jedem Pull Request aus.
4. Eintrag unter "Unreleased" in [CHANGELOG.md](CHANGELOG.md).
5. Pull Request mit der Vorlage öffnen. Mindestens ein Review ist nötig, alle Prüfungen müssen grün sein.

Pull Requests aus Forks bekommen keinen Zugriff auf Secrets. Was Zugangsdaten braucht, lässt sich deshalb nur
lokal testen.

## Lokal entwickeln

Voraussetzungen: Docker oder Node.js 22.

```bash
cp .env.example .env
```

Für echte Daten in `.env` die Zugangsdaten aus dem [Battle.net Developer Portal](https://develop.battle.net/access/clients)
und den Slug einer Gilde eintragen. Dann:

```bash
docker compose up -d --build
```

Die Seite läuft unter http://localhost:8888, die Sammler laufen im Takt. Ohne Docker:

```bash
npm ci
npx netlify dev
```

Ohne eigene Zugangsdaten lassen sich die Tests trotzdem ausführen; sie nutzen gespeicherte Antworten der API
(`test/fixtures`).

## Prüfen

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

## Code-Stil

- TypeScript, React mit Funktionskomponenten, keine neuen Abhängigkeiten ohne guten Grund.
- Bezeichner, Kommentare und Texte sind meist Deutsch; Felder der Blizzard-API bleiben, wie sie sind.
- Jeder sichtbare Text hat eine deutsche und eine englische Fassung (`Fassungen` aus `src/sprache.ts`).
  Schwäbisch und Bayrisch sind freiwillig.
- Keine Gedankenstriche (U+2014) in Texten.
- Keine Werte fest im Code, die je Gilde verschieden sind: neue Einstellungen als Umgebungsvariable mit
  Standardwert und Kommentar in `.env.example`.
- Geheimnisse nie loggen und nie in Fehlermeldungen ausgeben.
- `npm run lint` (oxlint) muss ohne Befund durchlaufen.
- Neue Logik bekommt Tests (vitest), Oberflächen-Bausteine Tests mit Testing Library.

## Commits

Kurze Betreffzeile auf Englisch nach dem Muster `Area: what changes`, z. B.
`Professions: filter by recipe rank`. Im Text darunter, falls nötig, warum. Ein Commit soll für sich bauen und die
Tests bestehen.

## Versionen

Versionen folgen [Semantic Versioning](https://semver.org/lang/de/): Patch für Korrekturen, Minor für neue
Funktionen, Major für Änderungen, nach denen Betreiber etwas umstellen müssen (z. B. neue Pflichtvariablen).
Releases macht der Maintainer.
