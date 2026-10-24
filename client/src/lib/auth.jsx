import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import i18n from '../i18n/index.js';
import { api, configureApi } from './api.js';
import { storage } from './storage.js';

const AuthContext = createContext(null);

function loadSession() {
  try {
    const session = JSON.parse(storage.get('session'));
    return session?.token && session?.user ? session : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(loadSession);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const save = useCallback((next) => {
    storage.set('session', next ? JSON.stringify(next) : null);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    save(null);
    queryClient.clear();
  }, [save, queryClient]);

  configureApi({ getToken: () => sessionRef.current?.token ?? null, onUnauthorized: logout });

  const start = useCallback(
    ({ token, user }) => {
      queryClient.clear();
      save({ token, user });
      // Patients see their own language; clinician pages are English (FR-8.1, FR-8.2).
      i18n.changeLanguage(user.role === 'patient' ? user.preferredLanguage : 'en');
      return user;
    },
    [save, queryClient],
  );

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      login: async (phone, password) => start(await api('/auth/login', { method: 'POST', body: { phone, password } })),
      register: async (form) => start(await api('/auth/register', { method: 'POST', body: form })),
      logout,
      /** FR-8.3: switch now, and remember it on the account when logged in. */
      setLanguage: async (lng) => {
        await i18n.changeLanguage(lng);
        const current = sessionRef.current;
        if (current) {
          const { user } = await api('/auth/me', { method: 'PATCH', body: { preferredLanguage: lng } });
          save({ ...current, user });
        }
      },
    }),
    [session, start, logout, save],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
