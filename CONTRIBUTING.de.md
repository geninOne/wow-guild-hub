# Mitmachen

🇬🇧 [English](CONTRIBUTING.md)

> Übersetzung von [CONTRIBUTING.md](CONTRIBUTING.md). Bei Abweichungen gilt die englische Fassung.

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
4. Pull Request mit der Vorlage öffnen. Sein **Titel** folgt [Conventional Commits](#commits-und-versionen), eine
   Prüfung testet das. `CHANGELOG.md` und die Version bitte nicht anfassen, das macht release-please.
5. Mindestens ein Review des Maintainers ist nötig, alle Prüfungen müssen grün sein. Gemergt wird mit "Squash and
   merge", der Titel wird also zum Commit auf `main`.

Workflows auf Pull Requests aus Forks laufen mit `pull_request`: nur lesend, ohne Secrets. Was Zugangsdaten braucht,
lässt sich deshalb nur lokal testen. Läufe auf Pull Requests aus Forks gibt der Maintainer von Hand frei, bevor
sie starten.

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
npm run check:english -- --all --strict
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
- Code, Bezeichner, Kommentare, Tests und Logmeldungen sind englisch; `npm run check:english` prüft das. Deutsch
  bleibt in sichtbaren Texten (Übersetzungen) und in wenigen gespeicherten Namen aus
  `scripts/check-english-frozen.txt`; Felder der Blizzard-API bleiben, wie sie sind. Hinweise für
  KI-Coding-Agenten: [AGENTS.md](AGENTS.md).
- Jeder sichtbare Text hat eine deutsche und eine englische Fassung (`Translations` aus `src/language.ts`).
  Schwäbisch und Bayrisch sind freiwillig.
- Keine Gedankenstriche (U+2014) in Texten.
- Die Doku ist englisch. Dateien mit einem `.de.md`-Gegenstück sind Übersetzungen: beide im selben Pull Request
  ändern; bei Abweichungen gilt die englische Fassung.
- Keine Werte fest im Code, die je Gilde verschieden sind: neue Einstellungen als Umgebungsvariable mit
  Standardwert und Kommentar in `.env.example`.
- Geheimnisse nie loggen und nie in Fehlermeldungen ausgeben.
- `npm run lint` (oxlint) muss ohne Befund durchlaufen.
- Neue Logik bekommt Tests (vitest), Oberflächen-Bausteine Tests mit Testing Library.

## Commits und Versionen

Titel von Pull Requests (und damit die Commits auf `main`) folgen [Conventional Commits](https://www.conventionalcommits.org/de/),
auf Englisch: `<type>(<optionaler scope>): <summary>`, z. B. `feat(professions): filter by recipe rank` oder
`fix: version in the footer`. Commits in deinem Branch sind frei, sie werden beim Mergen zusammengefasst.

| Type | Wofür | Release |
|---|---|---|
| `feat` | neue Funktion | Minor |
| `fix` | Fehlerkorrektur | Patch |
| `perf`, `revert` | schnellerer Code, Änderung zurücknehmen | Patch |
| `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore` | alles andere | keins |
| `!` nach dem Type, z. B. `feat!: …` | Änderung, nach der Betreiber etwas umstellen müssen (z. B. neue oder umbenannte Pflichtvariable) | Major |

Versionen folgen [Semantic Versioning](https://semver.org/lang/de/). [release-please](https://github.com/googleapis/release-please)
sammelt die gemergten Pull Requests in einem Release-PR mit neuer Version und Abschnitt in `CHANGELOG.md`. Merged
der Maintainer ihn, entstehen ein Tag `vX.Y.Z` und ein GitHub-Release mit denselben Notizen. Das öffentliche Repo
deployt selbst nichts.

**Breaking Changes:** `!` im Titel und in der Beschreibung des Pull Requests "Upgrade notes" ausfüllen: welche
Umgebungsvariablen neu, umbenannt oder entfallen sind und was Betreiber bei Netlify tun müssen. Beim Mergen setzt
der Maintainer diese Hinweise als Fußzeile mit `BREAKING CHANGE:` in die Commit-Nachricht. Sie erscheinen dann in
den Notizen der Hauptversion unter "Upgrade notes".
