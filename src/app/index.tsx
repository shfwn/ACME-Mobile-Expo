import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/auth.store';
import { router } from 'expo-router';
import { BrandColors } from '../constants/theme';

export default function IndexDispatcherScreen() {
  const { isLoading, isAuthenticated, isExecutiveMode, user } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace('/login');
    } else if (isExecutiveMode) {
      router.replace('/(executive)/todos');
    } else {
      router.replace('/(team)/my-tasks');
    }
  }, [isLoading, isAuthenticated, isExecutiveMode, user]);

  return (
    <View style={styles.splashContainer}>
      <View style={styles.logoBadge}>
        <Text style={styles.logoText}>AC</Text>
      </View>
      <Text style={styles.appName}>ACME Workspace</Text>
      <ActivityIndicator size="small" color={BrandColors.primary} style={styles.spinner} />
      <Text style={styles.statusText}>Memuat sesi pengguna...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  spinner: {
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
