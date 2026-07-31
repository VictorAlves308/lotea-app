import type { RegisterInput } from '@lotea/shared';
import { useMutation } from '@tanstack/react-query';

import { setAccessToken, setRefreshToken } from '../../../shared/lib/storage';
import { register } from '../api';

/** Mirrors useLogin: registering logs the account in immediately (same token handling). */
export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const result = await register(input);
      await Promise.all([setAccessToken(result.tokens.accessToken), setRefreshToken(result.tokens.refreshToken)]);
      return result;
    },
  });
}
