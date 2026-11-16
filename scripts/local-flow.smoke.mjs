/**
 * Smoke test alur lokal (SQLite murni, tanpa jaringan).
 *
 * Menjalankan kode asli dari `src/` di atas SQLite sungguhan (node:sqlite) dengan
 * shim tipis untuk `expo-sqlite`, `drizzle-orm/expo-sqlite`, `expo-crypto`, dan
 * `react-native`. Yang diuji adalah perilaku repo & auth store, bukan salinan logika.
 *
 * Jalankan: node --experimental-strip-types scripts/local-flow.smoke.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------- shims

const sqliteHandle = new DatabaseSync(':memory:');
sqliteHandle.exec('PRAGMA foreign_keys = ON');

class FakeSQLiteDatabase {
  constructor() {
    this.databasePath = ':memory:';
  }
  execSync(source) {
    sqliteHandle.exec(source);
  }
  getAllSync(source, params = []) {
    const normalized = Array.isArray(params) ? params : [params];
    const stmt = sqliteHandle.prepare(source);
    return stmt.all(...normalized);
  }
  runSync(source, params = []) {
    const normalized = Array.isArray(params) ? params : [params];
    const stmt = sqliteHandle.prepare(source);
    const info = stmt.run(...normalized);
    return { changes: Number(info.changes), lastInsertRowId: Number(info.lastInsertRowid) };
  }
}

const dbShim = { openDatabaseSync: () => new FakeSQLiteDatabase() };

/**
 * Drizzle asli di atas node:sqlite.
 *
 * Yang di-shim hanya `SQLiteSession.prepareQuery` (jalur eksekusi ekspo-sqlite),
 * lalu Drizzle membangun database sungguhan sendiri lewat `BaseSQLiteDatabase`.
 * Dengan begitu `toSQL()`, mapping baris, dan dialect tetap kode asli.
 */
function createDrizzle(handle) {
  const { BaseSQLiteDatabase } = require('drizzle-orm/sqlite-core/db');
  const { SQLiteSyncDialect } = require('drizzle-orm/sqlite-core/dialect');
  const { SQLiteSession, SQLitePreparedQuery } = require('drizzle-orm/sqlite-core/session');
  const { fillPlaceholders, sql } = require('drizzle-orm/sql/sql');
  const { NoopLogger } = require('drizzle-orm/logger');
  const { extractTablesRelationalConfig, createTableRelationsHelpers } = require('drizzle-orm/relations');
  const { mapResultRow } = require('drizzle-orm/utils');

  class ShimSession extends SQLiteSession {
    constructor(dialect, schema) {
      super(dialect);
      this.schema = schema;
      this.logger = new NoopLogger();
    }

    prepareQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper) {
      const run = (params) =>
        params && params.length ? handle.prepare(query.sql).run(...params) : handle.prepare(query.sql).run();
      const all = (params) =>
        params && params.length ? handle.prepare(query.sql).all(...params) : handle.prepare(query.sql).all();

      return new (class extends SQLitePreparedQuery {
        run(placeholderValues) {
          const info = run(fillPlaceholders(query.params, placeholderValues ?? {}));
          return { changes: Number(info.changes), lastInsertRowId: Number(info.lastInsertRowid) };
        }
        all(placeholderValues) {
          if (!fields && !customResultMapper) {
            return all(fillPlaceholders(query.params, placeholderValues ?? {}));
          }
          const rows = this.values(placeholderValues);
          if (customResultMapper) return customResultMapper(rows);
          return rows.map((row) => mapResultRow(fields, row, undefined));
        }
        get(placeholderValues) {
          const rows = this.values(placeholderValues);
          if (customResultMapper) return customResultMapper(rows);
          if (!fields) return rows[0];
          return rows[0] ? mapResultRow(fields, rows[0], undefined) : undefined;
        }
        values(placeholderValues) {
          return all(fillPlaceholders(query.params, placeholderValues ?? {})).map(Object.values);
        }
      })('sync', executeMethod, query, undefined, fields, isResponseInArrayMode);
    }

    transaction(fn) {
      this.run(sql.raw('begin'));
      try {
        const out = fn(this);
        this.run(sql.raw('commit'));
        return out;
      } catch (e) {
        this.run(sql.raw('rollback'));
        throw e;
      }
    }
  }

  return (client, config = {}) => {
    const dialect = new SQLiteSyncDialect({ casing: config.casing });
    const relational = config.schema
      ? extractTablesRelationalConfig(config.schema, createTableRelationsHelpers)
      : undefined;
    const schema = config.schema
      ? {
          fullSchema: config.schema,
          schema: relational.tables,
          tableNamesMap: relational.tableNamesMap,
        }
      : undefined;
    const session = new ShimSession(dialect, schema);
    const db = new BaseSQLiteDatabase('sync', dialect, session, schema);
    db.$client = client;
    return db;
  };
}

