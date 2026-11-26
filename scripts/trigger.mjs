// Löst einen Sammlerlauf in netlify dev aus: node scripts/trigger.mjs collect-guild
// netlify dev gibt bei geplanten Functions nicht deren Antwort zurück, sondern nur einen Hinweis.
// Der Bericht des Laufs steht als JSON-Zeile im Log: docker compose logs app | grep '"job"'
const name = process.argv[2];
if (!name) {
  console.error("Aufruf: node scripts/trigger.mjs <functionName>");
  process.exit(2);
}
const base = process.env.TRIGGER_BASE_URL ?? "http://localhost:8888";
const res = await fetch(`${base}/.netlify/functions/${name}`);
await res.text();
console.log(`${name} ausgelöst (HTTP ${res.status}). Bericht im Log: docker compose logs app | grep '"job":"${name}"'`);
process.exit(res.ok ? 0 : 1);
