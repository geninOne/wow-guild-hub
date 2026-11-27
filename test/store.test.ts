import { expect, test } from "vitest";
import { createMemoryStore } from "../src/store";

test("in-memory store: get, set, list by prefix, copies instead of references", async () => {
  const s = createMemoryStore();
  expect(await s.get("x")).toBeNull();
  const value = { a: 1 };
  await s.set("characters/1", value);
  await s.set("characters/2", { a: 2 });
  await s.set("guild", { g: 1 });
  value.a = 99;
  expect(await s.get("characters/1")).toEqual({ a: 1 });
  expect((await s.list("characters/")).sort()).toEqual(["characters/1", "characters/2"]);
});