const cryptoShim = {
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  async digest(_algorithm, data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const out = createHash('sha256').update(Buffer.from(bytes)).digest();
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  },
  getRandomBytes(n) {
    return new Uint8Array(randomBytes(n));
  },
  randomUUID: () => randomUUID(),
  async digestStringAsync(_alg, data) {
    return createHash('sha256').update(data).digest('hex');
  },
};

const asyncStorage = new Map();
class SecureStoreShim {
  async getItemAsync(key) {
    return asyncStorage.get(key) ?? null;
  }
  async setItemAsync(key, value) {
    asyncStorage.set(key, value);
  }
  async deleteItemAsync(key) {
    asyncStorage.delete(key);
  }
}

const moduleShims = {
  'expo-sqlite': dbShim,
  'expo-crypto': cryptoShim,
  'expo-secure-store': new SecureStoreShim(),
  'react-native': { Platform: { OS: 'web', select: (o) => o.default ?? o.web } },
  'expo-local-authentication': {
    hasHardwareAsync: async () => false,
    isEnrolledAsync: async () => false,
    supportedAuthenticationTypesAsync: async () => [],
  },
};

// ---------------------------------------------------------------- loader

// Lintasan tanpa jiti: baca file .ts, buang tipe lewat node:module, lalu eval
// sebagai CommonJS dengan `require` yang sudah di-shim. Modul Expo asli tidak
// pernah dievaluasi (butuh runtime native).
function transpile(source, filename) {
  return stripTypeScriptTypes(source, { mode: 'transform', sourceUrl: filename });
}

const moduleCache = new Map();

/**
 * ESM -> CJS. `stripTypeScriptTypes` hanya membuang tipe; sintaks modul masih
 * tersisa dan tidak bisa dieksekusi `new Function`.
 */
function esmToCjs(js) {
  const exported = new Set();
  const bindings = [];
  let body = js.replace(/\/\*[\s\S]*?\*\//g, '');

  // Impor: `import X from 'm'`, `import {a, b as c} from 'm'`, `import * as ns from 'm'`
  body = body.replace(
    /^import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}|\*\s+as\s+([\w$]+))?\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm,
    (_m, def, named, ns, spec) => {
      const parts = [];
      if (def) parts.push(`const ${def} = __req(${JSON.stringify(spec)});`);
      if (ns) parts.push(`const ${ns} = __req(${JSON.stringify(spec)});`);
      if (named) {
        const fields = named
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
          .map((x) => {
            const [orig, alias] = x.split(/\s+as\s+/);
            return alias ? `${alias}: ${orig.trim()}` : orig.trim();
          });
        parts.push(`const { ${fields.join(', ')} } = __req(${JSON.stringify(spec)});`);
      }
      return parts.join(' ');
    }
  );
  body = body.replace(/^import\s*['"][^'"]+['"];?[ \t]*$/gm, '');

  // Interface/type yang diekspor: buang blok penuhnya.
  let prev;
  do {
    prev = body;
    body = body.replace(/^export\s+(?:interface|type)\s+[\w$]+[\s\S]*?\n\}[ \t]*$/m, '');
  } while (body !== prev);

  // Deklarasi yang diekspor.
  body = body.replace(
    /^export\s+(async\s+)?(const|let|var|function|class|enum)\s+([A-Za-z_$][\w$]*)/gm,
    (_m, isAsync, kind, name) => {
      exported.add(name);
      return `${isAsync ?? ''}${kind} ${name}`;
    }
  );

  // Sisa sintaks modul.
  body = body.replace(/^export\s+default\s+/m, 'exports.default = ');
  body = body.replace(/^export\s*\{[^}]*\}\s*;?[ \t]*$/gm, '');
  body = body.replace(/\bexport\s+(?=(?:async\s+)?(?:const|let|var|function|class|enum)\b)/g, '');

  for (const name of exported) bindings.push(`exports.${name} = ${name};`);
  return `${body}\n${bindings.join('\n')}`;
}

