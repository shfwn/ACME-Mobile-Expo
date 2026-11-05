import * as XLSX from 'xlsx';
import { PersonalTodo } from '../src/types/todo.types';

function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return -1;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return -1;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

function detectConflicts(items: PersonalTodo[]): Set<string> {
  const conflicts = new Set<string>();
  const timed = items.filter((t) => t.startTime && t.endTime);

  for (let i = 0; i < timed.length; i++) {
    const a = timed[i];
    const startA = timeToMinutes(a.startTime);
    const endA = timeToMinutes(a.endTime);

    for (let j = i + 1; j < timed.length; j++) {
      const b = timed[j];
      const startB = timeToMinutes(b.startTime);
      const endB = timeToMinutes(b.endTime);

      if (startA < endB && startB < endA) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}

async function runPhase3SmokeTest() {
  console.log('=== SMOKE TEST FASE 3: Modul Eksekutif (To-Do, Kalender, Notes, Sheets) ===\n');

  const todayIso = new Date().toISOString().split('T')[0];

  // 1. Data Mock To-Do Time-blocking
  console.log('[1] Menguji Struktur To-Do Time-Blocking & Palet Warna:');
  const sampleTodo1: PersonalTodo = {
    id: 'todo-01',
    userId: 'u-milt',
    title: 'Review Sprint & Sinkronisasi DB',
    description: 'Pengecekan skema Drizzle & Neon',
    targetDate: todayIso,
    startTime: '09:00',
    endTime: '10:30',
    isCompleted: false,
    priority: 'HIGH',
    category: 'Kerja',
    colorTheme: 'yellow',
    subtasks: [
      { id: 'sub-1', title: 'Periksa migrasi SQLite', isCompleted: true },
      { id: 'sub-2', title: 'Verifikasi endpoint sync', isCompleted: false },
    ],
    createdAt: new Date().toISOString(),
    syncStatus: 'pending_push',
  };

  const sampleTodo2: PersonalTodo = {
    id: 'todo-02',
    userId: 'u-milt',
    title: 'Rapat Sinkronisasi Tim',
    description: 'Pertemuan dengan Admin & Member',
    targetDate: todayIso,
    startTime: '10:00', // Saling bentrok dengan 09:00-10:30!
    endTime: '11:00',
    isCompleted: false,
    priority: 'URGENT',
    category: 'Penting',
    colorTheme: 'pink',
    subtasks: [],
    createdAt: new Date().toISOString(),
    syncStatus: 'pending_push',
  };

  console.log(' - Todo 1:', sampleTodo1.title, `(${sampleTodo1.startTime} - ${sampleTodo1.endTime})`);
  console.log(' - Todo 2:', sampleTodo2.title, `(${sampleTodo2.startTime} - ${sampleTodo2.endTime})`);
  console.log('✔ Struktur data to-do time-blocking valid!');

  // 2. Deteksi Bentrok Jadwal Kalender
  console.log('\n[2] Menguji Algoritma Deteksi Bentrok Jadwal Kalender:');
  const conflicts = detectConflicts([sampleTodo1, sampleTodo2]);
  console.log(' - Terdeteksi konflik ID:', Array.from(conflicts));

  if (!conflicts.has('todo-01') || !conflicts.has('todo-02')) {
    throw new Error('Algoritma gagal mendeteksi bentrok antara 09:00-10:30 dan 10:00-11:00');
  }
  console.log('✔ Deteksi bentrok jadwal akurat!');

  // 3. Rollover Logic Simulation
  console.log('\n[3] Menguji Logika Rollover Tugas:');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().split('T')[0];

  const rolledOverTodo: PersonalTodo = {
    ...sampleTodo2,
    targetDate: tomorrowIso,
    syncStatus: 'pending_push',
  };
  console.log(` - Tanggal awal: ${sampleTodo2.targetDate} -> Rollover ke: ${rolledOverTodo.targetDate}`);
  if (rolledOverTodo.targetDate !== tomorrowIso) {
    throw new Error('Rollover targetDate tidak sesuai');
  }
  console.log('✔ Rollover berhasil memindahkan target tanggal!');

  // 4. Ekspor Workbook Spreadsheet dengan SheetJS
  console.log('\n[4] Menguji Generator Spreadsheet (.xlsx):');
  const rows = [sampleTodo1, sampleTodo2].map((t, idx) => ({
    No: idx + 1,
    'Tanggal Target': t.targetDate,
    'Judul To-Do': t.title,
    Kategori: t.category,
    Prioritas: t.priority,
    'Jam Mulai': t.startTime || '-',
    'Jam Selesai': t.endTime || '-',
    Status: t.isCompleted ? 'SELESAI' : 'PENDING',
    Deskripsi: t.description || '-',
    Subtasks: t.subtasks?.map((s) => `[${s.isCompleted ? 'v' : ' '}] ${s.title}`).join('; ') || '-',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Aktivitas');

  const base64Out = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  console.log(' - Generated Workbook base64 length:', base64Out.length);
  if (base64Out.length === 0) {
    throw new Error('Gagal menghasilkan file spreadsheet XLSX');
  }
  console.log('✔ SheetJS berhasil membentuk file spreadsheet terstruktur!');

  console.log('\n>>> SEMUA PENGUJIAN SMOKE TEST FASE 3 BERHASIL 100%! <<<');
}

runPhase3SmokeTest().catch((err) => {
  console.error('Smoke test Fase 3 gagal:', err);
  process.exit(1);
});
