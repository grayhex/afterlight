'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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

  return (
    <div className="flex min-h-screen items-center justify-center p-6 font-body text-white">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        Выход...
      </motion.div>
    </div>
  );
}

