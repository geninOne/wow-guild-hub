/** `static-retail` ist der statische Namespace des normalen WoW, nur für Instanzbilder (Forever hat keine). */
export type Namespace = "profile" | "dynamic" | "static" | "static-retail";

export interface ApiResult {
  status: number;
  // Rohantworten der API sind bewusst untypisiert; die Aufbereitung prüft die Felder.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export interface BlizzardClient {
  get(pathOrHref: string, ns: Namespace): Promise<ApiResult>;
}

/** Fehler ohne Geheimnisse: Text enthält nie Secret, Token oder Header, und es wird keine Ursache angehängt. */
export class BlizzardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlizzardError";
  }
}

const TOKEN_URL = "https://oauth.battle.net/token";
const TOKEN_MARGIN_MS = 60_000;
/** Netlify bricht geplante Functions nach 30 s ab; keine einzelne Anfrage darf das Budget sprengen. */
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
/** Blizzard erlaubt 100 Anfragen pro Sekunde; mit Abstand darunter bleiben. */
const DEFAULT_MAX_REQUESTS_PER_SECOND = 80;

export function createBlizzardClient(opts: {
  clientId: string;
  clientSecret: string;
  region: string;
  locale: string;
  /** Spielversion im Namespace, z. B. `forever` für `profile-forever-eu`. */
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

  /** Verteilt API-Anfragen gleichmäßig: jede startet frühestens spacingMs nach der vorigen. */
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
      throw new BlizzardError("Token-Abruf fehlgeschlagen: Netzwerkfehler");
    }
    if (res.status !== 200) throw new BlizzardError(`Token-Abruf fehlgeschlagen: HTTP ${res.status}`);
    const body = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
    if (!body?.access_token) throw new BlizzardError("Token-Abruf fehlgeschlagen: keine Antwort mit Token");
    token = { value: body.access_token, expiresAt: now() + (body.expires_in ?? 0) * 1000 - TOKEN_MARGIN_MS };
    return token.value;
  }

  /** Ein laufender Token-Abruf wird von allen wartenden Anfragen geteilt. */
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

  /** Erneuert nach 401; hat eine andere Anfrage das Token schon ersetzt, wird dieses genutzt. */
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
      throw new BlizzardError(`Anfrage fehlgeschlagen: ${path}`);
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
