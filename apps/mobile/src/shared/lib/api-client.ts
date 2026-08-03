import { router } from 'expo-router';

import { env } from './env';
import { clearSession } from './session';
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './storage';

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`API request failed with status ${status} (${code})`);
    this.name = 'ApiError';
  }
}

/** These never trigger a refresh-and-retry — refresh itself 401ing means the refresh token is dead, and login/register are unauthenticated by definition. */
const AUTH_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

let refreshPromise: Promise<boolean> | null = null;

/**
 * The access token is short-lived (15min) and, until now, nothing ever
 * refreshed it — every session just started 401ing once it expired, with no
 * recovery short of a manual logout/login. `/auth/refresh` rotates the
 * refresh token server-side (the old one is revoked the moment a new pair is
 * issued — see auth.service.ts), so two concurrent 401s racing to refresh
 * with the same token would have the second one fail. This in-flight
 * promise makes every concurrent caller await the *same* refresh attempt
 * instead of firing their own.
 */
async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;
      try {
        const response = await fetch(`${env.EXPO_PUBLIC_API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return false;
        const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
        await Promise.all([setAccessToken(tokens.accessToken), setRefreshToken(tokens.refreshToken)]);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function rawRequest(path: string, init?: RequestInit, isRetry = false): Promise<Response> {
  const token = await getAccessToken();

  const response = await fetch(`${env.EXPO_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 401 && !isRetry && !AUTH_EXEMPT_PATHS.some((exempt) => path.startsWith(exempt))) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return rawRequest(path, init, true);
    }
    await clearSession();
    router.replace('/login');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, body?.error?.code ?? 'INTERNAL_ERROR');
  }

  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await rawRequest(path, init);
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/**
 * A handful of create endpoints (products, customers) respond 200 with
 * duplicate candidates instead of 201 with the created record — the status
 * code itself is the signal, so callers that need it use this instead of
 * `post`, which discards it.
 */
async function requestWithStatus<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const response = await rawRequest(path, init);
  const data = response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  return { status: response.status, data };
}

// Every feature's React Query hooks call through here — components never call
// fetch directly. See ARCHITECTURE.md §4.
export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  postWithStatus: <T>(path: string, body?: unknown) =>
    requestWithStatus<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
};
