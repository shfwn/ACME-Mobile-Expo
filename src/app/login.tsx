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
import { BrandColors } from '../constants/theme';
import { Lock, Mail, User as UserIcon, Fingerprint, ArrowRight, ShieldCheck } from 'lucide-react-native';
import type { Role } from '../types/auth.types';

type Mode = 'login' | 'register';

const ROLE_OPTIONS: { role: Role; label: string }[] = [
  { role: 'OWNER', label: 'Owner' },
  { role: 'ADMIN', label: 'Admin' },
  { role: 'MEMBER', label: 'Member' },
  { role: 'VIEWER', label: 'Viewer' },
];

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [registerRole, setRegisterRole] = useState<Role>('MEMBER');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { loginWithCredentials, register, loginWithBiometrics, biometricAvailable, isLoading } =
    useAuthStore();

  const goToDashboard = () => {
    const user = useAuthStore.getState().user;
    if (user?.role === 'OWNER' || user?.role === 'MILT') {
      router.replace('/(executive)/todos');
    } else {
      router.replace('/(team)/my-tasks');
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Silakan isi email dan kata sandi');
      return;
    }

    setErrorMessage(null);
    const res = await loginWithCredentials({ email: email.trim(), password });
    if (res.success) {
      goToDashboard();
    } else {
      setErrorMessage(res.error);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage('Nama, email, dan kata sandi wajib diisi');
      return;
    }

    setErrorMessage(null);
    const res = await register({
      name: name.trim(),
      email: email.trim(),
      password,
      role: registerRole,
    });
    if (res.success) {
      goToDashboard();
    } else {
      setErrorMessage(res.error);
    }
  };

  const handleBiometricLogin = async () => {
    setErrorMessage(null);
    const success = await loginWithBiometrics();
    if (success) {
      goToDashboard();
    } else {
      setErrorMessage('Autentikasi biometrik gagal atau sesi belum tersimpan');
    }
  };

  const switchMode = () => {
    setErrorMessage(null);
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>AC</Text>
          </View>
          <Text style={styles.title}>ACME Workspace</Text>
          <Text style={styles.subtitle}>Sistem Produktivitas & Penjadwalan Terpadu</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.formTitle}>
            {mode === 'login' ? 'Masuk ke Akun Anda' : 'Buat Akun Baru'}
          </Text>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Lengkap</Text>
              <View style={styles.inputWrapper}>
                <UserIcon size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nama Anda"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>
          )}

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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Kata Sandi</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Minimal 8 karakter"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Peran</Text>
              <View style={styles.roleRow}>
                {ROLE_OPTIONS.map((option) => {
                  const active = registerRole === option.role;
                  return (
                    <TouchableOpacity
                      key={option.role}
                      style={[styles.roleChip, active && styles.roleChipActive]}
                      onPress={() => setRegisterRole(option.role)}
                    >
                      <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={mode === 'login' ? handleLogin : handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {mode === 'login' ? 'Masuk ke Workspace' : 'Daftar & Masuk'}
                </Text>
                <ArrowRight size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {mode === 'login' && biometricAvailable && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              activeOpacity={0.7}
            >
              <Fingerprint size={20} color={BrandColors.primary} />
              <Text style={styles.biometricButtonText}>Masuk dengan Biometrik</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.switchButton} onPress={switchMode}>
            <Text style={styles.switchText}>
              {mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <ShieldCheck size={16} color="#64748B" />
          <Text style={styles.footerText}>Seluruh data tersimpan di SQLite perangkat ini</Text>
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
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
  },
  roleChipActive: {
    borderColor: BrandColors.primary,
    backgroundColor: '#E8ECF9',
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  roleChipTextActive: {
    color: BrandColors.primary,
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
  switchButton: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 4,
  },
  switchText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: BrandColors.primary,
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
