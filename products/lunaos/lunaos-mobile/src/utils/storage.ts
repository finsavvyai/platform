/**
 * Secure token storage using expo-secure-store.
 * Falls back to in-memory store for web.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'lunaos_auth_token';
const memoryStore = new Map<string, string>();

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return memoryStore.get(TOKEN_KEY) ?? null;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    memoryStore.set(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  if (Platform.OS === 'web') {
    memoryStore.delete(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
