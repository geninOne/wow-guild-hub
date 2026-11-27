/** `static-retail` is the static namespace of regular WoW, only for instance images (Forever has none). */
export type Namespace = "profile" | "dynamic" | "static" | "static-retail";

export interface ApiResult {
  status: number;
  // Raw API responses are untyped on purpose; the transformation checks the fields.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export interface BlizzardClient {
  get(pathOrHref: string, ns: Namespace): Promise<ApiResult>;
}

/** Error without secrets: the text never contains secret, token or headers, and no cause is attached. */
export class BlizzardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlizzardError";
  }
}

const TOKEN_URL = "https://oauth.battle.net/token";
const TOKEN_MARGIN_MS = 60_000;
/** Netlify aborts scheduled functions after 30 s; no single request may blow the budget. */
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
/** Blizzard allows 100 requests per second; stay well below that. */
const DEFAULT_MAX_REQUESTS_PER_SECOND = 80;

export function createBlizzardClient(opts: {
  clientId: string;
  clientSecret: string;
  region: string;
  locale: string;
  /** Game version in the namespace, e.g. `forever` for `profile-forever-eu`. */
  gameVersion?: string;
  fetch?: typeof fetch;
  now?: () => number;
  requestTimeoutMs?: number;
  maxRequestsPerSecond?: number;
}): BlizzardClient {
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  const host = `https://${opts.region}.api.blizzard.com`;
  let token: { value: string; expiresAt: number } | null = null;
  const timeoutMs = opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const spacingMs = 1000 / (opts.maxRequestsPerSecond ?? DEFAULT_MAX_REQUESTS_PER_SECOND);
  let nextSlot = 0;

  /** Spreads API requests evenly: each starts no earlier than spacingMs after the previous one. */
  async function waitForSlot(): Promise<void> {
    const t = Date.now();
    const start = Math.max(t, nextSlot);
    nextSlot = start + spacingMs;
    if (start > t) await new Promise((resolve) => setTimeout(resolve, start - t));
  }

  async function requestToken(): Promise<string> {
    const basic = Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString("base64");
    let res: Response;
    try {
      res = await doFetch(TOKEN_URL, {
        method: "POST",
        headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new BlizzardError("Token request failed: network error");
    }
    if (res.status !== 200) throw new BlizzardError(`Token request failed: HTTP ${res.status}`);
    const body = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
    if (!body?.access_token) throw new BlizzardError("Token request failed: no response with token");
    token = { value: body.access_token, expiresAt: now() + (body.expires_in ?? 0) * 1000 - TOKEN_MARGIN_MS };
    return token.value;
  }

  /** A token request in progress is shared by all waiting requests. */
  let pendingToken: Promise<string> | null = null;
  function fetchToken(): Promise<string> {
    pendingToken ??= requestToken().finally(() => {
      pendingToken = null;
    });
    return pendingToken;
  }

  async function currentToken(): Promise<string> {
    if (token && now() < token.expiresAt) return token.value;
    return fetchToken();
  }

  /** Renews after 401; if another request has already replaced the token, that one is used. */
  async function renewToken(rejected: string): Promise<string> {
    if (token && token.value !== rejected && now() < token.expiresAt) return token.value;
    return fetchToken();
  }

  function buildUrl(pathOrHref: string, ns: Namespace): { url: string; path: string } {
    const path = pathOrHref.startsWith("http") ? new URL(pathOrHref).pathname : pathOrHref.split("?")[0];
    const namespace = ns === "static-retail" ? `static-${opts.region}` : `${ns}-${opts.gameVersion ?? "forever"}-${opts.region}`;
    const query = new URLSearchParams({ namespace, locale: opts.locale });
    return { url: `${host}${path}?${query}`, path };
  }

  async function send(url: string, path: string, bearer: string): Promise<Response> {
    await waitForSlot();
    try {
      return await doFetch(url, { headers: { Authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new BlizzardError(`Request failed: ${path}`);
    }
  }

  return {
    async get(pathOrHref, ns) {
      const { url, path } = buildUrl(pathOrHref, ns);
      const used = await currentToken();
      let res = await send(url, path, used);
      if (res.status === 401) {
        res = await send(url, path, await renewToken(used));
      }
      const text = await res.text().catch(() => "");
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      return { status: res.status, data };
    },
  };
}
