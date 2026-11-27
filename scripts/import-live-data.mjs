// One-time data import for going live, a single command in the main checkout (container running):
//   npm run data:import:live
//   npm run data:import:live -- --source path       existing copy instead of a copy from the container
//   npm run data:import:live -- --overwrite         even if the site's store already has entries
// The former German flag names are still accepted as deprecated aliases (see parseArgs below).
// Flow: copy .netlify/blobs-serve out of the container "app", show the dry run, after "yes" ask for the
// Netlify token without echo and upload. Site ID from NETLIFY_SITE_ID. The token appears neither in the
// output nor in the shell history; if NETLIFY_AUTH_TOKEN is set, no prompt is shown.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { liveImport, netlifyTarget } from "./blobs-lib.mjs";

// NETLIFY_SITE_ID and other settings may also be in .env.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env, only the environment counts
}

const root = new URL("../", import.meta.url);

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

/** Reads input without echo (terminal raw mode). */
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error("The token prompt needs a terminal (or NETLIFY_AUTH_TOKEN in the environment)"));
      return;
    }
    let value = "";
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    function onData(chunk) {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          finish();
          reject(new Error("Cancelled"));
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    }
    stdout.write(question);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

let temp;
try {
  const { values } = parseArgs({
    options: {
      source: { type: "string" },
      overwrite: { type: "boolean", default: false },
      // Deprecated German aliases of --source and --overwrite.
      "quelle": { type: "string" },
      "ueberschreiben": { type: "boolean", default: false },
    },
  });
  const givenSource = values.source ?? values["quelle"];
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!siteId) throw new Error("NETLIFY_SITE_ID is missing (ID of the Netlify site, e.g. in .env)");

  let source = givenSource;
  if (!source) {
    temp = mkdtempSync(join(tmpdir(), "guild-hub-blobs-"));
    source = join(temp, "blobs-serve");
    console.log("Copying .netlify/blobs-serve from the container app ...");
    execFileSync("docker", ["compose", "cp", "app:/app/.netlify/blobs-serve", source], {
      cwd: new URL(".", root),
      stdio: ["ignore", "ignore", "inherit"],
    });
  }
  console.log(`Source: ${givenSource ?? "copy from the container"}`);

  const result = await liveImport({
    source,
    overwrite: values.overwrite || values["ueberschreiben"],
    log: (line) => console.log(line),
    confirm,
    askToken: async () => process.env.NETLIFY_AUTH_TOKEN || askHidden("Netlify token (input stays hidden): "),
    createTarget: (token) => netlifyTarget({ siteID: siteId, token }),
  });
  if (result) console.log("Data import complete.");
} catch (error) {
  console.error(`Aborted: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (temp) rmSync(temp, { recursive: true, force: true });
}
