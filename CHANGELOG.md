# Änderungen

Alle nennenswerten Änderungen an WoW Guild Hub. Versionsnummern nach
[Semantic Versioning](https://semver.org/lang/de/): Patch für Korrekturen, Minor für neue Inhalte,
Major für Änderungen, nach denen Betreiber etwas umstellen müssen.

Neue Einträge kommen unter "Unveröffentlicht". `npm run release:patch`, `release:minor` oder
`release:major` macht daraus den Abschnitt der neuen Version, committet und setzt das Tag.

## Unveröffentlicht

Erste öffentliche Version. Die Seite entstand für eine Gemeinschaft aus zwei Gilden in WoW Forever und ist jetzt
für jede Gilde nutzbar.

- **Gilde, Charaktere, Berufe:** Mitgliederliste mit Filtern, Charakterseiten mit Ausrüstung, Talenten, Berufen,
  Ruf, Dungeons und Raids sowie Monatsrückblick, Berufe-Verzeichnis mit Rezepten. Mehrere Gilden lassen sich zu
  einer Gemeinschaft zusammenfassen.
- **Statistik:** Klassen- und Levelverteilung, Heatmap der Aktivität, Gildenstatistik nach Woche, Monat und
  gesamt, Dungeons und Raids der ganzen Gilde.
- **Spaßtitel und Wochenzeitung:** zwölf Titel je Woche mit Ehrentafel und eine Wochenzeitung aus
  Satzbausteinen oder, mit eigenem KI-Gateway, von Claude geschrieben.
- **Sprachen:** Deutsch und Englisch, auf Wunsch zusätzlich Schwäbisch und Bayrisch (`SEITE_SPRACHEN`).
- **Konfiguration nur über Umgebungsvariablen:** Gilde, Rangnamen, Spielversion, Name, Logo, Farben, Discord,
  Impressum und Umami (siehe `.env.example`). Impressum und Datenschutzerklärung sind Vorlagen mit Platzhaltern.
- **Erweiterungen:** Module für eigene Reiter, Seiten, Charakterdaten, Zeitungsartikel und Rechtstexte
  (`docs/erweiterungen.md`).
- **Installation:** "Deploy to Netlify"-Knopf, Daten aus der Blizzard-API, gespeichert in Netlify Blobs, lokal mit
  Docker. Prüfung mit oxlint, vitest, Typecheck und Build bei jedem Pull Request, Dependabot für npm und Actions.
