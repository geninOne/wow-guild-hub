// Triggers a collector run in netlify dev: node scripts/trigger.mjs collect-guild
// For scheduled functions netlify dev does not return their response, only a notice.
// The run report is a JSON line in the log: docker compose logs app | grep '"job"'
const name = process.argv[2];
if (!name) {
  console.error("Usage: node scripts/trigger.mjs <functionName>");
  process.exit(2);
}
const base = process.env.TRIGGER_BASE_URL ?? "http://localhost:8888";
const res = await fetch(`${base}/.netlify/functions/${name}`);
await res.text();
console.log(`${name} triggered (HTTP ${res.status}). Report in the log: docker compose logs app | grep '"job":"${name}"'`);
process.exit(res.ok ? 0 : 1);
