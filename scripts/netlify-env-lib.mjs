// Helpers for scripts/netlify-env.mjs: set the environment variables of the Netlify site, from the local .env
// or (in the release workflow) from GitHub secrets and GitHub variables.
import { parseEnv } from "node:util";

/**
 * Weekly newspaper via your own AI gateway, all optional: if they are missing, the text templates write it.
 * Deliberately not ANTHROPIC_API_KEY, because Netlify's own AI Gateway sets that by itself.
 */
export const AI_VARIABLES = ["NEWSPAPER_AI_URL", "NEWSPAPER_AI_KEY", "NEWSPAPER_AI_MODEL", "NEWSPAPER_AI_EFFORT", "NEWSPAPER_AI_OUTPUT_CONFIG"];

/** Site details, optional, inserted into the UI and index.html during the build (see .env.example). */
export const WEBSITE_VARIABLES = [
  "WEBSITE_NAME",
  "WEBSITE_LANGUAGES",
  "WEBSITE_NEWSPAPER",
  "WEBSITE_DESCRIPTION",
  "WEBSITE_TAGLINE",
  "WEBSITE_LOGO",
  "WEBSITE_LOGO_ALT",
  "WEBSITE_FAVICON",
  "WEBSITE_APPLE_ICON",
  "WEBSITE_OG_IMAGE",
  "WEBSITE_THEME_COLOR",
  "WEBSITE_COLORS",
  "WEBSITE_DISCORD",
  "WEBSITE_IMPRINT_NAME",
  "WEBSITE_IMPRINT_ADDRESS",
  "WEBSITE_IMPRINT_EMAIL",
  "WEBSITE_UMAMI_ID",
  "WEBSITE_UMAMI_DOMAINS",
];

/** Variables the functions on Netlify need. The local scheduler (LOCAL_SCHEDULER*) is not part of it. */
export const NETLIFY_VARIABLES = [
  "BNET_CLIENT_ID",
  "BNET_CLIENT_SECRET",
  "GUILD_SLUGS",
  "GUILD_RANKS",
  "TWINK_RANKS",
  "TITLE_OPT_OUTS",
  "WOW_VERSION",
  "BNET_REGION",
  "BNET_LOCALE",
  "COLLECT_CONCURRENCY",
  "COLLECT_BUDGET_MS",
  ...AI_VARIABLES,
  ...WEBSITE_VARIABLES,
];

/** Required settings without a default. */
export const CREDENTIALS = ["BNET_CLIENT_ID", "BNET_CLIENT_SECRET", "GUILD_SLUGS"];

/** Defaults of the remaining settings (as in src/config.ts), if no GitHub variable is set. */
export const DEFAULTS = {
  BNET_REGION: "eu",
  BNET_LOCALE: "de_DE",
  COLLECT_CONCURRENCY: "10",
  COLLECT_BUDGET_MS: "12000",
};

const API = "https://api.netlify.com/api/v1";

/**
 * Allowed variables with a value from the content of a .env file, in the order of NETLIFY_VARIABLES.
 * @param {string} text
 * @returns {{ key: string, value: string }[]}
 */
export function variablesFromEnvFile(text) {
  const env = parseEnv(text);
  return NETLIFY_VARIABLES.filter((key) => (env[key] ?? "") !== "").map((key) => ({ key, value: env[key] }));
}

/**
 * All variables for Netlify from an environment (process.env in the workflow). Empty or missing settings get
 * their default, missing credentials abort with their names. Optional variables without a default
 * (AI_VARIABLES) are only included when set; otherwise they stay on Netlify as they are.
 * @param {Record<string, string | undefined>} env
 * @returns {{ key: string, value: string }[]}
 */
export function variablesFromEnvironment(env) {
  const missing = CREDENTIALS.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Required settings missing: ${missing.join(", ")}`);
  return NETLIFY_VARIABLES.map((key) => ({ key, value: env[key] || DEFAULTS[key] })).filter((v) => v.value);
}

/** true if the existing variable has exactly one value for all contexts with this content. */
function isSame(existing, value) {
  return existing.values?.length === 1 && existing.values[0].context === "all" && existing.values[0].value === value;
}

/**
 * Sets the variables for all contexts of the site, idempotently: new ones are created, differing ones replaced
 * (without deleting first, so running functions are never without a variable), identical ones stay unchanged.
 * Only keys are printed; errors name method, path and status, never values or the token.
 * @param {{ siteId: string, token: string, variables: { key: string, value: string }[], fetchFn?: typeof fetch, log: (line: string) => void }} options
 */
export async function setVariables({ siteId, token, variables, fetchFn = fetch, log }) {
  if (variables.length === 0) throw new Error("No matching variables with a value found in the .env");

  async function request(method, path, body) {
    const res = await fetchFn(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`Netlify API ${method} ${path.split("?")[0]} responded with HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  const site = encodeURIComponent(siteId);
  const siteInfo = await request("GET", `/sites/${site}`);
  const account = encodeURIComponent(siteInfo.account_slug ?? siteInfo.account_id);
  const existing = new Map((await request("GET", `/accounts/${account}/env?site_id=${site}`)).map((v) => [v.key, v]));

  const created = [];
  for (const { key, value } of variables) {
    const old = existing.get(key);
    const body = { key, values: [{ value, context: "all" }] };
    if (!old) {
      created.push(body);
    } else if (isSame(old, value)) {
      log(`  ${key}: unchanged`);
    } else {
      await request("PUT", `/accounts/${account}/env/${encodeURIComponent(key)}?site_id=${site}`, body);
      log(`  ${key}: changed`);
    }
  }
  if (created.length) {
    await request("POST", `/accounts/${account}/env?site_id=${site}`, created);
    for (const { key } of created) log(`  ${key}: created`);
  }
}
