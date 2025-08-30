'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogoutPage() {
  const router = useRouter();
  useEffect(() => {
    document.cookie = 'auth=; Max-Age=0; path=/';
    router.replace('/adm/login');
  }, [router]);
  return null;
}

