# Sicherheit

## Unterstützte Versionen

Sicherheitskorrekturen gibt es für die jeweils neueste Version auf `main`. Wer die Seite geforkt hat, übernimmt
Korrekturen, indem er die Änderungen von hier zieht (siehe README, Abschnitt "Aktualisieren").

## Sicherheitslücke melden

Bitte Sicherheitslücken **nicht** als öffentliches Issue, Pull Request oder im Discord melden.

Stattdessen privat über GitHub:
[Security, Report a vulnerability](https://github.com/geninOne/wow-guild-hub/security/advisories/new).

Hilfreich sind:

- was betroffen ist (Datei, Endpunkt, Seite),
- wie sich die Lücke ausnutzen lässt, gern mit einem kleinen Beispiel,
- welche Folgen du siehst.

Ich bestätige den Eingang meist innerhalb weniger Tage, melde mich mit einer Einschätzung und sage Bescheid, wenn
die Korrektur veröffentlicht ist. Auf Wunsch wirst du in den Release-Notes genannt.

## Bitte nicht

- Keine Tests gegen fremde Installationen oder gegen die Blizzard-API, die über normale Nutzung hinausgehen.
- Keine Daten anderer abrufen, ändern oder löschen.
- Keine Angriffe auf Verfügbarkeit (Lasttests, Fluten).

## Für Betreiber einer eigenen Installation

- Geheimnisse (`BNET_CLIENT_SECRET`, Upload-Codes, Tokens) gehören nur in Umgebungsvariablen, nie ins Repository.
- Lokale Docker-Installationen sind nur auf `127.0.0.1` erreichbar. Das bitte so lassen, denn `netlify dev` löst
  die Sammler per Adresse ohne Schutz aus.
- Dependabot-Updates zeitnah übernehmen.
