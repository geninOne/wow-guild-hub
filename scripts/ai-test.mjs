// Tests the custom AI gateway for the weekly newspaper with a small request, without blobs and without Netlify.
//
// Run in the container:  docker compose exec app npm run newspaper:ai-test
//                        docker compose exec app npm run newspaper:ai-test -- --output-config
// Without container:     node --env-file=.env scripts/ai-test.mjs
//
// Reads NEWSPAPER_AI_URL, NEWSPAPER_AI_KEY and NEWSPAPER_AI_MODEL (default anthropic-router), sends a
// request to <URL>/v1/messages with x-api-key and reports status, model, stop reason and whether the response
// is valid JSON. With --output-config, output_config (effort and JSON schema) is sent along; if that works,
// NEWSPAPER_AI_OUTPUT_CONFIG=on can be set. The key is never printed.
const url = process.env.NEWSPAPER_AI_URL?.trim();
const apiKey = process.env.NEWSPAPER_AI_KEY?.trim();
const model = process.env.NEWSPAPER_AI_MODEL?.trim() || "anthropic-router";
const withOutputConfig = process.argv.includes("--output-config");

if (!url || !apiKey) {
  console.error("NEWSPAPER_AI_URL or NEWSPAPER_AI_KEY is missing. Add both to .env (in the container, then docker compose up -d).");
  process.exit(1);
}

const target = `${url.replace(/\/+$/, "")}/v1/messages`;
// The prompt is German on purpose: the newspaper is written in German.
const body = {
  model,
  max_tokens: 300,
  system: 'Antworte ausschließlich mit einem JSON-Objekt der Form {"spruch": "..."}, ohne weiteren Text.',
  messages: [{ role: "user", content: "Ein kurzer schwäbischer Spruch ohne Namen und ohne Zahlen." }],
  ...(withOutputConfig
    ? {
        output_config: {
          effort: "low",
          format: {
            type: "json_schema",
            schema: { type: "object", properties: { spruch: { type: "string" } }, required: ["spruch"], additionalProperties: false },
          },
        },
      }
    : {}),
};

console.log(`Target: ${target}`);
console.log(`Model: ${model}${withOutputConfig ? ", with output_config" : ""}`);
const start = Date.now();
try {
  const res = await fetch(target, {
    method: "POST",
    headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const duration = ((Date.now() - start) / 1000).toFixed(1);
  const text = await res.text();
  console.log(`HTTP ${res.status} after ${duration} s`);
  if (!res.ok) {
    console.error(`Error response: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  const response = JSON.parse(text);
  const content = response.content?.find((b) => b.type === "text")?.text ?? "";
  console.log(`Responding model: ${response.model ?? "unknown"}, stop reason: ${response.stop_reason ?? "unknown"}`);
  console.log(`Text: ${content}`);
  const a = content.indexOf("{");
  const b = content.lastIndexOf("}");
  try {
    const json = JSON.parse(content.slice(a, b + 1));
    console.log(typeof json.spruch === "string" ? "JSON valid: the newspaper can write through this gateway." : "JSON without field spruch.");
  } catch {
    console.log("No valid JSON: the newspaper would fall back to the phrase templates.");
    process.exit(1);
  }
} catch (error) {
  console.error(`Request failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
