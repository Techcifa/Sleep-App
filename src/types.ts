export interface SleepEntry {
  id: string;
  date: string; // YYYY-MM-DD
  bedTime: string; // HH:MM
  bedDate?: 'same' | 'prev';
  wakeTime: string; // HH:MM
  duration: number; // in minutes
  quality: number; // 1-5
  notes: string;
  tags?: string[];
  createdAt: number;
}

export type ViewTab = 'dashboard' | 'log' | 'history' | 'insights' | 'community';
