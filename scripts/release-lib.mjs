// Hilfen für Versionen und CHANGELOG.md, getrennt von den Kommandozeilen-Skripten, damit sie testbar sind.
// Versionen, CHANGELOG.md und Tags pflegt release-please (.github/workflows/release-please.yml).

/** Überschrift einer Version, wie release-please sie schreibt oder von Hand: "## [1.2.0](link) (2026-11-26)" oder "## 1.2.0 (2026-11-26)". */
const VERSIONS_UEBERSCHRIFT = /^#{2,3} \[?(\d+\.\d+\.\d+)\]?(?:\([^)]*\))? \((\d{4}-\d{2}-\d{2})\)$/;

/** Zerlegt den Changelog in Abschnitte, je Überschrift "## …" oder Versionsüberschrift "### [x.y.z]". */
function abschnitte(text) {
  /** @type {{ ueberschrift: string, zeilen: string[] }[]} */
  const liste = [];
  for (const zeile of text.replace(/\r\n/g, "\n").split("\n")) {
    if (zeile.startsWith("## ") || VERSIONS_UEBERSCHRIFT.test(zeile.trimEnd())) {
      liste.push({ ueberschrift: zeile.trimEnd(), zeilen: [] });
    } else if (liste.length > 0) {
      liste[liste.length - 1].zeilen.push(zeile);
    }
  }
  return liste;
}

/**
 * Abschnitt einer Version.
 * @param {string} text Inhalt von CHANGELOG.md
 * @param {string} version zum Beispiel "1.0.0"
 * @returns {{ datum: string, inhalt: string } | null}
 */
export function changelogAbschnitt(text, version) {
  for (const abschnitt of abschnitte(text)) {
    const treffer = VERSIONS_UEBERSCHRIFT.exec(abschnitt.ueberschrift);
    if (treffer && treffer[1] === version) {
      return { datum: treffer[2], inhalt: abschnitt.zeilen.join("\n").trim() };
    }
  }
  return null;
}

/**
 * Prüft vor dem Deploy, dass das Tag zur Version in package.json passt und der Changelog sie kennt.
 * @param {string} tag zum Beispiel "v1.0.0"
 * @param {string} version aus package.json
 * @param {string} changelog Inhalt von CHANGELOG.md
 */
export function pruefeTag(tag, version, changelog) {
  if (tag !== `v${version}`) {
    throw new Error(`Tag ${tag} passt nicht zur Version ${version} in package.json (erwartet v${version})`);
  }
  if (!changelogAbschnitt(changelog, version)) {
    throw new Error(`CHANGELOG.md hat keinen Abschnitt für Version ${version}`);
  }
}

/**
 * Heutiges Datum in deutscher Zeit als "JJJJ-MM-TT" (Build ohne Changelog-Abschnitt der Version).
 * @param {Date} now
 * @returns {string}
 */
export function heuteIso(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
