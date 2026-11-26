// Prüft das eigene AI Gateway für die Wochenzeitung mit einer kleinen Anfrage, ohne Blobs und ohne Netlify.
//
// Aufruf im Container:  docker compose exec app npm run zeitung:ki-test
//                       docker compose exec app npm run zeitung:ki-test -- --output-config
// Ohne Container:       node --env-file=.env scripts/ki-test.mjs
//
// Liest NEWSPAPER_AI_URL, NEWSPAPER_AI_KEY und NEWSPAPER_AI_MODEL (Vorgabe anthropic-router), schickt eine
// Anfrage an <URL>/v1/messages mit x-api-key und meldet Status, Modell, Abbruchgrund und ob die Antwort
// gültiges JSON ist. Mit --output-config kommt output_config (Aufwand und JSON-Schema) mit; klappt das, kann
// NEWSPAPER_AI_OUTPUT_CONFIG=on gesetzt werden. Der Schlüssel wird nie ausgegeben.
const url = process.env.NEWSPAPER_AI_URL?.trim();
const schluessel = process.env.NEWSPAPER_AI_KEY?.trim();
const modell = process.env.NEWSPAPER_AI_MODEL?.trim() || "anthropic-router";
const mitOutputConfig = process.argv.includes("--output-config");

if (!url || !schluessel) {
  console.error("NEWSPAPER_AI_URL oder NEWSPAPER_AI_KEY fehlt. Beides in .env eintragen (im Container danach docker compose up -d).");
  process.exit(1);
}

const ziel = `${url.replace(/\/+$/, "")}/v1/messages`;
const body = {
  model: modell,
  max_tokens: 300,
  system: 'Antworte ausschließlich mit einem JSON-Objekt der Form {"spruch": "..."}, ohne weiteren Text.',
  messages: [{ role: "user", content: "Ein kurzer schwäbischer Spruch ohne Namen und ohne Zahlen." }],
  ...(mitOutputConfig
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

console.log(`Ziel: ${ziel}`);
console.log(`Modell: ${modell}${mitOutputConfig ? ", mit output_config" : ""}`);
const start = Date.now();
try {
  const res = await fetch(ziel, {
    method: "POST",
    headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": schluessel },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const dauer = ((Date.now() - start) / 1000).toFixed(1);
  const text = await res.text();
  console.log(`HTTP ${res.status} nach ${dauer} s`);
  if (!res.ok) {
    console.error(`Fehlerantwort: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  const antwort = JSON.parse(text);
  const inhalt = antwort.content?.find((b) => b.type === "text")?.text ?? "";
  console.log(`Antwortendes Modell: ${antwort.model ?? "unbekannt"}, Abbruchgrund: ${antwort.stop_reason ?? "unbekannt"}`);
  console.log(`Text: ${inhalt}`);
  const a = inhalt.indexOf("{");
  const b = inhalt.lastIndexOf("}");
  try {
    const json = JSON.parse(inhalt.slice(a, b + 1));
    console.log(typeof json.spruch === "string" ? "JSON gültig: Die Zeitung kann über dieses Gateway schreiben." : "JSON ohne Feld spruch.");
  } catch {
    console.log("Kein gültiges JSON: Die Zeitung würde auf die Satzbausteine zurückfallen.");
    process.exit(1);
  }
} catch (error) {
  console.error(`Anfrage gescheitert: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
