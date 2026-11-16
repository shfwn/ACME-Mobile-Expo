import { getDb } from './client';
import {
  personalTodosTable,
  personalNotesTable,
  timeLogsTable,
  savedSheetLinksTable,
} from './schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import {
  PersonalTodo,
  PersonalNote,
  PersonalTodoColor,
  Priority,
  SavedSheetLink,
} from '../types/todo.types';
import * as Crypto from 'expo-crypto';

function generateId(): string {
  if (Crypto.randomUUID) {
    return Crypto.randomUUID();
  }
  return 'uuid-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
}

export const todoRepository = {
  async getByDate(userId: string, targetDate: string): Promise<PersonalTodo[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(personalTodosTable)
      .where(
        and(
          eq(personalTodosTable.userId, userId),
          eq(personalTodosTable.targetDate, targetDate),
          isNull(personalTodosTable.deletedAt)
        )
      )
      .orderBy(personalTodosTable.startTime);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      description: r.description ?? undefined,
      targetDate: r.targetDate,
      startTime: r.startTime ?? undefined,
      endTime: r.endTime ?? undefined,
      isCompleted: r.isCompleted === 1,
      priority: r.priority as Priority,
      category: r.category,
      colorTheme: r.colorTheme as PersonalTodoColor,
      subtasks: r.subtasksJson ? JSON.parse(r.subtasksJson) : [],
      reminderAt: r.reminderAt ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },

  async getAllByUser(userId: string): Promise<PersonalTodo[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(personalTodosTable)
      .where(
        and(
          eq(personalTodosTable.userId, userId),
          isNull(personalTodosTable.deletedAt)
        )
      )
      .orderBy(desc(personalTodosTable.targetDate));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      description: r.description ?? undefined,
      targetDate: r.targetDate,
      startTime: r.startTime ?? undefined,
      endTime: r.endTime ?? undefined,
      isCompleted: r.isCompleted === 1,
      priority: r.priority as Priority,
      category: r.category,
      colorTheme: r.colorTheme as PersonalTodoColor,
      subtasks: r.subtasksJson ? JSON.parse(r.subtasksJson) : [],
      reminderAt: r.reminderAt ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },

  async create(data: Omit<PersonalTodo, 'id' | 'createdAt' | 'updatedAt'>): Promise<PersonalTodo> {
    const db = getDb();
    const now = new Date().toISOString();
    const newId = generateId();

    const newTodo: PersonalTodo = {
      ...data,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(personalTodosTable).values({
      id: newId,
      userId: data.userId,
      title: data.title,
      description: data.description ?? null,
      targetDate: data.targetDate,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      isCompleted: data.isCompleted ? 1 : 0,
      priority: data.priority,
      category: data.category,
      colorTheme: data.colorTheme ?? 'yellow',
      subtasksJson: data.subtasks ? JSON.stringify(data.subtasks) : '[]',
      reminderAt: data.reminderAt ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    return newTodo;
  },

  async toggleComplete(id: string): Promise<boolean> {
    const db = getDb();
    const [existing] = await db
      .select({ isCompleted: personalTodosTable.isCompleted })
      .from(personalTodosTable)
      .where(eq(personalTodosTable.id, id));

    if (!existing) return false;

    const nextState = existing.isCompleted === 1 ? 0 : 1;
    const now = new Date().toISOString();

    await db
      .update(personalTodosTable)
      .set({
        isCompleted: nextState,
        updatedAt: now,
        })
      .where(eq(personalTodosTable.id, id));

    return nextState === 1;
  },

  async update(id: string, updates: Partial<PersonalTodo>): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    const patch: Record<string, unknown> = {
      updatedAt: now,
      // Edit baru membatalkan jadwal backoff sebelumnya
    };

    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.description !== undefined) patch.description = updates.description ?? null;
    if (updates.targetDate !== undefined) patch.targetDate = updates.targetDate;
    if (updates.startTime !== undefined) patch.startTime = updates.startTime ?? null;
    if (updates.endTime !== undefined) patch.endTime = updates.endTime ?? null;
    if (updates.isCompleted !== undefined) patch.isCompleted = updates.isCompleted ? 1 : 0;
    if (updates.priority !== undefined) patch.priority = updates.priority;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.colorTheme !== undefined) patch.colorTheme = updates.colorTheme;
    if (updates.subtasks !== undefined) patch.subtasksJson = JSON.stringify(updates.subtasks);
    if (updates.reminderAt !== undefined) patch.reminderAt = updates.reminderAt ?? null;

    await db.update(personalTodosTable).set(patch).where(eq(personalTodosTable.id, id));
  },

  async softDelete(id: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    await db
      .update(personalTodosTable)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(personalTodosTable.id, id));
  },

  /**
   * Tetapkan status selesai secara eksplisit. Dipakai saat seluruh subtask
   * dituntaskan, supaya hasilnya tidak bergantung pada state UI yang mungkin basi.
   */
  async setCompleted(id: string, isCompleted: boolean): Promise<void> {
    const db = getDb();
    await db
      .update(personalTodosTable)
      .set({ isCompleted: isCompleted ? 1 : 0, updatedAt: new Date().toISOString() })
      .where(eq(personalTodosTable.id, id));
  },
};

