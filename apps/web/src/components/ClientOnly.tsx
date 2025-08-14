// apps/web/src/components/ClientOnly.tsx
'use client';
import React, { useEffect, useState } from 'react';

/**
 * Рендерит детей только после монтирования на клиенте.
 * Помогает избежать ошибок гидрации (React #418/#423) и расхождений SSR/CSR.
 */
export default function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}
