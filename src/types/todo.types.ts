import type { Priority } from './auth.types';

export type { Priority };

export type PersonalTodoColor = 'yellow' | 'pink' | 'mint' | 'periwinkle';

export interface PersonalTodoSubtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface PersonalTodo {
  id: string;
  userId: string;
  title: string;
  description?: string;
  targetDate: string; // YYYY-MM-DD
  startTime?: string; // "09:00"
  endTime?: string;   // "10:30"
  isCompleted: boolean;
  priority: Priority;
  category: string;   // "Kerja" | "Pribadi" | "Fokus" | "Penting"
  colorTheme?: PersonalTodoColor;
  subtasks?: PersonalTodoSubtask[];
  reminderAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PersonalNote {
  id: string;
  userId: string;
  title: string;
  contentMarkdown: string;
  linkedDate?: string; // YYYY-MM-DD
  tags: string[];
  audioUrl?: string; // Mobile audio memo feature
  createdAt: string;
  updatedAt: string;
}

export interface SavedSheetLink {
  id: string;
  userId: string;
  title: string;
  url: string;
  category: string;
  createdAt: string;
}

export interface TimeLog {
  id: string;
  taskId?: string;
  todoId?: string;
  userId: string;
  durationMinutes: number;
  note?: string;
  createdAt: string;
}
