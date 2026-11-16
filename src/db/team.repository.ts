import { getDb } from './client';
import {
  projectsTable,
  customStatusesTable,
  tasksTable,
  subtasksTable,
  taskCommentsTable,
  timeLogsTable,
  notificationsTable,
  usersTable,
} from './schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import {
  Project,
  CustomStatus,
  TaskItem,
  SubtaskItem,
  CommentItem,
  NotificationItem,
} from '../types/team.types';

import { DEFAULT_WEEKLY_CAPACITY, UNKNOWN_ASSIGNEE_ID } from './workload';
import { LOCAL_WORKSPACE_ID } from './account.repository';
import type { Priority } from '../types/auth.types';
import * as Crypto from 'expo-crypto';

function generateId(): string {
  if (Crypto.randomUUID) {
    return Crypto.randomUUID();
  }
  return 'uuid-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
}

export const teamRepository = {
  /**
   * Proyek konteks default: proyek pertama yang masih hidup. Bila belum ada,
   * proyek bootstrap `proj-umum` dibuat bersama empat status standarnya.
   */
  async ensureDefaultProject(
    workspaceId = LOCAL_WORKSPACE_ID
  ): Promise<{ project: Project; statuses: CustomStatus[] }> {
    const db = getDb();
    const now = new Date().toISOString();

    const existingProjects = await db
      .select()
      .from(projectsTable)
      .where(isNull(projectsTable.deletedAt));

    if (existingProjects.length > 0) {
      const p = existingProjects[0];
      const statuses = await this.getStatuses(p.id);
      return {
        project: {
          id: p.id,
          workspaceId: p.workspaceId,
          name: p.name,
          description: p.description ?? undefined,
          color: p.color,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        },
        statuses,
      };
    }

    const projectId = 'proj-umum';
    await db.insert(projectsTable).values({
      id: projectId,
      workspaceId,
      name: 'Proyek Umum',
      description: null,
      color: '#38507A',
      createdAt: now,
      updatedAt: now,
    });

    // Buat 4 status default
    const defaultStatuses = [
      { id: 'stat-todo', name: 'To Do', orderIndex: 0, color: '#94A3B8', isDoneState: 0 },
      { id: 'stat-progress', name: 'In Progress', orderIndex: 1, color: '#3B82F6', isDoneState: 0 },
      { id: 'stat-review', name: 'Review', orderIndex: 2, color: '#F59E0B', isDoneState: 0 },
      { id: 'stat-done', name: 'Done', orderIndex: 3, color: '#10B981', isDoneState: 1 },
    ];

    for (const s of defaultStatuses) {
      await db.insert(customStatusesTable).values({
        id: s.id,
        projectId,
        name: s.name,
        orderIndex: s.orderIndex,
        color: s.color,
        isDoneState: s.isDoneState,
        createdAt: now,
        updatedAt: now,
      });
    }

    const statuses = await this.getStatuses(projectId);
    return {
      project: {
        id: projectId,
        workspaceId,
        name: 'Proyek Umum',
        description: undefined,
        color: '#38507A',
        createdAt: now,
        updatedAt: now,
      },
      statuses,
    };
  },

  async getProjects(): Promise<Project[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(projectsTable)
      .where(isNull(projectsTable.deletedAt))
      .orderBy(projectsTable.createdAt);

    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      name: r.name,
      description: r.description ?? undefined,
      color: r.color,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },

  async createProject(data: {
    name: string;
    description?: string;
    color?: string;
    workspaceId?: string;
  }): Promise<Project> {
    const db = getDb();
    const now = new Date().toISOString();
    const id = generateId();
    const workspaceId = data.workspaceId ?? LOCAL_WORKSPACE_ID;

    await db.insert(projectsTable).values({
      id,
      workspaceId,
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? '#3B82F6',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    return {
      id,
      workspaceId,
      name: data.name,
      description: data.description,
      color: data.color ?? '#3B82F6',
      createdAt: now,
      updatedAt: now,
    };
  },

  async renameProject(projectId: string, name: string): Promise<void> {
    const db = getDb();
    await db
      .update(projectsTable)
      .set({ name, updatedAt: new Date().toISOString() })
      .where(eq(projectsTable.id, projectId));
  },

  async deleteProject(projectId: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    await db
      .update(projectsTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(projectsTable.id, projectId));
  },

  async createStatus(data: {
    projectId: string;
    name: string;
    color?: string;
    isDoneState?: boolean;
  }): Promise<CustomStatus> {
    const db = getDb();
    const now = new Date().toISOString();
    const id = generateId();
    const existing = await this.getStatuses(data.projectId);
    const orderIndex = existing.length;

    await db.insert(customStatusesTable).values({
      id,
      projectId: data.projectId,
      name: data.name,
      orderIndex,
      color: data.color ?? '#94A3B8',
      isDoneState: data.isDoneState ? 1 : 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    return {
      id,
      projectId: data.projectId,
      name: data.name,
      orderIndex,
      color: data.color ?? '#94A3B8',
      isDoneState: data.isDoneState ?? false,
    };
  },

  async updateTask(taskId: string, updates: {
    title?: string;
    description?: string;
    priority?: Priority;
    estimatedHours?: number;
    dueDate?: string;
    assigneeId?: string | null;
  }): Promise<void> {
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.priority !== undefined) patch.priority = updates.priority;
    if (updates.estimatedHours !== undefined) patch.estimatedHours = updates.estimatedHours;
    if (updates.dueDate !== undefined) patch.dueDate = updates.dueDate;
    if (updates.assigneeId !== undefined) patch.assigneeId = updates.assigneeId;

    await db.update(tasksTable).set(patch).where(eq(tasksTable.id, taskId));
  },

  async deleteTask(taskId: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    await db
      .update(tasksTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(tasksTable.id, taskId));
  },

  async deleteSubtask(subtaskId: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    await db
      .update(subtasksTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(subtasksTable.id, subtaskId));
  },

  async getStatuses(projectId: string): Promise<CustomStatus[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(customStatusesTable)
      .where(and(eq(customStatusesTable.projectId, projectId), isNull(customStatusesTable.deletedAt)))
      .orderBy(customStatusesTable.orderIndex);

    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      name: r.name,
      orderIndex: r.orderIndex,
      color: r.color,
      isDoneState: r.isDoneState === 1,
    }));
  },

  async getMyTasks(userId: string): Promise<TaskItem[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.assigneeId, userId), isNull(tasksTable.deletedAt)))
      .orderBy(desc(tasksTable.createdAt));

    return this.populateTasks(rows);
  },

  async getTasksByProject(projectId: string): Promise<TaskItem[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.projectId, projectId), isNull(tasksTable.deletedAt)))
      .orderBy(tasksTable.orderIndex);

    return this.populateTasks(rows);
  },

  async populateTasks(taskRows: (typeof tasksTable.$inferSelect)[]): Promise<TaskItem[]> {
    const db = getDb();
    const tasks: TaskItem[] = [];

    for (const r of taskRows) {
      // Ambil subtasks
      const subtaskRows = await db
        .select()
        .from(subtasksTable)
        .where(and(eq(subtasksTable.taskId, r.id), isNull(subtasksTable.deletedAt)))
        .orderBy(subtasksTable.orderIndex);

      const subtasks: SubtaskItem[] = subtaskRows.map((s) => ({
        id: s.id,
        taskId: s.taskId,
        assigneeId: s.assigneeId ?? undefined,
        title: s.title,
        isCompleted: s.isCompleted === 1,
        orderIndex: s.orderIndex ?? 0,
        createdAt: s.createdAt,
      }));

      // Ambil komentar
      const commentRows = await db
        .select()
        .from(taskCommentsTable)
        .where(and(eq(taskCommentsTable.taskId, r.id), isNull(taskCommentsTable.deletedAt)))
        .orderBy(desc(taskCommentsTable.createdAt));

      const comments: CommentItem[] = commentRows.map((c) => ({
        id: c.id,
        taskId: c.taskId,
        userId: c.userId,
        content: c.content,
        createdAt: c.createdAt,
      }));

      // Ambil status
      const [statusRow] = await db
        .select()
        .from(customStatusesTable)
        .where(eq(customStatusesTable.id, r.statusId));

      const status: CustomStatus | undefined = statusRow
        ? {
            id: statusRow.id,
            projectId: statusRow.projectId,
            name: statusRow.name,
            orderIndex: statusRow.orderIndex,
            color: statusRow.color,
            isDoneState: statusRow.isDoneState === 1,
          }
        : undefined;

      tasks.push({
        id: r.id,
        projectId: r.projectId,
        statusId: r.statusId,
        creatorId: r.creatorId,
        assigneeId: r.assigneeId ?? undefined,
        title: r.title,
        description: r.description ?? undefined,
        priority: r.priority as Priority,
        estimatedHours: r.estimatedHours ?? 0,
        dueDate: r.dueDate ?? undefined,
        orderIndex: r.orderIndex ?? 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        status,
        subtasks,
        comments,
        timeLogs: [],
      });
    }

    return tasks;
  },

  async updateTaskStatus(taskId: string, newStatusId: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    await db
      .update(tasksTable)
      .set({
        statusId: newStatusId,
        updatedAt: now,
      })
      .where(eq(tasksTable.id, taskId));
  },

  async createTask(data: {
    projectId: string;
    statusId: string;
    creatorId: string;
    assigneeId?: string;
    title: string;
    description?: string;
    priority?: Priority;
    estimatedHours?: number;
    dueDate?: string;
  }): Promise<TaskItem> {
    const db = getDb();
    const now = new Date().toISOString();
    const id = generateId();

    await db.insert(tasksTable).values({
      id,
      projectId: data.projectId,
      statusId: data.statusId,
      creatorId: data.creatorId,
      assigneeId: data.assigneeId ?? null,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority ?? 'MEDIUM',
      estimatedHours: data.estimatedHours ?? 0,
      dueDate: data.dueDate ?? null,
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await this.populateTasks([
      {
        id,
        projectId: data.projectId,
        statusId: data.statusId,
        creatorId: data.creatorId,
        assigneeId: data.assigneeId ?? null,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority ?? 'MEDIUM',
        estimatedHours: data.estimatedHours ?? 0,
        dueDate: data.dueDate ?? null,
        orderIndex: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    return created;
  },

  async toggleSubtask(subtaskId: string): Promise<boolean> {
    const db = getDb();
    const [sub] = await db
      .select({ isCompleted: subtasksTable.isCompleted })
      .from(subtasksTable)
      .where(eq(subtasksTable.id, subtaskId));

    if (!sub) return false;

    const nextState = sub.isCompleted === 1 ? 0 : 1;
    const now = new Date().toISOString();

    await db
      .update(subtasksTable)
      .set({
        isCompleted: nextState,
        updatedAt: now,
      })
      .where(eq(subtasksTable.id, subtaskId));

    return nextState === 1;
  },

  async addSubtask(taskId: string, title: string, assigneeId?: string): Promise<SubtaskItem> {
    const db = getDb();
    const now = new Date().toISOString();
    const id = generateId();

    await db.insert(subtasksTable).values({
      id,
      taskId,
      assigneeId: assigneeId ?? null,
      title,
      isCompleted: 0,
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      taskId,
      assigneeId,
      title,
      isCompleted: false,
      orderIndex: 0,
      createdAt: now,
    };
  },

  async addComment(taskId: string, userId: string, content: string): Promise<CommentItem> {
    const db = getDb();
    const now = new Date().toISOString();
    const id = generateId();

    await db.insert(taskCommentsTable).values({
      id,
      taskId,
      userId,
      content,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      taskId,
      userId,
      content,
      createdAt: now,
    };
  },

  async addTimeLog(taskId: string, userId: string, durationMinutes: number, note?: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const id = generateId();

    await db.insert(timeLogsTable).values({
      id,
      taskId,
      userId,
      durationMinutes,
      durationSeconds: durationMinutes * 60,
      note: note ?? null,
      startedAt: null,
      endedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },

  async getNotifications(userId: string): Promise<NotificationItem[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.deletedAt)))
      .orderBy(desc(notificationsTable.createdAt));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      actorId: r.actorId ?? undefined,
      title: r.title,
      message: r.message,
      linkUrl: r.linkUrl ?? undefined,
      isRead: r.isRead === 1,
      createdAt: r.createdAt,
    }));
  },

  async markNotificationAsRead(id: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    await db
      .update(notificationsTable)
      .set({
        isRead: 1,
        updatedAt: now,
      })
      .where(eq(notificationsTable.id, id));
  },

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    await db
      .update(notificationsTable)
      .set({
        isRead: 1,
        updatedAt: now,
      })
      .where(eq(notificationsTable.userId, userId));
  },

  async createNotification(data: {
    userId: string;
    actorId?: string;
    title: string;
    message: string;
    linkUrl?: string;
  }): Promise<NotificationItem> {
    const db = getDb();
    const now = new Date().toISOString();
    const id = generateId();

    await db.insert(notificationsTable).values({
      id,
      userId: data.userId,
      actorId: data.actorId ?? null,
      title: data.title,
      message: data.message,
      linkUrl: data.linkUrl ?? null,
      isRead: 0,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      userId: data.userId,
      actorId: data.actorId,
      title: data.title,
      message: data.message,
      linkUrl: data.linkUrl,
      isRead: false,
      createdAt: now,
    };
  },

  /** Semua tugas aktif (belum dihapus) beserta statusnya, untuk hitung beban kerja. */
  async getWorkloadTasks(): Promise<TaskItem[]> {
    const db = getDb();
    const rows = await db.select().from(tasksTable).where(isNull(tasksTable.deletedAt));
    return this.populateTasks(rows);
  },

  /**
   * Daftar anggota tim untuk peta beban kerja, dibaca dari tabel users lokal.
   * Assignee yang tidak punya baris user digabung jadi satu entri "Anggota lain".
   */
  async getWorkloadMembers(
    currentUser?: { id: string; name: string; weeklyCapacityHours?: number }
  ): Promise<{ userId: string; name: string; capacity: number }[]> {
    const db = getDb();
    const memberMap = new Map<string, { userId: string; name: string; capacity: number }>();

    const cachedUsers = await db.select().from(usersTable);
    for (const u of cachedUsers) {
      memberMap.set(u.id, {
        userId: u.id,
        name: u.name,
        capacity: u.weeklyCapacityHours ?? DEFAULT_WEEKLY_CAPACITY,
      });
    }

    if (currentUser) {
      memberMap.set(currentUser.id, {
        userId: currentUser.id,
        name: currentUser.name,
        capacity: currentUser.weeklyCapacityHours ?? DEFAULT_WEEKLY_CAPACITY,
      });
    }

    const taskRows = await db
      .select({ assigneeId: tasksTable.assigneeId })
      .from(tasksTable)
      .where(isNull(tasksTable.deletedAt));

    // Assignee tanpa baris user (mis. akun yang sudah dihapus) digabung menjadi
    // satu entri "Anggota lain"; nama karangan per-id hanya mengotori daftar.
    const hasUnknownAssignee = taskRows.some(
      (row) => row.assigneeId && !memberMap.has(row.assigneeId)
    );
    if (hasUnknownAssignee) {
      memberMap.set(UNKNOWN_ASSIGNEE_ID, {
        userId: UNKNOWN_ASSIGNEE_ID,
        name: 'Anggota lain',
        capacity: DEFAULT_WEEKLY_CAPACITY,
      });
    }

    return Array.from(memberMap.values());
  },
};
