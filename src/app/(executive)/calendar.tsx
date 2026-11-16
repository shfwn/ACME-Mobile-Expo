import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  CalendarDays,
  Check,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth.store';
import {
  CALENDAR_COLORS,
  calendarRepository,
  type CalendarDayMark,
  type DayTodoSignal,
} from '../../db/calendar.repository';
import type { PersonalTodoColor } from '../../types/todo.types';
import { BrandColors, TodoColors } from '../../constants/theme';
import {
  DatePickerSheet,
  formatDayMonthYear,
  fromIsoDate,
  toIsoDate,
} from '../../components/date-picker-sheet';

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

const WEEKDAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const COLOR_LABEL: Record<PersonalTodoColor, string> = {
  yellow: 'Kuning',
  pink: 'Coral',
  mint: 'Mint',
  periwinkle: 'Periwinkle',
};

interface DayCell {
  iso: string;
  dayNum: number;
  weekday: number;
}

/** Tanggal 1..akhir bulan, plus jumlah sel kosong sebelum tanggal 1 (Senin = index 0). */
function buildMonth(year: number, month: number): { cells: DayCell[]; leading: number } {
  const total = new Date(year, month + 1, 0).getDate();
  const cells: DayCell[] = Array.from({ length: total }, (_, i) => {
    const date = new Date(year, month, i + 1);
    return {
      iso: toIsoDate(date),
      dayNum: i + 1,
      weekday: (date.getDay() + 6) % 7,
    };
  });

  return { cells, leading: cells[0]?.weekday ?? 0 };
}

