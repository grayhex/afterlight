'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { httpClient } from '@/shared/api/httpClient';
import { takeTokenFromHash } from '@/lib/hash-token';
import { auth } from '@/shared/auth/store';

type Status = 'form' | 'saving' | 'done' | 'invalid' | 'error';

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('form');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [message, setMessage] = useState('');
  // токен живёт только в памяти страницы: из адресной строки он убран сразу
  const token = useRef<string | null>(null);
  const read = useRef(false);

  useEffect(() => {
    // в dev-режиме эффект вызывается дважды, а фрагмент можно прочитать один раз
    if (read.current) return;
    read.current = true;
    token.current = takeTokenFromHash();
    if (!token.current) setStatus('invalid');
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    if (password.length < 8) {
      setMessage('Пароль должен быть не короче 8 символов.');
      return;
    }
    if (password !== repeat) {
      setMessage('Пароли не совпадают.');
      return;
    }
    setStatus('saving');
    try {
      const res = await httpClient('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.current, password }),
      });
      if (res.ok) {
        token.current = null;
        // сброс отозвал и текущую сессию (если она была): шапка должна снова предлагать вход
        auth.logout();
        setPassword('');
        setRepeat('');
        setStatus('done');
      } else if (res.status === 401 || res.status === 410) {
        setStatus('invalid');
      } else if (res.status === 400) {
        setMessage('Проверьте пароль: он должен быть не короче 8 символов.');
        setStatus('form');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="p-6 font-body">
        <h1 className="mb-4 text-2xl">Пароль изменён</h1>
        <p>Теперь можно войти с новым паролем. Сброс пароля не восстанавливает содержимое сейфов: ключи шифрования по почте не восстанавливаются.</p>
        <div className="mt-4">
          <Link href="/" className="underline">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="p-6 font-body">
        <h1 className="mb-4 text-2xl">Ссылка недействительна</h1>
        <p>Срок ссылки истёк, она заменена новой или уже использована. Запросите восстановление пароля заново на главной странице.</p>
        <div className="mt-4">
          <Link href="/" className="underline">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl">Новый пароль</h1>
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4 font-body">
        <input
          type="password"
          placeholder="Новый пароль (не короче 8 символов)"
          minLength={8}
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
        />
        <input
          type="password"
          placeholder="Повторите пароль"
          minLength={8}
          required
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
        />
        {message && <p className="text-bodaghee-accent">{message}</p>}
        {status === 'error' && <p className="text-bodaghee-accent">Не удалось изменить пароль. Попробуйте позже.</p>}
        <button
          type="submit"
          disabled={status === 'saving'}
          className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg disabled:opacity-50"
        >
          Сохранить пароль
        </button>
      </form>
    </div>
  );
}
