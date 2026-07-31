import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'lotea.accessToken';
const REFRESH_TOKEN_KEY = 'lotea.refreshToken';

// expo-secure-store has no real web implementation (its web build is an
// empty object — every call throws "not a function") — fall back to
// AsyncStorage there, itself backed by localStorage on web. Native platforms
// keep the encrypted keychain/keystore via SecureStore, per ARCHITECTURE.md
// §9; this is a deliberate, platform-specific exception to "never
// AsyncStorage" — the web has no keychain equivalent to fall back to.
const isWeb = Platform.OS === 'web';

export async function getAccessToken(): Promise<string | null> {
  return isWeb ? AsyncStorage.getItem(ACCESS_TOKEN_KEY) : SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  }
}

export async function clearAccessToken(): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  }
}

export async function getRefreshToken(): Promise<string | null> {
  return isWeb ? AsyncStorage.getItem(REFRESH_TOKEN_KEY) : SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  }
}

export async function clearRefreshToken(): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

/** Clears both tokens together — every logout/refresh-failure path should use this, not the two functions separately, so neither is ever left stale on its own. */
export async function clearAuthTokens(): Promise<void> {
  await Promise.all([clearAccessToken(), clearRefreshToken()]);
}
