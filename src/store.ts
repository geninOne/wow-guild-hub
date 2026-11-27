import { getStore } from "@netlify/blobs";

/** Key-value store for JSON. Netlify Blobs in production, RAM in tests. */
export interface JsonStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export function createMemoryStore(): JsonStore & { dump(): Record<string, unknown> } {
  const data = new Map<string, string>();
  return {
    async get<T>(key: string) {
      const raw = data.get(key);
      return raw === undefined ? null : (JSON.parse(raw) as T);
    },
    async set(key, value) {
      data.set(key, JSON.stringify(value));
    },
    async delete(key) {
      data.delete(key);
    },
    async list(prefix) {
      return [...data.keys()].filter((k) => k.startsWith(prefix));
    },
    dump() {
      return Object.fromEntries([...data].map(([k, v]) => [k, JSON.parse(v)]));
    },
  };
}

export function createNetlifyStore(name = "gilde"): JsonStore {
  const store = getStore({ name, consistency: "strong" });
  return {
    async get<T>(key: string) {
      return ((await store.get(key, { type: "json" })) ?? null) as T | null;
    },
    async set(key, value) {
      await store.setJSON(key, value);
    },
    async delete(key) {
      await store.delete(key);
    },
    async list(prefix) {
      const { blobs } = await store.list({ prefix });
      return blobs.map((b) => b.key);
    },
  };
}
