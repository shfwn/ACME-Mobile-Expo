import { Platform } from 'react-native';

const TOKEN_KEY = 'acme_auth_token';
const USER_KEY = 'acme_auth_user';

// In-memory fallback for Node/SSR/Testing environments
const memoryStore = new Map<string, string>();

async function getNativeSecureStore() {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    // Platform-specific: expo-secure-store native Turbomodule exists exclusively on iOS and Android
    return await import('expo-secure-store');
  }
  return null;
}

export const AuthStorage = {
  async saveToken(token: string): Promise<void> {
    try {
      const secureStore = await getNativeSecureStore();
      if (secureStore) {
        await secureStore.setItemAsync(TOKEN_KEY, token);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        memoryStore.set(TOKEN_KEY, token);
      }
    } catch (e) {
      console.warn('Failed to save auth token:', e);
      memoryStore.set(TOKEN_KEY, token);
    }
  },

  async getToken(): Promise<string | null> {
    try {
      const secureStore = await getNativeSecureStore();
      if (secureStore) {
        return await secureStore.getItemAsync(TOKEN_KEY);
      } else if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(TOKEN_KEY);
      } else {
        return memoryStore.get(TOKEN_KEY) ?? null;
      }
    } catch (e) {
      console.warn('Failed to get auth token:', e);
      return memoryStore.get(TOKEN_KEY) ?? null;
    }
  },

  async removeToken(): Promise<void> {
    try {
      const secureStore = await getNativeSecureStore();
      if (secureStore) {
        await secureStore.deleteItemAsync(TOKEN_KEY);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
      }
      memoryStore.delete(TOKEN_KEY);
    } catch (e) {
      console.warn('Failed to remove auth token:', e);
      memoryStore.delete(TOKEN_KEY);
    }
  },

  async saveUser(user: object): Promise<void> {
    const data = JSON.stringify(user);
    try {
      const secureStore = await getNativeSecureStore();
      if (secureStore) {
        await secureStore.setItemAsync(USER_KEY, data);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(USER_KEY, data);
      } else {
        memoryStore.set(USER_KEY, data);
      }
    } catch (e) {
      console.warn('Failed to save user cache:', e);
      memoryStore.set(USER_KEY, data);
    }
  },

  async getUser<T>(): Promise<T | null> {
    try {
      let data: string | null = null;
      const secureStore = await getNativeSecureStore();
      if (secureStore) {
        data = await secureStore.getItemAsync(USER_KEY);
      } else if (typeof localStorage !== 'undefined') {
        data = localStorage.getItem(USER_KEY);
      } else {
        data = memoryStore.get(USER_KEY) ?? null;
      }
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async clearAll(): Promise<void> {
    await this.removeToken();
    try {
      const secureStore = await getNativeSecureStore();
      if (secureStore) {
        await secureStore.deleteItemAsync(USER_KEY);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      console.warn('Failed to clear user cache:', e);
    }
    memoryStore.delete(USER_KEY);
  },
};
