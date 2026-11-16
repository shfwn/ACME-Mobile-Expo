import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/auth.store';
import { NotificationService } from '../services/notification.service';
import { accountRepository } from '../db/account.repository';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, StyleSheet } from 'react-native';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    // Bootstrap SQLite lebih dulu: skema, workspace/proyek dasar, lalu akun
    // bawaan bila tabel users benar-benar kosong. Semua lokal, tanpa jaringan.
    accountRepository
      .ensureBootstrap()
      .then(() => accountRepository.seedAccountsIfEmpty())
      .catch((e) => console.warn('Bootstrap basis data gagal:', e))
      .finally(() => initialize());

    NotificationService.initialize().catch((e) => {
      console.warn('Inisialisasi notifikasi gagal:', e);
    });
  }, [initialize]);

  // Jadwal pengingat diturunkan ulang dari data lokal setiap app dibuka kembali.
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    NotificationService.refreshForUser(userId).catch((e) => {
      console.warn('Gagal menyusun ulang pengingat:', e);
    });

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        NotificationService.refreshForUser(userId).catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, userId]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(executive)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(team)" options={{ gestureEnabled: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