function load(absPath) {
  const resolved = absPath.endsWith('.ts') ? absPath : `${absPath}.ts`;
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;

  const js = esmToCjs(transpile(readFileSync(resolved, 'utf8'), resolved));
  const module = { exports: {} };
  moduleCache.set(resolved, module);

  const localRequire = (spec) => {
    if (spec in moduleShims) return moduleShims[spec];
    if (spec === 'drizzle-orm/expo-sqlite') return { drizzle: createDrizzle(sqliteHandle) };
    if (spec.startsWith('.')) return load(path.resolve(path.dirname(resolved), spec));
    return require(spec);
  };

  const wrapper = new Function('exports', 'require', 'module', '__req', js);
  wrapper(module.exports, localRequire, module, localRequire);
  return module.exports;
}

// ---------------------------------------------------------------- run

const results = [];
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      results.push({ name, ok: true });
      console.log(`PASS  ${name}`);
    })
    .catch((err) => {
      results.push({ name, ok: false, detail: err.message });
      console.log(`FAIL  ${name} — ${err.message}`);
    });
}

const password = load('src/db/password.ts');
const accountsModule = load('src/db/account.repository.ts');
const accounts = accountsModule.accountRepository;
const teamRepo = load('src/db/team.repository.ts');
const todoRepo = load('src/db/repository.ts');
const { getRawSqliteDb } = load('src/db/client.ts');

await check('hash kata sandi deterministik untuk salt yang sama', async () => {
  const a = await password.hashPassword('rahasia123', 's1');
  const b = await password.hashPassword('rahasia123', 's1');
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

await check('salt berbeda menghasilkan hash berbeda', async () => {
  const a = await password.hashPassword('rahasia123', 's1');
  const b = await password.hashPassword('rahasia123', 's2');
  assert.notEqual(a, b);
});

await check('kata sandi salah ditolak', async () => {
  const digest = await password.createPasswordDigest('benar1234');
  assert.equal(await password.verifyPassword('benar1234', digest), true);
  assert.equal(await password.verifyPassword('salah1234', digest), false);
});

await check('migrasi berjalan dan skema versi tercatat', async () => {
  getRawSqliteDb();
  const [{ user_version: version }] = sqliteHandle.prepare('PRAGMA user_version').all();
  assert.equal(version, 2);
  const tables = sqliteHandle
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => r.name);
  for (const expected of ['users', 'workspaces', 'projects', 'custom_statuses', 'tasks', 'personal_todos']) {
    assert.ok(tables.includes(expected), `tabel ${expected} tidak ada`);
  }
  assert.ok(!tables.includes('sync_meta'), 'sync_meta seharusnya sudah dihapus');
});

await check('kolom metadata sync sudah tidak ada', async () => {
  for (const table of ['personal_todos', 'personal_notes', 'tasks', 'subtasks', 'projects']) {
    const cols = sqliteHandle.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    assert.ok(!cols.includes('sync_status'), `${table} masih punya sync_status`);
    assert.ok(!cols.includes('retry_count'), `${table} masih punya retry_count`);
  }
});

await check('bootstrap membuat workspace, proyek, dan 4 status tanpa data karangan', async () => {
  await accounts.ensureBootstrap();
  const projectCount = sqliteHandle.prepare('SELECT COUNT(*) AS n FROM projects').get().n;
  const statusCount = sqliteHandle.prepare('SELECT COUNT(*) AS n FROM custom_statuses').get().n;
  const todoCount = sqliteHandle.prepare('SELECT COUNT(*) AS n FROM personal_todos').get().n;
  const taskCount = sqliteHandle.prepare('SELECT COUNT(*) AS n FROM tasks').get().n;
  const notifCount = sqliteHandle.prepare('SELECT COUNT(*) AS n FROM notifications').get().n;
  assert.equal(projectCount, 1);
  assert.equal(statusCount, 4);
  assert.equal(todoCount, 0, 'to-do awal harus kosong');
  assert.equal(taskCount, 0, 'task awal harus kosong');
  assert.equal(notifCount, 0, 'notifikasi awal harus kosong');
});

await check('seed akun nyata: 3 akun dengan hash tersimpan, bukan fallback', async () => {
  const created = await accounts.seedAccountsIfEmpty();
  assert.equal(created, 3);
  const rows = sqliteHandle.prepare('SELECT email, role, password_hash, password_salt FROM users').all();
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.password_hash.length, 64);
    assert.equal(row.password_salt.length, 32);
  }
  const roles = rows.map((r) => `${r.email}:${r.role}`).sort();
  assert.deepEqual(roles, [
    'andi@company.com:MEMBER',
    'owner@company.com:OWNER',
    'siti@company.com:ADMIN',
  ]);
});

