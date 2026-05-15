import React, { createContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export const AuthContext = createContext();

export const normalizeRole = (roleLike) => {
  if (!roleLike) return null;
  const rawRole = typeof roleLike === 'string' ? roleLike : roleLike?.value || roleLike;
  if (typeof rawRole !== 'string') return null;
  const normalized = rawRole.includes('.') ? rawRole.split('.').pop() : rawRole;
  return normalized.toLowerCase();
};

const normalizeUser = (sessionUser) => {
  if (!sessionUser) return null;
  const role = normalizeRole(
    sessionUser?.role || sessionUser?.app_metadata?.role || sessionUser?.user_metadata?.role || null
  );
  return { ...sessionUser, role };
};

const normalizeUserUpdater = (updater) => (previous) => {
  const nextValue = typeof updater === 'function' ? updater(previous) : updater;
  return normalizeUser(nextValue);
};

export const AuthProvider = ({ children }) => {
  const [user, setRawUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setUser = (updater) => {
    setRawUser(normalizeUserUpdater(updater));
  };

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        const response = await api.get('/auth/session', { validateStatus: () => true });
        if (!isMounted) return;
        if (response.status >= 200 && response.status < 300) {
          setUser(response.data?.user || null);
        } else {
          setUser(null);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const logout = async () => {
    await api.post('/auth/logout', {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
