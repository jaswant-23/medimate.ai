import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  dob?: string;
  gender?: string;
  address?: string;
  language?: string;
  preferredUnits?: string;
  theme?: string;
  notificationPref?: any;
  timezone?: string;
  notificationSettings?: any;
  isEmailVerified: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  profiles: any[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;
  
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
  verifyEmail: (token: string) => Promise<boolean>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  uploadProfileImage: (file: File) => Promise<string | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  fetchProfiles: () => Promise<boolean>;
  createProfile: (profileData: { fullName: string; relation: string; dob?: string; gender?: string; photoUrl?: string }) => Promise<boolean>;
  updateProfileMember: (id: string, profileData: { fullName: string; relation: string; dob?: string; gender?: string; photoUrl?: string }) => Promise<boolean>;
  deleteProfile: (id: string) => Promise<boolean>;
  sendPhoneOtp: (phone: string, purpose: string) => Promise<boolean>;
  verifyPhoneOtp: (phone: string, otpCode: string, purpose: string, fullName?: string) => Promise<boolean>;
  socialLogin: (payload: { token?: string, provider: string, email: string, fullName: string, photoUrl?: string }) => Promise<boolean>;
  deleteAccount: () => Promise<boolean>;
  clearError: () => void;
}

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth`;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      profiles: [],
      isAuthenticated: false,
      isLoading: false,
      error: null,
      activeProfileId: null,

      setActiveProfileId: (id) => set({ activeProfileId: id }),
      clearError: () => set({ error: null }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Login failed');
          }

          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }

          set({
            user: {
              _id: data._id,
              name: data.fullName,
              email: data.email,
              photo: data.photoUrl,
              phone: data.phone,
              dob: data.dob,
              gender: data.gender,
              address: data.address,
              language: data.preferredLanguage,
              preferredUnits: data.preferredUnits,
              theme: data.theme,
              notificationPref: data.notificationPref,
              isEmailVerified: data.isEmailVerified,
            },
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });

          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fullName: name, email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
          }

          set({ isLoading: false });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      forgotPassword: async (email) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Failed to send reset email');
          set({ isLoading: false });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      resetPassword: async (token, newPassword) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Password reset failed');
          set({ isLoading: false });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      verifyEmail: async (token) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Email verification failed');
          
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }

          set({
            isLoading: false,
            isAuthenticated: true,
            token: data.token,
            user: {
              _id: data._id,
              name: data.fullName,
              email: data.email,
              photo: data.photoUrl,
              phone: data.phone,
              dob: data.dob,
              gender: data.gender,
              address: data.address,
              language: data.preferredLanguage,
              preferredUnits: data.preferredUnits,
              theme: data.theme,
              notificationPref: data.notificationPref,
              isEmailVerified: data.isEmailVerified || false,
            }
          });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      updateProfile: async (profileData) => {
        set({ isLoading: true, error: null });
        try {
          const state = useAuthStore.getState();
          const mappedData: any = {};
          if (profileData.name !== undefined) mappedData.fullName = profileData.name;
          if (profileData.phone !== undefined) mappedData.phone = profileData.phone;
          if (profileData.photo !== undefined) mappedData.photoUrl = profileData.photo;
          if (profileData.language !== undefined) mappedData.preferredLanguage = profileData.language;
          if (profileData.dob !== undefined) mappedData.dob = profileData.dob;
          if (profileData.gender !== undefined) mappedData.gender = profileData.gender;
          if (profileData.address !== undefined) mappedData.address = profileData.address;
          if (profileData.preferredUnits !== undefined) mappedData.preferredUnits = profileData.preferredUnits;
          if (profileData.theme !== undefined) mappedData.theme = profileData.theme;
          if (profileData.notificationPref !== undefined) mappedData.notificationPref = profileData.notificationPref;

          const response = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(mappedData),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Failed to update profile');
          
          set((state) => ({
            isLoading: false,
            user: state.user ? { 
              ...state.user, 
              name: data.fullName !== undefined ? data.fullName : state.user.name,
              phone: data.phone !== undefined ? data.phone : state.user.phone,
              photo: data.photoUrl !== undefined ? data.photoUrl : state.user.photo,
              language: data.preferredLanguage !== undefined ? data.preferredLanguage : state.user.language,
              dob: data.dob !== undefined ? data.dob : state.user.dob,
              gender: data.gender !== undefined ? data.gender : state.user.gender,
              address: data.address !== undefined ? data.address : state.user.address,
              preferredUnits: data.preferredUnits !== undefined ? data.preferredUnits : state.user.preferredUnits,
              theme: data.theme !== undefined ? data.theme : state.user.theme,
              notificationPref: data.notificationPref !== undefined ? data.notificationPref : state.user.notificationPref,
            } : null
          }));
          await useAuthStore.getState().fetchProfiles();
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      uploadProfileImage: async (file) => {
        set({ isLoading: true, error: null });
        try {
          const state = useAuthStore.getState();
          const formData = new FormData();
          formData.append('image', file);

          const response = await fetch(`${API_URL}/profile/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${state.token}`
            },
            body: formData,
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Image upload failed');
          set({ isLoading: false });
          return data.photo;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return null;
        }
      },

      logout: async () => {
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            await fetch(`${API_URL}/logout`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refreshToken }),
            });
          }
        } catch (error) {
          console.error('Logout error', error);
        } finally {
          localStorage.removeItem('refreshToken');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            profiles: [],
            activeProfileId: null
          });
        }
      },

      sendPhoneOtp: async (phone, purpose) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/phone/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, purpose }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Failed to send OTP');
          set({ isLoading: false });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      verifyPhoneOtp: async (phone, otpCode, purpose, fullName) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/phone/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otpCode, purpose, fullName }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'OTP verification failed');

          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }

          set({
            user: {
              _id: data._id,
              name: data.fullName,
              email: data.email || '',
              phone: data.phone,
              dob: data.dob,
              gender: data.gender,
              address: data.address,
              photo: data.photoUrl,
              language: data.preferredLanguage,
              preferredUnits: data.preferredUnits,
              theme: data.theme,
              notificationPref: data.notificationPref,
              isEmailVerified: data.isEmailVerified || false,
            },
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      socialLogin: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/social`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Social login failed');

          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }

          set({
            user: {
              _id: data._id,
              name: data.fullName,
              email: data.email,
              photo: data.photoUrl,
              dob: data.dob,
              gender: data.gender,
              address: data.address,
              language: data.preferredLanguage,
              preferredUnits: data.preferredUnits,
              theme: data.theme,
              notificationPref: data.notificationPref,
              isEmailVerified: data.isEmailVerified || false,
            },
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      deleteAccount: async () => {
        set({ isLoading: true, error: null });
        try {
          const state = useAuthStore.getState();
          const response = await fetch(`${API_URL}/account`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${state.token}`
            },
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Failed to delete account');
          
          localStorage.removeItem('refreshToken');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        set({ isLoading: true, error: null });
        try {
          const state = useAuthStore.getState();
          const response = await fetch(`${API_URL}/change-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ currentPassword, newPassword }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Failed to change password');
          set({ isLoading: false });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      fetchProfiles: async () => {
        set({ isLoading: true, error: null });
        try {
          const state = useAuthStore.getState();
          const response = await fetch(`${API_URL}/profiles`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${state.token}`
            },
          });
          const data = await response.json();
          if (response.status === 401) {
            localStorage.removeItem('refreshToken');
            set({ 
              user: null, 
              token: null, 
              isAuthenticated: false, 
              profiles: [], 
              activeProfileId: null,
              isLoading: false, 
              error: 'Session expired. Please log in again.' 
            });
            return false;
          }
          if (!response.ok) throw new Error(data.message || 'Failed to fetch profiles');
          
          let activeId = state.activeProfileId;
          const hasActive = data.some((p: any) => p.id === activeId);
          if (!activeId || !hasActive) {
            const selfProfile = data.find((p: any) => p.relation === 'SELF');
            activeId = selfProfile ? selfProfile.id : (data[0] ? data[0].id : null);
          }

          set({ profiles: data, activeProfileId: activeId, isLoading: false });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      createProfile: async (profileData) => {
        set({ isLoading: true, error: null });
        try {
          const state = useAuthStore.getState();
          const response = await fetch(`${API_URL}/profiles`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(profileData),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Failed to create profile');
          set((state) => ({
            profiles: [...state.profiles, data],
            isLoading: false,
          }));
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      updateProfileMember: async (id, profileData) => {
        set({ isLoading: true, error: null });
        try {
          const state = useAuthStore.getState();
          const response = await fetch(`${API_URL}/profiles/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(profileData),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Failed to update profile');
          set((state) => {
            const isSelf = data.relation === 'SELF';
            return {
              profiles: state.profiles.map((p) => (p.id === id ? data : p)),
              user: (isSelf && state.user) ? {
                ...state.user,
                name: data.fullName,
                photo: data.photoUrl,
                dob: data.dob,
                gender: data.gender,
              } : state.user,
              isLoading: false,
            };
          });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      deleteProfile: async (id) => {
        set({ isLoading: true, error: null });
        try {
          const state = useAuthStore.getState();
          const response = await fetch(`${API_URL}/profiles/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${state.token}`
            },
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Failed to delete profile');
          set((state) => ({
            profiles: state.profiles.filter((p) => p.id !== id),
            isLoading: false,
          }));
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },
    }),
    {
      name: 'auth-storage', // name of item in localStorage
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      }), // only persist these fields
    }
  )
);
