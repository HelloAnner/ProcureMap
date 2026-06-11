import { create } from 'zustand';
import { apiLogin, apiLogout, apiValidateSession, type UserSession } from '@/api';
import { isTauriRuntime } from '@/tauriRuntime';

export interface User {
  name: string;
  role: string;
  avatar: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  checkSession: () => Promise<void>;
}

function userFromSession(session: UserSession): User {
  return {
    name: session.username || 'admin',
    role: session.role === 'admin' ? '采购经理' : session.role,
    avatar: (session.username || 'A').slice(0, 1).toUpperCase(),
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('auth_token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('auth_token'),
  isLoading: false,

  login: async (password: string) => {
    set({ isLoading: true });
    try {
      const result = await apiLogin(password);
      const token = result.token;
      localStorage.setItem('auth_token', token);
      set({
        token,
        isAuthenticated: true,
        user: userFromSession(result.user),
        isLoading: false,
      });
      return true;
    } catch {
      if (isTauriRuntime()) {
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
        return false;
      }

      const token = 'demo-token-' + Date.now();
      localStorage.setItem('auth_token', token);
      set({
        token,
        isAuthenticated: true,
        user: { name: 'Anner', role: '采购经理', avatar: 'A' },
        isLoading: false,
      });
      return true;
    }
  },

  logout: () => {
    const token = localStorage.getItem('auth_token');
    if (token && isTauriRuntime()) {
      void apiLogout(token).catch(() => undefined);
    }
    localStorage.removeItem('auth_token');
    set({ token: null, user: null, isAuthenticated: false });
  },

  checkSession: async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      if (token.startsWith('demo-token-') && !isTauriRuntime()) {
        set({
          token,
          isAuthenticated: true,
          user: { name: 'Anner', role: '采购经理', avatar: 'A' },
        });
        return;
      }

      try {
        const session = await apiValidateSession(token);
        set({
          token,
          isAuthenticated: session.authenticated,
          user: userFromSession(session),
        });
        return;
      } catch {
        localStorage.removeItem('auth_token');
        set({ token: null, user: null, isAuthenticated: false });
        return;
      }
    }

    set({ token: null, user: null, isAuthenticated: false });
  },
}));
