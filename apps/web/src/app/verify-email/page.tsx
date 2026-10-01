'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { httpClient } from '@/shared/api/httpClient';
import { takeTokenFromHash } from '@/lib/hash-token';

type Status = 'working' | 'verified' | 'invalid' | 'error';
type Resend = 'idle' | 'sending' | 'sent' | 'login' | 'error';

const MESSAGES: Record<Exclude<Status, 'working'>, string> = {
  verified: 'Адрес подтверждён. Теперь вам доступны создание сейфа, приглашения и голосование.',
  invalid: 'Ссылка недействительна: срок истёк, она заменена новой или уже использована. Запросите новое письмо ниже (нужно быть в аккаунте).',
  error: 'Не удалось подтвердить адрес. Попробуйте позже.',
};

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>('working');
  const [resend, setResend] = useState<Resend>('idle');
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

  async function handleResend() {
    setResend('sending');
    try {
      const res = await httpClient('/auth/resend-verification', { method: 'POST' });
      setResend(res.ok ? 'sent' : res.status === 401 ? 'login' : 'error');
    } catch {
      setResend('error');
    }
  }

  return (
    <div className="p-6 font-body">
      <h1 className="mb-4 text-2xl">Подтверждение адреса</h1>
      {status === 'working' ? <p>Проверяем ссылку…</p> : <p>{MESSAGES[status]}</p>}
      {(status === 'invalid' || status === 'error') && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleResend}
            disabled={resend === 'sending' || resend === 'sent'}
            className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg disabled:opacity-50"
          >
            Отправить письмо ещё раз
          </button>
          {resend === 'sent' && <p className="mt-2">Если адрес ещё не подтверждён, письмо отправлено. Между письмами пауза около минуты.</p>}
          {resend === 'login' && <p className="mt-2">Сначала войдите в аккаунт на главной странице, затем запросите письмо снова.</p>}
          {resend === 'error' && <p className="mt-2">Не удалось отправить письмо. Попробуйте позже.</p>}
        </div>
      )}
      <div className="mt-4">
        <Link href={status === 'verified' ? '/cabinet' : '/'} className="underline">
          {status === 'verified' ? 'Перейти в кабинет' : 'На главную'}
        </Link>
      </div>
    </div>
  );
}
