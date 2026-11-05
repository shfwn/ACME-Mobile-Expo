import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { drizzle, ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'acme_mobile_v1.db';

export type AppDatabase = ExpoSQLiteDatabase<typeof schema>;

let sqliteDbInstance: SQLiteDatabase | null = null;
let drizzleInstance: AppDatabase | null = null;


/**
 * Inisialisasi struktur tabel database SQLite secara otomatis jika belum ada
 */
export function initDatabaseTables(db: SQLiteDatabase) {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar_url TEXT,
      weekly_capacity_hours REAL DEFAULT 40.0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS personal_todos (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      target_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      category TEXT NOT NULL DEFAULT 'Kerja',
      color_theme TEXT NOT NULL DEFAULT 'yellow',
      subtasks_json TEXT DEFAULT '[]',
      reminder_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending_push'
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_date ON personal_todos (user_id, target_date);
    CREATE INDEX IF NOT EXISTS idx_todos_sync ON personal_todos (sync_status);

    CREATE TABLE IF NOT EXISTS personal_notes (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content_markdown TEXT NOT NULL DEFAULT '',
      linked_date TEXT,
      tags_json TEXT DEFAULT '[]',
      audio_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending_push'
    );

    CREATE INDEX IF NOT EXISTS idx_notes_user_date ON personal_notes (user_id, linked_date);

    CREATE TABLE IF NOT EXISTS saved_sheet_links (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Spreadsheet',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending_push'
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      status_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      assignee_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      estimated_hours REAL DEFAULT 0,
      due_date TEXT,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending_push'
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      assignee_id TEXT,
      title TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending_push'
    );

    CREATE TABLE IF NOT EXISTS time_logs (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT,
      todo_id TEXT,
      user_id TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      started_at TEXT,
      ended_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending_push'
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending_push'
    );

    CREATE TABLE IF NOT EXISTS custom_statuses (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#94A3B8',
      is_done_state INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending_push'
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending_push'
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      actor_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link_url TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending_push'
    );
  `);
}

/**
 * Dapatkan instance Drizzle Database
 */
export function getDb(): AppDatabase {
  if (!sqliteDbInstance) {
    sqliteDbInstance = openDatabaseSync(DB_NAME);
    initDatabaseTables(sqliteDbInstance);
    drizzleInstance = drizzle(sqliteDbInstance, { schema });
  }

  return drizzleInstance as AppDatabase;
}

export function getRawSqliteDb(): SQLiteDatabase {
  if (!sqliteDbInstance) {
    sqliteDbInstance = openDatabaseSync(DB_NAME);
    initDatabaseTables(sqliteDbInstance);
  }
  return sqliteDbInstance;
}
