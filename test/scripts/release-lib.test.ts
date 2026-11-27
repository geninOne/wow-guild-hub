import { describe, expect, test } from "vitest";
import { changelogSection, checkTag, todayIso } from "../../scripts/release-lib.mjs";

// This is how release-please writes: heading with link, subsections with "###".
const CHANGELOG = `# Changelog

Introduction.

## [1.1.0](https://github.com/geninOne/wow-guild-hub/compare/v1.0.0...v1.1.0) (2026-12-01)


### Features

* **professions:** filter by recipe rank ([#7](https://github.com/geninOne/wow-guild-hub/issues/7))

### [1.0.1](https://github.com/geninOne/wow-guild-hub/compare/v1.0.0...v1.0.1) (2026-11-20)

* Fix.

## 1.0.0 (2026-11-06)

- First version.
- Second item.
`;

describe("changelogSection", () => {
  test("returns date and content of a hand-written section", () => {
    expect(changelogSection(CHANGELOG, "1.0.0")).toEqual({
      date: "2026-11-06",
      content: "- First version.\n- Second item.",
    });
  });

  test("reads release-please headings with a link and keeps the subsections", () => {
    expect(changelogSection(CHANGELOG, "1.1.0")).toEqual({
      date: "2026-12-01",
      content: "### Features\n\n* **professions:** filter by recipe rank ([#7](https://github.com/geninOne/wow-guild-hub/issues/7))",
    });
  });

  test("also recognizes version headings with three hashes", () => {
    expect(changelogSection(CHANGELOG, "1.0.1")).toEqual({ date: "2026-11-20", content: "* Fix." });
  });

  test("returns null for an unknown version", () => {
    expect(changelogSection(CHANGELOG, "9.9.9")).toBeNull();
    expect(changelogSection(CHANGELOG, "1.0")).toBeNull();
  });
});

describe("checkTag", () => {
  test("accepts a tag that matches the version and has a section", () => {
    expect(() => checkTag("v1.0.0", "1.0.0", CHANGELOG)).not.toThrow();
    expect(() => checkTag("v1.1.0", "1.1.0", CHANGELOG)).not.toThrow();
  });

  test("rejects a tag that does not match the version in package.json", () => {
    expect(() => checkTag("v1.1.0", "1.0.0", CHANGELOG)).toThrow(/v1\.1\.0.*1\.0\.0/);
  });

  test("rejects a version without a changelog section", () => {
    expect(() => checkTag("v2.0.0", "2.0.0", CHANGELOG)).toThrow(/CHANGELOG/);
  });
});

test("todayIso computes in German time", () => {
  expect(todayIso(new Date("2026-11-06T23:30:00Z"))).toBe("2026-11-07");
  expect(todayIso(new Date("2026-11-06T12:00:00Z"))).toBe("2026-11-06");
});
