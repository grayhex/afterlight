'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Simple role detection using localStorage
// Possible roles: guest (default), owner, verifier
function useRole() {
  const [role, setRole] = useState<'guest' | 'owner' | 'verifier'>('guest');

  useEffect(() => {
    const stored = window.localStorage.getItem('role');
    if (stored === 'owner' || stored === 'verifier') {
      setRole(stored);
    }
  }, []);

  return role;
}

export default function Header() {
  const role = useRole();

  return (
    <header className="bg-gray-100">
      <nav className="container mx-auto flex items-center justify-between p-4">
        <ul className="flex gap-4">
          <li>
            <Link href="/dev">Главная</Link>
          </li>
          <li>
            <Link href="/dev/how">Как это работает</Link>
          </li>
          <li>
            <Link href="/dev/policies">Политики</Link>
          </li>
          <li>
            <Link href="/dev/contacts">Контакты</Link>
          </li>
        </ul>
        {
          (role === 'owner' || role === 'verifier') && (
            <ul className="flex gap-4">
              {role === 'owner' && (
                <li>
                  <Link href="/dev/owner">Личный кабинет</Link>
                </li>
              )}
              {role === 'verifier' && (
                <li>
                  <Link href="/dev/verifier">Кабинет верификатора</Link>
                </li>
              )}
            </ul>
          )
        }
      </nav>
    </header>
  );
}

