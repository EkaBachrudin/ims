import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { authApi } from "@/api/endpoints";
import { tokenStore } from "@/lib/auth-storage";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => tokenStore.getUser());

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    tokenStore.setTokens(result.accessToken, result.refreshToken);
    tokenStore.setUser(result.user);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStore.getRefresh();
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        // abaikan kegagalan logout server; tetap bersihkan lokal
      }
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: Boolean(user && tokenStore.getAccess()), login, logout }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
