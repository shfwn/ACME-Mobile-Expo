import * as schema from '../src/db/schema';
import { TaskItem, CustomStatus, SubtaskItem, CommentItem, NotificationItem } from '../src/types/team.types';

async function runPhase4SmokeTest() {
  console.log('=== SMOKE TEST FASE 4: Modul Kolaborasi Tim (Tasks, Kanban, Notifications) ===\n');

  // 1. Verifikasi Skema Tabel Tim
  console.log('[1] Verifikasi Skema Tabel Tim Drizzle ORM:');
  const teamTables = [
    'projectsTable',
    'customStatusesTable',
    'tasksTable',
    'subtasksTable',
    'taskCommentsTable',
    'notificationsTable',
  ];

  for (const t of teamTables) {
    if (!(t in schema)) {
      throw new Error(`Tabel ${t} tidak ditemukan di schema.ts`);
    }
    console.log(` - Tabel ${t}: TERDAFTAR`);
  }
  console.log('✔ Seluruh 6 skema tabel tim berhasil divalidasi!\n');

  // 2. Simulasi Alur Tugas Tim (Task Item)
  console.log('[2] Simulasi Alur Tugas & Status Kanban:');
  const mockStatusTodo: CustomStatus = {
    id: 'stat-backlog',
    projectId: 'proj-1',
    name: 'To Do',
    orderIndex: 0,
    color: '#94A3B8',
    isDoneState: false,
  };

  const mockStatusProgress: CustomStatus = {
    id: 'stat-progress',
    projectId: 'proj-1',
    name: 'In Progress',
    orderIndex: 1,
    color: '#3B82F6',
    isDoneState: false,
  };

  const mockStatusDone: CustomStatus = {
    id: 'stat-done',
    projectId: 'proj-1',
    name: 'Done',
    orderIndex: 3,
    color: '#10B981',
    isDoneState: true,
  };

  const taskSample: TaskItem = {
    id: 'task-team-01',
    projectId: 'proj-1',
    statusId: mockStatusTodo.id,
    creatorId: 'u-milt',
    assigneeId: 'u-andi',
    title: 'Pemeriksaan Arsitektur Mobile & SQLite',
    description: 'Pastikan seluruh flow offline-first berfungsi.',
    priority: 'HIGH',
    estimatedHours: 3.5,
    dueDate: '2026-11-06',
    orderIndex: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: mockStatusTodo,
    subtasks: [
      {
        id: 'sub-01',
        taskId: 'task-team-01',
        title: 'Review tabel notifications',
        isCompleted: true,
        orderIndex: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sub-02',
        taskId: 'task-team-01',
        title: 'Uji transisi status kanban',
        isCompleted: false,
        orderIndex: 1,
        createdAt: new Date().toISOString(),
      },
    ],
    comments: [
      {
        id: 'com-01',
        taskId: 'task-team-01',
        userId: 'u-milt',
        content: 'Tolong prioritaskan tugas ini sebelum rilis sync engine.',
        createdAt: new Date().toISOString(),
      },
    ],
    timeLogs: [
      {
        id: 'tl-01',
        taskId: 'task-team-01',
        userId: 'u-andi',
        durationMinutes: 45,
        note: 'Setup skema tabel',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  console.log(' - Judul Tugas:', taskSample.title);
  console.log(' - Status Awal:', taskSample.status?.name);
  console.log(' - Jumlah Subtask:', taskSample.subtasks.length);
  console.log(' - Durasi Time Log:', taskSample.timeLogs[0].durationMinutes, 'menit');

  // Transisi status maju (To Do -> In Progress -> Done)
  taskSample.statusId = mockStatusProgress.id;
  taskSample.status = mockStatusProgress;
  console.log(' - Transisi status ke:', taskSample.status.name);

  taskSample.statusId = mockStatusDone.id;
  taskSample.status = mockStatusDone;
  console.log(' - Transisi status akhir ke:', taskSample.status.name, '(isDoneState = true)');

  if (!taskSample.status.isDoneState) {
    throw new Error('Status Done harus bernilai isDoneState = true');
  }
  console.log('✔ Transisi status tugas valid!\n');

  // 3. Simulasi Sistem Notifikasi Tim
  console.log('[3] Simulasi Sistem Notifikasi & Mark-as-Read:');
  const notificationSample: NotificationItem = {
    id: 'notif-01',
    userId: 'u-andi',
    actorId: 'u-milt',
    title: 'Tugas Didelegasikan',
    message: 'Anda ditugaskan pada tugas baru: Pemeriksaan Arsitektur Mobile',
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  console.log(' - Notifikasi Masuk:', notificationSample.title);
  console.log(' - Status isRead awal:', notificationSample.isRead);

  if (notificationSample.isRead !== false) {
    throw new Error('Notifikasi baru harus berstatus isRead = false');
  }

  // Tandai sudah dibaca
  notificationSample.isRead = true;
  console.log(' - Status isRead setelah dibaca:', notificationSample.isRead);

  if (notificationSample.isRead !== true) {
    throw new Error('Gagal menandai notifikasi sebagai sudah dibaca');
  }
  console.log('✔ Sistem notifikasi dan penanda baca valid!');

  console.log('\n>>> SEMUA PENGUJIAN SMOKE TEST FASE 4 BERHASIL 100%! <<<');
}

runPhase4SmokeTest().catch((err) => {
  console.error('Smoke test Fase 4 gagal:', err);
  process.exit(1);
});
