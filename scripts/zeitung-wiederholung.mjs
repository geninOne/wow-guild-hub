// Misst Textwiederholungen über alle Zeitungsausgaben der lokalen Umgebung (liest nur die Lese-API).
// Aufruf: node scripts/zeitung-wiederholung.mjs   (TRIGGER_BASE_URL, Vorgabe http://localhost:8888)
import { issuePatterns, repetitionStats } from "../src/weekly/repetition.ts";

const basis = process.env.TRIGGER_BASE_URL ?? "http://localhost:8888";
const holen = async (pfad) => (await fetch(`${basis}${pfad}`, { headers: { "Cache-Control": "no-cache" } })).json();

const gilde = await holen("/api/guild");
const namen = gilde.members.map((m) => m.name);
const archiv = await holen("/api/zeitung/archiv");
const wochen = archiv.issues.map((i) => i.week).reverse();
const ausgaben = [];
for (const woche of wochen) ausgaben.push(await holen(`/api/zeitung/${woche}`));
const muster = ausgaben.map((a) => issuePatterns(a, namen));
const s = repetitionStats(muster, 6);
console.log(`${ausgaben.length} Ausgaben (${wochen[0]} bis ${wochen[wochen.length - 1]}), Texter: ${[...new Set(ausgaben.map((a) => a.generator))].join(", ")}`);
console.log(`${s.repeated} von ${s.patterns} Satzmustern kommen mehrfach vor (${Math.round((100 * s.repeated) / Math.max(1, s.patterns))} %).`);
console.log(`${s.consecutive} Muster stehen in zwei aufeinanderfolgenden Ausgaben, höchstens ${s.maxInWindow} Wiederholungen in 6 Ausgaben.`);
for (const [p, n] of s.top.slice(0, 12)) console.log(`  ${n}x  ${p}`);