export const notesRepository = {
  async getAll(userId: string): Promise<PersonalNote[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(personalNotesTable)
      .where(
        and(
          eq(personalNotesTable.userId, userId),
          isNull(personalNotesTable.deletedAt)
        )
      )
      .orderBy(desc(personalNotesTable.createdAt));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      contentMarkdown: r.contentMarkdown,
      linkedDate: r.linkedDate ?? undefined,
      tags: r.tagsJson ? JSON.parse(r.tagsJson) : [],
      audioUrl: r.audioUrl ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },

  async create(data: Omit<PersonalNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<PersonalNote> {
    const db = getDb();
    const now = new Date().toISOString();
    const newId = generateId();

    const newNote: PersonalNote = {
      ...data,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(personalNotesTable).values({
      id: newId,
      userId: data.userId,
      title: data.title,
      contentMarkdown: data.contentMarkdown,
      linkedDate: data.linkedDate ?? null,
      tagsJson: JSON.stringify(data.tags ?? []),
      audioUrl: data.audioUrl ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    return newNote;
  },

  async update(
    id: string,
    updates: {
      title?: string;
      contentMarkdown?: string;
      linkedDate?: string | null;
      tags?: string[];
      audioUrl?: string | null;
    }
  ): Promise<void> {
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.contentMarkdown !== undefined) patch.contentMarkdown = updates.contentMarkdown;
    if (updates.linkedDate !== undefined) patch.linkedDate = updates.linkedDate;
    if (updates.tags !== undefined) patch.tagsJson = JSON.stringify(updates.tags);
    if (updates.audioUrl !== undefined) patch.audioUrl = updates.audioUrl;

    await db.update(personalNotesTable).set(patch).where(eq(personalNotesTable.id, id));
  },

  async softDelete(id: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    await db
      .update(personalNotesTable)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(personalNotesTable.id, id));
  },
};

export const timeLogRepository = {
  async logDuration(
    userId: string,
    durationMinutes: number,
    options?: { taskId?: string; todoId?: string; note?: string; durationSeconds?: number }
  ): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const newId = generateId();

    await db.insert(timeLogsTable).values({
      id: newId,
      userId,
      durationMinutes,
      durationSeconds: options?.durationSeconds ?? 0,
      taskId: options?.taskId ?? null,
      todoId: options?.todoId ?? null,
      note: options?.note ?? null,
      startedAt: null,
      endedAt: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  },
};

export const sheetLinkRepository = {
  async getAll(userId: string): Promise<SavedSheetLink[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(savedSheetLinksTable)
      .where(and(eq(savedSheetLinksTable.userId, userId), isNull(savedSheetLinksTable.deletedAt)))
      .orderBy(desc(savedSheetLinksTable.createdAt));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      url: r.url,
      category: r.category,
      createdAt: r.createdAt,
    }));
  },

  async create(data: {
    userId: string;
    title: string;
    url: string;
    category?: string;
  }): Promise<SavedSheetLink> {
    const db = getDb();
    const now = new Date().toISOString();
    const id = generateId();

    await db.insert(savedSheetLinksTable).values({
      id,
      userId: data.userId,
      title: data.title,
      url: data.url,
      category: data.category ?? 'Spreadsheet',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    return {
      id,
      userId: data.userId,
      title: data.title,
      url: data.url,
      category: data.category ?? 'Spreadsheet',
      createdAt: now,
    };
  },

  async softDelete(id: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    await db
      .update(savedSheetLinksTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(savedSheetLinksTable.id, id));
  },
};
