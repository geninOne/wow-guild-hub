// Finds German in code: file names, identifiers, comments, test names, log and error messages.
// Used by scripts/check-english.mjs; kept free of I/O so it can be tested.
//
// It is a heuristic. A name counts as German when one of its word parts (camelCase, snake_case, kebab-case) has an
// umlaut or ß or is in the word list (scripts/check-english-words.txt). A comment or message counts as German when it
// has an umlaut or ß, or enough German function words or listed words.
// UI texts are not checked: they are translations (`Translations`) and stay multilingual.

/**
 * @typedef {{ path: string; line: number; kind: "file-name" | "identifier" | "comment" | "test-name" | "message"; text: string }} Finding
 * `line` is 0 for a file name.
 */

/** Names that stay German on purpose: stored data, API and LLM fields, language codes, title ids. */
export const FROZEN_NAMES = new Set([
  // Language codes, also values of WEBSITE_LANGUAGES and keys of every translation object.
  "schwaebisch",
  "bayrisch",
  // Fields of stored records (Netlify Blobs) and API responses that live data depends on.
  "zahlen",
  "zahl",
  "rueckblick",
  "vorwoche",
  "bausteine",
  "dialekte",
  "mottoDialekte",
  "wetterDialekte",
  "spitze",
  "gesamt",
  "testdaten",
  "nachgeholt",
  // JSON keys exchanged with the language model that writes the weekly newspaper.
  "schlagzeile",
  "rubrik",
  "hinweis",
  "spruch",
  // Ids of the weekly fun titles, stored in every weekly result.
  "nachteule",
  "stammgast",
  "dauerlaeufer",
  "pechvogel",
  "kellerkind",
  "kaepsele",
  "schleimer",
  "tausendsassa",
]);

/** Paths that are never checked: translations, fixtures, assets, generated files and modules of forks. */
const IGNORED_PATHS = [
  /\.de\.md$/,
  /\.md$/,
  /^LICENSE$/,
  /^package-lock\.json$/,
  /^test\/fixtures\//,
  /^web\/public\//,
  /^config\//,
  /^docs\//,
  /\.(png|jpe?g|webp|svg|ico|gif|woff2?)$/,
  // Deprecated aliases of 2.x at their old paths (and their test), kept for extension modules until 4.0.
  /^src\/sprache\.ts$/,
  /^web\/src\/lib\/sprache\.tsx$/,
  /^src\/weekly\/(bausteine|zeitung-facts)\.ts$/,
  /^(src|web\/src)\/erweiterungen\/(index|typen)\.ts$/,
  /^src\/extensions\/legacy\.ts$/,
  /^web\/src\/extensions\/legacy\.tsx$/,
  /^test\/web\/language-legacy\.test\.tsx$/,
  /^test\/(web\/)?erweiterungen\/kern-2x\.test\.tsx?$/,
  // The check itself names German words and umlauts.
  /^scripts\/check-english(-lib\.mjs|\.mjs|-words\.txt)$/,
  /^test\/scripts\/check-english-lib\.test\.ts$/,
  // Modules of forks live in their own folders below the extension directories and may keep their own language.
  /^(src|web\/src|test|test\/web)\/(erweiterungen|extensions)\/[^/]+\//,
];

const CODE_EXTENSIONS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const HASH_EXTENSIONS = /\.(py|sh|ya?ml|toml)$|(^|\/)(Dockerfile|\.gitignore|\.dockerignore|\.env\.example)$/;
const CSS_EXTENSIONS = /\.css$/;

const GERMAN_LETTERS = /[äöüÄÖÜß]/;

/** German function words: frequent in sentences, rare in English ones. */
const STOP_WORDS = new Set(
  `der die das und nicht ist mit für fuer auf ein eine einen einem einer wird werden sind oder auch nur noch wenn
  dann als bei aus dem den des im zum zur vom nach vor über ueber unter wie kein keine keinen schon hier dort damit
  sonst weil dass bis ohne jede jeder jedes alle allen beim ins sich sie wir ihr er man soll sollen muss kann darf
  gibt steht stehen bleibt kommt eigene eigenen neue neuen`.split(/\s+/),
);

