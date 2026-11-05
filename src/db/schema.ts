import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// 1. Users Cache
export const usersTable = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'MILT'
  avatarUrl: text('avatar_url'),
  weeklyCapacityHours: real('weekly_capacity_hours').default(40.0),
  updatedAt: text('updated_at').notNull(),
});

// 2. Personal To-Dos (Executive Suite)
export const personalTodosTable = sqliteTable('personal_todos', {
  id: text('id').primaryKey(), // UUID v4
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  targetDate: text('target_date').notNull(), // YYYY-MM-DD
  startTime: text('start_time'), // "09:00"
  endTime: text('end_time'),     // "10:30"
  isCompleted: integer('is_completed').notNull().default(0), // 0 or 1
  priority: text('priority').notNull().default('MEDIUM'), // 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  category: text('category').notNull().default('Kerja'), // 'Kerja' | 'Pribadi' | 'Fokus' | 'Penting'
  colorTheme: text('color_theme').notNull().default('yellow'), // 'yellow' | 'pink' | 'mint' | 'periwinkle'
  subtasksJson: text('subtasks_json').default('[]'),
  reminderAt: text('reminder_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'), // Soft-delete for sync
  syncStatus: text('sync_status').notNull().default('pending_push'), // 'synced' | 'pending_push' | 'pending_delete'
});

// 3. Personal Notes / Daily Logs (Executive Suite)
export const personalNotesTable = sqliteTable('personal_notes', {
  id: text('id').primaryKey(), // UUID v4
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  contentMarkdown: text('content_markdown').notNull().default(''),
  linkedDate: text('linked_date'), // YYYY-MM-DD
  tagsJson: text('tags_json').default('[]'),
  audioUrl: text('audio_url'), // Memo suara mobile
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncStatus: text('sync_status').notNull().default('pending_push'),
});

// 4. Saved Spreadsheet Links
export const savedSheetLinksTable = sqliteTable('saved_sheet_links', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  category: text('category').notNull().default('Spreadsheet'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncStatus: text('sync_status').notNull().default('pending_push'),
});

// 5. Team Tasks (Team Suite)
export const tasksTable = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  statusId: text('status_id').notNull(),
  creatorId: text('creator_id').notNull(),
  assigneeId: text('assignee_id'),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority').notNull().default('MEDIUM'),
  estimatedHours: real('estimated_hours').default(0),
  dueDate: text('due_date'),
  orderIndex: integer('order_index').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncStatus: text('sync_status').notNull().default('pending_push'),
});

// 6. Subtasks
export const subtasksTable = sqliteTable('subtasks', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull(),
  assigneeId: text('assignee_id'),
  title: text('title').notNull(),
  isCompleted: integer('is_completed').notNull().default(0),
  orderIndex: integer('order_index').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncStatus: text('sync_status').notNull().default('pending_push'),
});

// 7. Time Logs (Timer & Pomodoro)
export const timeLogsTable = sqliteTable('time_logs', {
  id: text('id').primaryKey(),
  taskId: text('task_id'),
  todoId: text('todo_id'),
  userId: text('user_id').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  note: text('note'),
  startedAt: text('started_at'),
  endedAt: text('ended_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncStatus: text('sync_status').notNull().default('pending_push'),
});

// 8. Internal Sync Metadata
export const syncMetaTable = sqliteTable('sync_meta', {
  key: text('key').primaryKey(), // e.g. 'last_sync_timestamp'
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 9. Projects Table
export const projectsTable = sqliteTable('projects', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').notNull().default('#3B82F6'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncStatus: text('sync_status').notNull().default('pending_push'),
});

// 10. Custom Statuses Table
export const customStatusesTable = sqliteTable('custom_statuses', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  color: text('color').notNull().default('#94A3B8'),
  isDoneState: integer('is_done_state').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncStatus: text('sync_status').notNull().default('pending_push'),
});

// 11. Task Comments Table
export const taskCommentsTable = sqliteTable('task_comments', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull(),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncStatus: text('sync_status').notNull().default('pending_push'),
});

// 12. Notifications Table
export const notificationsTable = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  actorId: text('actor_id'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  linkUrl: text('link_url'),
  isRead: integer('is_read').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncStatus: text('sync_status').notNull().default('pending_push'),
});
