import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/auth.store';
import { syncEngine } from '../services/sync.engine';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Otomatis sinkronisasi saat perangkat terhubung kembali ke internet
  useEffect(() => {
    if (!isAuthenticated) return;

    let wasOffline = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected && !!state.isInternetReachable;
      if (wasOffline && isOnline) {
        console.log('Koneksi internet kembali aktif. Menjalankan auto-sync...');
        syncEngine.syncAll();
      }
      wasOffline = !isOnline;
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated]);

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
