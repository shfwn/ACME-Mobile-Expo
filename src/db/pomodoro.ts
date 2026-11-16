/**
 * Perhitungan sesi Pomodoro yang bebas dari React, supaya aturan pencatatan
 * jam kerja bisa diuji tanpa me-render komponen.
 *
 * Waktu yang dipakai selalu selisih timestamp, bukan jumlah tick: timer di
 * background atau saat JS thread tersendat tetap akurat.
 */

export type PomodoroMode = 'focus' | 'break';

export interface PomodoroSession {
  taskId?: string;
  /** To-do pribadi (bukan task proyek) yang sedang dihitung. */
  todoId?: string;
  taskTitle?: string;
  mode: PomodoroMode;
  /** Durasi terjadwal (detik). */
  plannedSeconds: number;
  /** Detik yang benar-benar berjalan, sudah dipotong ke plannedSeconds. */
  elapsedSeconds: number;
}

/** Detik berjalan dari titik mulai, dipotong ke durasi terjadwal. */
export function elapsedWithinPlanned(
  startedAtMs: number,
  nowMs: number,
  plannedSeconds: number
): number {
  const raw = Math.floor((nowMs - startedAtMs) / 1000);
  return Math.min(Math.max(raw, 0), plannedSeconds);
}

/**
 * Sesi yang layak dicatat ke `time_logs`.
 *
 * Aturan:
 * - hanya mode `focus` yang dihitung sebagai jam kerja (istirahat bukan kerja),
 * - sesi di bawah 60 detik dibuang agar tidak membanjiri time_logs dengan
 *   potongan yang tidak berarti.
 */
export function sessionToLoggedMinutes(session: PomodoroSession): number | null {
  if (session.mode !== 'focus') return null;
  if (session.elapsedSeconds < 60) return null;
  return Math.floor(session.elapsedSeconds / 60);
}
