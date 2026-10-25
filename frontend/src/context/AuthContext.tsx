import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi } from "../api/auth";
import { onUnauthorized, tokenStore } from "../api/client";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  /** True while a stored token is being validated on first load. */
  initialising: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { email: string; full_name: string; password: string }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialising, setInitialising] = useState(() => tokenStore.get() !== null);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
    return () => onUnauthorized(null);
  }, [logout]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setInitialising(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, user } = await authApi.login(email, password);
    tokenStore.set(access_token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(
    async (data: { email: string; full_name: string; password: string }) => {
      await authApi.register(data);
      return login(data.email, data.password);
    },
    [login],
  );

  const value = useMemo(
    () => ({ user, initialising, login, register, logout }),
    [user, initialising, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
