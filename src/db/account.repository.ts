import { getDb } from './client';
import { usersTable, workspacesTable, projectsTable, customStatusesTable } from './schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { Role, User } from '../types/auth.types';
import { createPasswordDigest, verifyPassword } from './password';
import * as Crypto from 'expo-crypto';

/** Workspace tunggal yang dimiliki instalasi ini. */
export const LOCAL_WORKSPACE_ID = 'ws-acme-local';
export const LOCAL_WORKSPACE_NAME = 'ACME Workspace';
export const LOCAL_WORKSPACE_SLUG = 'acme-workspace';

export const DEFAULT_PASSWORD = 'password123';

/**
 * Akun bawaan saat database masih kosong.
 *
 * Ini bukan akun dummy yang dilewati saat server gagal: baris ini benar-benar
 * ditulis ke SQLite dengan hash kata sandi sendiri, dan login memverifikasi
 * hash tersebut. Tanpa baris ini aplikasi tidak punya jalan masuk sama sekali.
 */
const SEED_ACCOUNTS: {
  id: string;
  email: string;
  name: string;
  role: Role;
  capacity: number;
}[] = [
  { id: 'usr-owner', email: 'owner@company.com', name: 'Budi Santoso', role: 'OWNER', capacity: 40 },
  { id: 'usr-admin', email: 'siti@company.com', name: 'Siti Rahma', role: 'ADMIN', capacity: 35 },
  { id: 'usr-member', email: 'andi@company.com', name: 'Andi Pratama', role: 'MEMBER', capacity: 40 },
];

interface StoredUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  passwordSalt: string;
  avatarUrl: string | null;
  weeklyCapacityHours: number | null;
  isActive: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toPublicUser(row: StoredUserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    avatarUrl: row.avatarUrl,
    weeklyCapacityHours: row.weeklyCapacityHours ?? 40,
  };
}

export type LoginOutcome =
  | { success: true; user: User }
  | { success: false; error: string };

export type RegisterOutcome =
  | { success: true; user: User }
  | { success: false; error: string };

const KNOWN_ROLES: Readonly<Record<Role, true>> = {
  OWNER: true,
  ADMIN: true,
  MEMBER: true,
  VIEWER: true,
  MILT: true,
};

function isKnownRole(value: unknown): value is Role {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(KNOWN_ROLES, value)
  );
}

function generateId(): string {
  if (Crypto.randomUUID) return Crypto.randomUUID();
  return 'usr-' + Math.random().toString(36).substring(2, 10);
}

