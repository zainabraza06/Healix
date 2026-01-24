import { create } from 'zustand';
import { User, AuthState } from '@/types';
import { apiClient } from './apiClient';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setToken: (token: string, refreshToken: string) => void;
  setUser: (user: User | null) => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  refreshToken: null,
  user: null,
  isLoading: false,
  isCheckAuthLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.login(email, password);

      if (response.success && response.data) {
        const { token, refreshToken, user } = response.data;

        // Store tokens
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);

        // Set auth headers
        apiClient.setAuthHeader(token);

        set({
          token,
          refreshToken,
          user,
          isLoading: false,
          error: null,
        });

        return user as User;
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and auth state
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      apiClient.clearAuthHeader();

      set({
        token: null,
        refreshToken: null,
        user: null,
        isLoading: false,
        error: null,
      });
    }
  },

  setToken: (token: string, refreshToken: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    apiClient.setAuthHeader(token);
    set({ token, refreshToken });
  },

  setUser: (user: User | null) => {
    set({ user });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ token: null, user: null, isCheckAuthLoading: false });
      return;
    }

    try {
      set({ isCheckAuthLoading: true });
      apiClient.setAuthHeader(token);
      const response = await apiClient.getCurrentUser();

      if (response.success && response.data) {
        set({
          token,
          user: response.data,
          error: null,
          isCheckAuthLoading: false,
        });
      } else {
        throw new Error('Session expired');
      }
    } catch (error: any) {
      // Clear auth state on any error (401, network, etc.)
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      apiClient.clearAuthHeader();
      set({ token: null, user: null, error: null, isCheckAuthLoading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
