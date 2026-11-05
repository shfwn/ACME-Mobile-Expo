import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BrandColors } from '../constants/theme';
import { Priority, PersonalTodoColor, PersonalTodoSubtask } from '../types/todo.types';
import { X, Plus, Trash2, Clock, Check } from 'lucide-react-native';

interface CreateTodoModalProps {
  visible: boolean;
  targetDate: string; // YYYY-MM-DD
  onClose: () => void;
  onSave: (todoData: {
    title: string;
    description?: string;
    targetDate: string;
    startTime?: string;
    endTime?: string;
    priority: Priority;
    category: string;
    colorTheme: PersonalTodoColor;
    subtasks: PersonalTodoSubtask[];
  }) => Promise<void>;
}

export const CreateTodoModal: React.FC<CreateTodoModalProps> = ({
  visible,
  targetDate,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [category, setCategory] = useState('Kerja');
  const [colorTheme, setColorTheme] = useState<PersonalTodoColor>('yellow');
  const [subtasks, setSubtasks] = useState<PersonalTodoSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartTime('09:00');
    setEndTime('10:30');
    setPriority('MEDIUM');
    setCategory('Kerja');
    setColorTheme('yellow');
    setSubtasks([]);
    setNewSubtaskTitle('');
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSub: PersonalTodoSubtask = {
      id: 'sub-' + Date.now().toString(36),
      title: newSubtaskTitle.trim(),
      isCompleted: false,
    };
    setSubtasks([...subtasks, newSub]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter((s) => s.id !== id));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        targetDate,
        startTime: startTime.trim() || undefined,
        endTime: endTime.trim() || undefined,
        priority,
        category,
        colorTheme,
        subtasks,
      });
      resetForm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const pastelOptions: PersonalTodoColor[] = ['yellow', 'pink', 'mint', 'periwinkle'];
  const priorityOptions: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const categoryOptions = ['Kerja', 'Pribadi', 'Fokus', 'Penting'];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>To-Do Harian Baru</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* Title Input */}
            <View style={styles.field}>
              <Text style={styles.label}>Judul Tugas *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: Rapat evaluasi mingguan"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Description Input */}
            <View style={styles.field}>
              <Text style={styles.label}>Deskripsi (Opsional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Detail atau catatan ringkas..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Time-Blocking Pickers */}
            <View style={styles.field}>
              <Text style={styles.label}>Time-Blocking (Jam Kerja)</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeInputWrapper}>
                  <Clock size={16} color="#64748B" style={styles.timeIcon} />
                  <TextInput
                    style={styles.timeInput}
                    placeholder="Mulai (09:00)"
                    placeholderTextColor="#94A3B8"
                    value={startTime}
                    onChangeText={setStartTime}
                  />
                </View>
                <Text style={styles.timeSeparator}>—</Text>
                <View style={styles.timeInputWrapper}>
                  <Clock size={16} color="#64748B" style={styles.timeIcon} />
                  <TextInput
                    style={styles.timeInput}
                    placeholder="Selesai (10:30)"
                    placeholderTextColor="#94A3B8"
                    value={endTime}
                    onChangeText={setEndTime}
                  />
                </View>
              </View>
            </View>

            {/* Pastel Color Theme */}
            <View style={styles.field}>
              <Text style={styles.label}>Tema Warna Pastel</Text>
              <View style={styles.colorRow}>
                {pastelOptions.map((c) => {
                  const palette = BrandColors.pastels[c];
                  const isSelected = colorTheme === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: palette.badge, borderColor: palette.border },
                        isSelected && styles.colorSwatchSelected,
                      ]}
                      onPress={() => setColorTheme(c)}
                    >
                      {isSelected && <Check size={16} color={palette.text} strokeWidth={3} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Category Chips */}
            <View style={styles.field}>
              <Text style={styles.label}>Kategori</Text>
              <View style={styles.chipRow}>
                {categoryOptions.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, category === cat && styles.chipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Priority Chips */}
            <View style={styles.field}>
              <Text style={styles.label}>Prioritas</Text>
              <View style={styles.chipRow}>
                {priorityOptions.map((p) => {
                  const isActive = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() => setPriority(p)}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Subtasks Builder */}
            <View style={styles.field}>
              <Text style={styles.label}>Checklist Subtask ({subtasks.length})</Text>
              <View style={styles.addSubtaskRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Tambah item subtask..."
                  placeholderTextColor="#94A3B8"
                  value={newSubtaskTitle}
                  onChangeText={setNewSubtaskTitle}
                  onSubmitEditing={handleAddSubtask}
                />
                <TouchableOpacity style={styles.addSubtaskButton} onPress={handleAddSubtask}>
                  <Plus size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {subtasks.map((sub) => (
                <View key={sub.id} style={styles.subtaskItem}>
                  <Text style={styles.subtaskItemText}>{sub.title}</Text>
                  <TouchableOpacity onPress={() => handleRemoveSubtask(sub.id)}>
                    <Trash2 size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitButton, (!title.trim() || isSubmitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!title.trim() || isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan To-Do'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeButton: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
  },
  timeIcon: {
    marginRight: 6,
  },
  timeInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  timeSeparator: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    transform: [{ scale: 1.08 }],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  addSubtaskRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  addSubtaskButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  subtaskItemText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  submitButton: {
    backgroundColor: BrandColors.primary,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
