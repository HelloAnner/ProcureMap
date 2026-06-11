import { create } from 'zustand';
import {
  apiListTasks,
  apiGetRecentAnalyses,
  type Task,
  type ProgressEvent,
} from '@/api';

export type { Task, ProgressEvent };

// UI-friendly view model derived from a backend Task
export interface TaskInfo {
  id: string;
  query: string;
  origin: string;
  material: string;
  radius: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  step: number;
  totalSteps: number;
  createdAt: string;
  companies: CompanyResult[];
  logs: LogEntry[];
  stats: {
    totalFound: number;
    matched: number;
    withContact: number;
    withCoordinate: number;
    withEmail: number;
  };
}

export interface CompanyResult {
  id: string;
  name: string;
  creditCode: string;
  category: 'M' | 'A';
  city: string;
  province: string;
  distance: number;
  capital: string;
  staffCount: number;
  score: number;
  hasEmail: boolean;
  hasCoordinate: boolean;
  hasContact: boolean;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

// Map backend Task to frontend TaskInfo
function taskToTaskInfo(t: Task): TaskInfo {
  let cfg: Record<string, unknown> = {};
  try {
    cfg = JSON.parse(t.config_json || '{}');
  } catch { /* ignore */ }

  const statusMap: Record<string, TaskInfo['status']> = {
    queued: 'pending',
    running: 'running',
    done: 'completed',
    error: 'failed',
    cancelled: 'cancelled',
  };

  return {
    id: t.id,
    query: (cfg.keywords as string[])?.join(' ') || t.material_label || '',
    origin: t.origin_name || '',
    material: t.material_label || '',
    radius: t.radius_km || 200,
    status: statusMap[t.status] || 'pending',
    progress: t.progress || 0,
    step: stepToNum(t.step),
    totalSteps: 5,
    createdAt: t.created_at || '',
    companies: [],
    logs: [],
    stats: {
      totalFound: t.company_count || 0,
      matched: t.company_count || 0,
      withContact: 0,
      withCoordinate: 0,
      withEmail: 0,
    },
  };
}

function stepToNum(step: string): number {
  const steps: Record<string, number> = {
    token: 0, search: 1, detail: 2, enrich: 3, scoring: 4, building: 5, done: 5,
  };
  return steps[step] ?? 0;
}

// --------------- mock data (browser dev fallback) ---------------

const mockRecentTasks: TaskInfo[] = [
  {
    id: 'task-001', query: '不锈钢板', origin: '无锡', material: '国标', radius: 100,
    status: 'completed', progress: 100, step: 5, totalSteps: 5,
    createdAt: '2026-06-11T14:32:00', companies: [], logs: [],
    stats: { totalFound: 47, matched: 14, withContact: 11, withCoordinate: 12, withEmail: 8 },
  },
  {
    id: 'task-002', query: '芜湖永康铝业', origin: '芜湖', material: '铝', radius: 300,
    status: 'completed', progress: 100, step: 5, totalSteps: 5,
    createdAt: '2026-06-10T09:15:00', companies: [], logs: [],
    stats: { totalFound: 53, matched: 17, withContact: 14, withCoordinate: 14, withEmail: 8 },
  },
  {
    id: 'task-003', query: '铝合金型材', origin: '佛山', material: '铝', radius: 200,
    status: 'completed', progress: 100, step: 5, totalSteps: 5,
    createdAt: '2026-06-09T16:45:00', companies: [], logs: [],
    stats: { totalFound: 32, matched: 8, withContact: 6, withCoordinate: 7, withEmail: 4 },
  },
  {
    id: 'task-004', query: '注塑模具', origin: '苏州', material: '塑料', radius: 150,
    status: 'completed', progress: 100, step: 5, totalSteps: 5,
    createdAt: '2026-06-08T11:20:00', companies: [], logs: [],
    stats: { totalFound: 28, matched: 11, withContact: 9, withCoordinate: 10, withEmail: 6 },
  },
  {
    id: 'task-005', query: '电子元器件', origin: '深圳', material: '电子', radius: 100,
    status: 'completed', progress: 100, step: 5, totalSteps: 5,
    createdAt: '2026-06-07T08:00:00', companies: [], logs: [],
    stats: { totalFound: 61, matched: 22, withContact: 18, withCoordinate: 20, withEmail: 14 },
  },
  {
    id: 'task-006', query: '包装材料', origin: '上海', material: '纸', radius: 200,
    status: 'completed', progress: 100, step: 5, totalSteps: 5,
    createdAt: '2026-06-05T14:10:00', companies: [], logs: [],
    stats: { totalFound: 39, matched: 15, withContact: 12, withCoordinate: 13, withEmail: 9 },
  },
  {
    id: 'task-007', query: '不锈钢板材', origin: '无锡', material: '国标', radius: 100,
    status: 'completed', progress: 100, step: 5, totalSteps: 5,
    createdAt: '2026-06-03T10:30:00', companies: [], logs: [],
    stats: { totalFound: 44, matched: 13, withContact: 10, withCoordinate: 11, withEmail: 7 },
  },
];

// ---------------------------------------------------------------------------

interface TaskState {
  activeTasks: Map<string, TaskInfo>;
  recentTasks: TaskInfo[];
  loadRecentTasks: () => Promise<void>;
  addTask: (task: TaskInfo) => void;
  deleteTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<TaskInfo>) => void;
  addLog: (taskId: string, entry: LogEntry) => void;
  addCompany: (taskId: string, company: CompanyResult) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  activeTasks: new Map(),
  recentTasks: [],

  loadRecentTasks: async () => {
    try {
      const tasks = await apiGetRecentAnalyses();
      if (tasks.length > 0) {
        set({ recentTasks: tasks.map(taskToTaskInfo) });
        return;
      }
    } catch { /* Tauri not available */ }
    set({ recentTasks: mockRecentTasks });
  },

  addTask: (task) => {
    set((state) => {
      const newMap = new Map(state.activeTasks);
      newMap.set(task.id, task);
      return { activeTasks: newMap };
    });
  },

  deleteTask: (id) => {
    set((state) => ({
      recentTasks: state.recentTasks.filter((t) => t.id !== id),
    }));
  },

  updateTask: (id, updates) => {
    set((state) => {
      const newMap = new Map(state.activeTasks);
      const existing = newMap.get(id);
      if (existing) {
        newMap.set(id, { ...existing, ...updates });
      }
      return { activeTasks: newMap };
    });
  },

  addLog: (taskId, entry) => {
    set((state) => {
      const newMap = new Map(state.activeTasks);
      const task = newMap.get(taskId);
      if (task) {
        newMap.set(taskId, { ...task, logs: [...task.logs, entry] });
      }
      return { activeTasks: newMap };
    });
  },

  addCompany: (taskId, company) => {
    set((state) => {
      const newMap = new Map(state.activeTasks);
      const task = newMap.get(taskId);
      if (task) {
        newMap.set(taskId, { ...task, companies: [...task.companies, company] });
      }
      return { activeTasks: newMap };
    });
  },
}));
