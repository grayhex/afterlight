// apps/web/src/components/ClientOnly.tsx
'use client';
import React, { useEffect, useState } from 'react';

/**
 * Рендерит children только на клиенте после монтирования.
 * Полезно для устранения ошибок гидрации/несовпадения SSR/CSR.
 */
export default function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}
