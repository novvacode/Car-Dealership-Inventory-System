import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import type { User, Vehicle } from "../types";

export const customer: User = { id: 1, email: "casey@example.com", full_name: "Casey Customer", role: "customer" };
export const admin: User = { id: 2, email: "admin@example.com", full_name: "Ada Admin", role: "admin" };

export function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    make: "Toyota",
    model: "Camry",
    category: "Sedan",
    price: 27500,
    quantity: 5,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

type Handler = (init: RequestInit, url: URL) => { status: number; body?: unknown };

/**
 * Stub global fetch with handlers keyed by "METHOD /path". Unmatched requests
 * fail the test loudly. Returns the mock so tests can inspect calls.
 */
export function mockApi(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost");
    const key = `${init.method ?? "GET"} ${url.pathname}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    const { status, body } = handler(init, url);
    return new Response(status === 204 ? null : JSON.stringify(body ?? {}), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Render inside router + providers. Pass `user` to start signed in (token in storage + /me handler). */
export function renderApp(ui: ReactElement, { route = "/" }: { route?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <AuthProvider>{ui}</AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

export function signIn(user: User) {
  localStorage.setItem("apex.token", "test-token");
  return { "GET /api/auth/me": () => ({ status: 200, body: user }) };
}
