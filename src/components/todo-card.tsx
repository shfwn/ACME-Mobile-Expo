import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { PersonalTodo, PersonalTodoColor } from '../types/todo.types';
import {
  BrandColors,
  TodoColors,
  CategoryDotColors,
  CATEGORY_DOT_FALLBACK,
} from '../constants/theme';
import {
  Clock,
  Check,
  MoreVertical,
  CalendarArrowRight,
  Trash2,
  Timer,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useTodoSwipe, type TodoSwipeAction } from './todo-swipe-gesture';

interface TodoCardProps {
  todo: PersonalTodo;
  onToggle?: (id: string) => void;
  onRollover?: (todo: PersonalTodo) => void;
  onDelete?: (id: string) => void;
  /** Mulai sesi Pomodoro untuk to-do ini. */
  onStartTimer?: (todo: PersonalTodo) => void;
  /** Swipe kanan = selesai, swipe kiri = snooze (tanggal +1). */
  onSwipeAction?: (todo: PersonalTodo, action: TodoSwipeAction) => void;
  /** Dipanggil saat satu subtask dicentang/dibuka. */
  onToggleSubtask?: (todo: PersonalTodo, subtaskId: string) => Promise<void> | void;
  /** Dipanggil saat subtask dihapus dari kartu. */
  onDeleteSubtask?: (todo: PersonalTodo, subtaskId: string) => Promise<void> | void;
}

/** Huruf/ikon prioritas: L, M, H, dan ikon bahaya untuk URGENT. */
function PriorityMark({ priority }: { priority: PersonalTodo['priority'] }) {
  if (priority === 'URGENT') {
    return (
      <View style={[styles.priorityMark, styles.priorityMarkDanger]}>
        <TriangleAlert size={12} color={TodoColors.danger} />
      </View>
    );
  }

  const label = priority === 'LOW' ? 'L' : priority === 'HIGH' ? 'H' : 'M';
  return (
    <View style={styles.priorityMark}>
      <Text style={styles.priorityMarkText}>{label}</Text>
    </View>
  );
}

