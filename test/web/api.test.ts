import { expect, test } from "vitest";
import { ApiError, fetchJson } from "../../web/src/lib/api";

test("fetchJson liefert Daten und wirft ApiError mit Status", async () => {
  const ok = async () => new Response(JSON.stringify({ a: 1 }), { status: 200 });
  expect(await fetchJson("/api/x", ok as typeof fetch)).toEqual({ a: 1 });
  const leer = async () =>
    new Response(JSON.stringify({ error: "Noch keine Daten gesammelt" }), { status: 503 });
  await expect(fetchJson("/api/x", leer as typeof fetch)).rejects.toMatchObject({
    status: 503,
    message: "Noch keine Daten gesammelt",
  });
});

test("fetchJson wirft ApiError auch ohne JSON im Fehlerkörper", async () => {
  const kaputt = async () => new Response("Bad Gateway", { status: 502 });
  const fehler = await fetchJson("/api/x", kaputt as typeof fetch).catch((e: unknown) => e);
  expect(fehler).toBeInstanceOf(ApiError);
  expect(fehler).toMatchObject({ status: 502 });
});