await check('seed idempoten: tidak menambah akun saat tabel sudah terisi', async () => {
  const created = await accounts.seedAccountsIfEmpty();
  assert.equal(created, 0);
});

await check('login berhasil dengan kata sandi benar', async () => {
  const res = await accounts.login('owner@company.com', 'password123');
  assert.equal(res.success, true);
  assert.equal(res.user.role, 'OWNER');
});

await check('login menolak kata sandi salah', async () => {
  const res = await accounts.login('owner@company.com', 'salah');
  assert.equal(res.success, false);
  assert.match(res.error, /tidak valid/);
});

await check('login case-insensitive pada email', async () => {
  const res = await accounts.login('SITI@Company.COM', 'password123');
  assert.equal(res.success, true);
  assert.equal(res.user.role, 'ADMIN');
});

await check('registrasi menambah akun dengan role pilihan', async () => {
  const res = await accounts.register({
    name: 'Rina Viewer',
    email: 'rina@company.com',
    password: 'rahasia1234',
    role: 'VIEWER',
  });
  assert.equal(res.success, true);
  const login = await accounts.login('rina@company.com', 'rahasia1234');
  assert.equal(login.success, true);
  assert.equal(login.user.role, 'VIEWER');
});

await check('registrasi menolak email duplikat dan kata sandi pendek', async () => {
  const dup = await accounts.register({ name: 'X', email: 'owner@company.com', password: 'rahasia1234' });
  assert.equal(dup.success, false);
  const short = await accounts.register({ name: 'Y', email: 'baru@company.com', password: '123' });
  assert.equal(short.success, false);
});

await check('akun nonaktif tidak bisa login', async () => {
  const user = await accounts.getUserByEmail('andi@company.com');
  await accounts.setActive(user.id, false);
  const res = await accounts.login('andi@company.com', 'password123');
  assert.equal(res.success, false);
  assert.match(res.error, /dinonaktifkan/);
  await accounts.setActive(user.id, true);
});

await check('role bisa diubah dan berlaku pada login berikutnya', async () => {
  const user = await accounts.getUserByEmail('andi@company.com');
  await accounts.updateRole(user.id, 'ADMIN');
  const res = await accounts.login('andi@company.com', 'password123');
  assert.equal(res.user.role, 'ADMIN');
  await accounts.updateRole(user.id, 'MEMBER');
});

