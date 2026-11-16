import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { useFocusEffect } from 'expo-router';
import { teamRepository } from '../../db/team.repository';
import { TaskItem, CustomStatus } from '../../types/team.types';
import { BrandColors } from '../../constants/theme';
import { TaskDetailModal } from '../../components/task-detail-modal';
import { CheckSquare, Calendar, Clock, Check, Inbox } from 'lucide-react-native';

export default function MyTasksScreen() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedPriorityFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTaskDetail, setActiveTaskDetail] = useState<TaskItem | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { statuses: defaultStatuses } = await teamRepository.ensureDefaultProject();
      setStatuses(defaultStatuses);

      const myTasks = await teamRepository.getMyTasks(userId);
      setTasks(myTasks);
    } catch (e) {
      console.warn('Gagal memuat tugas saya:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchStatus =
        selectedStatusFilter === 'all' || t.statusId === selectedStatusFilter;
      const matchPriority =
        selectedPriorityFilter === 'all' || t.priority === selectedPriorityFilter;
      return matchStatus && matchPriority;
    });
  }, [tasks, selectedStatusFilter, selectedPriorityFilter]);

  const handleQuickToggleDone = async (task: TaskItem) => {
    const doneStatus = statuses.find((s) => s.isDoneState);
    const todoStatus = statuses.find((s) => !s.isDoneState);

    const isCurrentlyDone = task.status?.isDoneState;
    const targetStatusId = isCurrentlyDone ? todoStatus?.id : doneStatus?.id;

    if (targetStatusId) {
      await teamRepository.updateTaskStatus(task.id, targetStatusId);
      loadData();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Statistics Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Tugas Saya</Text>
          <View style={styles.taskCountBadge}>
            <Text style={styles.taskCountBadgeText}>{tasks.length} Total</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          Daftar tugas yang ditugaskan kepada Anda di workspace tim
        </Text>
      </View>

      {/* Filter Status Pills */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterPill, selectedStatusFilter === 'all' && styles.filterPillActive]}
            onPress={() => setSelectedStatusFilter('all')}
          >
            <Text
              style={[
                styles.filterPillText,
                selectedStatusFilter === 'all' && styles.filterPillTextActive,
              ]}
            >
              Semua ({tasks.length})
            </Text>
          </TouchableOpacity>

          {statuses.map((s) => {
            const count = tasks.filter((t) => t.statusId === s.id).length;
            const isSelected = selectedStatusFilter === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.filterPill,
                  isSelected && { backgroundColor: s.color, borderColor: s.color },
                ]}
                onPress={() => setSelectedStatusFilter(s.id)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected && { color: '#FFFFFF', fontWeight: '800' },
                  ]}
                >
                  {s.name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Task List */}
      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      ) : filteredTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Inbox size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Tidak Ada Tugas</Text>
          <Text style={styles.emptySubtitle}>
            {selectedStatusFilter !== 'all'
              ? 'Tidak ada tugas yang cocok dengan filter status yang dipilih.'
              : 'Semua tugas Anda telah selesai dikerjakan!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isDone = item.status?.isDoneState;
            const priorityColor =
              item.priority === 'URGENT'
                ? BrandColors.urgent
                : item.priority === 'HIGH'
                ? BrandColors.high
                : item.priority === 'LOW'
                ? BrandColors.low
                : BrandColors.medium;

            const completedSubs = item.subtasks.filter((s) => s.isCompleted).length;
            const totalSubs = item.subtasks.length;

            return (
              <TouchableOpacity
                style={[styles.taskCard, isDone && styles.taskCardDone]}
                onPress={() => setActiveTaskDetail(item)}
                activeOpacity={0.8}
              >
                <View style={styles.cardMain}>
                  {/* Quick Toggle Checkbox */}
                  <TouchableOpacity
                    style={[styles.taskCheck, isDone && styles.taskCheckDone]}
                    onPress={() => handleQuickToggleDone(item)}
                  >
                    {isDone && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </TouchableOpacity>

                  {/* Task Info */}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.statusTag, { backgroundColor: item.status?.color + '22' }]}>
                        <Text style={[styles.statusTagText, { color: item.status?.color || '#64748B' }]}>
                          {item.status?.name || 'Status'}
                        </Text>
                      </View>

                      <View style={[styles.priorityTag, { backgroundColor: priorityColor + '18' }]}>
                        <Text style={[styles.priorityTagText, { color: priorityColor }]}>
                          {item.priority}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>
                      {item.title}
                    </Text>

                    {item.description ? (
                      <Text style={styles.taskDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}

                    {/* Metadata Badges */}
                    <View style={styles.cardFooter}>
                      {item.dueDate && (
                        <View style={styles.footerBadge}>
                          <Calendar size={11} color="#64748B" />
                          <Text style={styles.footerBadgeText}>{item.dueDate}</Text>
                        </View>
                      )}

                      {item.estimatedHours > 0 && (
                        <View style={styles.footerBadge}>
                          <Clock size={11} color="#64748B" />
                          <Text style={styles.footerBadgeText}>{item.estimatedHours} Jam</Text>
                        </View>
                      )}

                      {totalSubs > 0 && (
                        <View style={styles.footerBadge}>
                          <CheckSquare size={11} color="#64748B" />
                          <Text style={styles.footerBadgeText}>
                            {completedSubs}/{totalSubs}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal
        visible={!!activeTaskDetail}
        task={activeTaskDetail}
        statuses={statuses}
        currentUserId={userId}
        onClose={() => setActiveTaskDetail(null)}
        onTaskUpdated={() => {
          loadData();
          if (activeTaskDetail) {
            teamRepository.getMyTasks(userId).then((updated) => {
              const refreshed = updated.find((t) => t.id === activeTaskDetail.id);
              if (refreshed) setActiveTaskDetail(refreshed);
            });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerCard: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  taskCountBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  taskCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
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
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  taskCardDone: {
    opacity: 0.7,
    backgroundColor: '#F8FAFC',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  taskCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskCheckDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  cardInfo: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priorityTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 19,
    marginBottom: 4,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  taskDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  footerBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
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
