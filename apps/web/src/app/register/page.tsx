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
        router.push('/login');
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
          className="rounded border border-bodaghee-navy bg-white/80 p-2 text-bodaghee-navy placeholder:text-bodaghee-navy/50 transition-colors focus:border-bodaghee-lime focus:bg-white"
        />
        <input
          type="tel"
          placeholder="Телефон (опционально)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded border border-bodaghee-navy bg-white/80 p-2 text-bodaghee-navy placeholder:text-bodaghee-navy/50 transition-colors focus:border-bodaghee-lime focus:bg-white"
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-bodaghee-navy bg-white/80 p-2 text-bodaghee-navy placeholder:text-bodaghee-navy/50 transition-colors focus:border-bodaghee-lime focus:bg-white"
        />
        {error && <p className="text-bodaghee-lime">{error}</p>}
        <button
          type="submit"
          className="rounded bg-bodaghee-teal px-4 py-2 text-bodaghee-navy transition-colors hover:bg-bodaghee-lime"
        >
          Зарегистрироваться
        </button>
      </form>
    </div>
  );
}

