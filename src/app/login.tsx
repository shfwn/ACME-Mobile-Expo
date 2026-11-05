import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useAuthStore } from '../store/auth.store';
import { router } from 'expo-router';
import { BrandColors, Colors } from '../constants/theme';
import { Lock, Mail, Fingerprint, ArrowRight, ShieldCheck } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { loginWithCredentials, loginWithBiometrics, biometricAvailable, isLoading } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Silakan isi email dan kata sandi');
      return;
    }

    setErrorMessage(null);
    const res = await loginWithCredentials({ email: email.trim(), password });

    if (res.success && res.user) {
      if (res.user.role === 'OWNER' || res.user.role === 'MILT') {
        router.replace('/(executive)/todos');
      } else {
        router.replace('/(team)/my-tasks');
      }
    } else {
      setErrorMessage(res.error || 'Email atau kata sandi tidak sesuai');
    }
  };

  const handleBiometricLogin = async () => {
    setErrorMessage(null);
    const success = await loginWithBiometrics();
    if (success) {
      const user = useAuthStore.getState().user;
      if (user?.role === 'OWNER' || user?.role === 'MILT') {
        router.replace('/(executive)/todos');
      } else {
        router.replace('/(team)/my-tasks');
      }
    } else {
      setErrorMessage('Autentikasi biometrik gagal atau sesi belum tersimpan');
    }
  };

  const fillQuickAccount = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword('password123');
    setErrorMessage(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>AC</Text>
          </View>
          <Text style={styles.title}>ACME Workspace</Text>
          <Text style={styles.subtitle}>Sistem Produktivitas & Penjadwalan Terpadu</Text>
        </View>

        {/* Card Form */}
        <View style={styles.card}>
          <Text style={styles.formTitle}>Masuk ke Akun Anda</Text>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Kerja</Text>
            <View style={styles.inputWrapper}>
              <Mail size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="nama@company.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Kata Sandi</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Masuk ke Workspace</Text>
                <ArrowRight size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* Biometric Quick Login */}
          {biometricAvailable && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              activeOpacity={0.7}
            >
              <Fingerprint size={20} color={BrandColors.primary} />
              <Text style={styles.biometricButtonText}>Masuk dengan Biometrik</Text>
            </TouchableOpacity>
          )}

          {/* Quick Account Fill (Dev Assist) */}
          <View style={styles.quickFillSection}>
            <View style={styles.quickFillDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Akun Demo Cepat</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.quickFillButtons}>
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => fillQuickAccount('owner@company.com')}
              >
                <Text style={styles.quickChipText}>👑 Owner</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => fillQuickAccount('siti@company.com')}
              >
                <Text style={styles.quickChipText}>⚡ Admin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => fillQuickAccount('andi@company.com')}
              >
                <Text style={styles.quickChipText}>💼 Member</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Security Footer */}
        <View style={styles.footer}>
          <ShieldCheck size={16} color="#64748B" />
          <Text style={styles.footerText}>Enkripsi SQLite Lokal & Neon Cloud Sync</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  primaryButton: {
    backgroundColor: BrandColors.primary,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.periwinkle,
    backgroundColor: '#F0F3FF',
    marginTop: 12,
  },
  biometricButtonText: {
    color: BrandColors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  quickFillSection: {
    marginTop: 24,
  },
  quickFillDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 11,
    color: '#94A3B8',
    paddingHorizontal: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  quickFillButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  quickChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 28,
  },
  footerText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
});
