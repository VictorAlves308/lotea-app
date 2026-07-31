import { useMutation } from '@tanstack/react-query';

import { setAccessToken, setRefreshToken } from '../../../shared/lib/storage';
import { login } from '../api';

/** Logs in and persists both tokens — the refresh token is what lets api-client.ts silently renew the (short-lived) access token instead of forcing a re-login every 15 minutes. */
export function useLogin() {
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const result = await login(input);
      await Promise.all([setAccessToken(result.tokens.accessToken), setRefreshToken(result.tokens.refreshToken)]);
      return result;
    },
  });
}
