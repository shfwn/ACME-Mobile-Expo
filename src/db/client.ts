import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { drizzle, ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'acme_mobile_v1.db';

/**
 * Naikkan angka ini setiap kali bentuk tabel berubah, lalu tambahkan satu blok
 * `if (current < N)` di `runMigrations`. Versi sebelumnya tidak boleh diubah:
 * perangkat yang sudah terpasang hanya menjalankan langkah yang belum dilewati.
 */
const SCHEMA_VERSION = 4;

export type AppDatabase = ExpoSQLiteDatabase<typeof schema>;

let sqliteDbInstance: SQLiteDatabase | null = null;
let drizzleInstance: AppDatabase | null = null;

/**
 * Skema lengkap, ditulis sekali dan dipakai dua jalur:
 * - instalasi baru (user_version 0) cukup menjalankannya sekali, tanpa perlu
 *   melewati migrasi lama yang tabelnya langsung dibuat ulang;
 * - versi 1 hanya pernah terpasang di dalam proyek ini, jadi tidak ada data
 *   pengguna yang perlu diselamatkan dari bentuk skemanya.
 *
 * Semua `IF NOT EXISTS` supaya idempoten: menjalankannya dua kali aman.
 */
function createSchema(db: SQLiteDatabase): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
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
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_todos_user_date ON personal_todos (user_id, target_date);

    CREATE TABLE IF NOT EXISTS personal_notes (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content_markdown TEXT NOT NULL DEFAULT '',
      linked_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
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
      deleted_at TEXT
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
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee_id);

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      assignee_id TEXT,
      title TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks (task_id);

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
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_time_logs_task ON time_logs (task_id);
    CREATE INDEX IF NOT EXISTS idx_time_logs_user ON time_logs (user_id);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
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
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_statuses_project ON custom_statuses (project_id);

    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments (task_id);

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
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);

    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
  `);
}

/**
 * Versi 3: penanda kalender per tanggal.
 *
 * Warna dan catatan adalah milik pengguna, bukan milik to-do: satu tanggal bisa
 * diwarnai tanpa harus punya to-do, dan warnanya tetap ada setelah to-do-nya
 * selesai. `(user_id, date)` unik sehingga satu baris = satu tanggal.
 */
function migrateToV3(db: SQLiteDatabase): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS calendar_days (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'periwinkle',
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_days_user_date
      ON calendar_days (user_id, date);
  `);
}

/**
 * Versi 4: `personal_notes` kehilangan `tags_json` dan `audio_url`.
 *
 * Keduanya tidak punya pemakai lagi setelah kategori dan memo suara dicabut dari
 * layar Catatan. Kolom dibiarkan hanya akan menambah lebar baris dan
 * membingungkan pembaca skema.
 */
function migrateToV4(db: SQLiteDatabase): void {
  const columns = new Set(
    (db.getAllSync<{ name: string }>('PRAGMA table_info(personal_notes)') ?? []).map((c) => c.name)
  );

  if (columns.has('tags_json')) {
    db.execSync('ALTER TABLE personal_notes DROP COLUMN tags_json;');
  }
  if (columns.has('audio_url')) {
    db.execSync('ALTER TABLE personal_notes DROP COLUMN audio_url;');
  }
}

/**
 * Jalankan migrasi bertahap. Setiap langkah idempoten terhadap `user_version`,
 * jadi aman dipanggil setiap kali aplikasi dibuka.
 *
 * Versi 1 dan 2 adalah bentuk sementara selama proyek ini belum dirilis:
 *  - v1 menyimpan kolom antrean sync (`sync_status`, `retry_count`, `sync_meta`)
 *    yang sudah dibuang bersama engine sync-nya;
 *  - v2 membangun ulang `users` dan membuang kolom tersebut lewat `ALTER TABLE`.
 * Keduanya digantikan `createSchema`: instalasi baru langsung mendapat bentuk
 * akhir tanpa melewati langkah yang hasil akhirnya sama.
 */
export function runMigrations(db: SQLiteDatabase): void {
  const [{ user_version: current }] = db.getAllSync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  if (current >= SCHEMA_VERSION) return;

  // Kosong (0) atau masih di versi lama: bangun skema penuh, lalu lanjutkan
  // langkah yang menambah tabel baru di atasnya.
  createSchema(db);
  if (current < 1) {
    db.execSync('PRAGMA user_version = 1');
  }
  if (current < 2) {
    db.execSync('PRAGMA user_version = 2');
  }
  if (current < 3) {
    migrateToV3(db);
    db.execSync('PRAGMA user_version = 3');
  }
  if (current < 4) {
    migrateToV4(db);
    db.execSync('PRAGMA user_version = 4');
  }
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
