// Misst Textwiederholungen in der Zeitung über mehrere Ausgaben. Ohne Importe, damit auch scripts/ die Datei laden.

export interface IssueText {
  lead: { headline: string; text: string };
  articles: { headline: string; text: string }[];
  motto: string;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Sätze eines Textes als Muster: Namen und Zahlen ersetzt, klein geschrieben. Reine Platzhalter zählen nicht. */
export function sentencePatterns(text: string, names: string[]): string[] {
  const sorted = [...new Set(names)].filter((n) => n.length > 1).sort((a, b) => b.length - a.length);
  const nameRe = sorted.length > 0 ? new RegExp(`(?<![\\p{L}\\p{N}])(${sorted.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "gu") : null;
  return text
    .split(/(?<=[.!?])\s+/u)
    .map((s) => {
      let out = nameRe ? s.replace(nameRe, "<name>") : s;
      out = out.replace(/\d+/g, "<n>").toLowerCase().replace(/\s+/g, " ").trim();
      return out;
    })
    .filter((s) => /\p{L}/u.test(s.replace(/<name>|<n>/g, "")));
}

/** Alle Satzmuster einer Ausgabe: Schlagzeilen, Texte und Spruch. */
export function issuePatterns(issue: IssueText, names: string[]): Set<string> {
  const parts = [issue.lead, ...issue.articles].flatMap((a) => [a.headline, a.text]);
  return new Set([...parts, issue.motto].flatMap((t) => sentencePatterns(t, names)));
}

export interface RepetitionStats {
  /** Verschiedene Satzmuster über alle Ausgaben. */
  patterns: number;
  /** Muster, die in mindestens zwei Ausgaben vorkommen. */
  repeated: number;
  /** Muster, die in zwei direkt aufeinanderfolgenden Ausgaben vorkommen. */
  consecutive: number;
  /** Höchste Zahl wiederholter Muster in einem Fenster von `window` aufeinanderfolgenden Ausgaben. */
  maxInWindow: number;
  /** Muster mit der Zahl der Ausgaben, in denen sie vorkommen, häufigste zuerst. */
  top: [string, number][];
}

/** Ausgaben in zeitlicher Reihenfolge. */
export function repetitionStats(issues: Set<string>[], window = 6): RepetitionStats {
  const count = new Map<string, number>();
  for (const set of issues) for (const p of set) count.set(p, (count.get(p) ?? 0) + 1);
  let consecutive = 0;
  const seenConsecutive = new Set<string>();
  for (let i = 1; i < issues.length; i++) {
    for (const p of issues[i]) {
      if (issues[i - 1].has(p) && !seenConsecutive.has(p)) {
        seenConsecutive.add(p);
        consecutive++;
      }
    }
  }
  let maxInWindow = 0;
  for (let start = 0; start + Math.min(window, issues.length) <= issues.length; start++) {
    const local = new Map<string, number>();
    for (const set of issues.slice(start, start + window)) for (const p of set) local.set(p, (local.get(p) ?? 0) + 1);
    maxInWindow = Math.max(maxInWindow, [...local.values()].filter((n) => n > 1).length);
  }
  return {
    patterns: count.size,
    repeated: [...count.values()].filter((n) => n > 1).length,
    consecutive,
    maxInWindow,
    top: [...count].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]),
  };
}
