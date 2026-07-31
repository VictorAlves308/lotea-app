import type { AuthTokens, CurrentUser, LoginInput, RegisterInput } from '@lotea/shared';

import { apiClient } from '../../shared/lib/api-client';

export interface LoginResponse {
  user: CurrentUser;
  tokens: AuthTokens;
}

export function login(input: LoginInput): Promise<LoginResponse> {
  return apiClient.post('/auth/login', input);
}

export function register(input: RegisterInput): Promise<LoginResponse> {
  return apiClient.post('/auth/register', input);
}

export function getMe(): Promise<CurrentUser> {
  return apiClient.get('/auth/me');
}

/** Revokes the refresh token server-side — best-effort; the caller clears local storage regardless. */
export function logout(refreshToken: string): Promise<void> {
  return apiClient.post('/auth/logout', { refreshToken });
}
