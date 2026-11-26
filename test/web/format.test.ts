import { expect, test } from "vitest";
import { formatDate, formatDateTime, formatDayMonth } from "../../web/src/lib/format";

test("Zeitpunkte in Europe/Berlin", () => {
  expect(formatDateTime("2026-11-06T09:13:23.666Z")).toBe("06.11.2026, 10:13 Uhr");
  expect(formatDate("2026-11-06T09:11:51.518Z")).toBe("06.11.2026");
  expect(formatDate("2026-11-06T23:30:00.000Z")).toBe("07.11.2026");
});

test("formatDayMonth: Tag und Monat in Berlin", () => {
  expect(formatDayMonth("2026-11-04T23:30:00.000Z")).toBe("05.11.");
});
