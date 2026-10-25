import type { TokenResponse, User } from "../types";
import { apiRequest } from "./client";

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<TokenResponse>("/api/auth/login", { method: "POST", body: { email, password } }),

  register: (data: { email: string; full_name: string; password: string }) =>
    apiRequest<User>("/api/auth/register", { method: "POST", body: data }),

  me: () => apiRequest<User>("/api/auth/me"),
};
