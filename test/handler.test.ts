import { expect, test, vi } from "vitest";
import { runAndRespond } from "../src/handler";

test("success: report as JSON with status 200 and one log line", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const res = await runAndRespond("collect-guild", async () => ({ fetched: 3 }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ fetched: 3 });
  expect(log).toHaveBeenCalledWith(JSON.stringify({ job: "collect-guild", fetched: 3 }));
  log.mockRestore();
});

test("error: status 500 with the message only, without stack trace", async () => {
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const res = await runAndRespond("collect-static", async () => {
    throw new Error("Environment variable BNET_CLIENT_ID is missing");
  });
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: "Environment variable BNET_CLIENT_ID is missing" });
  expect(err).toHaveBeenCalledWith(JSON.stringify({ job: "collect-static", error: "Environment variable BNET_CLIENT_ID is missing" }));
  err.mockRestore();
});
