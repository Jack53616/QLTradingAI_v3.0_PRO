import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AdminContext = createContext(null);
const TOKEN_KEY = 'qlwallet-admin-token';
const PROFILE_KEY = 'qlwallet-admin-profile';

export function AdminProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (error) {
      return null;
    }
  });

  const [profile, setProfile] = useState(() => {
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  });

  const setSession = useCallback((nextToken, nextProfile) => {
    setToken(nextToken);
    setProfile(nextProfile ?? null);
    try {
      if (nextToken) {
        localStorage.setItem(TOKEN_KEY, nextToken);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (error) {
      // ignore storage errors
    }

    try {
      if (nextProfile) {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
      } else {
        localStorage.removeItem(PROFILE_KEY);
      }
    } catch (error) {
      // ignore storage errors
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null, null);
  }, [setSession]);

  const request = useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set('Accept', 'application/json');
      if (!(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(`/api/admin${path}`, {
        ...options,
        headers,
        body:
          options.body instanceof FormData || typeof options.body === 'string'
            ? options.body
            : options.body
            ? JSON.stringify(options.body)
            : undefined
      });

      if (response.status === 401) {
        logout();
        return { success: false, message: 'unauthorized' };
      }

      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        return { success: false, message: 'invalid_response' };
      }

      if (!response.ok) {
        return payload;
      }

      return payload;
    },
    [token, logout]
  );

  const value = useMemo(
    () => ({
      token,
      profile,
      setSession,
      logout,
      request
    }),
    [token, profile, setSession, logout, request]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}
