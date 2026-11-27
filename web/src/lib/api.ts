import { useEffect, useState } from "react";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // No JSON in the error body, use the default message.
  }
  return `Anfrage fehlgeschlagen (${response.status})`;
}

export async function fetchJson<T>(path: string, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(path, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
  return (await response.json()) as T;
}

export interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

interface Loaded<T> {
  path: string;
  data: T | null;
  error: ApiError | null;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, error instanceof Error ? error.message : String(error));
}

/** Loads `path` as JSON. With `null` nothing is loaded. */
export function useApi<T>(path: string | null): ApiState<T> {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);

  useEffect(() => {
    if (path === null) return;
    let active = true;
    fetchJson<T>(path).then(
      (data) => {
        if (active) setLoaded({ path, data, error: null });
      },
      (error: unknown) => {
        if (active) setLoaded({ path, data: null, error: toApiError(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [path]);

  if (path === null) return { data: null, error: null, loading: false };
  if (loaded?.path !== path) return { data: null, error: null, loading: true };
  return { data: loaded.data, error: loaded.error, loading: false };
}
