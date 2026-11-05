import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PersonalTodo, PersonalTodoColor } from '../types/todo.types';
import { BrandColors } from '../constants/theme';
import { Clock, Check, MoreVertical, CalendarForward, Trash2 } from 'lucide-react-native';

interface TodoCardProps {
  todo: PersonalTodo;
  onToggle: (id: string) => void;
  onRollover?: (todo: PersonalTodo) => void;
  onDelete?: (id: string) => void;
}

export const TodoCard: React.FC<TodoCardProps> = ({
  todo,
  onToggle,
  onRollover,
  onDelete,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);

  const themeKey = (todo.colorTheme || 'yellow') as PersonalTodoColor;
  const pastel = BrandColors.pastels[themeKey] || BrandColors.pastels.yellow;

  const completedSubtasks = todo.subtasks?.filter((s) => s.isCompleted).length || 0;
  const totalSubtasks = todo.subtasks?.length || 0;

  const priorityColor =
    todo.priority === 'URGENT'
      ? BrandColors.urgent
      : todo.priority === 'HIGH'
      ? BrandColors.high
      : todo.priority === 'LOW'
      ? BrandColors.low
      : BrandColors.medium;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: todo.isCompleted ? '#F8FAFC' : pastel.bg,
          borderColor: todo.isCompleted ? '#E2E8F0' : pastel.border,
          opacity: todo.isCompleted ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.mainRow}>
        {/* Checkbox Button */}
        <TouchableOpacity
          style={[
            styles.checkbox,
            todo.isCompleted
              ? styles.checkboxChecked
              : { borderColor: pastel.border, backgroundColor: '#FFFFFF' },
          ]}
          onPress={() => onToggle(todo.id)}
          activeOpacity={0.7}
        >
          {todo.isCompleted && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </TouchableOpacity>

        {/* Content Body */}
        <View style={styles.body}>
          <View style={styles.headerMeta}>
            <View style={styles.badgeRow}>
              {/* Category */}
              <View style={[styles.categoryBadge, { backgroundColor: '#FFFFFF' }]}>
                <Text style={[styles.categoryText, { color: pastel.text }]}>
                  {todo.category}
                </Text>
              </View>

              {/* Priority */}
              <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '18' }]}>
                <Text style={[styles.priorityText, { color: priorityColor }]}>
                  {todo.priority}
                </Text>
              </View>
            </View>

            {/* Menu Trigger */}
            <TouchableOpacity
              onPress={() => setShowMenu(!showMenu)}
              style={styles.menuTrigger}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MoreVertical size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              todo.isCompleted && styles.titleCompleted,
              { color: todo.isCompleted ? '#64748B' : '#0F172A' },
            ]}
            numberOfLines={2}
          >
            {todo.title}
          </Text>

          {/* Description */}
          {todo.description ? (
            <Text
              style={[
                styles.description,
                todo.isCompleted && styles.descriptionCompleted,
              ]}
              numberOfLines={2}
            >
              {todo.description}
            </Text>
          ) : null}

          {/* Footer Info: Time-Blocking & Subtasks */}
          <View style={styles.footerRow}>
            {todo.startTime && (
              <View style={styles.timeBlock}>
                <Clock size={12} color="#64748B" />
                <Text style={styles.timeText}>
                  {todo.startTime}
                  {todo.endTime ? ` - ${todo.endTime}` : ''}
                </Text>
              </View>
            )}

            {totalSubtasks > 0 && (
              <View style={styles.subtaskSummary}>
                <Text style={styles.subtaskText}>
                  Checklist: {completedSubtasks}/{totalSubtasks}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Popover Action Menu */}
      {showMenu && (
        <View style={styles.actionMenu}>
          {onRollover && !todo.isCompleted && (
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                setShowMenu(false);
                onRollover(todo);
              }}
            >
              <CalendarForward size={14} color={BrandColors.primary} />
              <Text style={styles.actionMenuText}>Rollover ke Besok</Text>
            </TouchableOpacity>
          )}

          {onDelete && (
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                setShowMenu(false);
                onDelete(todo.id);
              }}
            >
              <Trash2 size={14} color={BrandColors.danger} />
              <Text style={[styles.actionMenuText, { color: BrandColors.danger }]}>
                Hapus To-Do
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
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
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  menuTrigger: {
    padding: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
  },
  description: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 6,
  },
  descriptionCompleted: {
    textDecorationLine: 'line-through',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  subtaskSummary: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subtaskText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  actionMenu: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionMenuText: {
    fontSize: 12,
    fontWeight: '600',
    color: BrandColors.primary,
  },
});
