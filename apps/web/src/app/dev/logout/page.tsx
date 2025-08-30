'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/');
    });
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
    router.replace('/dev');
  }, [router]);

  return null;
}

