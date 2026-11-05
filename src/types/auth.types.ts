export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'MILT';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
  weeklyCapacityHours?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isExecutiveMode: boolean; // true for OWNER / MILT
}
