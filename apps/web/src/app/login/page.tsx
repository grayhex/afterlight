'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { httpClient } from '@/shared/api/httpClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await httpClient('/auth/login', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, otp: otp || undefined }),
      });
      if (!res.ok) {
        setError('Ошибка логина');
        return;
      }

      const data = await res.json().catch(() => ({}));
      const vaultIds: string[] = Array.isArray(data.vaults) ? data.vaults : [];

      if (vaultIds.length === 0) {
        try {
          const vRes = await httpClient('/vaults', { method: 'GET' });
          const vData = await vRes.json().catch(() => []);
          for (const v of vData) {
            if (v?.id) vaultIds.push(v.id);
          }
        } catch {
          // ignore vault fetch errors
        }
      }

      await Promise.all(
        vaultIds.map((id) =>
          httpClient('/heartbeats/ping', {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vault_id: id }),
          }),
        ),
      );

      router.push('/');
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
        <input
          type="text"
          placeholder="OTP (если включен)"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
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