export const accountRepository = {
  /**
   * Siapkan baris dasar yang dibutuhkan aplikasi agar tidak kosong secara
   * struktural: satu workspace, satu project, empat status. TIDAK ada to-do,
   * task, catatan, atau notifikasi palsu — isi data dimulai dari kosong.
   *
   * Idempoten: hanya menulis bila baris tersebut belum ada.
   */
  async ensureBootstrap(): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    const [workspace] = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, LOCAL_WORKSPACE_ID));

    if (!workspace) {
      await db.insert(workspacesTable).values({
        id: LOCAL_WORKSPACE_ID,
        name: LOCAL_WORKSPACE_NAME,
        slug: LOCAL_WORKSPACE_SLUG,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existingProjects = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.workspaceId, LOCAL_WORKSPACE_ID), isNull(projectsTable.deletedAt)));

    if (existingProjects.length === 0) {
      await db.insert(projectsTable).values({
        id: 'proj-umum',
        workspaceId: LOCAL_WORKSPACE_ID,
        name: 'Proyek Umum',
        description: null,
        color: '#38507A',
        createdAt: now,
        updatedAt: now,
      });

      const defaultStatuses: {
        id: string;
        name: string;
        orderIndex: number;
        color: string;
        isDoneState: number;
      }[] = [
        { id: 'stat-todo', name: 'To Do', orderIndex: 0, color: '#94A3B8', isDoneState: 0 },
        { id: 'stat-progress', name: 'In Progress', orderIndex: 1, color: '#3B82F6', isDoneState: 0 },
        { id: 'stat-review', name: 'Review', orderIndex: 2, color: '#F59E0B', isDoneState: 0 },
        { id: 'stat-done', name: 'Done', orderIndex: 3, color: '#10B981', isDoneState: 1 },
      ];

      for (const status of defaultStatuses) {
        await db.insert(customStatusesTable).values({
          id: status.id,
          projectId: 'proj-umum',
          name: status.name,
          orderIndex: status.orderIndex,
          color: status.color,
          isDoneState: status.isDoneState,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },

  /**
   * Isi akun bawaan bila tabel users masih kosong. Mengembalikan jumlah akun
   * yang dibuat (0 bila sudah ada akun).
   */
  async seedAccountsIfEmpty(): Promise<number> {
    const db = getDb();
    const existing = await db.select({ id: usersTable.id }).from(usersTable);
    if (existing.length > 0) return 0;

    const now = new Date().toISOString();
    for (const account of SEED_ACCOUNTS) {
      const digest = await createPasswordDigest(DEFAULT_PASSWORD);
      await db.insert(usersTable).values({
        id: account.id,
        email: account.email.toLowerCase(),
        name: account.name,
        role: account.role,
        passwordHash: digest.hash,
        passwordSalt: digest.salt,
        avatarUrl: null,
        weeklyCapacityHours: account.capacity,
        isActive: 1,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return SEED_ACCOUNTS.length;
  },

  async login(email: string, password: string): Promise<LoginOutcome> {
    const db = getDb();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      return { success: false, error: 'Email dan kata sandi wajib diisi' };
    }

    const [row] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, cleanEmail));

    if (!row) {
      return { success: false, error: 'Email atau kata sandi tidak valid' };
    }
    if (row.isActive !== 1) {
      return { success: false, error: 'Akun ini dinonaktifkan' };
    }

    const valid = await verifyPassword(password, {
      hash: row.passwordHash,
      salt: row.passwordSalt,
    });
    if (!valid) {
      return { success: false, error: 'Email atau kata sandi tidak valid' };
    }

    const now = new Date().toISOString();
    await db
      .update(usersTable)
      .set({ lastLoginAt: now, updatedAt: now })
      .where(eq(usersTable.id, row.id));

    return { success: true, user: toPublicUser(row) };
  },

  async register(data: {
    name: string;
    email: string;
    password: string;
    role?: Role;
  }): Promise<RegisterOutcome> {
    const db = getDb();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim();

    if (!cleanName) return { success: false, error: 'Nama wajib diisi' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Format email tidak valid' };
    }
    if (data.password.length < 8) {
      return { success: false, error: 'Kata sandi minimal 8 karakter' };
    }

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, cleanEmail));
    if (existing) return { success: false, error: 'Email sudah terdaftar' };

    const role: Role = isKnownRole(data.role) ? data.role : 'MEMBER';
    const digest = await createPasswordDigest(data.password);
    const now = new Date().toISOString();
    const id = generateId();

    await db.insert(usersTable).values({
      id,
      email: cleanEmail,
      name: cleanName,
      role,
      passwordHash: digest.hash,
      passwordSalt: digest.salt,
      avatarUrl: null,
      weeklyCapacityHours: 40,
      isActive: 1,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      user: { id, name: cleanName, email: cleanEmail, role, avatarUrl: null, weeklyCapacityHours: 40 },
    };
  },

  async getUserById(id: string): Promise<User | null> {
    const db = getDb();
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return row ? toPublicUser(row as StoredUserRow) : null;
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.trim().toLowerCase()));
    return row ? toPublicUser(row as StoredUserRow) : null;
  },

  async getAllUsers(): Promise<User[]> {
    const db = getDb();
    const rows = await db.select().from(usersTable);
    return rows.map((row) => toPublicUser(row as StoredUserRow));
  },

  async updateRole(userId: string, role: Role): Promise<void> {
    if (!isKnownRole(role)) throw new Error(`Role tidak dikenal: ${String(role)}`);
    const db = getDb();
    await db
      .update(usersTable)
      .set({ role, updatedAt: new Date().toISOString() })
      .where(eq(usersTable.id, userId));
  },

  async changePassword(userId: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) throw new Error('Kata sandi minimal 8 karakter');
    const db = getDb();
    const digest = await createPasswordDigest(newPassword);
    await db
      .update(usersTable)
      .set({
        passwordHash: digest.hash,
        passwordSalt: digest.salt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(usersTable.id, userId));
  },

  /**
   * Ubah profil (nama, email, foto).
   *
   * Email tetap unik: bila alamat baru sudah dipakai akun lain, perubahan
   * ditolak dan pesan dikembalikan — bukan dilempar sebagai exception, karena
   * pemanggilnya adalah form yang perlu menampilkannya di dekat field.
   */
  async updateProfile(
    userId: string,
    input: { name?: string; email?: string; avatarUrl?: string | null }
  ): Promise<{ success: true; user: User } | { success: false; error: string }> {
    const db = getDb();

    const [current] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!current) return { success: false, error: 'Akun tidak ditemukan' };

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) return { success: false, error: 'Nama tidak boleh kosong' };
      patch.name = name;
    }

    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: 'Format email tidak valid' };
      }
      if (email !== current.email) {
        const [taken] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.email, email));
        if (taken) return { success: false, error: 'Email sudah dipakai akun lain' };
      }
      patch.email = email;
    }

    if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;

    await db.update(usersTable).set(patch).where(eq(usersTable.id, userId));

    const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    return { success: true, user: toPublicUser(updated as StoredUserRow) };
  },

  /**
   * Cocokkan kata sandi akun tanpa mengubah apa pun.
   *
   * Dipakai sebagai gerbang konfirmasi: perubahan email atau kata sandi harus
   * dibuktikan dengan kata sandi saat ini, sehingga perangkat yang ditinggal
   * terbuka tidak bisa dipakai mengganti kredensial.
   */
  async confirmPassword(userId: string, password: string): Promise<boolean> {
    const db = getDb();
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!row) return false;
    return verifyPassword(password, { hash: row.passwordHash, salt: row.passwordSalt });
  },

  async setActive(userId: string, isActive: boolean): Promise<void> {
    const db = getDb();
    await db
      .update(usersTable)
      .set({ isActive: isActive ? 1 : 0, updatedAt: new Date().toISOString() })
      .where(eq(usersTable.id, userId));
  },
};
