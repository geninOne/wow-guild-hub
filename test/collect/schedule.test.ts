import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const scheduleOf = (name: string) =>
  /schedule:\s*"([^"]+)"/.exec(readFileSync(`netlify/functions/${name}.mts`, "utf8"))?.[1] ?? "";

/** Minute eines Zeitplans; "@hourly" und "@daily" laufen zur vollen Stunde. */
const minuteOf = (schedule: string) => (schedule.startsWith("@") ? 0 : Number(schedule.split(" ")[0]));

test("collect-static läuft alle vier Stunden, versetzt zu collect-guild und collect-weekly", () => {
  const schedule = scheduleOf("collect-static");
  const [minute, hours, ...rest] = schedule.split(" ");
  expect(hours).toBe("*/4");
  expect(rest).toEqual(["*", "*", "*"]);
  expect(Number(minute)).not.toBe(minuteOf(scheduleOf("collect-guild")));
  expect(Number(minute)).not.toBe(minuteOf(scheduleOf("collect-weekly")));
});
