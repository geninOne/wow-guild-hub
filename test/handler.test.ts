import { expect, test, vi } from "vitest";
import { runAndRespond } from "../src/handler";

test("Erfolg: Bericht als JSON mit Status 200 und eine Logzeile", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const res = await runAndRespond("collect-guild", async () => ({ fetched: 3 }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ fetched: 3 });
  expect(log).toHaveBeenCalledWith(JSON.stringify({ job: "collect-guild", fetched: 3 }));
  log.mockRestore();
});

test("Fehler: Status 500 nur mit der Meldung, ohne Stacktrace", async () => {
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const res = await runAndRespond("collect-static", async () => {
    throw new Error("Umgebungsvariable BNET_CLIENT_ID fehlt");
  });
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: "Umgebungsvariable BNET_CLIENT_ID fehlt" });
  expect(err).toHaveBeenCalledWith(JSON.stringify({ job: "collect-static", error: "Umgebungsvariable BNET_CLIENT_ID fehlt" }));
  err.mockRestore();
});
