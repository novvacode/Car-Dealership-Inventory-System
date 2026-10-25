import { describe, expect, it, vi } from "vitest";
import { mockApi } from "../test/utils";
import { ApiError, apiRequest, errorMessage, onUnauthorized } from "./client";

describe("errorMessage", () => {
  it("returns string details as-is", () => {
    expect(errorMessage({ detail: "Insufficient stock" }, 409)).toBe("Insufficient stock");
  });

  it("formats FastAPI validation errors with field names", () => {
    const body = {
      detail: [
        { loc: ["body", "price"], msg: "Input should be greater than 0" },
        { loc: ["body", "password"], msg: "Value error, Password must contain a number" },
      ],
    };
    expect(errorMessage(body, 422)).toBe("price: Input should be greater than 0; password: Password must contain a number");
  });

  it("falls back to a generic message for server errors without a body", () => {
    expect(errorMessage(null, 500)).toMatch(/server encountered an error/i);
  });
});

describe("apiRequest", () => {
  it("sends the stored token as a bearer header and JSON body", async () => {
    localStorage.setItem("apex.token", "abc123");
    const fetchMock = mockApi({ "POST /api/vehicles/1/purchase": () => ({ status: 200, body: { ok: true } }) });

    await apiRequest("/api/vehicles/1/purchase", { method: "POST", body: { quantity: 2 } });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc123");
    expect(init.body).toBe(JSON.stringify({ quantity: 2 }));
  });

  it("throws ApiError with the server message on failure", async () => {
    mockApi({ "GET /api/vehicles": () => ({ status: 403, body: { detail: "Administrator privileges required" } }) });
    await expect(apiRequest("/api/vehicles")).rejects.toEqual(new ApiError(403, "Administrator privileges required"));
  });

  it("notifies the unauthorized handler when a token is rejected", async () => {
    localStorage.setItem("apex.token", "expired");
    const handler = vi.fn();
    onUnauthorized(handler);
    mockApi({ "GET /api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }) });

    await expect(apiRequest("/api/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledOnce();
    onUnauthorized(null);
  });

  it("reports network failures clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiRequest("/api/vehicles")).rejects.toThrow(/unable to reach the server/i);
  });
});
