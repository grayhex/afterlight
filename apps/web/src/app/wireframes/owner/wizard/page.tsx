'use client';

export const revalidate = false;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import React from 'react';
import { useSearchParams } from 'next/navigation';

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      {children}
    </div>
  );
}

export default function Wizard() {
  const sp = useSearchParams();
  const stepRaw = sp?.get('step') ?? '1';
  const stepNum = Number(stepRaw);
  const step = Number.isFinite(stepNum) && stepNum > 0 ? stepNum : 1;

  const steps = [
    { id: 1, title: 'Шаг 1 — Создание сейфа', desc: 'Задайте Quorum N-из-M, heartbeat и grace.' },
    { id: 2, title: 'Шаг 2 — Категории и блоки', desc: 'Добавьте блоки и назначьте получателей.' },
    { id: 3, title: 'Шаг 3 — Верификаторы', desc: 'Пригласите 3–5 верификаторов и отметьте Primary.' },
    { id: 4, title: 'Шаг 4 — Dry-run', desc: 'Прогон без выдачи реального контента, проверка уведомлений.' },
  ] as const;

  const current = steps.find((s) => s.id === step) ?? steps[0];

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Мастер создания сейфа</h1>

      <Card>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {steps.map((s) => (
            <a
              key={s.id}
              href={`?step=${s.id}`}
              style={{
                padding: '6px 10px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                textDecoration: 'none',
                background: s.id === current.id ? '#eef2ff' : 'white',
              }}
            >
              {s.id}. {s.title}
            </a>
          ))}
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{current.title}</h2>
          <p style={{ color: '#4b5563' }}>{current.desc}</p>
        </div>
      </Card>
    </main>
  );
}
