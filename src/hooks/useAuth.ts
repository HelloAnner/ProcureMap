import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const { token, user, isAuthenticated, isLoading, login, logout, checkSession } = useAuthStore();
  return { token, user, isAuthenticated, isLoading, login, logout, checkSession };
}
