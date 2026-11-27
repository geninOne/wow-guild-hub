import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const scheduleOf = (name: string) =>
  /schedule:\s*"([^"]+)"/.exec(readFileSync(`netlify/functions/${name}.mts`, "utf8"))?.[1] ?? "";

/** Minute of a schedule; "@hourly" and "@daily" run on the hour. */
const minuteOf = (schedule: string) => (schedule.startsWith("@") ? 0 : Number(schedule.split(" ")[0]));

test("collect-static runs every four hours, offset from collect-guild and collect-weekly", () => {
  const schedule = scheduleOf("collect-static");
  const [minute, hours, ...rest] = schedule.split(" ");
  expect(hours).toBe("*/4");
  expect(rest).toEqual(["*", "*", "*"]);
  expect(Number(minute)).not.toBe(minuteOf(scheduleOf("collect-guild")));
  expect(Number(minute)).not.toBe(minuteOf(scheduleOf("collect-weekly")));
});
