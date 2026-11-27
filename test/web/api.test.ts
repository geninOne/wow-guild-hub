import { expect, test } from "vitest";
import { ApiError, fetchJson } from "../../web/src/lib/api";

test("fetchJson returns data and throws ApiError with status", async () => {
  const ok = async () => new Response(JSON.stringify({ a: 1 }), { status: 200 });
  expect(await fetchJson("/api/x", ok as typeof fetch)).toEqual({ a: 1 });
  const empty = async () =>
    new Response(JSON.stringify({ error: "No data collected yet" }), { status: 503 });
  await expect(fetchJson("/api/x", empty as typeof fetch)).rejects.toMatchObject({
    status: 503,
    message: "No data collected yet",
  });
});

test("fetchJson throws ApiError even without JSON in the error body", async () => {
  const broken = async () => new Response("Bad Gateway", { status: 502 });
  const error = await fetchJson("/api/x", broken as typeof fetch).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 502 });
});
