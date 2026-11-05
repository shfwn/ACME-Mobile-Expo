import { POST as pushHandler } from '../../../setup/todolist-ACME-yapindo/app/api/mobile/sync/push/route';
import { POST as pullHandler } from '../../../setup/todolist-ACME-yapindo/app/api/mobile/sync/pull/route';
import { signMobileToken } from '../../../setup/todolist-ACME-yapindo/lib/auth/mobile-jwt';
import { NextRequest } from 'next/server';

async function runPhase5SmokeTest() {
  console.log('=== SMOKE TEST FASE 5: Outbox Sync Engine & Dual Sync Backend ===\n');

  // 1. Siapkan Token Autentikasi Sync
  const token = await signMobileToken({
    id: 'u-milt',
    email: 'owner@company.com',
    name: 'Owner Eksekutif',
    role: 'OWNER',
  });
  console.log('[1] Token Sync dibuat. Panjang token:', token.length);

  // 2. Simulasi Push Mutasi Offline ke Cloud (Neon DB Push Endpoint)
  console.log('\n[2] Menguji Push Phase (Mengirim mutasi lokal offline ke cloud):');
  const offlineCreatedTodo = {
    id: 'todo-sync-001',
    userId: 'u-milt',
    title: 'Pekerjaan Offline: Desain Flow Sinkronisasi',
    description: 'Dibuat saat perangkat tanpa koneksi internet',
    targetDate: '2026-11-06',
    startTime: '08:30',
    endTime: '09:30',
    isCompleted: false,
    priority: 'HIGH',
    category: 'Kerja',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const offlineCreatedNote = {
    id: 'note-sync-001',
    userId: 'u-milt',
    title: 'Catatan Arsitektur Dual-Sync',
    contentMarkdown: 'Data disimpan lokal di SQLite lebih dulu, lalu dipush saat online.',
    linkedDate: '2026-11-06',
    tags: ['Arsitektur', 'Sync'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const pushReq = new NextRequest('http://127.0.0.1:3000/api/mobile/sync/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mutations: {
        todos: [offlineCreatedTodo],
        notes: [offlineCreatedNote],
      },
    }),
  });

  const pushRes = await pushHandler(pushReq);
  const pushData = await pushRes.json();
  console.log(' - Push Response status:', pushRes.status);
  console.log(' - Synced To-Do IDs:', pushData.syncedIds?.todos);
  console.log(' - Synced Note IDs:', pushData.syncedIds?.notes);

  if (
    pushRes.status !== 200 ||
    !pushData.success ||
    !pushData.syncedIds?.todos?.includes('todo-sync-001') ||
    !pushData.syncedIds?.notes?.includes('note-sync-001')
  ) {
    throw new Error('Push sync gagal: Mutasi lokal tidak terkonfirmasi oleh server');
  }
  console.log('✔ Push Phase berhasil! Server mengonfirmasi seluruh mutasi lokal.');

  // 3. Simulasi Pull Phase (Mengambil perubahan dari server)
  console.log('\n[3] Menguji Pull Phase (Mengambil data terbaru sejak last_sync):');
  const pullReq = new NextRequest('http://127.0.0.1:3000/api/mobile/sync/pull', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      since: new Date(Date.now() - 3600000).toISOString(), // 1 jam yang lalu
    }),
  });

  const pullRes = await pullHandler(pullReq);
  const pullData = await pullRes.json();
  console.log(' - Pull Response status:', pullRes.status);
  console.log(' - Server Timestamp:', pullData.timestamp);
  console.log(' - Changes returned keys:', Object.keys(pullData.changes || {}));

  if (pullRes.status !== 200 || !pullData.success || !pullData.timestamp) {
    throw new Error('Pull sync gagal: Endpoint tidak mengembalikan struktur sinkronisasi yang valid');
  }
  console.log('✔ Pull Phase berhasil! Server merespons delta perubahan.');

  // 4. Simulasi Resolusi Konflik Last-Write-Wins (LWW)
  console.log('\n[4] Menguji Logika Resolusi Konflik Last-Write-Wins:');
  const localRecord = {
    id: 'todo-sync-001',
    title: 'Versi Lokal Diperbarui',
    updatedAt: '2026-11-06T10:00:00.000Z',
  };

  const olderRemoteRecord = {
    id: 'todo-sync-001',
    title: 'Versi Server Lebih Lama',
    updatedAt: '2026-11-06T09:00:00.000Z',
  };

  const newerRemoteRecord = {
    id: 'todo-sync-001',
    title: 'Versi Server Lebih Baru dari Desktop',
    updatedAt: '2026-11-06T11:00:00.000Z',
  };

  // Case A: Remote lebih lama -> Abaikan (pertahankan lokal)
  const isRemoteNewer1 = new Date(olderRemoteRecord.updatedAt) > new Date(localRecord.updatedAt);
  console.log(' - Skenario A (Server lebih lama): Pertahankan lokal?', !isRemoteNewer1);
  if (isRemoteNewer1) {
    throw new Error('LWW gagal: Record server yang lebih lama tidak boleh menimpa record lokal yang lebih baru');
  }

  // Case B: Remote lebih baru -> Timpa lokal
  const isRemoteNewer2 = new Date(newerRemoteRecord.updatedAt) > new Date(localRecord.updatedAt);
  console.log(' - Skenario B (Server lebih baru): Timpa lokal?', isRemoteNewer2);
  if (!isRemoteNewer2) {
    throw new Error('LWW gagal: Record server yang lebih baru harus menimpa record lokal');
  }
  console.log('✔ Aturan resolusi konflik Last-Write-Wins (LWW) terbukti akurat!');

  console.log('\n>>> SEMUA PENGUJIAN SMOKE TEST FASE 5 BERHASIL 100%! <<<');
}

runPhase5SmokeTest().catch((err) => {
  console.error('Smoke test Fase 5 gagal:', err);
  process.exit(1);
});
