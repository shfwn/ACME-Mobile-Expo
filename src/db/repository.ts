import { getDb } from './client';
import { personalTodosTable, personalNotesTable, timeLogsTable } from './schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { PersonalTodo, PersonalNote, PersonalTodoColor, Priority } from '../types/todo.types';
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
      syncStatus: r.syncStatus as PersonalTodo['syncStatus'],
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
      syncStatus: r.syncStatus as PersonalTodo['syncStatus'],
    }));
  },

  async create(data: Omit<PersonalTodo, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>): Promise<PersonalTodo> {
    const db = getDb();
    const now = new Date().toISOString();
    const newId = generateId();

    const newTodo: PersonalTodo = {
      ...data,
      id: newId,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending_push',
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
      syncStatus: 'pending_push',
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
        syncStatus: 'pending_push',
      })
      .where(eq(personalTodosTable.id, id));

    return nextState === 1;
  },

  async update(id: string, updates: Partial<PersonalTodo>): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    const patch: Record<string, unknown> = {
      updatedAt: now,
      syncStatus: 'pending_push',
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
        syncStatus: 'pending_delete',
      })
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
      syncStatus: r.syncStatus as PersonalNote['syncStatus'],
    }));
  },

  async create(data: Omit<PersonalNote, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>): Promise<PersonalNote> {
    const db = getDb();
    const now = new Date().toISOString();
    const newId = generateId();

    const newNote: PersonalNote = {
      ...data,
      id: newId,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending_push',
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
      syncStatus: 'pending_push',
    });

    return newNote;
  },

  async softDelete(id: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    await db
      .update(personalNotesTable)
      .set({
        deletedAt: now,
        updatedAt: now,
        syncStatus: 'pending_delete',
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
      syncStatus: 'pending_push',
    });
  },
};
