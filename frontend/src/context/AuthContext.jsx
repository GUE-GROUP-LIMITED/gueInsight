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
  const [authSource, setAuthSource] = useState(null);
  const [loading, setLoading] = useState(true);

  const setUser = (updater) => {
    setRawUser(normalizeUserUpdater(updater));
  };

  const setAuthResponse = (responseData) => {
    setUser(responseData?.user || null);
    setAuthSource(responseData?.auth_source || null);
  };

  useEffect(() => {
    let isMounted = true;

    const resolveAuthContext = () => {
      if (typeof window === 'undefined') {
        return 'user';
      }
      return window.location.pathname.startsWith('/admin') ? 'admin' : 'user';
    };

    const fetchSession = async () => {
      try {
        const response = await api.get('/auth/session', {
          validateStatus: () => true,
          headers: { 'X-Auth-Context': resolveAuthContext() },
        });
        if (!isMounted) return;
        if (response.status >= 200 && response.status < 300) {
          setAuthResponse(response.data || {});
        } else {
          setUser(null);
          setAuthSource(null);
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setAuthSource(null);
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
    setAuthSource(null);
  };

  const DEV_PREVIEW_USER = {
    id: 'dev-preview-user',
    email: 'preview@gueinsight.com',
    first_name: 'Gabriel',
    last_name: 'Aloho',
    company: 'Gue Cyber',
    role: 'user',
    current_plan: 'enterprise_elite',
    plan: 'enterprise_elite',
    subscription: { plan: 'enterprise_elite', status: 'active' },
  };

  const activeUser = user || DEV_PREVIEW_USER;

  return (
    <AuthContext.Provider value={{ user: activeUser, authSource, setUser, setAuthResponse, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
