'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { auth, Role } from './store';
import { httpClient } from '../api/httpClient';

export function useAuth() {
  const role = useSyncExternalStore(
    auth.subscribe.bind(auth),
    auth.getRole.bind(auth),
    auth.getRole.bind(auth),
  );

  useEffect(() => {
    async function load() {
      try {
        const res = await httpClient('/auth/me', { method: 'GET' });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const role = data?.role;
          if (
            role === 'Owner' ||
            role === 'Verifier' ||
            role === 'Admin'
          ) {
            auth.login(role.toLowerCase() as Role);
          } else {
            auth.logout();
          }
        }
      } catch {
        // ignore errors
      }
    }
    load();
  }, []);

  return {
    role,
    login: (r: Role) => auth.login(r),
    logout: () => auth.logout(),
  };
}
