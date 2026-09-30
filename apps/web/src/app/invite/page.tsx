'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { httpClient } from '@/shared/api/httpClient';

type Status = 'idle' | 'working' | 'accepted' | 'unauthorized' | 'forbidden' | 'invalid' | 'error';

const MESSAGES: Record<Exclude<Status, 'idle' | 'working'>, string> = {
  accepted: 'Приглашение принято. Теперь вы активный верификатор этого сейфа.',
  unauthorized: 'Сначала войдите в аккаунт, на чей e-mail пришло приглашение, затем откройте ссылку из письма ещё раз.',
  forbidden: 'Приглашение выписано на другой e-mail. Войдите под тем адресом, на который оно пришло.',
  invalid: 'Приглашение недействительно: срок истёк, оно уже использовано или отозвано.',
  error: 'Не удалось принять приглашение. Попробуйте позже.',
};

export default function InvitePage() {
  const [status, setStatus] = useState<Status>('idle');
  const started = useRef(false);

  useEffect(() => {
    // одноразовый токен: в dev-режиме React вызывает эффект дважды, второй запрос дал бы «уже использовано»
    if (started.current) return;
    started.current = true;
    // Токен лежит во фрагменте URL (#token=...): он не уходит на сервер и не попадает в логи.
    const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    if (!token) {
      setStatus('invalid');
      return;
    }
    setStatus('working');
    httpClient('/verifiers/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        // токен убираем из адресной строки независимо от результата
        window.history.replaceState(null, '', window.location.pathname);
        if (res.ok) setStatus('accepted');
        else if (res.status === 401) setStatus('unauthorized');
        else if (res.status === 403) setStatus('forbidden');
        else if (res.status === 404 || res.status === 410) setStatus('invalid');
        else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="p-6 font-body">
      <h1 className="mb-4 text-2xl">Приглашение верификатора</h1>
      {(status === 'idle' || status === 'working') && <p>Проверяем приглашение…</p>}
      {status !== 'idle' && status !== 'working' && <p>{MESSAGES[status]}</p>}
      <div className="mt-4">
        <Link href={status === 'accepted' ? '/cabinet' : '/'} className="underline">
          {status === 'accepted' ? 'Перейти в кабинет' : 'На главную'}
        </Link>
      </div>
    </div>
  );
}
