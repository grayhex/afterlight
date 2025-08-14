// apps/web/src/app/playground/layout.tsx
'use client';
import React from 'react';

// В App Router вложенный layout НЕ должен рендерить <html>/<body>.
// Этот контейнер не трогает document и не управляет корневым DOM.
export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-narrow mx-auto p-6 space-y-6">
      {children}
    </div>
  );
}
