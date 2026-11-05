import { Platform } from 'react-native';

export interface BiometricStatus {
  hasHardware: boolean;
  isEnrolled: boolean;
  biometricTypes: number[];
}

async function getNativeLocalAuthentication() {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      // Platform-specific: expo-local-authentication native Turbomodule exists exclusively on iOS and Android
      return await import('expo-local-authentication');
    } catch {
      return null;
    }
  }
  return null;
}

export const BiometricService = {
  async checkAvailability(): Promise<BiometricStatus> {
    const LocalAuth = await getNativeLocalAuthentication();
    if (!LocalAuth) {
      return {
        hasHardware: false,
        isEnrolled: false,
        biometricTypes: [],
      };
    }

    try {
      const hasHardware = await LocalAuth.hasHardwareAsync();
      const isEnrolled = await LocalAuth.isEnrolledAsync();
      const biometricTypes = await LocalAuth.supportedAuthenticationTypesAsync();

      return {
        hasHardware,
        isEnrolled,
        biometricTypes,
      };
    } catch (e) {
      console.warn('Error checking biometric availability:', e);
      return {
        hasHardware: false,
        isEnrolled: false,
        biometricTypes: [],
      };
    }
  },

  async authenticate(
    promptMessage = 'Gunakan Face ID atau Sidik Jari untuk masuk'
  ): Promise<{ success: boolean; error?: string }> {
    const LocalAuth = await getNativeLocalAuthentication();
    if (!LocalAuth) {
      return { success: false, error: 'Biometrik tidak didukung di platform ini' };
    }

    try {
      const { hasHardware, isEnrolled } = await this.checkAvailability();
      if (!hasHardware || !isEnrolled) {
        return {
          success: false,
          error: 'Perangkat belum mengaktifkan kunci biometrik (Face ID / Sidik Jari)',
        };
      }

      const result = await LocalAuth.authenticateAsync({
        promptMessage,
        cancelLabel: 'Batal',
        fallbackLabel: 'Gunakan Kata Sandi',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: result.error || 'Autentikasi biometrik dibatalkan',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses autentikasi biometrik';
      return { success: false, error: msg };
    }
  },
};
