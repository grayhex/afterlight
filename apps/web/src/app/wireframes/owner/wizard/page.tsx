'use client';
import { useSearchParams } from 'next/navigation';
import { Step } from '@/components/Step';

export default function Wizard(){
  const step = Number(useSearchParams().get('step') || 1);
  return (
    <main className="container-narrow py-8 space-y-4">
      <h1 className="text-2xl font-semibold mb-4">Мастер создания сейфа</h1>
      <Step n={1} title="Базовые настройки">
        <ul className="list-disc pl-6">
          <li>Демо‑сейф (флаг)</li>
          <li>Heartbeat по умолчанию: 60 дней</li>
          <li>Grace: 24 часа</li>
        </ul>
        <div className="mt-3"><a className="btn btn-primary" href="/wireframes/owner/wizard?step=2">Далее</a></div>
      </Step>

      <Step n={2} title="Категории блоков">
        <ul className="list-disc pl-6">
          <li>Домашние животные</li>
          <li>Доступ к дому/квартире</li>
          <li>Контакты/телефоны</li>
          <li>Финансовые инструкции/инвентарь активов (без PIN/карт)</li>
          <li>Организация похорон</li>
          <li>Секреты (только после смерти)</li>
          <li>Публичный блок (опционально)</li>
        </ul>
        <div className="mt-3"><a className="btn btn-primary" href="/wireframes/owner/wizard?step=3">Далее</a></div>
      </Step>

      <Step n={3} title="Приглашение верификаторов">
        <p>Введите email/телефон; минимум 3, максимум 5. Можно назначить одного Primary.</p>
        <div className="mt-3"><a className="btn btn-primary" href="/wireframes/owner/wizard?step=4">Далее</a></div>
      </Step>

      <Step n={4} title="Пороги и политика">
        <ul className="list-disc pl-6">
          <li>N‑из‑M: по умолчанию 3‑из‑5</li>
          <li>Поведение при споре: блокировка на 24 часа, перезапуск</li>
        </ul>
        <div className="mt-3"><a className="btn btn-primary" href="/wireframes/owner">Готово</a></div>
      </Step>
    </main>
  )
}
