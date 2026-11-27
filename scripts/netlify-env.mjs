// Sets the environment variables of the Netlify site (only those the functions need), idempotently:
//   node scripts/netlify-env.mjs                 from the local .env
//   node scripts/netlify-env.mjs --env path      from another file
//   node scripts/netlify-env.mjs --from-env      from environment variables (release workflow: GitHub secrets
//                                                and GitHub variables, missing settings with their default)
// The old flag --aus-umgebung is still accepted as a deprecated alias for --from-env.
// Needs NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN in the environment. Only variable names are printed.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { CREDENTIALS, NETLIFY_VARIABLES, setVariables, variablesFromEnvFile, variablesFromEnvironment } from "./netlify-env-lib.mjs";

try {
  const { values } = parseArgs({
    options: {
      env: { type: "string", default: ".env" },
      "from-env": { type: "boolean", default: false },
      "aus-umgebung": { type: "boolean", default: false }, // deprecated alias for --from-env
    },
  });
  const siteId = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const missing = [!siteId && "NETLIFY_SITE_ID", !token && "NETLIFY_AUTH_TOKEN"].filter(Boolean);
  if (missing.length) throw new Error(`Environment variable missing: ${missing.join(", ")}`);

  let variables;
  let source;
  if (values["from-env"] || values["aus-umgebung"]) {
    variables = variablesFromEnvironment(process.env);
    source = "the environment";
  } else {
    variables = variablesFromEnvFile(readFileSync(values.env, "utf8"));
    source = values.env;
    for (const required of CREDENTIALS) {
      if (!variables.some((v) => v.key === required)) throw new Error(`${required} is missing or empty in ${values.env}`);
    }
    const withoutValue = NETLIFY_VARIABLES.filter((key) => !variables.some((v) => v.key === key));
    if (withoutValue.length) {
      console.log(`Without a value in ${values.env}, Netlify uses the default in the code: ${withoutValue.join(", ")}`);
    }
  }
  console.log(`Netlify environment variables from ${source}:`);
  await setVariables({ siteId, token, variables, log: (line) => console.log(line) });
} catch (error) {
  console.error(`Aborted: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
