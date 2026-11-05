import { create } from 'zustand';
import { User, LoginCredentials, AuthResponse } from '../types/auth.types';
import { AuthStorage } from '../services/auth.storage';
import { ApiClient } from '../services/api.client';
import { BiometricService } from '../services/biometric.service';

interface AuthStoreState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isExecutiveMode: boolean;
  biometricAvailable: boolean;

  // Actions
  initialize: () => Promise<void>;
  loginWithCredentials: (credentials: LoginCredentials) => Promise<AuthResponse>;
  loginWithBiometrics: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  isExecutiveMode: false,
  biometricAvailable: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const token = await AuthStorage.getToken();
      const user = await AuthStorage.getUser<User>();
      const bioStatus = await BiometricService.checkAvailability();

      if (token && user) {
        const isExec = user.role === 'OWNER' || user.role === 'MILT';
        set({
          token,
          user,
          isAuthenticated: true,
          isExecutiveMode: isExec,
          biometricAvailable: bioStatus.hasHardware && bioStatus.isEnrolled,
          isLoading: false,
        });

        // Verifikasi token di latar belakang
        ApiClient.getMe()
          .then((res) => {
            if (res.success && res.user) {
              const exec = res.user.role === 'OWNER' || res.user.role === 'MILT';
              set({ user: res.user, isExecutiveMode: exec });
            }
          })
          .catch(() => {
            // Tetap gunakan cached user jika offline
          });
      } else {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isExecutiveMode: false,
          biometricAvailable: bioStatus.hasHardware && bioStatus.isEnrolled,
          isLoading: false,
        });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  loginWithCredentials: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      const res = await ApiClient.login(credentials);
      if (res.success && res.token && res.user) {
        const isExec = res.user.role === 'OWNER' || res.user.role === 'MILT';
        set({
          token: res.token,
          user: res.user,
          isAuthenticated: true,
          isExecutiveMode: isExec,
          isLoading: false,
        });
        return res;
      }

      set({ isLoading: false });
      return { success: false, error: res.error || 'Login gagal' };
    } catch (err: unknown) {
      set({ isLoading: false });
      const error = err instanceof Error ? err.message : 'Terjadi kesalahan jaringan';
      return { success: false, error };
    }
  },

  loginWithBiometrics: async (): Promise<boolean> => {
    const { token, user } = get();
    // Jika sudah ada sesi token tersimpan, izinkan unlock biometrik
    const storedToken = token || (await AuthStorage.getToken());
    const storedUser = user || (await AuthStorage.getUser<User>());

    if (!storedToken || !storedUser) {
      return false;
    }

    const bioAuth = await BiometricService.authenticate('Buka ACME Workspace');
    if (bioAuth.success) {
      const isExec = storedUser.role === 'OWNER' || storedUser.role === 'MILT';
      set({
        token: storedToken,
        user: storedUser,
        isAuthenticated: true,
        isExecutiveMode: isExec,
      });
      return true;
    }

    return false;
  },

  logout: async () => {
    set({ isLoading: true });
    await ApiClient.logout();
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isExecutiveMode: false,
      isLoading: false,
    });
  },
}));
