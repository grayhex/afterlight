'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { httpClient } from '@/shared/api/httpClient';
import { takeTokenFromHash } from '@/lib/hash-token';

type Step = 'working' | 'accepted' | 'login' | 'register' | 'unverified' | 'forbidden' | 'invalid' | 'error';

const MESSAGES: Record<Exclude<Step, 'working' | 'register'>, string> = {
  accepted: 'Приглашение принято. Теперь вы активный верификатор этого сейфа.',
  login: 'Для этого адреса уже есть аккаунт. Войдите в него на главной странице и откройте ссылку из письма ещё раз.',
  unverified: 'Адрес вашего аккаунта ещё не подтверждён. Откройте ссылку из письма подтверждения, затем ссылку из приглашения ещё раз.',
  forbidden: 'Приглашение выписано на другой e-mail. Войдите под тем адресом, на который оно пришло.',
  invalid: 'Приглашение недействительно: срок истёк, оно уже использовано или отозвано.',
  error: 'Не удалось принять приглашение. Попробуйте позже.',
};

const FIELD =
  'rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent';

export default function InvitePage() {
  const [step, setStep] = useState<Step>('working');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Одноразовый токен живёт только в памяти страницы: из адресной строки он убран, в хранилище не пишется.
  const token = useRef<string | null>(null);
  const started = useRef(false);

  async function accept() {
    try {
      const res = await httpClient('/verifiers/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.current }),
      });
      if (res.ok) return setStep('accepted');
      if (res.status === 401) return await offerLoginOrRegistration();
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        return setStep(body?.message === 'Email address is not verified' ? 'unverified' : 'forbidden');
      }
      if (res.status === 404 || res.status === 410) return setStep('invalid');
      setStep('error');
    } catch {
      setStep('error');
    }
  }

  // Не вошёл: по токену узнаём адрес приглашения и есть ли аккаунт — и предлагаем вход или регистрацию
  async function offerLoginOrRegistration() {
    const res = await httpClient('/verifiers/invitations/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.current }),
    });
    if (!res.ok) return setStep(res.status === 410 || res.status === 404 ? 'invalid' : 'error');
    const preview = (await res.json()) as { email: string; has_account: boolean };
    setEmail(preview.email);
    setStep(preview.has_account ? 'login' : 'register');
  }

  useEffect(() => {
    // одноразовый токен: в dev-режиме React вызывает эффект дважды, второй запрос дал бы «уже использовано»
    if (started.current) return;
    started.current = true;
    token.current = takeTokenFromHash();
    if (!token.current) {
      setStep('invalid');
      return;
    }
    void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      // Получение письма доказывает владение адресом: регистрация по токену подтверждает его сразу
      const reg = await httpClient('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, invitation_token: token.current }),
      });
      if (reg.status === 409) return setStep('login');
      if (!reg.ok) return setFormError('Проверьте данные: пароль не короче 8 символов, телефон и имя обязательны.');
      const login = await httpClient('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!login.ok) return setStep('login');
      setStep('working');
      await accept();
    } catch {
      setFormError('Ошибка соединения');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 font-body">
      <h1 className="mb-4 text-2xl">Приглашение верификатора</h1>
      {step === 'working' && <p>Проверяем приглашение…</p>}
      {step === 'register' && (
        <form onSubmit={handleRegister} className="flex max-w-sm flex-col gap-4">
          <p>Вас пригласили стать верификатором. Создайте аккаунт для адреса {email}.</p>
          <input type="email" value={email} readOnly aria-label="Email" className={FIELD} />
          <input placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} required className={FIELD} />
          <input type="tel" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} required className={FIELD} />
          <input
            type="password"
            placeholder="Пароль (не короче 8 символов)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className={FIELD}
          />
          {formError && <p className="text-bodaghee-accent">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg disabled:opacity-50"
          >
            Создать аккаунт и принять приглашение
          </button>
        </form>
      )}
      {step !== 'working' && step !== 'register' && <p>{MESSAGES[step]}</p>}
      <div className="mt-4">
        <Link href={step === 'accepted' ? '/cabinet' : '/'} className="underline">
          {step === 'accepted' ? 'Перейти в кабинет' : 'На главную'}
        </Link>
      </div>
    </div>
  );
}
