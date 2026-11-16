import { create } from 'zustand';
import { LoginCredentials, Role, User } from '../types/auth.types';
import { SessionStorage } from '../services/auth.storage';
import { BiometricService } from '../services/biometric.service';
import { accountRepository } from '../db/account.repository';

export interface AuthStoreState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isExecutiveMode: boolean;
  biometricAvailable: boolean;

  initialize: () => Promise<void>;
  loginWithCredentials: (credentials: LoginCredentials) => Promise<
    { success: true; user: User } | { success: false; error: string }
  >;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role?: Role;
  }) => Promise<{ success: true; user: User } | { success: false; error: string }>;
  loginWithBiometrics: () => Promise<boolean>;
  logout: () => Promise<void>;
}

function isExecutiveRole(role: Role): boolean {
  return role === 'OWNER' || role === 'MILT';
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isExecutiveMode: false,
  biometricAvailable: false,

  /**
   * Pulihkan sesi dari SQLite. Role dibaca ulang dari tabel users, jadi
   * perubahan role berlaku tanpa perlu login ulang. Tidak ada panggilan jaringan.
   */
  initialize: async () => {
    set({ isLoading: true });
    try {
      const bioStatus = await BiometricService.checkAvailability();
      const biometricAvailable = bioStatus.hasHardware && bioStatus.isEnrolled;

      const savedUserId = await SessionStorage.getUserId();
      if (!savedUserId) {
        set({ user: null, isAuthenticated: false, isExecutiveMode: false, isLoading: false, biometricAvailable });
        return;
      }

      const user = await accountRepository.getUserById(savedUserId);
      if (!user) {
        await SessionStorage.clear();
        set({ user: null, isAuthenticated: false, isExecutiveMode: false, isLoading: false, biometricAvailable });
        return;
      }

      set({
        user,
        isAuthenticated: true,
        isExecutiveMode: isExecutiveRole(user.role),
        isLoading: false,
        biometricAvailable,
      });
    } catch (e) {
      console.warn('Gagal memulihkan sesi:', e);
      set({ isLoading: false });
    }
  },

  loginWithCredentials: async (credentials) => {
    set({ isLoading: true });
    try {
      const outcome = await accountRepository.login(credentials.email, credentials.password);
      if (!outcome.success) {
        set({ isLoading: false });
        return outcome;
      }

      await SessionStorage.saveUserId(outcome.user.id);
      set({
        user: outcome.user,
        isAuthenticated: true,
        isExecutiveMode: isExecutiveRole(outcome.user.role),
        isLoading: false,
      });
      return outcome;
    } catch (e) {
      set({ isLoading: false });
      const message = e instanceof Error ? e.message : 'Gagal membaca basis data lokal';
      return { success: false, error: message };
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const outcome = await accountRepository.register(data);
      if (!outcome.success) {
        set({ isLoading: false });
        return outcome;
      }

      await SessionStorage.saveUserId(outcome.user.id);
      set({
        user: outcome.user,
        isAuthenticated: true,
        isExecutiveMode: isExecutiveRole(outcome.user.role),
        isLoading: false,
      });
      return outcome;
    } catch (e) {
      set({ isLoading: false });
      const message = e instanceof Error ? e.message : 'Gagal menyimpan akun baru';
      return { success: false, error: message };
    }
  },

  loginWithBiometrics: async () => {
    const savedUserId = await SessionStorage.getUserId();
    if (!savedUserId) return false;

    const bioAuth = await BiometricService.authenticate('Buka ACME Workspace');
    if (!bioAuth.success) return false;

    const user = await accountRepository.getUserById(savedUserId);
    if (!user) return false;

    set({
      user,
      isAuthenticated: true,
      isExecutiveMode: isExecutiveRole(user.role),
    });
    return true;
  },

  logout: async () => {
    await SessionStorage.clear();
    set({
      user: null,
      isAuthenticated: false,
      isExecutiveMode: false,
      isLoading: false,
    });
  },
}));
