import type { TaskItem } from '../types/team.types';

export type WorkloadStatus = 'LIGHT' | 'OPTIMAL' | 'OVERLOAD';

export interface WorkloadMember {
  userId: string;
  name: string;
  totalHours: number;
  capacity: number;
  /** Persentase pembulatan, bisa > 100 saat overload */
  percentage: number;
  status: WorkloadStatus;
  tasks: TaskItem[];
}

/** Id semu untuk assignee yang profilnya belum ada di cache lokal. */
export const UNKNOWN_ASSIGNEE_ID = '__unknown_assignee__';

export const DEFAULT_WEEKLY_CAPACITY = 40;

/**
 * Status beban kerja — samakan dengan logika web (getWorkloadData):
 * < 50% LIGHT, 50–100% OPTIMAL, > 100% OVERLOAD.
 */
export function getWorkloadStatus(percentage: number): WorkloadStatus {
  if (percentage < 50) return 'LIGHT';
  if (percentage > 100) return 'OVERLOAD';
  return 'OPTIMAL';
}

interface MemberInput {
  userId: string;
  name: string;
  capacity?: number;
}

/**
 * Hitung beban kerja per anggota dari tugas lokal.
 * Tugas dianggap selesai bila statusnya isDoneState (bukan dari judul status).
 */
export function calculateWorkload(tasks: TaskItem[], members: MemberInput[]): WorkloadMember[] {
  const activeTasks = tasks.filter((t) => !t.status?.isDoneState);
  const knownIds = new Set(
    members.map((m) => m.userId).filter((id) => id !== UNKNOWN_ASSIGNEE_ID)
  );

  return members
    .map((member) => {
      // Entri "Anggota lain" mengumpulkan semua assignee yang profilnya belum ada.
      const memberTasks = activeTasks.filter((t) =>
        member.userId === UNKNOWN_ASSIGNEE_ID
          ? !!t.assigneeId && !knownIds.has(t.assigneeId)
          : t.assigneeId === member.userId
      );
      const totalHours = memberTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
      const capacity = member.capacity && member.capacity > 0 ? member.capacity : DEFAULT_WEEKLY_CAPACITY;
      const percentage = Math.round((totalHours / capacity) * 100);

      return {
        userId: member.userId,
        name: member.name,
        totalHours,
        capacity,
        percentage,
        status: getWorkloadStatus(percentage),
        tasks: memberTasks.sort((a, b) => b.estimatedHours - a.estimatedHours),
      };
    })
    .sort((a, b) => b.percentage - a.percentage);
}
