import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

export interface StockHistory {
  id: string;
  medicineId: string;
  changeAmount: number;
  reason: 'DOSE_TAKEN' | 'MANUAL_ADJUSTMENT' | 'RESTOCK' | 'DONATED' | 'DISPOSED';
  balanceAfter: number;
  createdAt: string;
}

export interface Medicine {
  id?: string;
  profileId: string;
  name: string;
  brandName?: string;
  genericName?: string;
  type: string;
  dosageAmount: number;
  dosageUnit: string;
  quantityAvailable: number;
  quantityUnit: string;
  purchaseDate?: string;
  expiryDate: string;
  batchNumber?: string;
  doctorName?: string;
  prescriptionImageUrl?: string;
  storageInstructions?: string;
  notes?: string;
  status?: 'SAFE' | 'EXPIRING_SOON' | 'EXPIRED';
  createdAt?: string;
  stockHistory?: StockHistory[];
}

interface MedicineFilters {
  search?: string;
  type?: string;
  status?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

interface MedicineState {
  medicines: Medicine[];
  activeMedicine: Medicine | null;
  isLoading: boolean;
  error: string | null;

  fetchMedicines: (profileId: string, filters?: MedicineFilters) => Promise<boolean>;
  fetchMedicineById: (id: string) => Promise<boolean>;
  addMedicine: (medicineData: Medicine) => Promise<boolean>;
  updateMedicine: (id: string, medicineData: Partial<Medicine>) => Promise<boolean>;
  adjustStock: (id: string, adjustData: { type: 'correct' | 'add'; amount: number; reason: string }) => Promise<boolean>;
  deleteMedicine: (id: string) => Promise<boolean>;
  uploadPrescriptionImage: (file: File) => Promise<string | null>;
  clearError: () => void;
}

const API_URL = 'http://localhost:5000/api';

export const useMedicineStore = create<MedicineState>()((set) => ({
  medicines: [],
  activeMedicine: null,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchMedicines: async (profileId, filters) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      
      let queryStr = '';
      if (filters) {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.type) params.append('type', filters.type);
        if (filters.status) params.append('status', filters.status);
        if (filters.sortBy) params.append('sortBy', filters.sortBy);
        if (filters.order) params.append('order', filters.order);
        queryStr = `?${params.toString()}`;
      }

      const response = await fetch(`${API_URL}/medicines/profile/${profileId}${queryStr}`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch medicines');
      
      set({ medicines: data, isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  fetchMedicineById: async (id) => {
    set({ isLoading: true, error: null, activeMedicine: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/medicines/${id}`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch medicine details');
      
      set({ activeMedicine: data, isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  addMedicine: async (medicineData) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/medicines`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify(medicineData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to add medicine');
      
      set((state) => ({
        medicines: [...state.medicines, data],
        isLoading: false
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  updateMedicine: async (id, medicineData) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/medicines/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify(medicineData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update medicine');
      
      set((state) => ({
        medicines: state.medicines.map((m) => (m.id === id ? data : m)),
        activeMedicine: state.activeMedicine?.id === id ? data : state.activeMedicine,
        isLoading: false
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  adjustStock: async (id, adjustData) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/medicines/${id}/stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify(adjustData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to adjust stock');
      
      set((state) => ({
        medicines: state.medicines.map((m) => (m.id === id ? data : m)),
        activeMedicine: state.activeMedicine?.id === id ? data : state.activeMedicine,
        isLoading: false
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  deleteMedicine: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const response = await fetch(`${API_URL}/medicines/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete medicine');
      
      set((state) => ({
        medicines: state.medicines.filter((m) => m.id !== id),
        activeMedicine: state.activeMedicine?.id === id ? null : state.activeMedicine,
        isLoading: false
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  uploadPrescriptionImage: async (file) => {
    set({ isLoading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_URL}/auth/profile/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.token}`
        },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Image upload failed');
      
      set({ isLoading: false });
      return data.photo;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  }
}));
