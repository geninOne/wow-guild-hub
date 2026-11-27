// Helpers for versions and CHANGELOG.md, kept apart from the command line scripts so they are testable.
// Versions, CHANGELOG.md and tags are maintained by release-please (.github/workflows/release-please.yml).

/** Heading of a version, as release-please or a human writes it: "## [1.2.0](link) (2026-11-26)" or "## 1.2.0 (2026-11-26)". */
const VERSION_HEADING = /^#{2,3} \[?(\d+\.\d+\.\d+)\]?(?:\([^)]*\))? \((\d{4}-\d{2}-\d{2})\)$/;

/** Splits the changelog into sections, one per heading "## …" or version heading "### [x.y.z]". */
function sections(text) {
  /** @type {{ heading: string, lines: string[] }[]} */
  const list = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith("## ") || VERSION_HEADING.test(line.trimEnd())) {
      list.push({ heading: line.trimEnd(), lines: [] });
    } else if (list.length > 0) {
      list[list.length - 1].lines.push(line);
    }
  }
  return list;
}

/**
 * Section of a version.
 * @param {string} text content of CHANGELOG.md
 * @param {string} version for example "1.0.0"
 * @returns {{ date: string, content: string } | null}
 */
export function changelogSection(text, version) {
  for (const section of sections(text)) {
    const match = VERSION_HEADING.exec(section.heading);
    if (match && match[1] === version) {
      return { date: match[2], content: section.lines.join("\n").trim() };
    }
  }
  return null;
}

/**
 * Checks before the deploy that the tag matches the version in package.json and the changelog knows it.
 * @param {string} tag for example "v1.0.0"
 * @param {string} version from package.json
 * @param {string} changelog content of CHANGELOG.md
 */
export function checkTag(tag, version, changelog) {
  if (tag !== `v${version}`) {
    throw new Error(`Tag ${tag} does not match version ${version} in package.json (expected v${version})`);
  }
  if (!changelogSection(changelog, version)) {
    throw new Error(`CHANGELOG.md has no section for version ${version}`);
  }
}

/**
 * Today's date in German time as "YYYY-MM-DD" (build without a changelog section for the version).
 * @param {Date} now
 * @returns {string}
 */
export function todayIso(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
