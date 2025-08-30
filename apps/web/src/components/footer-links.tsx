'use client';

import { useState, FormEvent } from 'react';
import { FaTelegramPlane, FaGithub, FaCode, FaUserShield } from 'react-icons/fa';

interface Links {
  telegram: string;
  github: string;
  dev: string;
}

export default function FooterLinks({ links }: { links: Links }) {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    const encoded = btoa(`${email}:${password}`);
    try {
      const res = await fetch('/api/landing', {
        method: 'HEAD',
        headers: { Authorization: `Basic ${encoded}` },
      });
      if (res.ok) {
        document.cookie = `auth=${encoded}; path=/`;
        window.location.href = '/adm';
      } else {
        setError('Неверный логин или пароль');
      }
    } catch {
      setError('Ошибка соединения');
    }
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 gap-6">
        <a href={links.telegram} aria-label="Telegram">
          <FaTelegramPlane className="h-6 w-6" />
        </a>
        <a href={links.github} aria-label="GitHub">
          <FaGithub className="h-6 w-6" />
        </a>
        <a href={links.dev} aria-label="Dev build">
          <FaCode className="h-6 w-6" />
        </a>
        <button onClick={() => setShow(true)} aria-label="Admin">
          <FaUserShield className="h-6 w-6" />
        </button>
      </div>
      {show && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
          <form
            onSubmit={handleLogin}
            className="flex w-80 flex-col gap-4 rounded bg-black/70 p-6 text-white"
          >
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded p-2 text-black"
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded p-2 text-black"
            />
            {error && <p className="text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShow(false)}
                className="rounded bg-gray-500 px-4 py-2"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="rounded bg-green-600 px-4 py-2 text-white"
              >
                Войти
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

