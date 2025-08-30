'use client';

import Link from 'next/link';
import { useAuth } from '@/shared/auth/useAuth';
import { User, ShieldCheck, LogIn, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';


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
          <motion.li
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.05 }}
          >
            <Link href="/owner" className="flex items-center gap-1" style={linkStyle}>
              <User className="h-4 w-4" />
              <span>Кабинет пользователя</span>
            </Link>
          </motion.li>
          <motion.li
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.05 }}
          >
            <Link href="/verifier" className="flex items-center gap-1" style={linkStyle}>
              <ShieldCheck className="h-4 w-4" />
              <span>Кабинет верификатора</span>
            </Link>
          </motion.li>
        </ul>
        <ul className="flex gap-4">
          {role === 'guest' ? (
            <motion.li
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.05 }}
            >
              <Link href="/login" className="flex items-center gap-1" style={linkStyle}>
                <LogIn className="h-4 w-4" />
                <span>Войти</span>
              </Link>
            </motion.li>
          ) : (
            <motion.li
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.05 }}
            >
              <Link href="/logout" className="flex items-center gap-1" style={linkStyle}>
                <LogOut className="h-4 w-4" />
                <span>Выйти</span>
              </Link>
            </motion.li>
          )}
        </ul>
      </nav>
    </header>
  );
}

