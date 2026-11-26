import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { berlinParts } from "../../src/lib/time";

// Der Zeitplan der Wochenauswertung steht in UTC. Jeder Lauf muss sonntags nach 0 Uhr Berliner Zeit liegen
// (Woche abgeschlossen, Tagesstand des Samstags vollständig) und mindestens einer vor 10 Uhr, im Winter wie im Sommer.
const source = readFileSync("netlify/functions/collect-weekly.mts", "utf8");
const schedule = /schedule:\s*"([^"]+)"/.exec(source)?.[1] ?? "";

test("Zeitplan: täglich, mehrere Versuche, alle sonntags zwischen 0 und 10 Uhr Berliner Zeit", () => {
  const [minute, hours, ...rest] = schedule.split(" ");
  expect(rest).toEqual(["*", "*", "*"]); // täglich, damit verpasste Wochen nachgeholt werden
  const utcHours = hours.split(",").map(Number);
  expect(utcHours.length).toBeGreaterThanOrEqual(2); // ein Fehlschlag darf die Sonntagsausgabe nicht kosten
  for (const sunday of ["2026-11-22", "2027-07-04", "2027-03-28", "2027-10-31"]) {
    for (const h of utcHours) {
      const at = `${sunday}T${String(h).padStart(2, "0")}:${minute.padStart(2, "0")}:00Z`;
      const p = berlinParts(at);
      expect(p.date).toBe(sunday);
      expect(p.hour).toBeGreaterThanOrEqual(1);
      expect(p.hour).toBeLessThan(10);
    }
  }
});
