import { expect, test } from "vitest";
import { versionsText } from "../../web/src/lib/version";

test("Version mit Datum im deutschen Format", () => {
  expect(versionsText("1.0.0", "2026-11-06")).toBe("Version 1.0.0 vom 06.11.2026");
});

test("ohne Datum nur die Version, ohne Version nichts", () => {
  expect(versionsText("1.0.0", "2026-11-06", true)).toBe("Version 1.0.0, 2026-11-06");
  expect(versionsText("1.2.3", undefined)).toBe("Version 1.2.3");
  expect(versionsText("1.2.3", "kaputt")).toBe("Version 1.2.3");
  expect(versionsText(undefined, "2026-11-06")).toBeNull();
  expect(versionsText("", "2026-11-06")).toBeNull();
});
