// Measures text repetition in the newspaper across issues. No imports, so scripts/ can load the file too.

export interface IssueText {
  lead: { headline: string; text: string };
  articles: { headline: string; text: string }[];
  motto: string;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Sentences of a text as patterns: names and numbers replaced, lower case. Pure placeholders do not count. */
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

/** All sentence patterns of an issue: headlines, texts and motto. */
export function issuePatterns(issue: IssueText, names: string[]): Set<string> {
  const parts = [issue.lead, ...issue.articles].flatMap((a) => [a.headline, a.text]);
  return new Set([...parts, issue.motto].flatMap((t) => sentencePatterns(t, names)));
}

export interface RepetitionStats {
  /** Distinct sentence patterns across all issues. */
  patterns: number;
  /** Patterns that occur in at least two issues. */
  repeated: number;
  /** Patterns that occur in two directly consecutive issues. */
  consecutive: number;
  /** Highest number of repeated patterns in a window of `window` consecutive issues. */
  maxInWindow: number;
  /** Patterns with the number of issues they occur in, most frequent first. */
  top: [string, number][];
}

/** Issues in chronological order. */
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
