import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AuthUser } from '../types';
import { getOfficerProfile } from '../utils/api';

interface AuthCtx {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, setUser: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem('ibms_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  // Hydrate officer_role after login
  useEffect(() => {
    if (user?.role === 'officer' && !user.officer_role) {
      getOfficerProfile()
        .then(r => {
          const updated = { ...user, officer_role: r.data.officer_role };
          setUserState(updated);
          localStorage.setItem('ibms_user', JSON.stringify(updated));
        })
        .catch(() => {});
    }
  }, [user?.token]);

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem('ibms_user', JSON.stringify(u));
      localStorage.setItem('ibms_token', u.token);
    } else {
      localStorage.removeItem('ibms_user');
      localStorage.removeItem('ibms_token');
    }
  }, []);

  const logout = useCallback(() => setUser(null), [setUser]);

  return <Ctx.Provider value={{ user, setUser, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
