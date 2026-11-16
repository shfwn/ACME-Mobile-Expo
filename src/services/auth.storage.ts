import { Platform } from 'react-native';

/**
 * Sesi lokal: yang disimpan hanya id pengguna.
 *
 * Tidak ada token, karena tidak ada server yang perlu diautentikasi. Otorisasi
 * ditegakkan oleh repo lokal saat memuat data, dan role dibaca ulang dari
 * tabel `users` setiap kali aplikasi dibuka — bukan dari salinan yang bisa busuk.
 */
const SESSION_KEY = 'acme_session_user_id';

const memoryStore = new Map<string, string>();

async function getNativeSecureStore() {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    // expo-secure-store adalah TurboModule native, hanya ada di iOS/Android.
    return await import('expo-secure-store');
  }
  return null;
}

async function readKey(): Promise<string | null> {
  try {
    const secureStore = await getNativeSecureStore();
    if (secureStore) return await secureStore.getItemAsync(SESSION_KEY);
    if (typeof localStorage !== 'undefined') return localStorage.getItem(SESSION_KEY);
    return memoryStore.get(SESSION_KEY) ?? null;
  } catch (e) {
    console.warn('Gagal membaca sesi tersimpan:', e);
    return memoryStore.get(SESSION_KEY) ?? null;
  }
}

async function writeKey(value: string): Promise<void> {
  try {
    const secureStore = await getNativeSecureStore();
    if (secureStore) {
      await secureStore.setItemAsync(SESSION_KEY, value);
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_KEY, value);
    } else {
      memoryStore.set(SESSION_KEY, value);
    }
  } catch (e) {
    console.warn('Gagal menyimpan sesi:', e);
    memoryStore.set(SESSION_KEY, value);
  }
}

async function deleteKey(): Promise<void> {
  try {
    const secureStore = await getNativeSecureStore();
    if (secureStore) {
      await secureStore.deleteItemAsync(SESSION_KEY);
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch (e) {
    console.warn('Gagal menghapus sesi:', e);
  }
  memoryStore.delete(SESSION_KEY);
}

export const SessionStorage = {
  saveUserId(userId: string): Promise<void> {
    return writeKey(userId);
  },

  getUserId(): Promise<string | null> {
    return readKey();
  },

  clear(): Promise<void> {
    return deleteKey();
  },
};
