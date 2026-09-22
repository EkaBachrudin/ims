import axios, { AxiosError } from "axios";
import { tokenStore } from "@/lib/auth-storage";
import type { ApiError } from "@/types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api",
});

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refresh });
    const access = data.data.accessToken as string;
    tokenStore.setAccess(access);
    if (data.data.refreshToken) tokenStore.setTokens(access, data.data.refreshToken);
    return access;
  } catch {
    tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && config && !config._retry) {
      config._retry = true;
      refreshing = refreshing ?? refreshAccessToken();
      const access = await refreshing;
      refreshing = null;
      if (access) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${access}`;
        return api(config);
      }
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiError | undefined;
    if (data?.error?.message) return data.error.message;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan";
}
