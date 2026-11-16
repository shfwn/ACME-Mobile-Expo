import React, { useMemo, useState } from 'react';
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
import { TodoColors, CategoryDotColors, CATEGORY_DOT_FALLBACK, BrandColors } from '../constants/theme';
import { Priority, PersonalTodoColor, PersonalTodoSubtask } from '../types/todo.types';
import { X, Plus, Trash2, Clock, Check, TriangleAlert, Pencil, ChevronLeft } from 'lucide-react-native';

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

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'L' },
  { value: 'MEDIUM', label: 'M' },
  { value: 'HIGH', label: 'H' },
  { value: 'URGENT', label: 'DANGER' },
];

/** Blok waktu default: 5 jam. */
const DEFAULT_BLOCK_HOURS = 5;

const COLOR_OPTIONS: { value: PersonalTodoColor; hex: string }[] = [
  { value: 'yellow', hex: BrandColors.pastels.yellow.border },
  { value: 'pink', hex: BrandColors.pastels.pink.border },
  { value: 'mint', hex: BrandColors.pastels.mint.border },
  { value: 'periwinkle', hex: BrandColors.pastels.periwinkle.border },
];

const PRESET_CATEGORIES = ['Kerja', 'Pribadi', 'Fokus', 'Penting'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Waktu mulai dibulatkan ke menit nol berikutnya (jam sekarang), lalu blok
 * berakhir `hours` jam setelahnya.
 */
export function defaultTimeBlock(now: Date = new Date(), hours = DEFAULT_BLOCK_HOURS) {
  const startHour = now.getMinutes() > 0 ? now.getHours() + 1 : now.getHours();
  const start = new Date(now);
  start.setHours(startHour, 0, 0, 0);

  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  return {
    startTime: `${pad2(start.getHours())}:${pad2(start.getMinutes())}`,
    endTime: `${pad2(end.getHours())}:${pad2(end.getMinutes())}`,
  };
}

function normalizeTimeInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export const CreateTodoModal: React.FC<CreateTodoModalProps> = ({
  visible,
  targetDate,
  onClose,
  onSave,
}) => {
  const initialBlock = useMemo(() => defaultTimeBlock(), []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(initialBlock.startTime);
  const [endTime, setEndTime] = useState(initialBlock.endTime);
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [category, setCategory] = useState('Kerja');
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [colorTheme, setColorTheme] = useState<PersonalTodoColor>('periwinkle');
  const [subtasks, setSubtasks] = useState<PersonalTodoSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Saat modal dibuka ulang: hitung blok waktu dari jam sekarang. Dijalankan di
  // fase render (pola reset-state resmi React), bukan di effect, agar tidak ada
  // commit ganda dengan nilai lama.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      const block = defaultTimeBlock();
      setStartTime(block.startTime);
      setEndTime(block.endTime);
      setIsEditingCategory(false);
    }
  }

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setCategory('Kerja');
    setColorTheme('periwinkle');
    setSubtasks([]);
    setNewSubtaskTitle('');
    setIsEditingCategory(false);
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([
      ...subtasks,
      {
        id: `sub-${Date.now().toString(36)}`,
        title: newSubtaskTitle.trim(),
        isCompleted: false,
      },
    ]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter((s) => s.id !== id));
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks(
      subtasks.map((s) => (s.id === id ? { ...s, isCompleted: !s.isCompleted } : s))
    );
  };

  const commitCategory = () => {
    const next = categoryDraft.trim();
    if (next) setCategory(next);
    setIsEditingCategory(false);
    setCategoryDraft('');
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
        category: category.trim() || 'Kerja',
        colorTheme,
        subtasks,
      });
      resetForm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>To-Do Baru</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Tutup">
              <X size={20} color={TodoColors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              style={styles.titleInput}
              placeholder="Judul tugas"
              placeholderTextColor={TodoColors.faint}
              value={title}
              onChangeText={setTitle}
              autoCapitalize="sentences"
            />

            <TextInput
              style={styles.descriptionInput}
              placeholder="Deskripsi (opsional)"
              placeholderTextColor={TodoColors.faint}
              multiline
              value={description}
              onChangeText={setDescription}
            />

            {/* Subtask menempel langsung di bawah deskripsi */}
            <View style={styles.subtaskBlock}>
              <Text style={styles.fieldLabel}>Subtask</Text>

              {subtasks.map((sub) => (
                <View key={sub.id} style={styles.subtaskRow}>
                  <TouchableOpacity
                    style={styles.subtaskCheck}
                    onPress={() => handleToggleSubtask(sub.id)}
                    accessibilityLabel={`Tandai ${sub.title}`}
                  >
                    {sub.isCompleted ? (
                      <Check size={12} color={TodoColors.surface} strokeWidth={3} />
                    ) : null}
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.subtaskText,
                      sub.isCompleted && styles.subtaskTextDone,
                    ]}
                  >
                    {sub.title}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveSubtask(sub.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={`Hapus ${sub.title}`}
                  >
                    <Trash2 size={15} color={TodoColors.faint} />
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.addSubtaskRow}>
                <TextInput
                  style={styles.addSubtaskInput}
                  placeholder="Tambah subtask"
                  placeholderTextColor={TodoColors.faint}
                  value={newSubtaskTitle}
                  onChangeText={setNewSubtaskTitle}
                  onSubmitEditing={handleAddSubtask}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.addSubtaskButton}
                  onPress={handleAddSubtask}
                  accessibilityLabel="Tambah subtask"
                >
                  <Plus size={17} color={TodoColors.accent} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Waktu */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Waktu</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeInputWrapper}>
                  <Clock size={15} color={TodoColors.muted} />
                  <TextInput
                    style={styles.timeInput}
                    value={startTime}
                    onChangeText={(v) => setStartTime(normalizeTimeInput(v))}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="08:00"
                    placeholderTextColor={TodoColors.faint}
                  />
                </View>
                <Text style={styles.timeSeparator}>s.d.</Text>
                <View style={styles.timeInputWrapper}>
                  <Clock size={15} color={TodoColors.muted} />
                  <TextInput
                    style={styles.timeInput}
                    value={endTime}
                    onChangeText={(v) => setEndTime(normalizeTimeInput(v))}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="13:00"
                    placeholderTextColor={TodoColors.faint}
                  />
                </View>
              </View>
            </View>

            {/* Warna */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Warna</Text>
              <View style={styles.colorRow}>
                {COLOR_OPTIONS.map((option) => {
                  const isSelected = colorTheme === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.colorDot,
                        { backgroundColor: option.hex },
                        isSelected && styles.colorDotSelected,
                      ]}
                      onPress={() => setColorTheme(option.value)}
                      accessibilityLabel={`Warna ${option.value}`}
                    >
                      {isSelected ? (
                        <Check size={14} color={TodoColors.surface} strokeWidth={3} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Kategori */}
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Kategori</Text>
                {!isEditingCategory ? (
                  <TouchableOpacity
                    onPress={() => {
                      setCategoryDraft(category);
                      setIsEditingCategory(true);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Pencil size={13} color={TodoColors.accent} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {isEditingCategory ? (
                <View style={styles.addSubtaskRow}>
                  <TextInput
                    style={styles.addSubtaskInput}
                    value={categoryDraft}
                    onChangeText={setCategoryDraft}
                    placeholder="Nama kategori"
                    placeholderTextColor={TodoColors.faint}
                    autoFocus
                    onSubmitEditing={commitCategory}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.addSubtaskButton}
                    onPress={commitCategory}
                    accessibilityLabel="Simpan kategori"
                  >
                    <Check size={17} color={TodoColors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addSubtaskButton}
                    onPress={() => setIsEditingCategory(false)}
                    accessibilityLabel="Batal"
                  >
                    <ChevronLeft size={17} color={TodoColors.muted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.chipRow}>
                  {Array.from(new Set([...PRESET_CATEGORIES, category])).map((cat) => {
                    const active = category === cat;
                    const dot = CategoryDotColors[cat] ?? CATEGORY_DOT_FALLBACK;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setCategory(cat)}
                      >
                        <View style={[styles.chipDot, { backgroundColor: dot }]} />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Prioritas */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Prioritas</Text>
              <View style={styles.chipRow}>
                {PRIORITY_OPTIONS.map((option) => {
                  const active = priority === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.priorityChip,
                        active && styles.priorityChipActive,
                        option.value === 'URGENT' && active && styles.priorityChipDanger,
                      ]}
                      onPress={() => setPriority(option.value)}
                    >
                      {option.value === 'URGENT' ? (
                        <TriangleAlert
                          size={14}
                          color={active ? TodoColors.danger : TodoColors.muted}
                        />
                      ) : null}
                      <Text
                        style={[
                          styles.priorityChipText,
                          active && styles.priorityChipTextActive,
                          option.value === 'URGENT' && active && styles.priorityChipTextDanger,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!title.trim() || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!title.trim() || isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Menyimpan…' : 'Simpan To-Do'}
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
    backgroundColor: 'rgba(16, 24, 40, 0.42)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: TodoColors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: TodoColors.border,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TodoColors.title,
  },
  closeButton: {
    padding: 4,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleInput: {
    fontSize: 17,
    fontWeight: '700',
    color: TodoColors.title,
    paddingVertical: 6,
    marginBottom: 4,
  },
  descriptionInput: {
    fontSize: 13.5,
    color: TodoColors.body,
    lineHeight: 20,
    paddingVertical: 6,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  subtaskBlock: {
    backgroundColor: TodoColors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  subtaskCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: TodoColors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TodoColors.surface,
  },
  subtaskText: {
    flex: 1,
    fontSize: 13,
    color: TodoColors.body,
  },
  subtaskTextDone: {
    color: TodoColors.faint,
    textDecorationLine: 'line-through',
  },
  addSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  addSubtaskInput: {
    flex: 1,
    fontSize: 13,
    color: TodoColors.title,
    backgroundColor: TodoColors.surface,
    borderWidth: 1,
    borderColor: TodoColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  addSubtaskButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: TodoColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: TodoColors.border,
    marginVertical: 16,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: TodoColors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TodoColors.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  timeInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: TodoColors.title,
    letterSpacing: 0.5,
  },
  timeSeparator: {
    fontSize: 12,
    color: TodoColors.muted,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 2,
    borderColor: TodoColors.title,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TodoColors.border,
    backgroundColor: TodoColors.surface,
  },
  chipActive: {
    borderColor: TodoColors.accent,
    backgroundColor: TodoColors.accentSoft,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: TodoColors.body,
  },
  chipTextActive: {
    color: TodoColors.accent,
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 46,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TodoColors.border,
    backgroundColor: TodoColors.surface,
  },
  priorityChipActive: {
    borderColor: TodoColors.accent,
    backgroundColor: TodoColors.accentSoft,
  },
  priorityChipDanger: {
    borderColor: TodoColors.danger,
    backgroundColor: TodoColors.dangerSoft,
  },
  priorityChipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: TodoColors.body,
  },
  priorityChipTextActive: {
    color: TodoColors.accent,
  },
  priorityChipTextDanger: {
    color: TodoColors.danger,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: TodoColors.border,
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: TodoColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: TodoColors.surface,
    fontSize: 14.5,
    fontWeight: '700',
  },
});
