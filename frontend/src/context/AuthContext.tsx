'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<User>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Tab-scoped session storage key (never stored in persistent localStorage)
const SESSION_STORAGE_KEY = 'sentinel_auth_session';

function getStoredSession(): { token: string; user: User } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === 'string' && parsed.user && typeof parsed.user.id === 'string') {
      return parsed;
    }
  } catch {
    // Ignore corrupt session data
  }
  return null;
}

function setStoredSession(token: string, user: User): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token, user }));
  } catch {
    // Quota or restricted environment fallback
  }
}

function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session from tab-scoped sessionStorage on mount
  useEffect(() => {
    let isMounted = true;
    const stored = getStoredSession();

    if (stored) {
      setToken(stored.token);
      setUser(stored.user);

      // Verify token freshness against backend /api/auth/me
      api
        .getMe(stored.token)
        .then((res) => {
          if (isMounted && res?.user) {
            setUser(res.user);
            setStoredSession(stored.token, res.user);
          }
        })
        .catch(() => {
          // Token expired or revoked on backend: purge local session
          if (isMounted) {
            clearStoredSession();
            setToken(null);
            setUser(null);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, pass: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.login(email, pass);
      setToken(res.token);
      setUser(res.user);
      setStoredSession(res.token, res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      if (token) {
        await api.logout(token);
      }
    } catch {
      // Backend logout failed or unreachable, ensure local state is cleaned
    } finally {
      clearStoredSession();
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: Boolean(token && user)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
