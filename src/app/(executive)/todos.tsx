import React, { useState, useCallback, useMemo } from 'react';
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
import { useFocusEffect } from 'expo-router';
import { todoRepository, timeLogRepository } from '../../db/repository';
import { calendarRepository, type DayTodoSignal } from '../../db/calendar.repository';
import { PersonalTodo, PersonalTodoColor, Priority, PersonalTodoSubtask } from '../../types/todo.types';
import { BrandColors, TodoColors } from '../../constants/theme';
import { TodoCard } from '../../components/todo-card';
import { CreateTodoModal, defaultTimeBlock } from '../../components/create-todo-modal';
import { DatePickerSheet, fromIsoDate, toIsoDate } from '../../components/date-picker-sheet';
import { PomodoroTimer } from '../../components/pomodoro-timer';
import { NotificationService } from '../../services/notification.service';
import { sessionToLoggedMinutes, type PomodoroSession } from '../../db/pomodoro';
import { teamRepository } from '../../db/team.repository';
import type { TodoSwipeAction } from '../../components/todo-swipe-gesture';
import { Plus, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const WEEKDAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function ExecutiveTodosScreen() {
  const user = useAuthStore((s) => s.user);

  const todayIso = toIsoDate(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [weekSignals, setWeekSignals] = useState<Record<string, DayTodoSignal>>({});
  const [yesterdayPendingCount, setYesterdayPendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'completed'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [timerFor, setTimerFor] = useState<PersonalTodo | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);

  const userId = user?.id ?? '';

  const loadTodos = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await todoRepository.getByDate(userId, selectedDate);
      setTodos(data);

      // Sinyal to-do untuk 7 hari minggu ini
      const curr = fromIsoDate(selectedDate);
      const dayOfWeek = (curr.getDay() + 6) % 7;
      const monday = new Date(curr);
      monday.setDate(curr.getDate() - dayOfWeek);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const signals = await calendarRepository.getTodoSignals(
        userId,
        toIsoDate(monday),
        toIsoDate(sunday)
      );
      setWeekSignals(signals);

      // Cek apakah ada tugas tertunda kemarin (rollover candidate)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayIso = toIsoDate(yesterday);
      const yesterdayTodos = await todoRepository.getByDate(userId, yesterdayIso);
      const pendingYesterday = yesterdayTodos.filter((t) => !t.isCompleted).length;
      setYesterdayPendingCount(pendingYesterday);
    } catch (e) {
      console.warn('Gagal memuat todo:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedDate, setIsLoading, setTodos, setWeekSignals, setYesterdayPendingCount]);

  // Muat ulang setiap tab kembali fokus: CRUD dari halaman lain (jadwal, sheets) harus terlihat di sini.
  useFocusEffect(
    useCallback(() => {
      loadTodos();
    }, [loadTodos])
  );

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

  const handleToggleSubtask = async (todo: PersonalTodo, subtaskId: string) => {
    const current = todo.subtasks ?? [];
    const next = current.map((s) =>
      s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
    );
    await todoRepository.update(todo.id, { subtasks: next });

    // To-do dianggap selesai hanya ketika semua subtask sudah dicentang.
    const allDone = next.length > 0 && next.every((s) => s.isCompleted);
    if (allDone && !todo.isCompleted) {
      await todoRepository.setCompleted(todo.id, true);
    } else if (!allDone && todo.isCompleted) {
      await todoRepository.setCompleted(todo.id, false);
    }

    loadTodos();
  };

  const handleDeleteSubtask = async (todo: PersonalTodo, subtaskId: string) => {
    const next = (todo.subtasks ?? []).filter((s) => s.id !== subtaskId);
    await todoRepository.update(todo.id, { subtasks: next });
    loadTodos();
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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await todoRepository.update(todo.id, { targetDate: toIsoDate(tomorrow) });
    Alert.alert('Sukses', `Tugas "${todo.title}" telah dipindahkan ke besok.`);
    loadTodos();
  };

  const handleRolloverAllYesterday = async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayIso = toIsoDate(yesterday);
    const yesterdayTodos = await todoRepository.getByDate(userId, yesterdayIso);
    const pending = yesterdayTodos.filter((t) => !t.isCompleted);

    for (const t of pending) {
      // Tanggal baru saja artinya jam lama sudah lewat: blok waktu digeser ke
      // jam sekarang sehingga pengingat H-15 menit tetap bisa terjadwal.
      const block = defaultTimeBlock();
      await todoRepository.update(t.id, {
        targetDate: selectedDate,
        startTime: block.startTime,
        endTime: block.endTime,
      });
    }

    Alert.alert('Rollover Berhasil', `${pending.length} tugas kemarin telah dipindahkan ke hari ini.`);
    loadTodos();
  };

  const recordPomodoro = useCallback(
    async (session: PomodoroSession) => {
      const minutes = sessionToLoggedMinutes(session);
      if (minutes === null) return;

      try {
        if (session.taskId) {
          await teamRepository.addTimeLog(
            session.taskId,
            userId,
            minutes,
            `Pomodoro ${minutes} menit`
          );
        } else {
          // To-do pribadi tidak punya baris Task; catat ke time_logs lewat
          // todoId supaya jamnya tetap terhitung di rekap.
          await timeLogRepository.logDuration(userId, minutes, {
            todoId: session.todoId,
            note: `Pomodoro ${minutes} menit`,
          });
        }
      } catch (e) {
        console.warn('Gagal mencatat sesi Pomodoro:', e);
      }
    },
    [userId]
  );

  const handleSwipeAction = useCallback(
    async (todo: PersonalTodo, action: TodoSwipeAction) => {
      if (action === 'complete') {
        await todoRepository.toggleComplete(todo.id);
        setTodos((prev) =>
          prev.map((t) => (t.id === todo.id ? { ...t, isCompleted: true } : t))
        );
        return;
      }

      const nextDate = await NotificationService.snoozeTodo(todo);
      setTodos((prev) => prev.filter((t) => t.id !== todo.id));
      Alert.alert('Ditunda', `"${todo.title}" dipindahkan ke ${nextDate}.`);
    },
    []
  );

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

  const shiftWeek = (offset: number) => {
    const next = fromIsoDate(selectedDate);
    next.setDate(next.getDate() + offset * 7);
    setSelectedDate(toIsoDate(next));
  };

  const monthYearTitle = useMemo(() => {
    const curr = fromIsoDate(selectedDate);
    return `${MONTH_NAMES[curr.getMonth()]} ${curr.getFullYear()}`;
  }, [selectedDate]);

  const weekDays = useMemo(() => {
    const curr = fromIsoDate(selectedDate);
    const dayOfWeek = (curr.getDay() + 6) % 7;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = toIsoDate(d);
      return {
        iso,
        dayNum: d.getDate(),
        dayName: WEEKDAY_NAMES[i],
      };
    });
  }, [selectedDate]);

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
      {/* Strip Mingguan: Judul bulan di kiri, panah ganti mingguan di pojok kanan atas, 7 hari singkatan */}
      <View style={styles.weekCard}>
        <View style={styles.weekHeader}>
          <TouchableOpacity
            style={styles.monthButton}
            onPress={() => setIsDatePickerOpen(true)}
            accessibilityLabel={`${monthYearTitle}. Ketuk untuk ganti tanggal`}
          >
            <View style={styles.monthButtonContent}>
              <CalendarDays size={15} color={TodoColors.accent} strokeWidth={2.2} />
              <Text style={styles.monthButtonText}>{monthYearTitle}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.weekNavArrows}>
            <TouchableOpacity
              style={styles.weekArrowBtn}
              onPress={() => shiftWeek(-1)}
              accessibilityLabel="Minggu sebelumnya"
            >
              <ChevronLeft size={16} color={TodoColors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.weekArrowBtn}
              onPress={() => shiftWeek(1)}
              accessibilityLabel="Minggu berikutnya"
            >
              <ChevronRight size={16} color={TodoColors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 7 Hari Singkatan dari kiri ke kanan */}
        <View style={styles.weekDaysRow}>
          {weekDays.map((item) => {
            const isSelected = item.iso === selectedDate;
            const isToday = item.iso === todayIso;
            const signal = weekSignals[item.iso];

            return (
              <TouchableOpacity
                key={item.iso}
                style={[
                  styles.dayChip,
                  isSelected && styles.dayChipSelected,
                  isToday && !isSelected && styles.dayChipToday,
                ]}
                onPress={() => setSelectedDate(item.iso)}
                activeOpacity={0.7}
                accessibilityLabel={`${item.dayName}, ${item.dayNum} ${monthYearTitle}`}
              >
                <Text
                  style={[
                    styles.dayChipName,
                    isSelected && styles.dayChipNameSelected,
                    isToday && !isSelected && styles.dayChipNameToday,
                  ]}
                >
                  {item.dayName}
                </Text>
                <Text
                  style={[
                    styles.dayChipNum,
                    isSelected && styles.dayChipNumSelected,
                    isToday && !isSelected && styles.dayChipNumToday,
                  ]}
                >
                  {item.dayNum}
                </Text>

                <View
                  style={[
                    styles.dayChipDot,
                    signal?.hasTodos
                      ? isSelected
                        ? styles.dayChipDotSelected
                        : signal.pending > 0
                        ? styles.dayChipDotActive
                        : styles.dayChipDotCompleted
                      : null,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
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
              onStartTimer={setTimerFor}
              onSwipeAction={handleSwipeAction}
              onToggleSubtask={handleToggleSubtask}
              onDeleteSubtask={handleDeleteSubtask}
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

      <DatePickerSheet
        visible={isDatePickerOpen}
        value={selectedDate}
        onClose={() => setIsDatePickerOpen(false)}
        onSelect={setSelectedDate}
      />

      <PomodoroTimer
        visible={timerFor !== null}
        todoId={timerFor?.id}
        taskTitle={timerFor?.title}
        onClose={() => setTimerFor(null)}
        onSessionEnd={(session) => {
          recordPomodoro(session);
          setTimerFor(null);
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
  weekCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: TodoColors.accentSoft,
  },
  monthButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthButtonText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: TodoColors.accent,
  },
  weekNavArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekArrowBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dayChipToday: {
    borderColor: BrandColors.primary,
    backgroundColor: TodoColors.accentSoft,
  },
  dayChipSelected: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  dayChipName: {
    fontSize: 10.5,
    fontWeight: '700',
    color: TodoColors.muted,
    marginBottom: 2,
  },
  dayChipNameToday: {
    color: BrandColors.primary,
  },
  dayChipNameSelected: {
    color: '#EDF1F8',
  },
  dayChipNum: {
    fontSize: 14.5,
    fontWeight: '800',
    color: TodoColors.title,
  },
  dayChipNumToday: {
    color: BrandColors.primary,
  },
  dayChipNumSelected: {
    color: '#FFFFFF',
  },
  dayChipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  dayChipDotActive: {
    backgroundColor: BrandColors.primary,
  },
  dayChipDotCompleted: {
    backgroundColor: '#CBD5E1',
  },
  dayChipDotSelected: {
    backgroundColor: '#FFE28A',
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
