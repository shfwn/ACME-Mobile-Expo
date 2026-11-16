import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { useFocusEffect } from 'expo-router';
import { teamRepository } from '../../db/team.repository';
import { NotificationItem } from '../../types/team.types';
import { BrandColors } from '../../constants/theme';
import { Bell, CheckCheck, Inbox } from 'lucide-react-native';

/** Filter daftar notifikasi berdasarkan tab aktif. */
export function filterNotifications<T extends { isRead: boolean }>(
  items: T[],
  tab: 'all' | 'unread'
): T[] {
  return tab === 'unread' ? items.filter((n) => !n.isRead) : items;
}

export default function TeamNotificationsScreen() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await teamRepository.getNotifications(userId);
      setNotifications(data);
    } catch (e) {
      console.warn('Gagal memuat notifikasi:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const filteredList = useMemo(
    () => filterNotifications(notifications, filterTab),
    [notifications, filterTab]
  );

  const handleMarkAsRead = async (id: string) => {
    // Tandai terbaca, lalu buka tautan bila notifikasi membawa linkUrl.
    await teamRepository.markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    const tapped = notifications.find((n) => n.id === id);
    if (tapped?.linkUrl) {
      try {
        await Linking.openURL(tapped.linkUrl);
      } catch {
        Alert.alert('Gagal', 'Tautan notifikasi tidak dapat dibuka.');
      }
    }
  };

  const handleMarkAllRead = async () => {
    await teamRepository.markAllNotificationsAsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <View style={styles.container}>
      {/* Header Summary */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Notifikasi</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount} Baru</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={handleMarkAllRead}
            activeOpacity={0.7}
          >
            <CheckCheck size={14} color={BrandColors.primary} />
            <Text style={styles.markAllBtnText}>Tandai Semua Dibaca</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.tabChip, filterTab === 'all' && styles.tabChipActive]}
          onPress={() => setFilterTab('all')}
        >
          <Text style={[styles.tabChipText, filterTab === 'all' && styles.tabChipTextActive]}>
            Semua ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabChip, filterTab === 'unread' && styles.tabChipActive]}
          onPress={() => setFilterTab('unread')}
        >
          <Text style={[styles.tabChipText, filterTab === 'unread' && styles.tabChipTextActive]}>
            Belum Dibaca ({filteredList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      ) : filteredList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Inbox size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Kotak Masuk Kosong</Text>
          <Text style={styles.emptySubtitle}>
            {filterTab === 'unread'
              ? 'Seluruh notifikasi telah Anda baca.'
              : 'Belum ada aktivitas atau pemberitahuan baru.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            return (
              <TouchableOpacity
                style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
                onPress={() => handleMarkAsRead(item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardRow}>
                  {/* Icon */}
                  <View style={[styles.iconCircle, !item.isRead && styles.iconCircleUnread]}>
                    <Bell size={16} color={!item.isRead ? BrandColors.primary : '#64748B'} />
                  </View>

                  {/* Body */}
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleUnread]}>
                        {item.title}
                      </Text>
                      <Text style={styles.cardTime}>
                        {new Date(item.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    <Text style={styles.cardMessage}>{item.message}</Text>
                  </View>

                  {/* Unread Dot */}
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  unreadBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: BrandColors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  tabChipActive: {
    backgroundColor: BrandColors.primary,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 8,
  },
  notificationCardUnread: {
    backgroundColor: '#F0F3FF',
    borderColor: BrandColors.periwinkle,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  iconCircleUnread: {
    backgroundColor: '#FFFFFF',
  },
  cardBody: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  cardTitleUnread: {
    fontWeight: '800',
  },
  cardTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardMessage: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.primary,
    marginTop: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