/** Reads the word list file: one lowercase word per line, `#` starts a comment. */
export function parseWordList(text) {
  return new Set(
    text
      .split("\n")
      .map((line) => line.replace(/#.*/, "").trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isIgnoredPath(path) {
  return IGNORED_PATHS.some((re) => re.test(path));
}

/** Splits `translationIn`, `LANGUAGE_NAMES` or `frueher-vogel` into lowercase word parts. */
export function splitName(name) {
  return name
    .replace(/([a-zäöüß0-9])([A-ZÄÖÜ])/g, "$1 $2")
    .replace(/([A-ZÄÖÜ]+)([A-ZÄÖÜ][a-zäöüß])/g, "$1 $2")
    .split(/[\s_\-.$0-9]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
}

/** Reads the list of frozen names: one name per line, case-sensitive, `#` starts a comment. */
export function parseNameList(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);
}

export function isGermanName(name, words) {
  if (FROZEN_NAMES.has(name)) return false;
  return splitName(name).some((part) => GERMAN_LETTERS.test(part) || words.has(part));
}

/** True for German prose. Code in backticks and URLs are left out first. */
export function isGermanText(text, words) {
  const prose = text.replace(/`[^`]*`/g, " ").replace(/https?:\/\/\S+/g, " ");
  if (GERMAN_LETTERS.test(prose)) return true;
  const tokens = prose.toLowerCase().match(/[a-z]+/g) ?? [];
  if (tokens.length === 0) return false;
  const stops = tokens.filter((t) => STOP_WORDS.has(t)).length;
  if (stops >= 2) return true;
  const hits = tokens.filter((t) => STOP_WORDS.has(t) || words.has(t)).length;
  return hits > 0 && hits / tokens.length >= 0.3;
}

/** Path segments (folders and the file name without extension) that are German. */
export function germanPathParts(path, words) {
  const segments = path.split("/");
  return segments.filter((segment, i) => {
    const name = i === segments.length - 1 ? segment.replace(/\..*$/, "") : segment;
    return name.length > 0 && isGermanName(name, words);
  });
}

/** A `/` starts a regular expression when the code before it cannot end an expression. */
function isRegexStart(piece, previous) {
  if (piece.kind !== "code") return false;
  const before = piece.text.trimEnd();
  if (before === "") return previous === undefined;
  // `<` and `>` are left out on purpose: in JSX they come before `/` in `</tag>` and `/>`.
  return /[(,=:[!&|?{};+\-*%~^]$/.test(before) || /\b(return|typeof|case|of|in)$/.test(before);
}

/**
 * Splits JavaScript or TypeScript source into pieces: `code`, `comment` and `string`, each with its start line.
 * Template literals with `${}` are followed; regular expression literals are not (a quote inside one may hide the
 * rest of that line, which only means fewer findings). Single and double quoted strings end at a line break.
 */
export function tokenizeJs(source) {
  const pieces = [];
  let line = 1;
  let i = 0;
  let current = { kind: "code", text: "", line: 1 };
  const templateDepth = []; // brace depth at which each open `${` returns to its template literal

  function start(kind) {
    if (current.text) pieces.push(current);
    current = { kind, text: "", line };
  }
  function take(n = 1) {
    for (let k = 0; k < n; k++) {
      const ch = source[i++];
      if (ch === undefined) return;
      current.text += ch;
      if (ch === "\n") line++;
    }
  }

  let braces = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      start("comment");
      i += 2;
      while (i < source.length && source[i] !== "\n") take();
      start("code");
    } else if (ch === "/" && next === "*") {
      start("comment");
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) take();
      i += 2;
      start("code");
    } else if (ch === "/" && isRegexStart(current, pieces.at(-1))) {
      // A regular expression literal: treated like a string, its letters are not identifiers.
      start("string");
      take();
      let inClass = false;
      while (i < source.length && source[i] !== "\n") {
        const c = source[i];
        if (c === "\\") take();
        else if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) break;
        take();
      }
      take();
      while (i < source.length && /[a-z]/.test(source[i])) take();
      start("code");
    } else if (ch === '"' || ch === "'") {
      start("string");
      i++;
      while (i < source.length && source[i] !== ch && source[i] !== "\n") {
        if (source[i] === "\\") take();
        take();
      }
      if (source[i] === ch) i++;
      start("code");
    } else if (ch === "`" || (ch === "}" && templateDepth.length > 0 && templateDepth.at(-1) === braces)) {
      if (ch === "}") templateDepth.pop();
      start("string");
      i++;
      while (i < source.length && source[i] !== "`" && !(source[i] === "$" && source[i + 1] === "{")) {
        if (source[i] === "\\") take();
        take();
      }
      if (source[i] === "`") {
        i++;
      } else if (source[i] === "$") {
        i += 2;
        templateDepth.push(braces);
      }
      start("code");
    } else {
      if (ch === "{") braces++;
      if (ch === "}") braces--;
      take();
    }
  }
  start("code");
  return pieces;
}

/** Line comments starting with `#` (Python, shell, YAML, TOML), ignoring `#` inside simple quotes. */
export function hashComments(source) {
  const comments = [];
  source.split("\n").forEach((text, index) => {
    let quote = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === "#" && (i === 0 || /\s/.test(text[i - 1]))) {
        if (!text.startsWith("#!")) comments.push({ line: index + 1, text: text.slice(i + 1) });
        break;
      }
    }
  });
  return comments;
}

