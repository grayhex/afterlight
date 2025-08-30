'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { httpClient } from '@/shared/api/httpClient';
import { auth } from '@/shared/auth/store';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        await httpClient('/auth/logout');
      } catch {
        // ignore errors
      }
      auth.logout();
      router.replace('/');
    })();
  }, [router]);

  return null;
}

