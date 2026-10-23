import { createContext, useContext, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const userQuery = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => (await apiClient.get('/auth/me')).data.data.user,
    retry: false
  });
  const loginMutation = useMutation({
    mutationFn: async (credentials) => (await apiClient.post('/auth/login', credentials)).data.data.user,
    onSuccess: (user) => queryClient.setQueryData(['current-user'], user)
  });
  const logoutMutation = useMutation({
    mutationFn: () => apiClient.post('/auth/logout'),
    onSettled: () => queryClient.setQueryData(['current-user'], null)
  });
  const changePasswordMutation = useMutation({
    mutationFn: async (values) => (await apiClient.post('/auth/change-password', values)).data.data.user,
    onSuccess: (user) => queryClient.setQueryData(['current-user'], user)
  });

  const value = useMemo(() => ({
    user: userQuery.data ?? null,
    loading: userQuery.isPending,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,
    changePasswordError: changePasswordMutation.error,
    isChangingPassword: changePasswordMutation.isPending
  }), [userQuery.data, userQuery.isPending, loginMutation, logoutMutation, changePasswordMutation]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
