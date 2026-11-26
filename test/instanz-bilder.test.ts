import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { DUNGEON_INFO, INSTANCE_IMAGES, normName } from "../src/instance-images";

const PUBLIC = join(__dirname, "..", "web", "public");

describe("Instanzbilder", () => {
  test("jede gepflegte Instanz aus config/dungeons.json hat ein Bild", () => {
    const withImage = new Set(Object.keys(INSTANCE_IMAGES).map(normName));
    const missing = Object.keys(DUNGEON_INFO).filter((name) => !withImage.has(normName(name)));
    expect(missing).toEqual([]);
  });

  test("eigene Bilder liegen unter web/public", () => {
    const local = Object.values(INSTANCE_IMAGES).filter((v): v is string => typeof v === "string" && v.startsWith("/"));
    expect(local.length).toBeGreaterThan(0);
    for (const path of local) expect(existsSync(join(PUBLIC, path)), path).toBe(true);
  });
});
