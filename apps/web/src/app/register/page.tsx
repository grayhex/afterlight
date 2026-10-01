'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { httpClient } from '@/shared/api/httpClient';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await httpClient('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      });
      if (res.ok) {
        setDone(true);
      } else if (res.status === 409) {
        setError('Этот адрес уже зарегистрирован. Войдите или восстановите пароль.');
      } else {
        setError('Проверьте данные: имя и телефон обязательны, пароль не короче 8 символов.');
      }
    } catch {
      setError('Ошибка соединения');
    }
  }

  if (done) {
    return (
      <div className="p-6 font-body">
        <h1 className="mb-4 text-2xl">Проверьте почту</h1>
        <p>
          Мы отправили письмо со ссылкой для подтверждения адреса (она действует 24 часа). До подтверждения нельзя
          создавать сейфы, принимать приглашения и голосовать.
        </p>
        <button type="button" onClick={() => router.push('/')} className="mt-4 underline">
          На главную
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl">Регистрация</h1>
      <form
        onSubmit={handleSubmit}
        className="flex max-w-sm flex-col gap-4 font-body"
      >
        <input
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
        />
        <input
          type="tel"
          placeholder="Телефон"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
        />
        <input
          type="password"
          placeholder="Пароль (не короче 8 символов)"
          minLength={8}
          required
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

