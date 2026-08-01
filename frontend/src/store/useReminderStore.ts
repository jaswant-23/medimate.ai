import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

export interface Reminder {
  id?: string;
  profileId: string;
  medicineId: string;
  doseAmount: number;
  doseUnit: string;
  instruction: 'NONE' | 'BEFORE_FOOD' | 'AFTER_FOOD' | 'EMPTY_STOMACH';
  repeatType: 'DAILY' | 'WEEKLY' | 'CUSTOM_INTERVAL' | 'COURSE';
  daysOfWeek: number[];
  intervalDays?: number | null;
  startDate: string;
  endDate?: string | null;
  times: string[];
  isActive?: boolean;
  medicine?: any;
  profile?: any;
  createdAt?: string;
}

interface ReminderState {
  reminders: Reminder[];
  doseLogs: any[];
  isLoading: boolean;
  error: string | null;

  fetchRemindersByMedicine: (medicineId: string) => Promise<boolean>;
  fetchRemindersByProfile: (profileId: string) => Promise<boolean>;
  createReminder: (reminderData: Reminder) => Promise<boolean>;
  updateReminder: (id: string, reminderData: Partial<Reminder>) => Promise<boolean>;
  deleteReminder: (id: string) => Promise<boolean>;
  toggleReminder: (id: string) => Promise<boolean>;
  logDose: (reminderId: string, status: 'TAKEN' | 'SKIPPED' | 'MISSED' | 'PENDING', scheduledAt: string, snoozeCount?: number) => Promise<boolean>;
  fetchDoseLogs: (profileId: string) => Promise<boolean>;
  triggerDailyDigestEmail: () => Promise<boolean>;
  clearError: () => void;
}

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/reminders`;

export const useReminderStore = create<ReminderState>()((set) => ({
  reminders: [],
  doseLogs: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchRemindersByMedicine: async (medicineId) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/medicine/${medicineId}`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch medicine reminders');
      set({ reminders: data, isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  fetchRemindersByProfile: async (profileId) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/profile/${profileId}`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch profile reminders');
      set({ reminders: data, isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  createReminder: async (reminderData) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify(reminderData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create reminder');
      set((state) => ({
        reminders: [data, ...state.reminders],
        isLoading: false
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  updateReminder: async (id, reminderData) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify(reminderData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update reminder');
      set((state) => ({
        reminders: state.reminders.map((r) => (r.id === id ? data : r)),
        isLoading: false
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  deleteReminder: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete reminder');
      set((state) => ({
        reminders: state.reminders.filter((r) => r.id !== id),
        isLoading: false
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  toggleReminder: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to toggle reminder status');
      set((state) => ({
        reminders: state.reminders.map((r) => (r.id === id ? data : r)),
        isLoading: false
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  logDose: async (reminderId, status, scheduledAt, snoozeCount = 0) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/dose-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({ reminderId, status, scheduledAt, snoozeCount })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to log dose');
      set((state) => ({
        doseLogs: [data, ...state.doseLogs],
        isLoading: false
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  fetchDoseLogs: async (profileId) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/dose-logs/profile/${profileId}`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch dose logs');
      set({ doseLogs: data, isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  triggerDailyDigestEmail: async () => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/daily-digest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to trigger daily digest email');
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  }
}));
