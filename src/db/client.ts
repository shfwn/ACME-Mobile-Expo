import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { drizzle, ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'acme_mobile_v1.db';

/**
 * Naikkan angka ini setiap kali bentuk tabel berubah. Migrasi berjalan sekali
 * per versi; `PRAGMA user_version` adalah penanda yang dipakai SQLite sendiri.
 */
const SCHEMA_VERSION = 2;

export type AppDatabase = ExpoSQLiteDatabase<typeof schema>;

let sqliteDbInstance: SQLiteDatabase | null = null;
let drizzleInstance: AppDatabase | null = null;

interface TableColumn {
  name: string;
}

function columnNames(db: SQLiteDatabase, table: string): Set<string> {
  return new Set(
    (db.getAllSync<TableColumn>(`PRAGMA table_info(${table})`) ?? []).map((c) => c.name)
  );
}

function dropOldTable(db: SQLiteDatabase, table: string): void {
  db.execSync(`DROP TABLE IF EXISTS ${table}__old;`);
}

/**
 * Versi 1: skema awal aplikasi (tabel to-do, catatan, task, status, dsb).
 * Tabel users pada versi ini hanya cache profil tanpa kredensial.
 */
function migrateToV1(db: SQLiteDatabase): void {
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
      sync_status TEXT NOT NULL DEFAULT 'pending_push',
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_date ON personal_todos (user_id, target_date);

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
      sync_status TEXT NOT NULL DEFAULT 'pending_push',
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT
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
      sync_status TEXT NOT NULL DEFAULT 'pending_push',
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT
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
      sync_status TEXT NOT NULL DEFAULT 'pending_push',
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT
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
 * Versi 2: SQLite menjadi satu-satunya sumber kebenaran.
 * - `users` mendapat kredensial (hash + salt) sehingga login tidak butuh server.
 * - kolom `sync_status`/`retry_*`/`sync_meta` dibuang: tidak ada lagi server untuk
 *   disinkronkan, dan menyisakannya berarti terus mengirim data yang tidak ada tujuannya.
 * - tabel `workspaces` ditambahkan agar project punya induk yang nyata.
 *
 * Tabel users dibangun ulang karena kolom NOT NULL tidak bisa ditambahkan lewat
 * ALTER TABLE. Baris cache lama (tanpa kredensial) dibuang: data awal memang kosong.
 */
function migrateToV2(db: SQLiteDatabase): void {
  db.execSync('PRAGMA foreign_keys = OFF;');

  db.execSync(`
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS sync_meta;

    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      avatar_url TEXT,
      weekly_capacity_hours REAL DEFAULT 40.0,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  dropOldTable(db, 'personal_todos');
  dropOldTable(db, 'personal_notes');
  dropOldTable(db, 'saved_sheet_links');
  dropOldTable(db, 'tasks');
  dropOldTable(db, 'subtasks');
  dropOldTable(db, 'time_logs');
  dropOldTable(db, 'projects');
  dropOldTable(db, 'custom_statuses');
  dropOldTable(db, 'task_comments');
  dropOldTable(db, 'notifications');

  for (const table of ['personal_todos', 'personal_notes', 'tasks', 'subtasks']) {
    const cols = columnNames(db, table);
    if (cols.has('sync_status')) db.execSync(`ALTER TABLE ${table} DROP COLUMN sync_status;`);
    if (cols.has('retry_count')) db.execSync(`ALTER TABLE ${table} DROP COLUMN retry_count;`);
    if (cols.has('next_retry_at')) db.execSync(`ALTER TABLE ${table} DROP COLUMN next_retry_at;`);
  }

  for (const table of [
    'saved_sheet_links',
    'projects',
    'custom_statuses',
    'task_comments',
    'notifications',
    'time_logs',
  ]) {
    if (columnNames(db, table).has('sync_status')) {
      db.execSync(`ALTER TABLE ${table} DROP COLUMN sync_status;`);
    }
  }

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee_id);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks (task_id);
    CREATE INDEX IF NOT EXISTS idx_statuses_project ON custom_statuses (project_id);
    CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments (task_id);
    CREATE INDEX IF NOT EXISTS idx_time_logs_task ON time_logs (task_id);
    CREATE INDEX IF NOT EXISTS idx_time_logs_user ON time_logs (user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
  `);

  db.execSync('PRAGMA foreign_keys = ON;');
}

/**
 * Jalankan migrasi bertahap. Setiap langkah idempoten terhadap `user_version`,
 * jadi aman dipanggil setiap kali aplikasi dibuka.
 */
export function runMigrations(db: SQLiteDatabase): void {
  const [{ user_version: current }] = db.getAllSync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  if (current >= SCHEMA_VERSION) return;

  if (current < 1) {
    migrateToV1(db);
    db.execSync('PRAGMA user_version = 1');
  }
  if (current < 2) {
    migrateToV2(db);
    db.execSync('PRAGMA user_version = 2');
  }
}

/**
 * Kompatibilitas dengan pemanggil lama.
 * @deprecated gunakan runMigrations
 */
export function initDatabaseTables(db: SQLiteDatabase): void {
  runMigrations(db);
}

function openAppDatabase(): SQLiteDatabase {
  if (!sqliteDbInstance) {
    sqliteDbInstance = openDatabaseSync(DB_NAME);
    runMigrations(sqliteDbInstance);
  }
  return sqliteDbInstance;
}

/**
 * Dapatkan instance Drizzle Database
 */
export function getDb(): AppDatabase {
  if (!drizzleInstance) {
    openAppDatabase();
    drizzleInstance = drizzle(sqliteDbInstance!, { schema });
  }
  return drizzleInstance;
}

export function getRawSqliteDb(): SQLiteDatabase {
  return openAppDatabase();
}