const IDENTIFIER = /[A-Za-z_$ÄÖÜäöüß][A-Za-z0-9_$ÄÖÜäöüß]*/g;
const TEST_CALL = /\b(?:it|test|describe)(?:\.(?:each|skip|only|todo)(?:\([^)]*\))?)?\(\s*$/;
const MESSAGE_CALL =
  /(?:console\.(?:log|info|warn|error)|\b\w*Error|\blog|\bfail|\bwarn|\bdie)\(\s*$|\bthrow\s+$|\berror:\s*$|\bmessage:\s*$/;

function snippet(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 80 ? `${flat.slice(0, 77)}...` : flat;
}

/** Blanks the text between a closing `>` of a JSX tag and the next `<` or `{`, keeping line breaks. */
export function withoutJsxText(code) {
  const blank = (text) => text.replace(/[^\n]/g, " ");
  return code
    .replace(/(^|[\w"'}/])>([^<>{}]*)(?=[<{])/g, (_, before, text) => `${before}>${blank(text)}`)
    .replace(/\}([^<>{}=;()[\]]*)(?=<\/?[A-Za-z])/g, (_, text) => `}${blank(text)}`);
}

const DECLARATION = /\b(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$ÄÖÜäöüß][\w$ÄÖÜäöüß]*)/g;

/** Names declared on one line of code (variables, functions, classes, types). */
export function declaredNames(line) {
  return [...line.matchAll(DECLARATION)].map((m) => m[1]);
}

/** Findings in one JavaScript or TypeScript file. */
function scanJs(path, source, words) {
  /** @type {Finding[]} */
  const findings = [];
  const pieces = tokenizeJs(source);
  const isTest = path.startsWith("test/");
  const isJsx = /\.(tsx|jsx)$/.test(path);
  pieces.forEach((piece, index) => {
    if (piece.kind === "code") {
      const seen = new Set();
      let line = piece.line;
      // JSX text is visible text, not code. Line breaks are kept so line numbers stay right.
      const code = isJsx ? withoutJsxText(piece.text) : piece.text;
      for (const part of code.split("\n")) {
        // In tests only declared names count; object keys and other data mirror fixtures, stored data or the API.
        const names = isTest ? declaredNames(part) : (part.match(IDENTIFIER) ?? []);
        for (const name of names) {
          const key = `${line}:${name}`;
          if (!seen.has(key) && isGermanName(name, words)) {
            seen.add(key);
            findings.push({ path, line, kind: "identifier", text: name });
          }
        }
        line++;
      }
    } else if (piece.kind === "comment") {
      if (isGermanText(piece.text, words)) {
        findings.push({ path, line: piece.line, kind: "comment", text: snippet(piece.text.replace(/^\s*\*+/gm, "")) });
      }
    } else {
      const before = pieces[index - 1];
      const context = before?.kind === "code" ? before.text.slice(-40) : "";
      let kind = null;
      if (isTest && TEST_CALL.test(context)) kind = "test-name";
      else if (MESSAGE_CALL.test(context)) kind = "message";
      if (kind && isGermanText(piece.text, words)) {
        findings.push({ path, line: piece.line, kind, text: snippet(piece.text) });
      }
    }
  });
  return findings;
}

/** Findings in YAML, shell, Python and similar files: comments, step names and echoed messages. */
function scanHash(path, source, words) {
  /** @type {Finding[]} */
  const findings = [];
  for (const comment of hashComments(source)) {
    if (isGermanText(comment.text, words)) {
      findings.push({ path, line: comment.line, kind: "comment", text: snippet(comment.text) });
    }
  }
  source.split("\n").forEach((text, index) => {
    const message =
      text.match(/^\s*-?\s*name:\s*(.+)$/)?.[1] ??
      text.match(/\b(?:echo|printf|print)\s*\(?\s*(.+)$/)?.[1] ??
      text.match(/::(?:error|warning|notice)::(.+)$/)?.[1];
    if (message && isGermanText(message.replace(/#.*$/, ""), words)) {
      findings.push({ path, line: index + 1, kind: "message", text: snippet(message) });
    }
  });
  return findings;
}

/**
 * Findings in CSS: comments only (class names follow the components).
 * @returns {Finding[]}
 */
function scanCss(path, source, words) {
  return tokenizeJs(source.replace(/"[^"\n]*"|'[^'\n]*'/g, '""'))
    .filter((piece) => piece.kind === "comment" && isGermanText(piece.text, words))
    .map((piece) => ({ path, line: piece.line, kind: "comment", text: snippet(piece.text) }));
}

/**
 * All findings in one file, file name included.
 * @param {string} path
 * @param {string} source
 * @param {Set<string>} words
 * @returns {Finding[]}
 */
export function scanFile(path, source, words) {
  if (isIgnoredPath(path)) return [];
  /** @type {Finding[]} */
  const findings = germanPathParts(path, words).map((part) => ({ path, line: 0, kind: "file-name", text: part }));
  if (CODE_EXTENSIONS.test(path)) findings.push(...scanJs(path, source, words));
  else if (HASH_EXTENSIONS.test(path)) findings.push(...scanHash(path, source, words));
  else if (CSS_EXTENSIONS.test(path)) findings.push(...scanCss(path, source, words));
  return findings;
}

/**
 * Reads `git diff --unified=0` output: per file, the line numbers added or changed in the new version, and whether
 * the file is new or renamed (then its name counts as changed).
 */
export function parseDiff(diff) {
  const files = new Map();
  let current = null;
  for (const text of diff.split("\n")) {
    if (text.startsWith("diff --git ")) {
      current = { lines: new Set(), newName: false };
    } else if (current && (text.startsWith("new file mode") || text.startsWith("rename to "))) {
      current.newName = true;
    } else if (current && text.startsWith("+++ ")) {
      const path = text.slice(4).replace(/^b\//, "");
      if (path !== "/dev/null") files.set(path, current);
    } else if (current && text.startsWith("@@")) {
      const match = text.match(/\+(\d+)(?:,(\d+))?/);
      if (match) {
        const from = Number(match[1]);
        const count = match[2] === undefined ? 1 : Number(match[2]);
        for (let n = from; n < from + count; n++) current.lines.add(n);
      }
    }
  }
  return files;
}

/**
 * Keeps the findings on changed lines; file names count only for new or renamed files.
 * @param {Finding[]} findings
 * @param {Map<string, { lines: Set<number>; newName: boolean }>} changes
 * @returns {Finding[]}
 */
export function onlyChanged(findings, changes) {
  return findings.filter((finding) => {
    const change = changes.get(finding.path);
    if (!change) return false;
    return finding.line === 0 ? change.newName : change.lines.has(finding.line);
  });
}

/** Text report, one line per finding, plus a summary per kind. */
export function formatReport(findings) {
  const lines = findings.map((f) => `${f.path}${f.line ? `:${f.line}` : ""}: ${f.kind}: ${f.text}`);
  const counts = {};
  for (const f of findings) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
  const summary = Object.entries(counts)
    .map(([kind, n]) => `${n} ${kind}`)
    .join(", ");
  lines.push(findings.length === 0 ? "No German found." : `German found: ${summary}.`);
  return lines.join("\n");
}
