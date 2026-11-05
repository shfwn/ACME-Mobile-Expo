import { Priority } from './auth.types';

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomStatus {
  id: string;
  projectId: string;
  name: string;
  orderIndex: number;
  color: string;
  isDoneState: boolean;
}

export interface SubtaskItem {
  id: string;
  taskId: string;
  assigneeId?: string;
  title: string;
  isCompleted: boolean;
  orderIndex: number;
  createdAt: string;
}

export interface CommentItem {
  id: string;
  taskId: string;
  userId: string;
  userName?: string;
  content: string;
  createdAt: string;
}

export interface TimeLogItem {
  id: string;
  taskId: string;
  userId: string;
  durationMinutes: number;
  durationSeconds?: number;
  note?: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  projectId: string;
  statusId: string;
  creatorId: string;
  creatorName?: string;
  assigneeId?: string;
  assigneeName?: string;
  title: string;
  description?: string;
  priority: Priority;
  estimatedHours: number;
  dueDate?: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  status?: CustomStatus;
  subtasks: SubtaskItem[];
  comments: CommentItem[];
  timeLogs: TimeLogItem[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  title: string;
  message: string;
  linkUrl?: string;
  isRead: boolean;
  createdAt: string;
}
