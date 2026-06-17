import { create } from 'zustand';
import { api, setAccessToken } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  ready: boolean; // finished initial bootstrap
  setUser: (u: User | null, token?: string | null) => void;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, asInstructor: boolean) => Promise<User>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  becomeInstructor: () => Promise<void>;
  refreshMe: () => Promise<void>;
  has: (role: string) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  ready: false,

  setUser: (u, token) => {
    if (token !== undefined) setAccessToken(token);
    set({ user: u });
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    set({ user: data.user });
    return data.user;
  },

  register: async (name, email, password, asInstructor) => {
    const { data } = await api.post('/auth/register', { name, email, password, asInstructor });
    setAccessToken(data.accessToken);
    set({ user: data.user });
    return data.user;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    set({ user: null });
  },

  bootstrap: async () => {
    try {
      const { data } = await api.post('/auth/refresh', {});
      setAccessToken(data.accessToken);
      set({ user: data.user, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },

  becomeInstructor: async () => {
    const { data } = await api.post('/auth/become-instructor', {});
    if (data.accessToken) setAccessToken(data.accessToken);
    set({ user: data.user });
  },

  refreshMe: async () => {
    const { data } = await api.get('/auth/me');
    set({ user: data.user });
  },

  has: (role) => get().user?.roles.includes(role) ?? false,
}));
