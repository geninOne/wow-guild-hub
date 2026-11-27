import { expect, test } from "vitest";
import { versionText } from "../../web/src/lib/version";

test("version with date in German format", () => {
  expect(versionText("1.0.0", "2026-11-06")).toBe("Version 1.0.0 vom 06.11.2026");
});

test("English format, without a date only the version, without a version nothing", () => {
  expect(versionText("1.0.0", "2026-11-06", true)).toBe("Version 1.0.0, 2026-11-06");
  expect(versionText("1.2.3", undefined)).toBe("Version 1.2.3");
  expect(versionText("1.2.3", "invalid")).toBe("Version 1.2.3");
  expect(versionText(undefined, "2026-11-06")).toBeNull();
  expect(versionText("", "2026-11-06")).toBeNull();
});
