import { useCallback, useMemo, useState } from 'react';
import { Animated, Platform, PanResponder, type PanResponderGestureState } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { PersonalTodo } from '../types/todo.types';

export type TodoSwipeAction = 'complete' | 'snooze';

/** Ambang geser (px) sebelum aksi dianggap sah. */
export const SWIPE_THRESHOLD = 96;

/**
 * Aksi yang dipicu oleh jarak geser horizontal.
 *
 * Dipisah dari komponen agar aturannya bisa diuji: geser kanan = selesai,
 * geser kiri = snooze, dan to-do yang sudah selesai tidak menerima swipe
 * "selesai" lagi (tetap boleh di-snooze).
 */
export function resolveSwipeAction(dx: number, isCompleted: boolean): TodoSwipeAction | null {
  if (Math.abs(dx) < SWIPE_THRESHOLD) return null;
  if (dx > 0) return isCompleted ? null : 'complete';
  return 'snooze';
}

/**
 * Gesture swipe untuk satu kartu to-do.
 *
 * Memakai PanResponder (bukan Reanimated) agar berjalan di semua platform
 * tanpa konfigurasi worklet tambahan; haptic memberi umpan balik saat ambang
 * terlewati.
 *
 * Status selesai kartu dan callback diambil dari props sehingga PanResponder
 * selalu memakai nilai segar; tidak ada ref yang dibaca saat render.
 */
export function useTodoSwipe(
  todo: PersonalTodo,
  onAction: (action: TodoSwipeAction) => void
) {
  // Nilai animasi dibuat sekali per instance lewat lazy initializer, bukan ref,
  // supaya boleh dibaca saat render (nilai ini memang dipakai di style).
  const [translateX] = useState(() => new Animated.Value(0));
  const isCompleted = !!todo.isCompleted;

  // Handler diturunkan dari props lewat useCallback, sehingga PanResponder
  // hanya dibuat ulang saat status selesai berubah.
  const handleMove = useCallback(
    (gesture: PanResponderGestureState) => {
      const clamped = Math.max(-160, Math.min(160, gesture.dx));
      translateX.setValue(clamped);

      const action = resolveSwipeAction(clamped, isCompleted);
      // Satu getaran per kali ambang terlewati (state lokal di closure handler).
      if (action && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    },
    [isCompleted, translateX]
  );

  const handleRelease = useCallback(
    (gesture: PanResponderGestureState) => {
      const action = resolveSwipeAction(gesture.dx, isCompleted);
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        friction: 6,
      }).start();

      if (!action) return;
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          action === 'complete'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
        ).catch(() => {});
      }
      onAction(action);
    },
    [isCompleted, onAction, translateX]
  );

  const handleTerminate = useCallback(() => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  }, [translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderMove: (_evt, gesture) => handleMove(gesture),
        onPanResponderRelease: (_evt, gesture) => handleRelease(gesture),
        onPanResponderTerminate: handleTerminate,
      }),
    [handleMove, handleRelease, handleTerminate]
  );

  return { panHandlers: panResponder.panHandlers, translateX };
}
