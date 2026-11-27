import { expect, test } from "vitest";
import { berlinDate } from "../../src/lib/time";

test("berlinDate computes in Europe/Berlin", () => {
  expect(berlinDate("2026-11-06T22:59:00Z")).toBe("2026-11-06");
  expect(berlinDate("2026-11-06T23:30:00Z")).toBe("2026-11-07");
  expect(berlinDate("2026-07-01T22:30:00Z")).toBe("2026-07-02");
});

import { addDays, berlinParts, dateOfWeekHour, isMonth, isWeek, isoWeek, shiftWeek, weekHour, weekRange, weekdayOf } from "../../src/lib/time";

test("isoWeek and weekRange, also across the turn of the year", () => {
  expect(isoWeek("2026-11-16")).toBe("2026-W47");
  expect(isoWeek("2026-11-15")).toBe("2026-W46");
  expect(isoWeek("2027-01-01")).toBe("2026-W53");
  expect(isoWeek("2027-01-04")).toBe("2027-W01");
  expect(isoWeek("2024-12-30")).toBe("2025-W01");
  expect(weekRange("2026-W47")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
  expect(weekRange("2026-W53")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
  expect(shiftWeek("2027-W01", -1)).toBe("2026-W53");
  expect(shiftWeek("2026-W47", -5)).toBe("2026-W42");
});

test("isWeek and isMonth check the format", () => {
  expect(isWeek("2026-W47")).toBe(true);
  expect(isWeek("2025-W53")).toBe(false);
  expect(isWeek("2026-47")).toBe(false);
  expect(isMonth("2026-11")).toBe(true);
  expect(isMonth("2026-13")).toBe(false);
});

test("addDays and weekdayOf", () => {
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  expect(weekdayOf("2026-11-16")).toBe(0);
  expect(weekdayOf("2026-11-15")).toBe(6);
});

test("berlinParts and weekHour compute in Berlin local time, also during summer time", () => {
  expect(berlinParts("2026-11-16T00:30:00Z")).toEqual({ date: "2026-11-16", hour: 1, weekday: 0 });
  // Sunday 23:50 Berlin still belongs to the old week.
  expect(weekHour("2026-11-15T22:50:00Z")).toEqual({ week: "2026-W46", hour: 6 * 24 + 23 });
  expect(weekHour("2026-11-15T23:05:00Z")).toEqual({ week: "2026-W47", hour: 0 });
  // Summer time: 20:30 UTC is 22:30 in Berlin.
  expect(weekHour("2026-07-01T20:30:00Z")).toEqual({ week: "2026-W27", hour: 2 * 24 + 22 });
  expect(dateOfWeekHour("2026-W47", 25)).toBe("2026-11-17");
});

import { compareWeeks, isoWeeksBetween, isGuildWeek, isWeekId, shiftGuildWeek, guildRange, guildWeek, weekBounds } from "../../src/lib/time";

test("guild week: Sunday to Saturday, named after its Saturday", () => {
  expect(guildWeek("2026-11-15")).toBe("2026-11-21"); // Sunday belongs to the following week
  expect(guildWeek("2026-11-16")).toBe("2026-11-21");
  expect(guildWeek("2026-11-21")).toBe("2026-11-21");
  expect(guildWeek("2026-11-22")).toBe("2026-11-28");
  expect(guildWeek("2026-12-31")).toBe("2027-01-02"); // across the turn of the year
  expect(guildRange("2026-11-21")).toEqual({ from: "2026-11-15", to: "2026-11-21" });
  expect(shiftGuildWeek("2026-11-21", -1)).toBe("2026-11-14");
  expect(shiftGuildWeek("2026-12-26", 1)).toBe("2027-01-02");
});

test("week IDs: guild weeks and old ISO weeks side by side", () => {
  expect(isGuildWeek("2026-11-21")).toBe(true);
  expect(isGuildWeek("2026-11-22")).toBe(false); // a Sunday
  expect(isGuildWeek("2026-02-30")).toBe(false);
  expect(isWeekId("2026-11-21")).toBe(true);
  expect(isWeekId("2026-W46")).toBe(true);
  expect(isWeekId("2026-11")).toBe(false);
  expect(weekBounds("2026-W46")).toEqual({ from: "2026-11-09", to: "2026-11-15" });
  expect(weekBounds("2026-11-21")).toEqual({ from: "2026-11-15", to: "2026-11-21" });
  const sorted = ["2026-11-28", "2026-W46", "2026-11-21", "2026-W45"].sort(compareWeeks);
  expect(sorted).toEqual(["2026-W45", "2026-W46", "2026-11-21", "2026-11-28"]);
});

test("isoWeeksBetween: all ISO weeks touching a period", () => {
  expect(isoWeeksBetween("2026-11-15", "2026-11-21")).toEqual(["2026-W46", "2026-W47"]);
  expect(isoWeeksBetween("2026-11-16", "2026-11-21")).toEqual(["2026-W47"]);
  expect(isoWeeksBetween("2026-11-01", "2026-11-30")).toEqual(["2026-W44", "2026-W45", "2026-W46", "2026-W47", "2026-W48", "2026-W49"]);
});
