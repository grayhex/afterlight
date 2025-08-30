'use client';

import { useEffect, useState } from 'react';
import { httpClient } from '@/shared/api/httpClient';
import { useAuth } from '@/shared/auth/useAuth';

interface VerificationEvent {
  id: string;
  state: string;
  confirmations?: number;
  denials?: number;
  confirmsCount?: number;
  deniesCount?: number;
}

export default function VerifierPage() {
  const { role } = useAuth();
  const [events, setEvents] = useState<VerificationEvent[]>([]);

  useEffect(() => {
    if (role !== 'verifier') return;
    httpClient('/verification-events', { method: 'GET' })
      .then(res => res.json())
      .then(setEvents)
      .catch(() => {});
  }, [role]);

  const updateEvent = (evt: VerificationEvent) => {
    setEvents(prev => prev.map(e => (e.id === evt.id ? evt : e)));
  };

  const handleAction = async (id: string, action: 'confirm' | 'deny') => {
    const res = await httpClient(`/verification-events/${id}/${action}`, {
      method: 'POST',
    });

    if (res.status === 403 || res.status === 404) {
      alert(res.status === 403 ? 'Доступ запрещён' : 'Событие не найдено');
      return;
    }

    const data = await res.json();
    updateEvent(data);
  };

  const renderCounters = (e: VerificationEvent) => {
    const confirms = e.confirmsCount ?? e.confirmations ?? 0;
    const denies = e.deniesCount ?? e.denials ?? 0;
    return (
      <div className="text-sm text-gray-600">
        Подтверждения: {confirms} / Отказы: {denies}
      </div>
    );
  };

  if (role !== 'verifier') {
    return <div className="p-6">Доступ запрещён</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Кабинет верификатора</h1>
      <p className="text-sm text-gray-600">
        Требуется 2 подтверждения из 3. Публичная ссылка активна 24 часа.
      </p>
      {events.map(e => (
        <div key={e.id} className="border rounded p-4 space-y-2">
          <div className="font-mono text-sm">ID: {e.id}</div>
          <div>Состояние: {e.state}</div>
          {renderCounters(e)}
          <div className="space-x-2">
            <button
              onClick={() => handleAction(e.id, 'confirm')}
              className="bg-green-500 text-white px-2 py-1 rounded"
            >
              Подтвердить
            </button>
            <button
              onClick={() => handleAction(e.id, 'deny')}
              className="bg-red-500 text-white px-2 py-1 rounded"
            >
              Отклонить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

