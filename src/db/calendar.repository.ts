import * as Crypto from 'expo-crypto';
import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import { getDb } from './client';
import { calendarDaysTable, personalTodosTable } from './schema';
import type { PersonalTodoColor } from '../types/todo.types';

export const CALENDAR_COLORS: PersonalTodoColor[] = ['yellow', 'pink', 'mint', 'periwinkle'];

const KNOWN_COLORS = new Set<string>(CALENDAR_COLORS);

function isKnownColor(value: unknown): value is PersonalTodoColor {
  return typeof value === 'string' && KNOWN_COLORS.has(value);
}

function generateId(): string {
  if (Crypto.randomUUID) return Crypto.randomUUID();
  return `cal-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

export interface CalendarDayMark {
  date: string;
  color: PersonalTodoColor;
  note: string;
}

/** Ringkasan to-do pada satu tanggal, dipakai titik penanda di petak kalender. */
export interface DayTodoSignal {
  /** Ada to-do sama sekali pada tanggal ini. */
  hasTodos: boolean;
  /** Jumlah to-do yang belum selesai. */
  pending: number;
  /** Warna to-do pertama pada tanggal itu — dipakai saat semua sudah selesai. */
  color: PersonalTodoColor;
}

/**
 * Penanda kalender milik pengguna: warna + catatan bebas per tanggal.
 *
 * Dipisah dari `todoRepository` karena tidak bergantung pada to-do: pengguna
 * boleh mewarnai tanggal kosong, dan warnanya tetap ada setelah semua to-do-nya
 * selesai. Titik penanda to-do dihitung terpisah oleh `getTodoSignals`.
 */
export const calendarRepository = {
  /** Semua penanda pada rentang tanggal (inklusif). */
  async getMarks(userId: string, fromIso: string, toIso: string): Promise<CalendarDayMark[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(calendarDaysTable)
      .where(
        and(
          eq(calendarDaysTable.userId, userId),
          gte(calendarDaysTable.date, fromIso),
          lte(calendarDaysTable.date, toIso)
        )
      );

    return rows.map((row) => ({
      date: row.date,
      color: isKnownColor(row.color) ? row.color : 'periwinkle',
      note: row.note ?? '',
    }));
  },

  /**
   * Simpan warna + catatan untuk satu tanggal.
   *
   * Menulis `color` default bila catatan dikosongkan tapi warna dipertahankan,
   * dan menghapus baris bila keduanya kosong: tabel hanya menyimpan tanggal yang
   * benar-benar punya penanda, sehingga tidak menumpuk baris hampa.
   */
  async setDay(
    userId: string,
    date: string,
    input: { color: PersonalTodoColor; note: string }
  ): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const color: PersonalTodoColor = isKnownColor(input.color) ? input.color : 'periwinkle';
    const note = input.note.trim();

    const [existing] = await db
      .select({ id: calendarDaysTable.id })
      .from(calendarDaysTable)
      .where(and(eq(calendarDaysTable.userId, userId), eq(calendarDaysTable.date, date)));

    if (!existing) {
      await db.insert(calendarDaysTable).values({
        id: generateId(),
        userId,
        date,
        color,
        note: note.length > 0 ? note : null,
        createdAt: now,
        updatedAt: now,
      });
      return;
    }

    await db
      .update(calendarDaysTable)
      .set({ color, note: note.length > 0 ? note : null, updatedAt: now })
      .where(eq(calendarDaysTable.id, existing.id));
  },

  /** Hapus penanda (warna kembali default, catatan hilang). */
  async clearDay(userId: string, date: string): Promise<void> {
    const db = getDb();
    await db
      .delete(calendarDaysTable)
      .where(and(eq(calendarDaysTable.userId, userId), eq(calendarDaysTable.date, date)));
  },

  /**
   * Sinyal titik penanda per tanggal pada rentang tertentu.
   *
   * Aturannya: selama masih ada to-do yang belum selesai, titik memakai warna
   * to-do itu; begitu semua selesai, titik berubah abu-abu (ditandai
   * `pending === 0`) supaya hari lampau yang sudah tuntas tidak terlihat aktif.
   */
  async getTodoSignals(
    userId: string,
    fromIso: string,
    toIso: string
  ): Promise<Record<string, DayTodoSignal>> {
    const db = getDb();
    const rows = await db
      .select({
        targetDate: personalTodosTable.targetDate,
        isCompleted: personalTodosTable.isCompleted,
        colorTheme: personalTodosTable.colorTheme,
      })
      .from(personalTodosTable)
      .where(
        and(
          eq(personalTodosTable.userId, userId),
          isNull(personalTodosTable.deletedAt),
          gte(personalTodosTable.targetDate, fromIso),
          lte(personalTodosTable.targetDate, toIso)
        )
      );

    const signals: Record<string, DayTodoSignal> = {};

    for (const row of rows) {
      const color: PersonalTodoColor = isKnownColor(row.colorTheme) ? row.colorTheme : 'periwinkle';
      const current = signals[row.targetDate];

      if (!current) {
        signals[row.targetDate] = {
          hasTodos: true,
          pending: row.isCompleted === 1 ? 0 : 1,
          color,
        };
        continue;
      }

      // Warna titik mengikuti to-do terbuka pertama; to-do selesai tidak pernah
      // menimpa warna itu supaya tanda tidak berkedip antar tanggal.
      if (row.isCompleted === 0) {
        if (current.pending === 0) current.color = color;
        current.pending += 1;
      }
    }

    return signals;
  },
};
