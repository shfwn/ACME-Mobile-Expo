import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Users2, AlertTriangle, Gauge, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useAuthStore } from '../../store/auth.store';
import { teamRepository } from '../../db/team.repository';
import { useResponsiveLayout } from '../../utils/layout';
import { calculateWorkload, WorkloadMember, WorkloadStatus } from '../../db/workload';
import { BrandColors } from '../../constants/theme';
import { TaskDetailModal } from '../../components/task-detail-modal';
import type { TaskItem } from '../../types/team.types';

const STATUS_META: Record<WorkloadStatus, { label: string; color: string; bg: string; bar: string }> = {
  LIGHT: { label: 'Kapasitas Luang', color: '#1D4ED8', bg: '#EFF6FF', bar: '#3B82F6' },
  OPTIMAL: { label: 'Beban Optimal', color: '#047857', bg: '#ECFDF5', bar: '#10B981' },
  OVERLOAD: { label: 'Kelebihan Beban', color: '#BE123C', bg: '#FFF1F2', bar: '#F43F5E' },
};

export default function TeamWorkloadScreen() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const [members, setMembers] = useState<WorkloadMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTaskDetail, setActiveTaskDetail] = useState<TaskItem | null>(null);
  const layout = useResponsiveLayout();

  const loadWorkload = useCallback(async () => {
    try {
      const [tasks, memberList] = await Promise.all([
        teamRepository.getWorkloadTasks(),
        teamRepository.getWorkloadMembers({
          id: userId,
          name: user?.name ?? 'Anggota',
          weeklyCapacityHours: user?.weeklyCapacityHours,
        }),
      ]);
      setMembers(calculateWorkload(tasks, memberList));
    } catch (e) {
      console.warn('Gagal memuat beban kerja:', e);
      setMembers([]);
    }
  }, [userId, user]);

  useEffect(() => {
    let active = true;
    (async () => {
      await loadWorkload();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadWorkload]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Semua data berasal dari SQLite lokal; refresh cukup membaca ulang tabel.
    await loadWorkload();
    setIsRefreshing(false);
  }, [loadWorkload]);

  const summary = useMemo(() => {
    const overload = members.filter((m) => m.status === 'OVERLOAD').length;
    const totalHours = members.reduce((sum, m) => sum + m.totalHours, 0);
    return { overload, totalHours, count: members.length };
  }, [members]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text style={styles.loadingText}>Menghitung beban kerja...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { padding: layout.gutter, paddingBottom: 32 }]}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={BrandColors.primary} />}
    >
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Users2 size={20} color={BrandColors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Peta Kapasitas Tim</Text>
          <Text style={styles.bannerSubtitle}>
            Distribusi jam kerja dari tugas aktif. Tarik ke bawah untuk memuat ulang.
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Gauge size={16} color={BrandColors.primary} />
          <Text style={styles.statValue}>{summary.totalHours} jam</Text>
          <Text style={styles.statLabel}>Total beban aktif</Text>
        </View>
        <View style={styles.statCard}>
          <AlertTriangle size={16} color={summary.overload > 0 ? BrandColors.danger : '#94A3B8'} />
          <Text style={styles.statValue}>{summary.overload}</Text>
          <Text style={styles.statLabel}>Anggota overload</Text>
        </View>
        <View style={styles.statCard}>
          <Users2 size={16} color={'#64748B'} />
          <Text style={styles.statValue}>{summary.count}</Text>
          <Text style={styles.statLabel}>Anggota</Text>
        </View>
      </View>

      {members.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Belum ada data beban kerja</Text>
          <Text style={styles.emptyText}>
            Beban kerja dihitung dari tugas aktif di perangkat ini. Buat tugas di papan proyek lebih dulu.
          </Text>
        </View>
      ) : (
        <View style={[styles.cardGrid, layout.columns > 1 && styles.cardGridWide]}>
        {members.map((member) => {
          const meta = STATUS_META[member.status];
          const isExpanded = expandedId === member.userId;
          const barWidth = Math.min(member.percentage, 100);

          return (
            <View
              key={member.userId}
              style={[
                styles.card,
                // Tablet: kartu berbagi baris agar tidak jadi kolom panjang.
                layout.columns > 1 ? { flexBasis: `${100 / layout.columns}%`, maxWidth: `${100 / layout.columns}%` } : null,
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setExpandedId(isExpanded ? null : member.userId)}
                style={styles.cardHeader}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{member.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.name}
                    {member.userId === userId ? ' (Anda)' : ''}
                  </Text>
                  <Text style={styles.memberMeta}>
                    {member.tasks.length} tugas aktif • {member.totalHours} / {member.capacity} jam
                  </Text>
                </View>
                <Text style={[styles.percent, { color: meta.color }]}>{member.percentage}%</Text>
                {isExpanded ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
              </TouchableOpacity>

              <View style={styles.track}>
                <View style={[styles.bar, { width: `${barWidth}%`, backgroundColor: meta.bar }]} />
              </View>

              <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                {member.status === 'OVERLOAD' && <AlertTriangle size={11} color={meta.color} />}
                <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
              </View>

              {isExpanded && (
                <View style={styles.taskList}>
                  {member.tasks.length === 0 ? (
                    <Text style={styles.taskEmpty}>Tidak ada tugas aktif</Text>
                  ) : (
                    member.tasks.map((task) => (
                      <TouchableOpacity
                        key={task.id}
                        style={styles.taskRow}
                        activeOpacity={0.7}
                        onPress={() => setActiveTaskDetail(task)}
                        accessibilityLabel={`Buka tugas ${task.title}`}
                      >
                        <View style={styles.taskDot} />
                        <Text style={styles.taskTitle} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <Text style={styles.taskHours}>{task.estimatedHours}j</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}
        </View>
      )}

      <TaskDetailModal
        visible={!!activeTaskDetail}
        task={activeTaskDetail}
        statuses={activeTaskDetail?.status ? [activeTaskDetail.status] : []}
        currentUserId={userId}
        onClose={() => setActiveTaskDetail(null)}
        onTaskUpdated={() => {
          loadWorkload();
          if (activeTaskDetail) {
            teamRepository.getWorkloadTasks().then((all) => {
              const refreshed = all.find((t) => t.id === activeTaskDetail.id);
              setActiveTaskDetail(refreshed ?? null);
            });
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', gap: 10 },
  loadingText: { fontSize: 13, color: '#64748B' },
  banner: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.periwinkleBg,
  },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  bannerSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 10.5, color: '#64748B' },
  cardGrid: {
    gap: 12,
  },
  cardGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.periwinkleBg,
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: BrandColors.primary },
  memberName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  memberMeta: { fontSize: 11.5, color: '#64748B', marginTop: 1 },
  percent: { fontSize: 14, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  taskList: { gap: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' },
  taskTitle: { flex: 1, fontSize: 12, color: '#334155' },
  taskHours: { fontSize: 11.5, fontWeight: '700', color: '#64748B' },
  taskEmpty: { fontSize: 12, color: '#94A3B8' },
  emptyCard: {
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  emptyText: { fontSize: 12.5, color: '#64748B', lineHeight: 18 },
});