export const TodoCard: React.FC<TodoCardProps> = ({
  todo,
  onToggle,
  onRollover,
  onDelete,
  onStartTimer,
  onSwipeAction,
  onToggleSubtask,
  onDeleteSubtask,
}) => {
  const { panHandlers, translateX } = useTodoSwipe(
    todo,
    (action) => onSwipeAction?.(todo, action)
  );
  const [showMenu, setShowMenu] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);

  const colorKey = (todo.colorTheme || 'periwinkle') as PersonalTodoColor;
  const colorHex = BrandColors.pastels[colorKey]?.border ?? BrandColors.pastels.periwinkle.border;
  const categoryDot = CategoryDotColors[todo.category] ?? CATEGORY_DOT_FALLBACK;

  const subtasks = todo.subtasks ?? [];
  const completedSubtasks = subtasks.filter((s) => s.isCompleted).length;
  const totalSubtasks = subtasks.length;

  return (
    <Animated.View
      {...(onSwipeAction ? panHandlers : {})}
      style={[
        styles.card,
        onSwipeAction ? { transform: [{ translateX }] } : null,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShowMenu((v) => !v)}
        style={styles.mainRow}
        disabled={!onDelete && !onRollover && !onStartTimer}
      >
        <View style={styles.body}>
          <View style={styles.headerMeta}>
            <View style={styles.badgeRow}>
              <View style={[styles.categoryDot, { backgroundColor: categoryDot }]} />
              <Text style={styles.categoryText}>{todo.category}</Text>
              <PriorityMark priority={todo.priority} />
            </View>

            <View style={styles.headerRight}>
              {todo.startTime ? (
                <View style={styles.timeBlock}>
                  <Clock size={11} color={TodoColors.muted} />
                  <Text style={styles.timeText}>
                    {todo.startTime}
                    {todo.endTime ? `–${todo.endTime}` : ''}
                  </Text>
                </View>
              ) : null}

              <View style={[styles.colorDot, { backgroundColor: colorHex }]} />

              <TouchableOpacity
                onPress={() => setShowMenu((v) => !v)}
                style={styles.menuTrigger}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Menu to-do"
              >
                <MoreVertical size={16} color={TodoColors.faint} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.title, todo.isCompleted && styles.titleCompleted]}>
            {todo.title}
          </Text>

          {todo.description ? (
            <Text
              style={[styles.description, todo.isCompleted && styles.descriptionCompleted]}
              numberOfLines={2}
            >
              {todo.description}
            </Text>
          ) : null}

          {totalSubtasks > 0 ? (
            <View style={styles.subtaskSummary}>
              <Check size={12} color={TodoColors.muted} />
              <Text style={styles.subtaskSummaryText}>
                {completedSubtasks}/{totalSubtasks} subtask
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Dropdown subtask */}
      {totalSubtasks > 0 ? (
        <TouchableOpacity
          style={styles.subtaskToggle}
          onPress={() => setShowSubtasks((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.subtaskToggleText}>
            {showSubtasks ? 'Sembunyikan subtask' : 'Lihat subtask'}
          </Text>
          {showSubtasks ? (
            <ChevronUp size={14} color={TodoColors.accent} />
          ) : (
            <ChevronDown size={14} color={TodoColors.accent} />
          )}
        </TouchableOpacity>
      ) : null}

      {showSubtasks && totalSubtasks > 0 ? (
        <View style={styles.subtaskList}>
          {subtasks.map((sub) => (
            <View key={sub.id} style={styles.subtaskRow}>
              <TouchableOpacity
                style={[styles.subtaskCheck, sub.isCompleted && styles.subtaskCheckDone]}
                onPress={() => onToggleSubtask?.(todo, sub.id)}
                accessibilityLabel={`Centang ${sub.title}`}
              >
                {sub.isCompleted ? (
                  <Check size={11} color={TodoColors.surface} strokeWidth={3} />
                ) : null}
              </TouchableOpacity>

              <Text style={[styles.subtaskText, sub.isCompleted && styles.subtaskTextDone]}>
                {sub.title}
              </Text>

              <TouchableOpacity
                onPress={() => onDeleteSubtask?.(todo, sub.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={`Hapus ${sub.title}`}
              >
                <Trash2 size={14} color={TodoColors.faint} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {showMenu ? (
        <View style={styles.actionMenu}>
          {onRollover && !todo.isCompleted ? (
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                setShowMenu(false);
                onRollover(todo);
              }}
            >
              <CalendarArrowRight size={14} color={TodoColors.accent} />
              <Text style={styles.actionMenuText}>Pindah ke besok</Text>
            </TouchableOpacity>
          ) : null}

          {onStartTimer ? (
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                setShowMenu(false);
                onStartTimer(todo);
              }}
            >
              <Timer size={14} color={TodoColors.accent} />
              <Text style={styles.actionMenuText}>Mulai Pomodoro</Text>
            </TouchableOpacity>
          ) : null}

          {onToggle ? (
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                setShowMenu(false);
                onToggle(todo.id);
              }}
            >
              <Check size={14} color={TodoColors.accent} />
              <Text style={styles.actionMenuText}>
                {todo.isCompleted ? 'Tandai belum selesai' : 'Tandai selesai'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {onDelete ? (
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                setShowMenu(false);
                onDelete(todo.id);
              }}
            >
              <Trash2 size={14} color={TodoColors.danger} />
              <Text style={[styles.actionMenuText, styles.actionMenuTextDanger]}>
                Hapus to-do
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: TodoColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TodoColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  body: {
    flex: 1,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: TodoColors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priorityMark: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: TodoColors.border,
    backgroundColor: TodoColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityMarkDanger: {
    borderColor: '#F5C2BC',
    backgroundColor: TodoColors.dangerSoft,
  },
  priorityMarkText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: TodoColors.body,
    letterSpacing: 0.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: 11,
    color: TodoColors.muted,
    fontWeight: '600',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  menuTrigger: {
    padding: 2,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 20,
    color: TodoColors.title,
  },
  titleCompleted: {
    color: TodoColors.faint,
    textDecorationLine: 'line-through',
  },
  description: {
    fontSize: 12.5,
    color: TodoColors.body,
    lineHeight: 18,
    marginTop: 3,
  },
  descriptionCompleted: {
    color: TodoColors.faint,
    textDecorationLine: 'line-through',
  },
  subtaskSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  subtaskSummaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: TodoColors.muted,
  },
  subtaskToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: TodoColors.border,
  },
  subtaskToggleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: TodoColors.accent,
  },
  subtaskList: {
    marginTop: 6,
    backgroundColor: TodoColors.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  subtaskCheck: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: TodoColors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TodoColors.surface,
  },
  subtaskCheckDone: {
    backgroundColor: TodoColors.success,
    borderColor: TodoColors.success,
  },
  subtaskText: {
    flex: 1,
    fontSize: 12.5,
    color: TodoColors.body,
  },
  subtaskTextDone: {
    color: TodoColors.faint,
    textDecorationLine: 'line-through',
  },
  actionMenu: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: TodoColors.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 14,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionMenuText: {
    fontSize: 12,
    fontWeight: '600',
    color: TodoColors.accent,
  },
  actionMenuTextDanger: {
    color: TodoColors.danger,
  },
});
