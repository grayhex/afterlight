'use client';

import { useEffect, useState } from 'react';
import { httpClient } from '@/shared/api/httpClient';
import { useAuth } from '@/shared/auth/useAuth';
import { AnimatePresence, motion } from 'framer-motion';

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
      <div className="text-sm text-white/70">
        Подтверждения: {confirms} / Отказы: {denies}
      </div>
    );
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: 'ожидает', color: 'bg-bodaghee-accent' },
    confirmed: { label: 'подтверждено', color: 'bg-white' },
  };

  if (role !== 'verifier') {
    return <div className="p-6">Доступ запрещён</div>;
  }

  return (
    <div className="p-6 space-y-4 font-body">
      <h1 className="mb-2 text-2xl">Кабинет верификатора</h1>
      <p className="text-sm text-white/70">
        Требуется 2 подтверждения из 3. Публичная ссылка активна 24 часа.
      </p>
      <div className="space-y-4">
        <AnimatePresence>
          {events.map(e => {
            const status = statusMap[e.state] || { label: e.state, color: 'bg-gray-400' };
            return (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2 rounded bg-bodaghee-bg p-4 text-white shadow"
              >
                <div className="font-mono text-sm">ID: {e.id}</div>
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${status.color}`} />
                  <span>{status.label}</span>
                </div>
                {renderCounters(e)}
                <div className="space-x-2">
                  <button
                    onClick={() => handleAction(e.id, 'confirm')}
                    className="rounded border border-bodaghee-accent bg-bodaghee-bg px-2 py-1 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
                  >
                    Подтвердить
                  </button>
                  <button
                    onClick={() => handleAction(e.id, 'deny')}
                    className="rounded border border-bodaghee-accent bg-bodaghee-bg px-2 py-1 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
                  >
                    Отклонить
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

