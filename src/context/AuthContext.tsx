import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile } from '../types/index.ts';
import { api } from '../services/api.ts';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getMe();
      if (res.authenticated && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
