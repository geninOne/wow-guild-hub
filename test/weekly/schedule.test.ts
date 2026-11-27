import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { berlinParts } from "../../src/lib/time";

// The schedule of the weekly evaluation is in UTC. Every run must be on Sunday after 0:00 Berlin time (week completed,
// Saturday's daily snapshot complete) and at least one before 10:00, in winter as in summer.
const source = readFileSync("netlify/functions/collect-weekly.mts", "utf8");
const schedule = /schedule:\s*"([^"]+)"/.exec(source)?.[1] ?? "";

test("schedule: daily, several attempts, all on Sunday between 0:00 and 10:00 Berlin time", () => {
  const [minute, hours, ...rest] = schedule.split(" ");
  expect(rest).toEqual(["*", "*", "*"]); // daily, so missed weeks are caught up
  const utcHours = hours.split(",").map(Number);
  expect(utcHours.length).toBeGreaterThanOrEqual(2); // one failure must not cost the Sunday issue
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
