import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { syncEngine, SyncStatusState } from '../services/sync.engine';
import { BrandColors } from '../constants/theme';
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react-native';
import NetInfo from '@react-native-community/netinfo';

export const SyncIndicator: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncStatusState>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  });
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // 1. Subscribe ke NetInfo
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    });

    // 2. Subscribe ke SyncEngine status
    const unsubscribeSync = syncEngine.subscribe(setSyncState);

    return () => {
      unsubscribeNet();
      unsubscribeSync();
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || syncState.isSyncing) return;
    await syncEngine.syncAll();
  };

  if (!isOnline) {
    return (
      <View style={[styles.pill, styles.pillOffline]}>
        <CloudOff size={13} color="#D97706" />
        <Text style={[styles.pillText, styles.pillTextOffline]}>
          Offline {syncState.pendingCount > 0 ? `(${syncState.pendingCount})` : ''}
        </Text>
      </View>
    );
  }

  if (syncState.isSyncing) {
    return (
      <View style={[styles.pill, styles.pillSyncing]}>
        <ActivityIndicator size={12} color={BrandColors.primary} />
        <Text style={[styles.pillText, styles.pillTextSyncing]}>Sinkronisasi...</Text>
      </View>
    );
  }

  if (syncState.pendingCount > 0) {
    return (
      <TouchableOpacity
        style={[styles.pill, styles.pillPending]}
        onPress={handleManualSync}
        activeOpacity={0.7}
      >
        <RefreshCw size={12} color={BrandColors.primary} />
        <Text style={[styles.pillText, styles.pillTextPending]}>
          {syncState.pendingCount} Belum Sinkron
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.pill, styles.pillSynced]}
      onPress={handleManualSync}
      activeOpacity={0.8}
    >
      <CheckCircle2 size={12} color="#10B981" />
      <Text style={[styles.pillText, styles.pillTextSynced]}>Tersinkron</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillOffline: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  pillTextOffline: {
    color: '#92400E',
  },
  pillSyncing: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  pillTextSyncing: {
    color: BrandColors.primary,
  },
  pillPending: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  pillTextPending: {
    color: '#0369A1',
  },
  pillSynced: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  pillTextSynced: {
    color: '#047857',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