await check('ganti kata sandi lama tidak berlaku lagi', async () => {
  const user = await accounts.getUserByEmail('rina@company.com');
  await accounts.changePassword(user.id, 'barurahasia1');
  assert.equal((await accounts.login('rina@company.com', 'rahasia1234')).success, false);
  assert.equal((await accounts.login('rina@company.com', 'barurahasia1')).success, true);
});

await check('CRUD to-do pribadi tersimpan dan terpisah per pengguna', async () => {
  const owner = await accounts.getUserByEmail('owner@company.com');
  const member = await accounts.getUserByEmail('andi@company.com');
  const today = new Date().toISOString().slice(0, 10);

  const created = await todoRepo.todoRepository.create({
    userId: owner.id,
    title: 'Rapat pagi',
    targetDate: today,
    isCompleted: false,
    priority: 'HIGH',
    category: 'Kerja',
  });

  const ownerTodos = await todoRepo.todoRepository.getByDate(owner.id, today);
  assert.equal(ownerTodos.length, 1);
  assert.equal(ownerTodos[0].title, 'Rapat pagi');

  const memberTodos = await todoRepo.todoRepository.getByDate(member.id, today);
  assert.equal(memberTodos.length, 0, 'to-do pengguna lain tidak boleh terlihat');

  const done = await todoRepo.todoRepository.toggleComplete(created.id);
  assert.equal(done, true);
  await todoRepo.todoRepository.update(created.id, { title: 'Rapat pagi (revisi)' });
  const [updated] = await todoRepo.todoRepository.getByDate(owner.id, today);
  assert.equal(updated.title, 'Rapat pagi (revisi)');

  await todoRepo.todoRepository.softDelete(created.id);
  assert.equal((await todoRepo.todoRepository.getByDate(owner.id, today)).length, 0);
});

await check('CRUD proyek, status, task, subtask, komentar lokal', async () => {
  const { project, statuses } = await teamRepo.teamRepository.ensureDefaultProject();
  assert.equal(statuses.length, 4);

  const owner = await accounts.getUserByEmail('owner@company.com');
  const task = await teamRepo.teamRepository.createTask({
    projectId: project.id,
    statusId: statuses[0].id,
    creatorId: owner.id,
    assigneeId: owner.id,
    title: 'Bangun modul laporan',
    priority: 'HIGH',
    estimatedHours: 6,
  });
  assert.equal(task.title, 'Bangun modul laporan');

  const subtask = await teamRepo.teamRepository.addSubtask(task.id, 'Rancang skema');
  await teamRepo.teamRepository.toggleSubtask(subtask.id);
  await teamRepo.teamRepository.addComment(task.id, owner.id, 'Mulai dari sampel data');

  const myTasks = await teamRepo.teamRepository.getMyTasks(owner.id);
  assert.equal(myTasks.length, 1);
  assert.equal(myTasks[0].subtasks[0].isCompleted, true);
  assert.equal(myTasks[0].comments.length, 1);

  await teamRepo.teamRepository.updateTaskStatus(task.id, statuses[3].id);
  const moved = await teamRepo.teamRepository.getMyTasks(owner.id);
  assert.equal(moved[0].status?.isDoneState, true);

  await teamRepo.teamRepository.deleteTask(task.id);
  assert.equal((await teamRepo.teamRepository.getMyTasks(owner.id)).length, 0);
});

await check('notifikasi tersimpan lokal dan bisa ditandai terbaca', async () => {
  const owner = await accounts.getUserByEmail('owner@company.com');
  const created = await teamRepo.teamRepository.createNotification({
    userId: owner.id,
    title: 'Tugas baru',
    message: 'Anda ditugaskan',
  });
  const list = await teamRepo.teamRepository.getNotifications(owner.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].isRead, false);
  await teamRepo.teamRepository.markNotificationAsRead(created.id);
  const after = await teamRepo.teamRepository.getNotifications(owner.id);
  assert.equal(after[0].isRead, true);
});

