import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { todoRepository } from '../../db/repository';
import { PersonalTodo, PersonalTodoColor, Priority, PersonalTodoSubtask } from '../../types/todo.types';
import { BrandColors } from '../../constants/theme';
import { TodoCard } from '../../components/todo-card';
import { CreateTodoModal } from '../../components/create-todo-modal';
import { Plus, Calendar, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react-native';

export default function ExecutiveTodosScreen() {
  const user = useAuthStore((s) => s.user);

  const todayIso = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [yesterdayPendingCount, setYesterdayPendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'completed'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  const userId = user?.id || 'u-default';

  const loadTodos = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await todoRepository.getByDate(userId, selectedDate);
      setTodos(data);

      // Cek apakah ada tugas tertunda kemarin (rollover candidate)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayIso = yesterday.toISOString().split('T')[0];
      const yesterdayTodos = await todoRepository.getByDate(userId, yesterdayIso);
      const pendingYesterday = yesterdayTodos.filter((t) => !t.isCompleted).length;
      setYesterdayPendingCount(pendingYesterday);
    } catch (e) {
      console.warn('Gagal memuat todo:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedDate]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const handleToggle = async (id: string) => {
    try {
      await todoRepository.toggleComplete(id);
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t))
      );
    } catch (e) {
      console.warn('Gagal toggle todo:', e);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Hapus Tugas', 'Apakah Anda yakin ingin menghapus to-do ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await todoRepository.softDelete(id);
          setTodos((prev) => prev.filter((t) => t.id !== id));
        },
      },
    ]);
  };

  const handleRollover = async (todo: PersonalTodo) => {
    await todoRepository.update(todo.id, { targetDate: todayIso });
    Alert.alert('Sukses', `Tugas "${todo.title}" telah dipindahkan ke tanggal hari ini.`);
    loadTodos();
  };

  const handleRolloverAllYesterday = async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayIso = yesterday.toISOString().split('T')[0];
    const yesterdayTodos = await todoRepository.getByDate(userId, yesterdayIso);
    const pending = yesterdayTodos.filter((t) => !t.isCompleted);

    for (const t of pending) {
      await todoRepository.update(t.id, { targetDate: selectedDate });
    }

    Alert.alert('Rollover Berhasil', `${pending.length} tugas kemarin telah dipindahkan ke hari ini.`);
    loadTodos();
  };

  const handleCreateTodo = async (newTodo: {
    title: string;
    description?: string;
    targetDate: string;
    startTime?: string;
    endTime?: string;
    priority: Priority;
    category: string;
    colorTheme: PersonalTodoColor;
    subtasks: PersonalTodoSubtask[];
  }) => {
    await todoRepository.create({
      ...newTodo,
      userId,
      isCompleted: false,
    });
    loadTodos();
  };

  const shiftDate = (offsetDays: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offsetDays);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // Filter list
  const filteredTodos = todos.filter((t) => {
    if (filterTab === 'active') return !t.isCompleted;
    if (filterTab === 'completed') return t.isCompleted;
    return true;
  });

  const totalTasks = todos.length;
  const completedTasks = todos.filter((t) => t.isCompleted).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Date Navigation Bar */}
      <View style={styles.dateBar}>
        <TouchableOpacity style={styles.navArrow} onPress={() => shiftDate(-1)}>
          <ChevronLeft size={20} color="#64748B" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateCenter}
          onPress={() => setSelectedDate(todayIso)}
        >
          <Calendar size={16} color={BrandColors.primary} />
          <Text style={styles.dateLabel}>
            {selectedDate === todayIso ? 'Hari Ini • ' : ''}
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navArrow} onPress={() => shiftDate(1)}>
          <ChevronRight size={20} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Progress Roll-up Header Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressTextRow}>
          <Text style={styles.progressTitle}>Progres Harian</Text>
          <Text style={styles.progressValue}>
            {completedTasks} dari {totalTasks} selesai ({progressPercent}%)
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? '#10B981' : BrandColors.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* Yesterday's Rollover Banner */}
      {selectedDate === todayIso && yesterdayPendingCount > 0 && (
        <View style={styles.rolloverBanner}>
          <View style={styles.rolloverLeft}>
            <AlertCircle size={18} color="#D97706" />
            <Text style={styles.rolloverText}>
              Ada {yesterdayPendingCount} tugas kemarin yang belum selesai
            </Text>
          </View>
          <TouchableOpacity style={styles.rolloverBtn} onPress={handleRolloverAllYesterday}>
            <Text style={styles.rolloverBtnText}>Rollover</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.tabFilterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filterTab === 'all' && styles.filterChipActive]}
          onPress={() => setFilterTab('all')}
        >
          <Text style={[styles.filterChipText, filterTab === 'all' && styles.filterChipTextActive]}>
            Semua ({todos.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filterTab === 'active' && styles.filterChipActive]}
          onPress={() => setFilterTab('active')}
        >
          <Text style={[styles.filterChipText, filterTab === 'active' && styles.filterChipTextActive]}>
            Aktif ({todos.filter((t) => !t.isCompleted).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filterTab === 'completed' && styles.filterChipActive]}
          onPress={() => setFilterTab('completed')}
        >
          <Text
            style={[
              styles.filterChipText,
              filterTab === 'completed' && styles.filterChipTextActive,
            ]}
          >
            Selesai ({completedTasks})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Todo List */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      ) : filteredTodos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <CheckCircle2 size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Tidak Ada Tugas</Text>
          <Text style={styles.emptySubtitle}>
            {filterTab === 'completed'
              ? 'Belum ada tugas yang selesai di tanggal ini.'
              : 'Semua tugas untuk tanggal ini telah selesai atau belum dibuat.'}
          </Text>
          <TouchableOpacity
            style={styles.emptyAddButton}
            onPress={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.emptyAddButtonText}>Tambah To-Do</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTodos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TodoCard
              todo={item}
              onToggle={handleToggle}
              onRollover={handleRollover}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsCreateModalOpen(true)}
        activeOpacity={0.8}
        accessibilityLabel="Tambah To-Do Harian"
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create Todo Modal Sheet */}
      <CreateTodoModal
        visible={isCreateModalOpen}
        targetDate={selectedDate}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateTodo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  navArrow: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  progressCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  progressValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  rolloverBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rolloverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  rolloverText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  rolloverBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rolloverBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 90,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 16,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BrandColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
