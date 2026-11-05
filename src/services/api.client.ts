import { AuthStorage } from './auth.storage';
import { AuthResponse, LoginCredentials, User } from '../types/auth.types';
import { Platform } from 'react-native';

// Default development base URL for Next.js backend:
// - Android Emulator: 10.0.2.2 points to host localhost
// - iOS Simulator / Web: localhost points to host
const DEFAULT_HOST = Platform.select({
  android: 'http://10.0.2.2:3000',
  default: 'http://localhost:3000',
});

let currentBaseUrl = process.env.EXPO_PUBLIC_API_URL || DEFAULT_HOST;

export const ApiClient = {
  getBaseUrl(): string {
    return currentBaseUrl;
  },

  setBaseUrl(url: string) {
    currentBaseUrl = url.replace(/\/+$/, '');
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await AuthStorage.getToken();
    const url = `${currentBaseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data?.error || `Request gagal dengan status ${res.status}`;
        throw new Error(errorMsg);
      }

      return data as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Koneksi jaringan bermasalah';
      throw new Error(message);
    }
  },

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/mobile/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (res.success && res.token && res.user) {
      await AuthStorage.saveToken(res.token);
      await AuthStorage.saveUser(res.user);
    }

    return res;
  },

  async getMe(): Promise<{ success: boolean; user: User }> {
    const res = await this.request<{ success: boolean; user: User }>('/api/mobile/auth/me', {
      method: 'GET',
    });

    if (res.success && res.user) {
      await AuthStorage.saveUser(res.user);
    }

    return res;
  },

  async logout(): Promise<void> {
    await AuthStorage.clearAll();
  },

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  },

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  },
};
