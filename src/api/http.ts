export type CacheKind = "live" | "static" | "none";

const HEADERS: Record<CacheKind, Record<string, string>> = {
  live: {
    "Cache-Control": "public, max-age=300",
    "Netlify-CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
  },
  static: {
    "Cache-Control": "public, max-age=3600",
    "Netlify-CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  },
  none: { "Cache-Control": "no-store" },
};

export function json(body: unknown, status: number, cache: CacheKind): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...HEADERS[cache] },
  });
}
