'use client';

import Link from 'next/link';
import { FaTelegramPlane, FaGithub, FaRegFileAlt, FaEnvelope } from 'react-icons/fa';
import { Shield } from 'lucide-react';

interface Links {
  telegram: string;
  github: string;
  policies: string;
  contacts: string;
}

export default function Footer({ links }: { links: Links }) {
  return (
    <footer className="bg-gray-200 text-gray-700">
      <nav className="container mx-auto flex justify-center p-4">
        <ul className="flex gap-6 text-sm">
          <li>
            <a
              href={links.telegram}
              className="flex items-center gap-1 hover:text-gray-900"
              aria-label="Telegram"
            >
              <FaTelegramPlane className="h-4 w-4" />
              <span>Telegram</span>
            </a>
          </li>
          <li>
            <a
              href={links.github}
              className="flex items-center gap-1 hover:text-gray-900"
              aria-label="GitHub"
            >
              <FaGithub className="h-4 w-4" />
              <span>GitHub</span>
            </a>
          </li>
          <li>
            <a
              href={links.policies}
              className="flex items-center gap-1 hover:text-gray-900"
              aria-label="Policies"
            >
              <FaRegFileAlt className="h-4 w-4" />
              <span>Политики</span>
            </a>
          </li>
          <li>
            <a
              href={links.contacts}
              className="flex items-center gap-1 hover:text-gray-900"
              aria-label="Contacts"
            >
              <FaEnvelope className="h-4 w-4" />
              <span>Контакты</span>
            </a>
          </li>
          <li>
            <Link
              href="/adm"
              className="flex items-center gap-1 hover:text-gray-900"
            >
              <Shield className="h-4 w-4" />
              <span>Админка</span>
            </Link>
          </li>
        </ul>
      </nav>
    </footer>
  );
}

