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
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border p-2 text-bodaghee-navy"
        />
        <input
          type="tel"
          placeholder="Телефон (опционально)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded border p-2 text-bodaghee-navy"
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border p-2 text-bodaghee-navy"
        />
        {error && <p className="text-bodaghee-lime">{error}</p>}
        <button
          type="submit"
          className="rounded bg-bodaghee-teal px-4 py-2 text-bodaghee-navy"
        >
          Зарегистрироваться
        </button>
      </form>
    </div>
  );
}

