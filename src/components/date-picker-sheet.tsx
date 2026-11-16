import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { TodoColors } from '../constants/theme';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react-native';

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

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/** Tanggal lokal dalam bentuk YYYY-MM-DD tanpa geser zona waktu. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Label tanggal header: "10 November 2026".
 *
 * Tanpa nama hari: strip tanggal seminggu sudah menunjukkan hari, dan header
 * Tasks/Jadwal butuh lebar untuk tombol menu di sisi kanan.
 */
export function formatDayMonthYear(iso: string): string {
  const date = fromIsoDate(iso);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** Sel yang akan tampil pada grid bulanan (selalu kelipatan 7, mulai Senin). */
export function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

interface DatePickerSheetProps {
  visible: boolean;
  value: string; // YYYY-MM-DD
  onClose: () => void;
  onSelect: (iso: string) => void;
  /** Dipakai untuk menandai tanggal yang punya isi. */
  datesWithContent?: Set<string>;
  /** Bila diisi, header ini yang dipakai (mis. "November 2026") alih-alih "Pilih Tanggal". */
  monthTitle?: string;
}

/**
 * Pemilih tanggal berbentuk kalender bulanan.
 *
 * Dibangun sendiri (bukan modal native) supaya bisa menampilkan penanda
 * "ada isi" dan menerapkan palet aplikasi di kedua platform.
 */
export const DatePickerSheet: React.FC<DatePickerSheetProps> = ({
  visible,
  value,
  onClose,
  onSelect,
  datesWithContent,
  monthTitle,
}) => {
  const initial = useMemo(() => fromIsoDate(value), [value]);
  const [cursor, setCursor] = useState<Date>(initial);
  const [prevValue, setPrevValue] = useState(value);
  const [showNativePicker, setShowNativePicker] = useState(false);

  if (value !== prevValue) {
    setPrevValue(value);
    setCursor(fromIsoDate(value));
  }

  const todayIso = toIsoDate(new Date());
  const cells = buildMonthGrid(cursor.getFullYear(), cursor.getMonth());

  const shiftMonth = (offset: number) => {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1));
  };

  const handleNativeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowNativePicker(false);
    if (event.type === 'set' && date) {
      onSelect(toIsoDate(date));
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {monthTitle ?? `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Tutup">
              <X size={18} color={TodoColors.muted} />
            </TouchableOpacity>
          </View>

          {monthTitle ? null : (
            <View style={styles.monthBar}>
              <TouchableOpacity
                style={styles.monthArrow}
                onPress={() => shiftMonth(-1)}
                accessibilityLabel="Bulan sebelumnya"
              >
                <ChevronLeft size={18} color={TodoColors.body} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>
                {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
              </Text>
              <TouchableOpacity
                style={styles.monthArrow}
                onPress={() => shiftMonth(1)}
                accessibilityLabel="Bulan berikutnya"
              >
                <ChevronRight size={18} color={TodoColors.body} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.weekHeader}>
            {DAY_NAMES.map((day) => (
              <Text key={day} style={styles.weekHeaderText}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((date, index) => {
              if (!date) return <View key={`empty-${index}`} style={styles.cell} />;

              const iso = toIsoDate(date);
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              const hasContent = datesWithContent?.has(iso) ?? false;

              return (
                <TouchableOpacity
                  key={iso}
                  style={styles.cell}
                  onPress={() => {
                    onSelect(iso);
                    onClose();
                  }}
                >
                  <View
                    style={[
                      styles.cellInner,
                      isToday && !isSelected && styles.cellToday,
                      isSelected && styles.cellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        isToday && !isSelected && styles.cellTextToday,
                        isSelected && styles.cellTextSelected,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {hasContent ? (
                      <View
                        style={[
                          styles.contentDot,
                          isSelected && styles.contentDotSelected,
                        ]}
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.footerButton}
              onPress={() => {
                onSelect(todayIso);
                onClose();
              }}
            >
              <CalendarDays size={15} color={TodoColors.accent} />
              <Text style={styles.footerButtonText}>Hari ini</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerButton}
              onPress={() => setShowNativePicker(true)}
            >
              <Text style={styles.footerButtonText}>Pilih dari kalender sistem</Text>
            </TouchableOpacity>
          </View>

          {showNativePicker ? (
            <DateTimePicker
              value={initial}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              onChange={handleNativeChange}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: TodoColors.surface,
    borderRadius: 18,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TodoColors.title,
  },
  closeButton: {
    padding: 4,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  monthArrow: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TodoColors.surfaceMuted,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TodoColors.title,
  },
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: TodoColors.faint,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  cell: {
    width: `${100 / 7}%`,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInner: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellToday: {
    backgroundColor: TodoColors.accentSoft,
  },
  cellSelected: {
    backgroundColor: TodoColors.accent,
  },
  cellText: {
    fontSize: 13,
    fontWeight: '600',
    color: TodoColors.body,
  },
  cellTextToday: {
    color: TodoColors.accent,
  },
  cellTextSelected: {
    color: TodoColors.surface,
  },
  contentDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: TodoColors.accent,
  },
  contentDotSelected: {
    backgroundColor: TodoColors.surface,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: TodoColors.border,
    gap: 10,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: TodoColors.accentSoft,
  },
  footerButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: TodoColors.accent,
  },
});
