import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { collectEntries, importEntries, liveImport } from "../../scripts/blobs-lib.mjs";

let source: string;

function file(path: string, content: string) {
  const full = join(source, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

beforeEach(() => {
  source = mkdtempSync(join(tmpdir(), "blobs-"));
  file("entries/unlinked/site:gilde/guild", '{"name":"Bärenklaue"}');
  file("entries/unlinked/site:gilde/characters/1", '{"id":1}');
  file("entries/unlinked/site:gilde/history/2026-11-06", '{"tag":"secret"}');
  file("metadata/unlinked/site:gilde/guild", "{}");
  file("metadata/unlinked/site:gilde/characters/1", '{"origin":"local"}');
});

afterEach(() => rmSync(source, { recursive: true, force: true }));

function fakeTarget(existing: string[] = []) {
  const written: { key: string; content: string; metadata?: object }[] = [];
  let listed = 0;
  return {
    written,
    get listed() {
      return listed;
    },
    async list() {
      listed++;
      return existing;
    },
    async set(key: string, content: string, metadata?: object) {
      written.push({ key, content, metadata });
    },
  };
}

describe("collectEntries", () => {
  test("returns all keys of the store with size and non-empty metadata", async () => {
    const entries = await collectEntries(source);
    expect(entries.map((e) => e.key)).toEqual(["characters/1", "guild", "history/2026-11-06"]);
    expect(entries.find((e) => e.key === "guild")).toMatchObject({ size: 22, metadata: null });
    expect(entries.find((e) => e.key === "characters/1")?.metadata).toEqual({ origin: "local" });
  });

  test("aborts with their names when there are several site folders", async () => {
    file("entries/abc123/site:gilde/guild", "{}");
    await expect(collectEntries(source)).rejects.toThrow(/abc123.*unlinked|unlinked.*abc123/);
  });

  test("aborts when the store or the source is missing", async () => {
    await expect(collectEntries(source, "other")).rejects.toThrow(/site:other/);
    await expect(collectEntries(join(source, "does-not-exist"))).rejects.toThrow(/entries/);
  });
});

describe("importEntries", () => {
  test("dry run only lists and does not touch the target", async () => {
    const target = fakeTarget();
    const log: string[] = [];
    const result = await importEntries({
      entries: await collectEntries(source),
      target,
      dryRun: true,
      log: (line: string) => log.push(line),
    });
    expect(target.listed).toBe(0);
    expect(target.written).toEqual([]);
    expect(result).toEqual({ uploaded: 0, entries: 3, bytes: 22 + 8 + 16 });
    expect(log.join("\n")).toContain("characters/1");
    expect(log.join("\n")).toMatch(/Dry run/);
  });

  test("uploads the content unchanged, with metadata only where present", async () => {
    const target = fakeTarget();
    const log: string[] = [];
    const result = await importEntries({
      entries: await collectEntries(source),
      target,
      dryRun: false,
      log: (line: string) => log.push(line),
    });
    expect(result.uploaded).toBe(3);
    expect(target.written).toContainEqual({ key: "guild", content: '{"name":"Bärenklaue"}', metadata: undefined });
    expect(target.written).toContainEqual({ key: "characters/1", content: '{"id":1}', metadata: { origin: "local" } });
    expect(log.join("\n")).not.toContain("secret");
  });

  test("aborts if the target already has entries, unless overwrite is set", async () => {
    const entries = await collectEntries(source);
    const target = fakeTarget(["guild"]);
    await expect(importEntries({ entries, target, dryRun: false, log: () => {} })).rejects.toThrow(/--overwrite/);
    expect(target.written).toEqual([]);

    const allowed = await importEntries({ entries, target, dryRun: false, overwrite: true, log: () => {} });
    expect(allowed.uploaded).toBe(3);
  });
});

describe("liveImport", () => {
  function flow(answer: string, token = "tok-secret") {
    const steps: string[] = [];
    const log: string[] = [];
    const target = fakeTarget();
    const options = {
      source,
      log: (line: string) => {
        log.push(line);
        if (line.startsWith("Dry run")) steps.push("dry run");
      },
      confirm: async (question: string) => {
        steps.push(`question: ${question}`);
        return answer;
      },
      askToken: async () => {
        steps.push("token");
        return token;
      },
      createTarget: (t: string) => {
        steps.push(`target with ${t === "tok-secret" ? "token" : "other"}`);
        return target;
      },
    };
    return { steps, log, target, options };
  }

  test("shows the dry run first, then asks and uploads with the token after yes", async () => {
    const { steps, log, target, options } = flow("yes");
    const result = await liveImport(options);
    expect(steps).toEqual([
      "dry run",
      "question: Upload 3 entries to the store gilde of the Netlify site? (yes/no) ",
      "token",
      "target with token",
    ]);
    expect(result?.uploaded).toBe(3);
    expect(target.written).toHaveLength(3);
    expect(log.join("\n")).not.toContain("tok-secret");
  });

  test("still accepts the deprecated German answer ja", async () => {
    const { target, options } = flow("ja");
    expect((await liveImport(options))?.uploaded).toBe(3);
    expect(target.written).toHaveLength(3);
  });

  test("without yes nothing is uploaded and no token is requested", async () => {
    const { steps, target, options } = flow("n");
    expect(await liveImport(options)).toBeNull();
    expect(steps).not.toContain("token");
    expect(target.written).toEqual([]);
  });

  test("an empty token aborts", async () => {
    const { target, options } = flow("yes", "  ");
    await expect(liveImport(options)).rejects.toThrow(/token/);
    expect(target.written).toEqual([]);
  });
});
