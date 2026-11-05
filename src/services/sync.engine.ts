import { getDb } from '../db/client';
import { personalTodosTable, personalNotesTable, syncMetaTable } from '../db/schema';
import { eq, ne, and, isNull } from 'drizzle-orm';
import { ApiClient } from './api.client';
import { AuthStorage } from './auth.storage';

export interface SyncStatusState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

type SyncListener = (status: SyncStatusState) => void;

class SyncEngine {
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.emitStatus();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async emitStatus() {
    const pendingCount = await this.getPendingMutationsCount();
    const state: SyncStatusState = {
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };
    for (const l of this.listeners) {
      l(state);
    }
  }

  async getPendingMutationsCount(): Promise<number> {
    try {
      const db = getDb();
      const [todos, notes] = await Promise.all([
        db
          .select({ id: personalTodosTable.id })
          .from(personalTodosTable)
          .where(ne(personalTodosTable.syncStatus, 'synced')),
        db
          .select({ id: personalNotesTable.id })
          .from(personalNotesTable)
          .where(ne(personalNotesTable.syncStatus, 'synced')),
      ]);
      return todos.length + notes.length;
    } catch {
      return 0;
    }
  }

  /**
   * 1. Push Phase: Mengirim seluruh mutasi lokal yang tertunda ke server
   */
  async pushLocalMutations(): Promise<number> {
    const db = getDb();
    const token = await AuthStorage.getToken();
    if (!token) return 0;

    const [pendingTodos, pendingNotes] = await Promise.all([
      db
        .select()
        .from(personalTodosTable)
        .where(ne(personalTodosTable.syncStatus, 'synced')),
      db
        .select()
        .from(personalNotesTable)
        .where(ne(personalNotesTable.syncStatus, 'synced')),
    ]);

    if (pendingTodos.length === 0 && pendingNotes.length === 0) {
      return 0;
    }

    const payload = {
      mutations: {
        todos: pendingTodos.map((t) => ({
          id: t.id,
          userId: t.userId,
          title: t.title,
          description: t.description,
          targetDate: t.targetDate,
          startTime: t.startTime,
          endTime: t.endTime,
          isCompleted: t.isCompleted === 1,
          priority: t.priority,
          category: t.category,
          deletedAt: t.deletedAt,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        notes: pendingNotes.map((n) => ({
          id: n.id,
          userId: n.userId,
          title: n.title,
          contentMarkdown: n.contentMarkdown,
          linkedDate: n.linkedDate,
          tags: n.tagsJson ? JSON.parse(n.tagsJson) : [],
          deletedAt: n.deletedAt,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        })),
      },
    };

    const res = await ApiClient.post<{
      success: boolean;
      syncedIds: { todos: string[]; notes: string[] };
      timestamp: string;
    }>('/api/mobile/sync/push', payload);

    if (res.success && res.syncedIds) {
      // Tandai to-do lokal sebagai tersinkron atau hapus permanen jika soft-deleted
      for (const todoId of res.syncedIds.todos) {
        const [local] = await db
          .select({ deletedAt: personalTodosTable.deletedAt })
          .from(personalTodosTable)
          .where(eq(personalTodosTable.id, todoId));

        if (local?.deletedAt) {
          await db.delete(personalTodosTable).where(eq(personalTodosTable.id, todoId));
        } else {
          await db
            .update(personalTodosTable)
            .set({ syncStatus: 'synced' })
            .where(eq(personalTodosTable.id, todoId));
        }
      }

      // Tandai catatan lokal sebagai tersinkron
      for (const noteId of res.syncedIds.notes) {
        const [local] = await db
          .select({ deletedAt: personalNotesTable.deletedAt })
          .from(personalNotesTable)
          .where(eq(personalNotesTable.id, noteId));

        if (local?.deletedAt) {
          await db.delete(personalNotesTable).where(eq(personalNotesTable.id, noteId));
        } else {
          await db
            .update(personalNotesTable)
            .set({ syncStatus: 'synced' })
            .where(eq(personalNotesTable.id, noteId));
        }
      }
    }

    return (res.syncedIds?.todos?.length || 0) + (res.syncedIds?.notes?.length || 0);
  }

  /**
   * 2. Pull Phase: Mengambil perubahan terbaru dari Neon DB sejak sinkronisasi terakhir
   */
  async pullRemoteChanges(): Promise<number> {
    const db = getDb();
    const token = await AuthStorage.getToken();
    if (!token) return 0;

    // Ambil timestamp sinkronisasi terakhir
    const [meta] = await db
      .select({ value: syncMetaTable.value })
      .from(syncMetaTable)
      .where(eq(syncMetaTable.key, 'last_sync_timestamp'));

    const since = meta?.value || new Date(0).toISOString();

    const res = await ApiClient.post<{
      success: boolean;
      timestamp: string;
      changes: {
        todos: Array<{
          id: string;
          userId: string;
          title: string;
          description?: string;
          targetDate: string;
          startTime?: string;
          endTime?: string;
          isCompleted: boolean;
          priority: string;
          category: string;
          createdAt: string;
          updatedAt: string;
        }>;
        notes: Array<{
          id: string;
          userId: string;
          title: string;
          contentMarkdown: string;
          linkedDate?: string;
          tags?: string[];
          createdAt: string;
          updatedAt: string;
        }>;
      };
    }>('/api/mobile/sync/pull', { since });

    let pulledCount = 0;

    if (res.success && res.changes) {
      // Upsert remote todos (Last-Write-Wins berdasarkan updated_at)
      for (const remote of res.changes.todos) {
        const [local] = await db
          .select()
          .from(personalTodosTable)
          .where(eq(personalTodosTable.id, remote.id));

        if (!local) {
          await db.insert(personalTodosTable).values({
            id: remote.id,
            userId: remote.userId,
            title: remote.title,
            description: remote.description ?? null,
            targetDate: remote.targetDate,
            startTime: remote.startTime ?? null,
            endTime: remote.endTime ?? null,
            isCompleted: remote.isCompleted ? 1 : 0,
            priority: remote.priority,
            category: remote.category,
            createdAt: remote.createdAt,
            updatedAt: remote.updatedAt,
            syncStatus: 'synced',
          });
          pulledCount++;
        } else if (new Date(remote.updatedAt) > new Date(local.updatedAt)) {
          // Server data is newer: apply update
          await db
            .update(personalTodosTable)
            .set({
              title: remote.title,
              description: remote.description ?? null,
              targetDate: remote.targetDate,
              startTime: remote.startTime ?? null,
              endTime: remote.endTime ?? null,
              isCompleted: remote.isCompleted ? 1 : 0,
              priority: remote.priority,
              category: remote.category,
              updatedAt: remote.updatedAt,
              syncStatus: 'synced',
            })
            .where(eq(personalTodosTable.id, remote.id));
          pulledCount++;
        }
      }

      // Upsert remote notes
      for (const remote of res.changes.notes) {
        const [local] = await db
          .select()
          .from(personalNotesTable)
          .where(eq(personalNotesTable.id, remote.id));

        if (!local) {
          await db.insert(personalNotesTable).values({
            id: remote.id,
            userId: remote.userId,
            title: remote.title,
            contentMarkdown: remote.contentMarkdown,
            linkedDate: remote.linkedDate ?? null,
            tagsJson: JSON.stringify(remote.tags ?? []),
            createdAt: remote.createdAt,
            updatedAt: remote.updatedAt,
            syncStatus: 'synced',
          });
          pulledCount++;
        } else if (new Date(remote.updatedAt) > new Date(local.updatedAt)) {
          await db
            .update(personalNotesTable)
            .set({
              title: remote.title,
              contentMarkdown: remote.contentMarkdown,
              linkedDate: remote.linkedDate ?? null,
              tagsJson: JSON.stringify(remote.tags ?? []),
              updatedAt: remote.updatedAt,
              syncStatus: 'synced',
            })
            .where(eq(personalNotesTable.id, remote.id));
          pulledCount++;
        }
      }

      // Simpan timestamp sinkronisasi terbaru
      const nowIso = res.timestamp || new Date().toISOString();
      await db
        .insert(syncMetaTable)
        .values({
          key: 'last_sync_timestamp',
          value: nowIso,
          updatedAt: nowIso,
        })
        .onConflictDoUpdate({
          target: syncMetaTable.key,
          set: { value: nowIso, updatedAt: nowIso },
        });

      this.lastSyncedAt = nowIso;
    }

    return pulledCount;
  }

  /**
   * 3. Sync All: Siklus atomik push mutasi lalu pull data terbaru
   */
  async syncAll(): Promise<{ success: boolean; pushed: number; pulled: number; error?: string }> {
    if (this.isSyncing) {
      return { success: false, pushed: 0, pulled: 0, error: 'Sinkronisasi sedang berjalan' };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.emitStatus();

    try {
      const pushed = await this.pushLocalMutations();
      const pulled = await this.pullRemoteChanges();

      this.isSyncing = false;
      this.lastSyncedAt = new Date().toISOString();
      this.emitStatus();

      return { success: true, pushed, pulled };
    } catch (err: unknown) {
      this.isSyncing = false;
      const errorMsg = err instanceof Error ? err.message : 'Gagal melakukan sinkronisasi';
      this.lastError = errorMsg;
      this.emitStatus();
      return { success: false, pushed: 0, pulled: 0, error: errorMsg };
    }
  }
}

export const syncEngine = new SyncEngine();
