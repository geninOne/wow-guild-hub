// Measures text repetition across all newspaper issues of the local environment (reads only the read API).
// Usage: node scripts/newspaper-repetition.mjs   (TRIGGER_BASE_URL, default http://localhost:8888)
import { issuePatterns, repetitionStats } from "../src/weekly/repetition.ts";

const base = process.env.TRIGGER_BASE_URL ?? "http://localhost:8888";
const fetchJson = async (path) => (await fetch(`${base}${path}`, { headers: { "Cache-Control": "no-cache" } })).json();

const guild = await fetchJson("/api/guild");
const names = guild.members.map((m) => m.name);
const archive = await fetchJson("/api/zeitung/archiv");
const weeks = archive.issues.map((i) => i.week).reverse();
const issues = [];
for (const week of weeks) issues.push(await fetchJson(`/api/zeitung/${week}`));
const patterns = issues.map((a) => issuePatterns(a, names));
const s = repetitionStats(patterns, 6);
console.log(`${issues.length} issues (${weeks[0]} to ${weeks[weeks.length - 1]}), writers: ${[...new Set(issues.map((a) => a.generator))].join(", ")}`);
console.log(`${s.repeated} of ${s.patterns} sentence patterns occur more than once (${Math.round((100 * s.repeated) / Math.max(1, s.patterns))} %).`);
console.log(`${s.consecutive} patterns appear in two consecutive issues, at most ${s.maxInWindow} repetitions in 6 issues.`);
for (const [p, n] of s.top.slice(0, 12)) console.log(`  ${n}x  ${p}`);
