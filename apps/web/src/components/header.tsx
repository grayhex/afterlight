'use client';

import Link from 'next/link';
import { useAuth } from '@/shared/auth/useAuth';
import {
  Home,
  Info,
  FileText,
  Mail,
  User,
  ShieldCheck,
  Shield,
  LogIn,
  LogOut,
} from 'lucide-react';


interface HeaderProps {
  bgColor: string;
  textColor: string;
}

export default function Header({ bgColor, textColor }: HeaderProps) {
  const { role } = useAuth();

  const linkStyle = { color: textColor } as React.CSSProperties;

  return (
    <header style={{ backgroundColor: bgColor }}>
      <nav className="container mx-auto flex items-center p-4">
        <Link href="/" className="text-xl font-bold" style={linkStyle}>
          Afterlight
        </Link>
        <ul className="flex flex-1 justify-center gap-4">
          <li>
            <Link href="/" className="flex items-center gap-1" style={linkStyle}>
              <Home className="h-4 w-4" />
              <span>Главная</span>
            </Link>
          </li>
          <li>
            <Link href="/how" className="flex items-center gap-1" style={linkStyle}>
              <Info className="h-4 w-4" />
              <span>Как это работает</span>
            </Link>
          </li>
          <li>
            <Link href="/policies" className="flex items-center gap-1" style={linkStyle}>
              <FileText className="h-4 w-4" />
              <span>Политики</span>
            </Link>
          </li>
          <li>
            <Link href="/contacts" className="flex items-center gap-1" style={linkStyle}>
              <Mail className="h-4 w-4" />
              <span>Контакты</span>
            </Link>
          </li>
          <li>
            <Link href="/owner" className="flex items-center gap-1" style={linkStyle}>
              <User className="h-4 w-4" />
              <span>Кабинет владельца</span>
            </Link>
          </li>
          <li>
            <Link href="/verifier" className="flex items-center gap-1" style={linkStyle}>
              <ShieldCheck className="h-4 w-4" />
              <span>Кабинет верификатора</span>
            </Link>
          </li>
          <li>
            <Link href="/adm" className="flex items-center gap-1" style={linkStyle}>
              <Shield className="h-4 w-4" />
              <span>Админка</span>
            </Link>
          </li>
        </ul>
        <ul className="flex gap-4">
          {role === 'guest' ? (
            <li>
              <Link href="/login" className="flex items-center gap-1" style={linkStyle}>
                <LogIn className="h-4 w-4" />
                <span>Войти</span>
              </Link>
            </li>
          ) : (
            <li>
              <Link href="/logout" className="flex items-center gap-1" style={linkStyle}>
                <LogOut className="h-4 w-4" />
                <span>Выйти</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}

