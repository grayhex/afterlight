'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { httpClient } from '@/shared/api/httpClient';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await httpClient('/auth/register', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone: phone || undefined, password }),
      });
      if (res.ok) {
        router.push('/');
      } else {
        setError('Ошибка регистрации');
      }
    } catch {
      setError('Ошибка соединения');
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl">Регистрация</h1>
      <form
        onSubmit={handleSubmit}
        className="flex max-w-sm flex-col gap-4 font-body"
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
        />
        <input
          type="tel"
          placeholder="Телефон (опционально)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
        />
        {error && <p className="text-bodaghee-accent">{error}</p>}
        <button
          type="submit"
          className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
        >
          Зарегистрироваться
        </button>
      </form>
    </div>
  );
}

