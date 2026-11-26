// Hilfen für Versionen und CHANGELOG.md, getrennt von den Kommandozeilen-Skripten, damit sie testbar sind.

const UNRELEASED = "## Unreleased";
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Nächste Versionsnummer nach Semantic Versioning.
 * @param {string} version zum Beispiel "1.0.0"
 * @param {"patch" | "minor" | "major"} art
 * @returns {string}
 */
export function naechsteVersion(version, art) {
  const teile = VERSION.exec(version);
  if (!teile) throw new Error(`Version "${version}" hat nicht die Form X.Y.Z`);
  const [major, minor, patch] = teile.slice(1).map(Number);
  if (art === "patch") return `${major}.${minor}.${patch + 1}`;
  if (art === "minor") return `${major}.${minor + 1}.0`;
  if (art === "major") return `${major + 1}.0.0`;
  throw new Error(`Unbekannte Art "${art}", erlaubt sind patch, minor oder major`);
}

/**
 * Zielversion eines Releases. "aktuell" veröffentlicht die Version aus package.json ohne Erhöhung
 * (zum Beispiel 1.0.0 beim ersten Live-Gang), sonst wie naechsteVersion.
 * @param {string} version
 * @param {"aktuell" | "patch" | "minor" | "major"} art
 * @returns {{ version: string, erhoehen: boolean }}
 */
export function zielVersion(version, art) {
  if (art === "aktuell") return { version, erhoehen: false };
  if (!["patch", "minor", "major"].includes(art)) {
    throw new Error(`Unbekannte Art "${art}", erlaubt sind aktuell, patch, minor oder major`);
  }
  return { version: naechsteVersion(version, art), erhoehen: true };
}

/** Zerlegt den Changelog in Kopf und Abschnitte (je Überschrift "## …"). */
function abschnitte(text) {
  const zeilen = text.replace(/\r\n/g, "\n").split("\n");
  const kopf = [];
  /** @type {{ ueberschrift: string, zeilen: string[] }[]} */
  const liste = [];
  for (const zeile of zeilen) {
    if (zeile.startsWith("## ")) liste.push({ ueberschrift: zeile.trimEnd(), zeilen: [] });
    else if (liste.length === 0) kopf.push(zeile);
    else liste[liste.length - 1].zeilen.push(zeile);
  }
  return { kopf, liste };
}

function versionsUeberschrift(ueberschrift) {
  return /^## (\d+\.\d+\.\d+) \((\d{4}-\d{2}-\d{2})\)$/.exec(ueberschrift);
}

/**
 * Abschnitt einer Version, Überschrift "## 1.0.0 (2026-11-06)".
 * @param {string} text Inhalt von CHANGELOG.md
 * @param {string} version
 * @returns {{ datum: string, inhalt: string } | null}
 */
export function changelogAbschnitt(text, version) {
  for (const abschnitt of abschnitte(text).liste) {
    const treffer = versionsUeberschrift(abschnitt.ueberschrift);
    if (treffer && treffer[1] === version) {
      return { datum: treffer[2], inhalt: abschnitt.zeilen.join("\n").trim() };
    }
  }
  return null;
}

/**
 * Gibt die Einträge unter "Unreleased" als neue Version frei und legt darüber ein leeres
 * "Unreleased" an.
 * @param {string} text
 * @param {string} version
 * @param {string} isoDatum zum Beispiel "2026-11-07"
 * @returns {string}
 */
export function changelogFreigeben(text, version, isoDatum) {
  if (changelogAbschnitt(text, version)) throw new Error(`Version ${version} steht schon in CHANGELOG.md`);
  const { kopf, liste } = abschnitte(text);
  const index = liste.findIndex((a) => a.ueberschrift === UNRELEASED);
  if (index === -1) throw new Error(`CHANGELOG.md hat keinen Abschnitt "${UNRELEASED}"`);
  const inhalt = liste[index].zeilen.join("\n").trim();
  if (inhalt === "") {
    throw new Error('Unter "Unreleased" in CHANGELOG.md steht nichts. Erst die Änderungen eintragen.');
  }

  const neu = [
    { ueberschrift: UNRELEASED, zeilen: [""] },
    { ueberschrift: `## ${version} (${isoDatum})`, zeilen: ["", inhalt, ""] },
    ...liste.slice(index + 1),
  ];
  const teile = [kopf.join("\n").trimEnd(), ""];
  for (const abschnitt of [...liste.slice(0, index), ...neu]) teile.push(abschnitt.ueberschrift, ...abschnitt.zeilen);
  return teile.join("\n").trimEnd() + "\n";
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
 * Heutiges Datum in deutscher Zeit als "JJJJ-MM-TT".
 * @param {Date} now
 * @returns {string}
 */
export function heuteIso(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