await check('catatan harian dan link spreadsheet tersimpan lokal', async () => {
  const owner = await accounts.getUserByEmail('owner@company.com');
  const note = await todoRepo.notesRepository.create({
    userId: owner.id,
    title: 'Catatan harian',
    contentMarkdown: 'Hari ini mengerjakan migrasi SQLite.',
    tags: ['migrasi'],
  });
  const notes = await todoRepo.notesRepository.getAll(owner.id);
  assert.equal(notes.length, 1);
  assert.deepEqual(notes[0].tags, ['migrasi']);
  await todoRepo.notesRepository.softDelete(note.id);
  assert.equal((await todoRepo.notesRepository.getAll(owner.id)).length, 0);

  const link = await todoRepo.sheetLinkRepository.create({
    userId: owner.id,
    title: 'Rekap Q4',
    url: 'https://docs.google.com/spreadsheets',
  });
  const links = await todoRepo.sheetLinkRepository.getAll(owner.id);
  assert.equal(links.length, 1);
  await todoRepo.sheetLinkRepository.softDelete(link.id);
  assert.equal((await todoRepo.sheetLinkRepository.getAll(owner.id)).length, 0);
});

await check('log waktu (pomodoro) tercatat dengan durasi', async () => {
  const owner = await accounts.getUserByEmail('owner@company.com');
  await todoRepo.timeLogRepository.logDuration(owner.id, 25, {
    note: 'Pomodoro 25 menit',
    durationSeconds: 1500,
  });
  const row = sqliteHandle.prepare('SELECT duration_minutes, duration_seconds FROM time_logs').get();
  assert.equal(row.duration_minutes, 25);
  assert.equal(row.duration_seconds, 1500);
});

await check('setCompleted menetapkan status secara eksplisit', async () => {
  const owner = await accounts.getUserByEmail('owner@company.com');
  const today = new Date().toISOString().slice(0, 10);
  const created = await todoRepo.todoRepository.create({
    userId: owner.id,
    title: 'Uji setCompleted',
    targetDate: today,
    isCompleted: false,
    priority: 'LOW',
    category: 'Fokus',
  });
  await todoRepo.todoRepository.setCompleted(created.id, true);
  const [done] = await todoRepo.todoRepository.getByDate(owner.id, today);
  assert.equal(done.isCompleted, true);
  await todoRepo.todoRepository.setCompleted(created.id, false);
  const [undone] = await todoRepo.todoRepository.getByDate(owner.id, today);
  assert.equal(undone.isCompleted, false);
  await todoRepo.todoRepository.softDelete(created.id);
});

await check('subtask tersimpan di SQLite dan bertahan antar-baca', async () => {
  const owner = await accounts.getUserByEmail('owner@company.com');
  const today = new Date().toISOString().slice(0, 10);
  const created = await todoRepo.todoRepository.create({
    userId: owner.id,
    title: 'Uji subtask',
    targetDate: today,
    isCompleted: false,
    priority: 'MEDIUM',
    category: 'Kerja',
    subtasks: [
      { id: 's1', title: 'Langkah satu', isCompleted: false },
      { id: 's2', title: 'Langkah dua', isCompleted: false },
    ],
  });

  await todoRepo.todoRepository.update(created.id, {
    subtasks: [
      { id: 's1', title: 'Langkah satu', isCompleted: true },
      { id: 's2', title: 'Langkah dua', isCompleted: true },
    ],
  });

  const [row] = await todoRepo.todoRepository.getByDate(owner.id, today);
  assert.equal(row.subtasks.length, 2);
  assert.equal(row.subtasks.every((s) => s.isCompleted), true);

  // Semua subtask selesai lalu to-do ditandai selesai secara eksplisit.
  await todoRepo.todoRepository.setCompleted(created.id, true);
  const [finished] = await todoRepo.todoRepository.getByDate(owner.id, today);
  assert.equal(finished.isCompleted, true);
  await todoRepo.todoRepository.softDelete(created.id);
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus`);
if (failed.length > 0) {
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exitCode = 1;
}
