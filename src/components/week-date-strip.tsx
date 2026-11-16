import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BrandColors } from '../constants/theme';
import { toIsoDate } from './date-picker-sheet';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface WeekDateStripProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  datesWithEvents?: Set<string>;
}

export const WeekDateStrip: React.FC<WeekDateStripProps> = ({
  selectedDate,
  onSelectDate,
  datesWithEvents = new Set(),
}) => {
  const curr = new Date(selectedDate + 'T00:00:00');
  const dayOfWeek = (curr.getDay() + 6) % 7; // 0 for Monday ... 6 for Sunday

  // Hitung tanggal Senin minggu ini
  const monday = new Date(curr);
  monday.setDate(curr.getDate() - dayOfWeek);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = toIsoDate(d);
    const dayNum = d.getDate();
    const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    return {
      iso,
      dayNum,
      dayName: dayNames[i],
    };
  });

  const shiftWeek = (offset: number) => {
    const next = new Date(curr);
    next.setDate(curr.getDate() + offset * 7);
    onSelectDate(toIsoDate(next));
  };

  const monthYearLabel = curr.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      {/* Month & Week Shift Header */}
      <View style={styles.header}>
        <Text style={styles.monthLabel}>{monthYearLabel}</Text>
        <View style={styles.navButtons}>
          <TouchableOpacity style={styles.arrowBtn} onPress={() => shiftWeek(-1)}>
            <ChevronLeft size={18} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.arrowBtn} onPress={() => shiftWeek(1)}>
            <ChevronRight size={18} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 7 Days Row */}
      <View style={styles.daysRow}>
        {days.map((item) => {
          const isSelected = item.iso === selectedDate;
          const hasEvents = datesWithEvents.has(item.iso);

          return (
            <TouchableOpacity
              key={item.iso}
              style={[styles.dayItem, isSelected && styles.dayItemSelected]}
              onPress={() => onSelectDate(item.iso)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                {item.dayName}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                {item.dayNum}
              </Text>
              <View
                style={[
                  styles.dot,
                  hasEvents && !isSelected && styles.dotActive,
                  hasEvents && isSelected && styles.dotActiveSelected,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'capitalize',
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayItem: {
    width: 44,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  dayItemSelected: {
    backgroundColor: BrandColors.primary,
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  dayNameSelected: {
    color: '#E2E8F0',
  },
  dayNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  dayNumSelected: {
    color: '#FFFFFF',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  dotActive: {
    backgroundColor: BrandColors.periwinkle,
  },
  dotActiveSelected: {
    backgroundColor: '#FFE28A',
  },
});