export default function ExecutiveCalendarScreen() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const now = new Date();
  const todayIso = toIsoDate(now);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth());
  const [marks, setMarks] = useState<Record<string, CalendarDayMark>>({});
  const [signals, setSignals] = useState<Record<string, DayTodoSignal>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState<boolean>(false);

  // Editor tanggal
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draftColor, setDraftColor] = useState<PersonalTodoColor | null>(null);
  const [draftNote, setDraftNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const { cells, leading } = useMemo(() => buildMonth(year, month), [month, year]);

  const loadMonth = useCallback(async () => {
    setIsLoading(true);
    try {
      const first = toIsoDate(new Date(year, month, 1));
      const last = toIsoDate(new Date(year, month + 1, 0));

      const [markList, signalMap] = await Promise.all([
        calendarRepository.getMarks(userId, first, last),
        calendarRepository.getTodoSignals(userId, first, last),
      ]);

      const markMap: Record<string, CalendarDayMark> = {};
      for (const mark of markList) markMap[mark.date] = mark;

      setMarks(markMap);
      setSignals(signalMap);
    } catch (e) {
      console.warn('Gagal memuat kalender:', e);
      setMarks({});
      setSignals({});
    } finally {
      setIsLoading(false);
    }
  }, [month, userId, year, setIsLoading, setMarks, setSignals]);

  useFocusEffect(
    useCallback(() => {
      loadMonth();
    }, [loadMonth])
  );

  const openEditor = (iso: string) => {
    const existing = marks[iso];
    setDraftColor(existing ? existing.color : null);
    setDraftNote(existing?.note ?? '');
    setEditingDate(iso);
  };

  const closeEditor = () => {
    setEditingDate(null);
    setIsSaving(false);
  };

  const handleSelectColor = (color: PersonalTodoColor) => {
    setDraftColor((prev) => (prev === color ? null : color));
  };

  const confirmClear = (iso: string) => {
    Alert.alert(
      'Hapus Penanda',
      `Warna dan catatan pada ${formatDayMonthYear(iso)} akan dihapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await calendarRepository.clearDay(userId, iso);
              await loadMonth();
            } catch (e) {
              console.warn('Gagal menghapus penanda kalender:', e);
            }
          },
        },
      ]
    );
  };

  const handleDeleteFromModal = () => {
    if (!editingDate) return;
    Alert.alert(
      'Hapus Penanda',
      `Warna dan catatan pada ${formatDayMonthYear(editingDate)} akan dihapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await calendarRepository.clearDay(userId, editingDate);
              closeEditor();
              await loadMonth();
            } catch (e) {
              console.warn('Gagal menghapus penanda:', e);
            }
          },
        },
      ]
    );
  };

  // Logic validasi simpan yang benar
  const existingMark = editingDate ? marks[editingDate] : undefined;
  const hasExistingMark = Boolean(existingMark);
  const noteTrimmed = draftNote.trim();
  const hasContent = draftColor !== null || noteTrimmed.length > 0;
  const isModified = hasExistingMark
    ? draftColor !== existingMark?.color || noteTrimmed !== (existingMark?.note ?? '')
    : hasContent;
  const canSave = hasContent && isModified;

  const saveDay = async () => {
    if (!editingDate) return;
    setIsSaving(true);
    try {
      const finalColor: PersonalTodoColor = draftColor ?? 'periwinkle';
      await calendarRepository.setDay(userId, editingDate, {
        color: finalColor,
        note: draftNote,
      });
      closeEditor();
      await loadMonth();
    } catch (e) {
      console.warn('Gagal menyimpan penanda kalender:', e);
      setIsSaving(false);
    }
  };

  // Ringkasan aktivitas bulanan
  const daysWithTasks = useMemo(() => {
    return Object.values(signals).filter((s) => s.hasTodos).length;
  }, [signals]);

  const daysCompleted = useMemo(() => {
    return Object.values(signals).filter((s) => s.hasTodos && s.pending === 0).length;
  }, [signals]);

  const markedDaysCount = useMemo(() => {
    return Object.keys(marks).length;
  }, [marks]);

  const monthProgressPercent =
    daysWithTasks > 0 ? Math.round((daysCompleted / daysWithTasks) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* 1. Header Bulan & Tahun */}
      <View style={styles.monthNav}>
        <TouchableOpacity
          style={styles.navCenter}
          onPress={() => setIsMonthPickerOpen(true)}
          accessibilityLabel={`${MONTH_NAMES[month]} ${year}. Ketuk untuk ganti bulan`}
        >
          <View style={styles.navTitleRow}>
            <CalendarDays size={16} color={TodoColors.accent} strokeWidth={2.2} />
            <Text style={styles.navTitle}>
              {MONTH_NAMES[month]} {year}
            </Text>
          </View>
          <Text style={styles.navHint}>
            {isCurrentMonth ? 'Bulan ini · ketuk untuk pilih' : 'Ketuk untuk pilih'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Kartu Ringkasan Progres Bulanan: identik dengan progressCard di Tasks */}
      <View style={styles.progressCard}>
        <View style={styles.progressTextRow}>
          <Text style={styles.progressTitle}>Aktivitas Bulan Ini</Text>
          <Text style={styles.progressValue}>
            {daysWithTasks > 0
              ? `${daysCompleted} dari ${daysWithTasks} hari tuntas (${monthProgressPercent}%)`
              : `${markedDaysCount} tanggal ditandai`}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width:
                  daysWithTasks > 0
                    ? `${monthProgressPercent}%`
                    : markedDaysCount > 0
                    ? '100%'
                    : '0%',
                backgroundColor:
                  monthProgressPercent === 100 || (daysWithTasks === 0 && markedDaysCount > 0)
                    ? '#10B981'
                    : BrandColors.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* 3. Petak Tanggal Kalender */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.calendarCard}>
            <View style={styles.weekdayRow}>
              {WEEKDAY_HEADERS.map((label, index) => (
                <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {Array.from({ length: leading }, (_, i) => (
                <View key={`blank-${i}`} style={styles.cell} />
              ))}

              {cells.map((cell) => {
                const mark = marks[cell.iso];
                const signal = signals[cell.iso];
                const pastel = mark ? BrandColors.pastels[mark.color] : null;
                const isToday = cell.iso === todayIso;
                const hasNote = Boolean(mark?.note);

                return (
                  <Pressable
                    key={cell.iso}
                    style={styles.cell}
                    onPress={() => openEditor(cell.iso)}
                    onLongPress={mark ? () => confirmClear(cell.iso) : undefined}
                    delayLongPress={450}
                    accessibilityLabel={`${cell.dayNum} ${MONTH_NAMES[month]}${
                      hasNote ? ', ada catatan' : ''
                    }, ketuk untuk menandai${
                      mark ? ', tekan lama untuk menghapus penanda' : ''
                    }`}
                  >
                    {({ pressed }) => (
                      <View
                        style={[
                          styles.cellBox,
                          pastel
                            ? { backgroundColor: pastel.bg, borderColor: pastel.border }
                            : styles.cellBoxEmpty,
                          isToday && styles.cellToday,
                          pressed && styles.cellPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNum,
                            pastel ? { color: pastel.text } : null,
                            isToday && styles.dayNumToday,
                          ]}
                        >
                          {cell.dayNum}
                        </Text>

                        <View style={styles.cellFooter}>
                          {hasNote ? (
                            <StickyNote size={8} color={pastel?.text ?? TodoColors.muted} />
                          ) : null}

                          {signal?.hasTodos ? (
                            <View
                              style={[
                                styles.todoDot,
                                {
                                  backgroundColor:
                                    signal.pending > 0
                                      ? BrandColors.pastels[signal.color].border
                                      : '#CBD5E1',
                                },
                              ]}
                            />
                          ) : null}
                        </View>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Legenda Keterangan */}
          <View style={styles.legendCard}>
            <View style={styles.legendRow}>
              <View
                style={[styles.legendDot, { backgroundColor: BrandColors.pastels.mint.border }]}
              />
              <Text style={styles.legendText}>Tugas aktif</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#CBD5E1' }]} />
              <Text style={styles.legendText}>Semua selesai</Text>
            </View>
            <View style={styles.legendRow}>
              <StickyNote size={11} color={TodoColors.muted} />
              <Text style={styles.legendText}>Catatan</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendToday} />
              <Text style={styles.legendText}>Hari ini</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Date Picker Modal untuk memilih bulan dan tanggal */}
      <DatePickerSheet
        visible={isMonthPickerOpen}
        value={toIsoDate(new Date(year, month, 1))}
        onClose={() => setIsMonthPickerOpen(false)}
        onSelect={(iso) => {
          const picked = fromIsoDate(iso);
          setYear(picked.getFullYear());
          setMonth(picked.getMonth());
        }}
      />

      {/* 4. Modal Editor Catatan & Warna Tanggal */}
      <Modal
        visible={editingDate !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEditor}
      >
        <Pressable style={styles.backdrop} onPress={closeEditor}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editingDate ? formatDayMonthYear(editingDate) : ''}
              </Text>
              <TouchableOpacity
                onPress={closeEditor}
                style={styles.closeBtn}
                accessibilityLabel="Tutup"
              >
                <X size={16} color={TodoColors.muted} />
              </TouchableOpacity>
            </View>

            {/* Input Catatan */}
            <TextInput
              style={styles.noteInput}
              placeholder="Tulis catatan untuk tanggal ini..."
              placeholderTextColor={TodoColors.faint}
              value={draftNote}
              onChangeText={setDraftNote}
              multiline
              textAlignVertical="top"
            />

            {/* Pilihan warna: bulat dan kecil di bawah teks input */}
            <View style={styles.colorPickerSection}>
              <Text style={styles.colorPickerLabel}>Warna:</Text>
              <View style={styles.colorCirclesRow}>
                {CALENDAR_COLORS.map((color) => {
                  const pastel = BrandColors.pastels[color];
                  const isActive = draftColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorDot,
                        { backgroundColor: pastel.badge, borderColor: pastel.border },
                        isActive && styles.colorDotActive,
                      ]}
                      onPress={() => handleSelectColor(color)}
                      accessibilityLabel={COLOR_LABEL[color]}
                      activeOpacity={0.7}
                    >
                      {isActive ? (
                        <Check size={12} color={pastel.text} strokeWidth={3} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.sheetActions}>
              {hasExistingMark ? (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={handleDeleteFromModal}
                  disabled={isSaving}
                  accessibilityLabel="Hapus Penanda"
                >
                  <Trash2 size={16} color={TodoColors.danger} />
                  <Text style={styles.deleteBtnText}>Hapus</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!canSave || isSaving) && styles.submitBtnDisabled,
                ]}
                onPress={saveDay}
                disabled={!canSave || isSaving}
                accessibilityState={{ disabled: !canSave || isSaving }}
              >
                <Text style={styles.submitBtnText}>
                  {isSaving ? 'Menyimpan...' : 'Simpan'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetHint}>
              Tekan lama tanggal pada kalender untuk menghapus penanda secara cepat.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  monthNav: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  navCenter: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: TodoColors.accentSoft,
  },
  navTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  navTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: TodoColors.accent,
  },
  navHint: {
    fontSize: 10.5,
    fontWeight: '500',
    color: TodoColors.faint,
    marginTop: 2,
  },
  progressCard: {
    marginHorizontal: 16,
    marginTop: 8,
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
  scrollContent: {
    paddingBottom: 32,
  },
  calendarCard: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: TodoColors.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.94,
    padding: 2.5,
  },
  cellBox: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  cellBoxEmpty: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  cellToday: {
    borderColor: BrandColors.primary,
    borderWidth: 2,
    backgroundColor: TodoColors.accentSoft,
  },
  cellPressed: {
    opacity: 0.65,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '700',
    color: TodoColors.body,
  },
  dayNumToday: {
    color: BrandColors.primary,
    fontWeight: '800',
  },
  cellFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    height: 8,
  },
  todoDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legendCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendToday: {
    width: 8,
    height: 8,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: BrandColors.primary,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: TodoColors.muted,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: TodoColors.surfaceMuted,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: TodoColors.title,
  },
  noteInput: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TodoColors.border,
    padding: 12,
    fontSize: 13.5,
    color: TodoColors.title,
    backgroundColor: TodoColors.surfaceMuted,
  },
  colorPickerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  colorPickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TodoColors.muted,
  },
  colorCirclesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  colorDotActive: {
    borderWidth: 2,
    borderColor: TodoColors.accent,
    transform: [{ scale: 1.15 }],
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: TodoColors.danger,
  },
  submitBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetHint: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: '500',
    color: TodoColors.faint,
    textAlign: 'center',
  },
});
