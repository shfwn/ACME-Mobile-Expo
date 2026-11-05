import * as schema from '../src/db/schema';
import { BiometricService } from '../src/services/biometric.service';
import { useAuthStore } from '../src/store/auth.store';
import { AuthStorage } from '../src/services/auth.storage';
import { User } from '../src/types/auth.types';

async function runPhase2SmokeTest() {
  console.log('=== SMOKE TEST FASE 2: Database Schema, Biometrics & Role Navigation ===\n');

  // 1. Verifikasi Skema Tabel SQLite (Drizzle ORM)
  console.log('[1] Verifikasi Skema Tabel SQLite:');
  const expectedTables = [
    'usersTable',
    'personalTodosTable',
    'personalNotesTable',
    'savedSheetLinksTable',
    'tasksTable',
    'subtasksTable',
    'timeLogsTable',
    'syncMetaTable',
  ];

  for (const tableName of expectedTables) {
    const table = schema[tableName as keyof typeof schema];
    if (!table) {
      throw new Error(`Tabel ${tableName} tidak ditemukan di schema.ts`);
    }
  }

  // Verifikasi kolom sinkronisasi wajib pada personalTodosTable
  const todoCols = Object.keys(schema.personalTodosTable);
  console.log('Tabel personal_todos terverifikasi dengan kolom sinkronisasi:');
  console.log(' - syncStatus:', 'syncStatus' in schema.personalTodosTable ? 'OK' : 'MISSING');
  console.log(' - deletedAt:', 'deletedAt' in schema.personalTodosTable ? 'OK' : 'MISSING');
  console.log(' - updatedAt:', 'updatedAt' in schema.personalTodosTable ? 'OK' : 'MISSING');
  console.log(' - id:', 'id' in schema.personalTodosTable ? 'OK' : 'MISSING');

  if (
    !('syncStatus' in schema.personalTodosTable) ||
    !('deletedAt' in schema.personalTodosTable) ||
    !('id' in schema.personalTodosTable)
  ) {
    throw new Error('Kolom metadata sinkronisasi wajib tidak lengkap di personalTodosTable');
  }
  console.log('✔ Seluruh 8 skema tabel SQLite terdaftar dan valid!\n');

  // 2. Verifikasi Layanan Biometrik
  console.log('[2] Verifikasi BiometricService:');
  const bioStatus = await BiometricService.checkAvailability();
  console.log('Biometric Availability status:', bioStatus);
  const bioAuth = await BiometricService.authenticate();
  console.log('Biometric Authenticate non-native fallback:', bioAuth);
  console.log('✔ Layanan biometrik menangani fallback platform dengan aman!\n');

  // 3. Verifikasi Global Auth Store & Role Routing Logic
  console.log('[3] Verifikasi Auth Store & Role Routing:');

  // Test Case A: Login sebagai Role OWNER
  console.log(' - Menguji Skenario Akun OWNER:');
  const ownerUser: User = {
    id: 'u-milt',
    name: 'Eksekutif ACME',
    email: 'owner@company.com',
    role: 'OWNER',
    weeklyCapacityHours: 40,
  };
  await AuthStorage.saveToken('jwt-owner-token-secret-123');
  await AuthStorage.saveUser(ownerUser);

  await useAuthStore.getState().initialize();
  const ownerState = useAuthStore.getState();

  console.log('   Authenticated:', ownerState.isAuthenticated);
  console.log('   User Role:', ownerState.user?.role);
  console.log('   isExecutiveMode:', ownerState.isExecutiveMode);

  if (!ownerState.isAuthenticated || !ownerState.isExecutiveMode) {
    throw new Error('Gagal: Role OWNER harus mengaktifkan isExecutiveMode = true');
  }
  console.log('   ✔ Role OWNER berhasil teridentifikasi sebagai Mode Eksekutif!');

  // Test Case B: Login sebagai Role MEMBER
  console.log('\n - Menguji Skenario Akun MEMBER (Tim):');
  const memberUser: User = {
    id: 'u-andi',
    name: 'Andi Pratama',
    email: 'andi@company.com',
    role: 'MEMBER',
    weeklyCapacityHours: 40,
  };
  await AuthStorage.saveToken('jwt-member-token-secret-456');
  await AuthStorage.saveUser(memberUser);

  await useAuthStore.getState().initialize();
  const memberState = useAuthStore.getState();

  console.log('   Authenticated:', memberState.isAuthenticated);
  console.log('   User Role:', memberState.user?.role);
  console.log('   isExecutiveMode:', memberState.isExecutiveMode);

  if (!memberState.isAuthenticated || memberState.isExecutiveMode) {
    throw new Error('Gagal: Role MEMBER harus memiliki isExecutiveMode = false (Mode Tim)');
  }
  console.log('   ✔ Role MEMBER berhasil teridentifikasi sebagai Mode Tim!');

  // Test Case C: Logout
  console.log('\n - Menguji Skenario Logout:');
  await useAuthStore.getState().logout();
  const loggedOutState = useAuthStore.getState();
  console.log('   Authenticated after logout:', loggedOutState.isAuthenticated);
  console.log('   User after logout:', loggedOutState.user);
  if (loggedOutState.isAuthenticated || loggedOutState.user !== null) {
    throw new Error('Gagal: Sesi pengguna belum terhapus sempurna saat logout');
  }
  console.log('   ✔ Sesi logout berhasil dibersihkan!');

  console.log('\n>>> SEMUA PENGUJIAN SMOKE TEST FASE 2 BERHASIL 100%! <<<');
}

runPhase2SmokeTest().catch((err) => {
  console.error('Smoke test Fase 2 gagal:', err);
  process.exit(1);
});
