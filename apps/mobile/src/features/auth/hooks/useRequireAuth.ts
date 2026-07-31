import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { getAccessToken } from '../../../shared/lib/storage';

/** Redirects to /login if there's no stored token; every authenticated screen starts with this. */
export function useRequireAuth(): { checkingAuth: boolean } {
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    getAccessToken().then((token) => {
      if (!token) {
        router.replace('/login');
        return;
      }
      setCheckingAuth(false);
    });
  }, []);

  return { checkingAuth };
}
