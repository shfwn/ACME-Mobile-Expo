import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { getDb } from '../db/client';
import { personalTodosTable } from '../db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { todoRepository } from '../db/repository';
import type { PersonalTodo } from '../types/todo.types';
import { toIsoDate } from '../components/date-picker-sheet';

const CHANNEL_ID = 'acme-reminders';
const MORNING_BRIEFING_ID = 'acme-morning-briefing';
/** Pengingat dikirim H-15 menit sebelum blok waktu to-do dimulai. */
const REMINDER_LEAD_MINUTES = 15;

let handlerInstalled = false;

function installHandler() {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Notifikasi Expo butuh channel dengan suara di Android 8+. */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Pengingat ACME',
    importance: AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#6C7EC2',
  });
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function reminderDateFor(todo: PersonalTodo, targetDate: string): Date | null {
  if (!todo.startTime) return null;
  const [hours, minutes] = todo.startTime.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const [year, month, day] = targetDate.split('-').map(Number);
  const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const trigger = new Date(start.getTime() - REMINDER_LEAD_MINUTES * 60_000);
  return trigger.getTime() > Date.now() ? trigger : null;
}

/**
 * Jadwalkan ulang seluruh pengingat to-do dari SQLite lokal.
 * Selalu dikosongkan dulu supaya to-do yang sudah selesai/dihapus tidak
 * meninggalkan notifikasi hantu.
 */
async function rescheduleTodoReminders(userId: string): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const db = getDb();
  const rows = await db
    .select()
    .from(personalTodosTable)
    .where(
      and(
        eq(personalTodosTable.userId, userId),
        eq(personalTodosTable.isCompleted, 0),
        isNull(personalTodosTable.deletedAt)
      )
    );

  let scheduled = 0;
  for (const row of rows) {
    const trigger = reminderDateFor(
      { ...row, isCompleted: row.isCompleted === 1 } as unknown as PersonalTodo,
      row.targetDate
    );
    if (!trigger) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Blok waktu sebentar lagi',
        body: `${row.title} · mulai ${row.startTime}`,
        data: { todoId: row.id, kind: 'todo-reminder' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    });
    scheduled++;
  }

  return scheduled;
}

/** Ringkasan pagi: task hari ini + tawaran rollover dari kemarin. */
async function scheduleMorningBriefing(userId: string, today: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(MORNING_BRIEFING_ID).catch(() => {});

  const db = getDb();
  const rows = await db
    .select({
      id: personalTodosTable.id,
      targetDate: personalTodosTable.targetDate,
      isCompleted: personalTodosTable.isCompleted,
    })
    .from(personalTodosTable)
    .where(and(eq(personalTodosTable.userId, userId), isNull(personalTodosTable.deletedAt)));

  const todayCount = rows.filter((r) => r.targetDate === today && r.isCompleted === 0).length;
  const overdueCount = rows.filter((r) => r.targetDate < today && r.isCompleted === 0).length;
  if (todayCount === 0 && overdueCount === 0) return;

  const [year, month, day] = today.split('-').map(Number);
  const briefing = new Date(year, month - 1, day, 8, 0, 0, 0);
  if (briefing.getTime() <= Date.now()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: MORNING_BRIEFING_ID,
    content: {
      title: 'Selamat pagi — ringkasan hari ini',
      body:
        overdueCount > 0
          ? `${todayCount} to-do hari ini, ${overdueCount} dari kemarin belum selesai.`
          : `${todayCount} to-do menunggu hari ini.`,
      data: { kind: 'morning-briefing', overdueCount },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: briefing },
  });
}

export const NotificationService = {
  /** Siapkan channel, izin, dan handler. Aman dipanggil berulang. */
  async initialize(): Promise<boolean> {
    installHandler();
    await ensureAndroidChannel();
    return ensurePermission();
  },

  /** Dipanggil setelah sync sukses supaya jadwal mencerminkan data terbaru. */
  async refreshForUser(userId: string): Promise<void> {
    if (!(await ensurePermission())) return;
    const today = toIsoDate(new Date());
    await rescheduleTodoReminders(userId);
    await scheduleMorningBriefing(userId, today);
  },

  /** Dipakai tes & tombol "matikan pengingat". */
  async clearAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  /**
   * Snooze dari swipe gesture: pindahkan to-do ke hari berikutnya.
   * Mengembalikan tanggal tujuan agar UI bisa memberi umpan balik.
   */
  async snoozeTodo(todo: PersonalTodo): Promise<string> {
    const [year, month, day] = todo.targetDate.split('-').map(Number);
    const next = new Date(year, month - 1, day);
    next.setDate(next.getDate() + 1);
    const nextDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
      next.getDate()
    ).padStart(2, '0')}`;

    await todoRepository.update(todo.id, { targetDate: nextDate });
    return nextDate;
  },
};
