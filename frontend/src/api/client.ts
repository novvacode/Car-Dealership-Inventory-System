const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const TOKEN_KEY = "apex.token";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Called whenever an authenticated request is rejected with 401 (e.g. expired token). */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage unavailable (private mode): the session simply won't persist.
    }
  },
};

interface ValidationIssue {
  loc?: (string | number)[];
  msg?: string;
}

/** Turn FastAPI error bodies ({detail: string} or {detail: ValidationIssue[]}) into readable text. */
export function errorMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return (detail as ValidationIssue[])
      .map((issue) => {
        const field = issue.loc?.filter((part) => part !== "body" && part !== "query").join(".");
        const msg = (issue.msg ?? "Invalid value").replace(/^Value error, /, "");
        return field ? `${field}: ${msg}` : msg;
      })
      .join("; ");
  }
  if (status >= 500) return "The server encountered an error. Please try again.";
  return `Request failed (${status})`;
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

export async function apiRequest<T>(
  path: string,
  { method = "GET", body, query }: { method?: Method; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : "";

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}${qs}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Unable to reach the server. Check your connection and that the API is running.");
  }

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler?.();
    throw new ApiError(response.status, errorMessage(data, response.status));
  }
  return data as T;
}
