import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pause, Play, RotateCcw, Square, Timer } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BrandColors, Spacing } from '../constants/theme';
import type { PomodoroMode, PomodoroSession } from '../db/pomodoro';
import { elapsedWithinPlanned } from '../db/pomodoro';

export type { PomodoroMode, PomodoroSession };

interface PomodoroTimerProps {
  visible: boolean;
  onClose: () => void;
  taskId?: string;
  todoId?: string;
  taskTitle?: string;
  /** Dipanggil saat sesi berakhir (selesai alami atau dihentikan). */
  onSessionEnd: (session: PomodoroSession) => void;
  focusMinutes?: number;
  breakMinutes?: number;
}

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

const formatClock = (totalSeconds: number) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Timer Pomodoro berbasis timestamp.
 *
 * Waktu yang dipakai adalah selisih `Date.now()` dengan waktu mulai, bukan
 * akumulasi per-tick, supaya timer tetap akurat ketika app dijeda di background
 * atau JS thread tersendat.
 */
export function PomodoroTimer({
  visible,
  onClose,
  taskId,
  todoId,
  taskTitle,
  onSessionEnd,
  focusMinutes = DEFAULT_FOCUS_MINUTES,
  breakMinutes = DEFAULT_BREAK_MINUTES,
}: PomodoroTimerProps) {
  // Menutup modal me-remount timer lewat `key`, sehingga ref/state kembali ke
  // nol tanpa setState atau penulisan ref di fase render.
  const [openCount, setOpenCount] = useState(0);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setOpenCount((c) => c + 1);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <PomodoroSessionSheet
        key={openCount}
        onClose={onClose}
        taskId={taskId}
        todoId={todoId}
        taskTitle={taskTitle}
        onSessionEnd={onSessionEnd}
        focusMinutes={focusMinutes}
        breakMinutes={breakMinutes}
      />
    </Modal>
  );
}

const PomodoroSessionSheet: React.FC<Omit<PomodoroTimerProps, 'visible'>> = ({
  onClose,
  taskId,
  todoId,
  taskTitle,
  onSessionEnd,
  focusMinutes = DEFAULT_FOCUS_MINUTES,
  breakMinutes = DEFAULT_BREAK_MINUTES,
}) => {
  const [mode, setMode] = useState<PomodoroMode>('focus');
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const baseElapsedRef = useRef(0);

  const plannedSeconds = (mode === 'focus' ? focusMinutes : breakMinutes) * 60;
  const remaining = Math.max(0, plannedSeconds - elapsedSeconds);
  const progress = plannedSeconds > 0 ? Math.min(1, elapsedSeconds / plannedSeconds) : 0;

  const reset = useCallback(() => {
    startedAtRef.current = null;
    baseElapsedRef.current = 0;
    setElapsedSeconds(0);
    setIsRunning(false);
  }, []);

  // `finish` didefinisikan setelah effect tick; ref menjaga interval tetap
  // memakai versi terbaru tanpa ikut men-subscribe ulang.
  const finishRef = useRef<(completedNaturally: boolean) => void>(() => {});

  useEffect(() => {
    if (!isRunning) return;
    startedAtRef.current = Date.now();

    const interval = setInterval(() => {
      if (startedAtRef.current === null) return;
      const delta = elapsedWithinPlanned(startedAtRef.current, Date.now(), plannedSeconds);
      const next = Math.min(baseElapsedRef.current + delta, plannedSeconds);
      setElapsedSeconds(next);
      // Sesi habis ditangani di dalam tick: tidak perlu effect tambahan yang
      // memanggil setState setelah render.
      if (next >= plannedSeconds) finishRef.current(true);
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning, plannedSeconds]);

  const finish = useCallback(
    (completedNaturally: boolean) => {
      // Tick dan tombol stop bisa memanggil finish hampir bersamaan; hanya
      // panggilan pertama yang boleh mencatat sesi.
      if (startedAtRef.current === null && baseElapsedRef.current === 0) return;

      const finalElapsed = startedAtRef.current
        ? baseElapsedRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000)
        : baseElapsedRef.current;

      // Hentikan tick lebih dulu agar interval terakhir tidak mencatat sesi ganda.
      setIsRunning(false);

      if (finalElapsed > 0) {
        onSessionEnd({
          taskId,
          todoId,
          taskTitle,
          mode,
          plannedSeconds,
          elapsedSeconds: Math.min(finalElapsed, plannedSeconds),
        });
      }

      if (completedNaturally) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      reset();
    },
    [mode, onSessionEnd, plannedSeconds, reset, taskId, taskTitle, todoId]
  );

  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const toggleRunning = useCallback(() => {
    if (isRunning) {
      if (startedAtRef.current !== null) {
        baseElapsedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000);
      }
      startedAtRef.current = null;
      setIsRunning(false);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setIsRunning(true);
  }, [isRunning]);

  const switchMode = useCallback(
    (next: PomodoroMode) => {
      if (next === mode) return;
      // Menukar mode di tengah sesi menutup sesi berjalan agar jamnya tercatat.
      if (elapsedSeconds > 0) finish(false);
      setMode(next);
      reset();
    },
    [elapsedSeconds, finish, mode, reset]
  );

  const totalLabel = useMemo(
    () => (mode === 'focus' ? `${focusMinutes} menit fokus` : `${breakMinutes} menit istirahat`),
    [breakMinutes, focusMinutes, mode]
  );

  return (
    <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Timer size={18} color={BrandColors.primary} />
            <Text style={styles.title}>Pomodoro</Text>
            {taskTitle ? (
              <Text style={styles.taskTitle} numberOfLines={1}>
                {taskTitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeBtn, mode === 'focus' && styles.modeBtnActive]}
              onPress={() => switchMode('focus')}
            >
              <Text style={[styles.modeText, mode === 'focus' && styles.modeTextActive]}>Fokus</Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, mode === 'break' && styles.modeBtnActive]}
              onPress={() => switchMode('break')}
            >
              <Text style={[styles.modeText, mode === 'break' && styles.modeTextActive]}>
                Istirahat
              </Text>
            </Pressable>
          </View>

          <Text style={styles.clock}>{formatClock(remaining)}</Text>
          <Text style={styles.subLabel}>{totalLabel} · {formatClock(elapsedSeconds)} tercatat</Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryBtn} onPress={() => finish(false)}>
              <Square size={16} color={BrandColors.primary} />
              <Text style={styles.secondaryText}>Simpan & tutup</Text>
            </Pressable>

            <Pressable style={styles.primaryBtn} onPress={toggleRunning}>
              {isRunning ? (
                <Pause size={18} color="#FFFFFF" />
              ) : (
                <Play size={18} color="#FFFFFF" />
              )}
              <Text style={styles.primaryText}>{isRunning ? 'Jeda' : 'Mulai'}</Text>
            </Pressable>

            <Pressable style={styles.iconBtn} onPress={reset} accessibilityLabel="Reset timer">
              <RotateCcw size={18} color="#64748B" />
            </Pressable>
          </View>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 17, 23, 0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    paddingTop: Spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  taskTitle: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    color: '#64748B',
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modeBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  modeBtnActive: {
    backgroundColor: BrandColors.periwinkle,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  clock: {
    fontSize: 56,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: Spacing.xl,
    fontVariant: ['tabular-nums'],
  },
  subLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748B',
    marginTop: Spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: BrandColors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    backgroundColor: BrandColors.primary,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  secondaryText: {
    color: BrandColors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
});
