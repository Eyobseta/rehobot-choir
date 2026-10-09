import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'rehobot.accessToken';
const REFRESH_TOKEN_KEY = 'rehobot.refreshToken';

/**
 * Secure storage for auth tokens.
 * Uses expo-secure-store (Keychain on iOS, Keystore on Android).
 * Never store tokens in AsyncStorage.
 */

export async function saveAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await Promise.all([
    saveAccessToken(accessToken),
    saveRefreshToken(refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}