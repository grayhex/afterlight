'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { httpClient } from '@/shared/api/httpClient';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await httpClient('/auth/login', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError('Неверный логин или пароль');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.role === 'Admin') {
        const encoded = btoa(`${email}:${password}`);
        document.cookie = `auth=${encoded}; path=/`;
        router.push('/adm');
      } else {
        setError('Нет доступа');
      }
    } catch {
      setError('Ошибка соединения');
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Вход</h1>
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border p-2"
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border p-2"
        />
        {error && <p className="text-red-600">{error}</p>}
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Войти
        </button>
      </form>
    </div>
  );
}

