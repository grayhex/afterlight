'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { httpClient } from '@/shared/api/httpClient';
import { takeTokenFromHash } from '@/lib/hash-token';

type Status = 'working' | 'verified' | 'invalid' | 'error';

const MESSAGES: Record<Exclude<Status, 'working'>, string> = {
  verified: 'Адрес подтверждён. Теперь вам доступны создание сейфа, приглашения и голосование.',
  invalid: 'Ссылка недействительна: срок истёк или она уже использована. Войдите в аккаунт и запросите новое письмо в кабинете.',
  error: 'Не удалось подтвердить адрес. Попробуйте позже.',
};

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>('working');
  const started = useRef(false);

  useEffect(() => {
    // одноразовый токен: в dev-режиме React вызывает эффект дважды, второй запрос дал бы «уже использовано»
    if (started.current) return;
    started.current = true;
    const token = takeTokenFromHash();
    if (!token) {
      setStatus('invalid');
      return;
    }
    httpClient('/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (res.ok) setStatus('verified');
        else if (res.status === 410 || res.status === 400) setStatus('invalid');
        else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="p-6 font-body">
      <h1 className="mb-4 text-2xl">Подтверждение адреса</h1>
      {status === 'working' ? <p>Проверяем ссылку…</p> : <p>{MESSAGES[status]}</p>}
      <div className="mt-4">
        <Link href={status === 'verified' ? '/cabinet' : '/'} className="underline">
          {status === 'verified' ? 'Перейти в кабинет' : 'На главную'}
        </Link>
      </div>
    </div>
  );
}
