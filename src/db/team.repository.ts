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
import { Priority } from '../types/auth.types';
import * as Crypto from 'expo-crypto';

function generateId(): string {
  if (Crypto.randomUUID) {
    return Crypto.randomUUID();
  }
  return 'uuid-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
}

export const teamRepository = {
  /**
   * Pastikan setidaknya ada satu proyek default dan 4 status standar di SQLite lokal
   */
  async ensureDefaultProject(workspaceId = 'ws-default'): Promise<{ project: Project; statuses: CustomStatus[] }> {
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

    // Buat proyek default
    const projectId = 'proj-core-acme';
    await db.insert(projectsTable).values({
      id: projectId,
      workspaceId,
      name: 'ACME Core Project',
      description: 'Papan pengembangan terpadu tim ACME Workspace',
      color: '#38507A',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending_push',
    });

    // Buat 4 status default
    const defaultStatuses = [
      { id: 'stat-backlog', name: 'To Do', orderIndex: 0, color: '#94A3B8', isDoneState: 0 },
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
        syncStatus: 'pending_push',
      });
    }

    const statuses = await this.getStatuses(projectId);
    return {
      project: {
        id: projectId,
        workspaceId,
        name: 'ACME Core Project',
        description: 'Papan pengembangan terpadu tim ACME Workspace',
        color: '#38507A',
        createdAt: now,
        updatedAt: now,
      },
      statuses,
    };
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
        syncStatus: 'pending_push',
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
      syncStatus: 'pending_push',
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
        syncStatus: 'pending_push',
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
        syncStatus: 'pending_push',
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
      syncStatus: 'pending_push',
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
      syncStatus: 'pending_push',
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
      syncStatus: 'pending_push',
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
        syncStatus: 'pending_push',
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
        syncStatus: 'pending_push',
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
      syncStatus: 'pending_push',
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
};
