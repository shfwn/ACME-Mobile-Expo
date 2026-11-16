import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { useFocusEffect } from 'expo-router';
import { todoRepository } from '../../db/repository';
import { PersonalTodo, PersonalTodoColor, Priority, PersonalTodoSubtask } from '../../types/todo.types';
import { BrandColors, TodoColors } from '../../constants/theme';
import { WeekDateStrip } from '../../components/week-date-strip';
import { DatePickerSheet, formatLongDate, toIsoDate } from '../../components/date-picker-sheet';
import { CreateTodoModal } from '../../components/create-todo-modal';
import { Plus, Clock, AlertTriangle, Check, CalendarDays, ChevronDown } from 'lucide-react-native';

function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return -1;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return -1;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

export default function ExecutiveCalendarScreen() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const todayIso = toIsoDate(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [allUserTodos, setAllUserTodos] = useState<PersonalTodo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dayData, allData] = await Promise.all([
        todoRepository.getByDate(userId, selectedDate),
        todoRepository.getAllByUser(userId),
      ]);
      setTodos(dayData);
      setAllUserTodos(allData);
    } catch (e) {
      console.warn('Gagal memuat kalender:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Set of dates with events for dot indicators
  const datesWithEvents = useMemo(() => {
    const s = new Set<string>();
    for (const t of allUserTodos) {
      s.add(t.targetDate);
    }
    return s;
  }, [allUserTodos]);

  // Conflict detection algorithm
  const conflictingTodoIds = useMemo(() => {
    const conflicts = new Set<string>();
    const timedTodos = todos.filter((t) => t.startTime && t.endTime);

    for (let i = 0; i < timedTodos.length; i++) {
      const a = timedTodos[i];
      const startA = timeToMinutes(a.startTime);
      const endA = timeToMinutes(a.endTime);

      for (let j = i + 1; j < timedTodos.length; j++) {
        const b = timedTodos[j];
        const startB = timeToMinutes(b.startTime);
        const endB = timeToMinutes(b.endTime);

        if (startA < endB && startB < endA) {
          conflicts.add(a.id);
          conflicts.add(b.id);
        }
      }
    }
    return conflicts;
  }, [todos]);

  const handleToggle = async (id: string) => {
    await todoRepository.toggleComplete(id);
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t))
    );
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
    loadData();
  };

  // 15 Hourly slots from 07:00 to 21:00
  const hours = Array.from({ length: 15 }, (_, i) => i + 7);

  // Distribution by Category
  const categoryCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of todos) {
      map[t.category] = (map[t.category] || 0) + 1;
    }
    return map;
  }, [todos]);

  return (
    <View style={styles.container}>
      {/* 1. Pemilih tanggal: strip mingguan + kalender bulanan */}
      <View style={styles.dateSelector}>
        <TouchableOpacity
          style={styles.dateSelectorButton}
          onPress={() => setIsDatePickerOpen(true)}
          accessibilityLabel="Buka kalender"
        >
          <CalendarDays size={15} color={TodoColors.accent} />
          <Text style={styles.dateSelectorText}>{formatLongDate(selectedDate)}</Text>
          <ChevronDown size={15} color={TodoColors.accent} />
        </TouchableOpacity>
      </View>

      <WeekDateStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        datesWithEvents={datesWithEvents}
      />

      <DatePickerSheet
        visible={isDatePickerOpen}
        value={selectedDate}
        onClose={() => setIsDatePickerOpen(false)}
        onSelect={setSelectedDate}
        datesWithContent={datesWithEvents}
      />

      {/* 2. Events Distribution Bar */}
      {todos.length > 0 && (
        <View style={styles.distributionBar}>
          <Text style={styles.distribTitle}>Distribusi Aktivitas:</Text>
          <View style={styles.distribChips}>
            {Object.entries(categoryCount).map(([cat, count]) => (
              <View key={cat} style={styles.distribChip}>
                <Text style={styles.distribChipText}>
                  {cat}: <Text style={{ fontWeight: '800' }}>{count}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 3. Conflict Alert Banner if any conflict found */}
      {conflictingTodoIds.size > 0 && (
        <View style={styles.conflictAlert}>
          <AlertTriangle size={18} color="#DC2626" />
          <Text style={styles.conflictAlertText}>
            Terdeteksi {conflictingTodoIds.size} jadwal yang saling bentrok pada jam yang sama!
          </Text>
        </View>
      )}

      {/* 4. Vertical Time-Blocking Timetable */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.timetableScroll} contentContainerStyle={styles.timetableContent}>
          {hours.map((hour) => {
            const hourStr = hour.toString().padStart(2, '0');
            const timeLabel = `${hourStr}:00`;

            // Filter todos starting in this hour (e.g. 09:xx in 09:00)
            const hourTodos = todos.filter((t) => {
              if (!t.startTime) return false;
              const h = parseInt(t.startTime.split(':')[0], 10);
              return h === hour;
            });

            return (
              <View key={hour} style={styles.hourRow}>
                {/* Time Axis */}
                <View style={styles.hourAxis}>
                  <Text style={styles.hourLabel}>{timeLabel}</Text>
                </View>

                {/* Event Area */}
                <View style={styles.slotContent}>
                  {hourTodos.length === 0 ? (
                    <View style={styles.emptySlotLine} />
                  ) : (
                    hourTodos.map((todo) => {
                      const themeKey = (todo.colorTheme || 'yellow') as PersonalTodoColor;
                      const pastel = BrandColors.pastels[themeKey] || BrandColors.pastels.yellow;
                      const hasConflict = conflictingTodoIds.has(todo.id);

                      return (
                        <View
                          key={todo.id}
                          style={[
                            styles.eventCard,
                            { backgroundColor: pastel.bg, borderColor: pastel.border },
                            hasConflict && styles.eventCardConflict,
                          ]}
                        >
                          {/* Event Header */}
                          <View style={styles.eventCardHeader}>
                            <View style={styles.eventTimeBadge}>
                              <Clock size={11} color="#64748B" />
                              <Text style={styles.eventTimeText}>
                                {todo.startTime} - {todo.endTime || 'Selesai'}
                              </Text>
                            </View>

                            {hasConflict && (
                              <View style={styles.conflictBadge}>
                                <AlertTriangle size={10} color="#DC2626" />
                                <Text style={styles.conflictBadgeText}>Bentrok</Text>
                              </View>
                            )}

                            <TouchableOpacity
                              style={[
                                styles.checkSmall,
                                todo.isCompleted && styles.checkSmallDone,
                              ]}
                              onPress={() => handleToggle(todo.id)}
                            >
                              {todo.isCompleted && (
                                <Check size={10} color="#FFFFFF" strokeWidth={3} />
                              )}
                            </TouchableOpacity>
                          </View>

                          <Text
                            style={[
                              styles.eventTitle,
                              todo.isCompleted && styles.eventTitleDone,
                            ]}
                            numberOfLines={1}
                          >
                            {todo.title}
                          </Text>

                          {todo.description ? (
                            <Text style={styles.eventDesc} numberOfLines={1}>
                              {todo.description}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsCreateModalOpen(true)}
        activeOpacity={0.8}
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Modal */}
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
  dateSelector: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  dateSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: TodoColors.accentSoft,
  },
  dateSelectorText: {
    fontSize: 13,
    fontWeight: '700',
    color: TodoColors.accent,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  distributionBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distribTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  distribChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  distribChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  distribChipText: {
    fontSize: 10,
    color: '#475569',
  },
  conflictAlert: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conflictAlertText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timetableScroll: {
    flex: 1,
  },
  timetableContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },
  hourRow: {
    flexDirection: 'row',
    minHeight: 52,
    marginBottom: 4,
  },
  hourAxis: {
    width: 52,
    paddingTop: 2,
  },
  hourLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  slotContent: {
    flex: 1,
    justifyContent: 'center',
    borderLeftWidth: 1.5,
    borderLeftColor: '#E2E8F0',
    paddingLeft: 10,
    paddingBottom: 6,
  },
  emptySlotLine: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  eventCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    marginBottom: 6,
  },
  eventCardConflict: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  conflictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  conflictBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    textTransform: 'uppercase',
  },
  checkSmall: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSmallDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  eventTitleDone: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  eventDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
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
