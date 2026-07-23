import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authService } from '../services/auth';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  avatar_url?: string;
  is_verified?: boolean;
  active_role: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  roles: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    city?: string;
  }) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  switchRole: (role: 'buyer' | 'owner') => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  const isAuthenticated = !!user;

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (token) {
          const { data } = await authService.me();
          setUser(data);
          setRoles(data.roles ?? []);
        }
      } catch {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // allow unauthenticated users to browse tabs
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading]);

  const handleAuthResponse = useCallback(async (data: any) => {
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    setUser(data.user);
    setRoles(data.roles ?? []);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await authService.login({ email, password });
      await handleAuthResponse(data);
    },
    [handleAuthResponse],
  );

  const register = useCallback(
    async (regData: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      city?: string;
    }) => {
      const { data } = await authService.register(regData);
      await handleAuthResponse(data);
    },
    [handleAuthResponse],
  );

  const googleLogin = useCallback(
    async (idToken: string) => {
      const { data } = await authService.google(idToken);
      await handleAuthResponse(data);
    },
    [handleAuthResponse],
  );

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authService.me();
      setUser(data);
      setRoles(data.roles ?? []);
    } catch {
      // ignore
    }
  }, []);

  const switchRole = useCallback(async (role: 'buyer' | 'owner') => {
    await authService.switchRole(role);
    setUser((prev) => (prev ? { ...prev, active_role: role } : prev));
  }, []);

  const logout = useCallback(async () => {
    try {
      const rt = await SecureStore.getItemAsync('refreshToken');
      await authService.logout(rt ?? undefined);
    } catch {
      // ignore
    }
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    setUser(null);
    setRoles([]);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        isLoading,
        isAuthenticated,
        login,
        register,
        googleLogin,
        switchRole,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
