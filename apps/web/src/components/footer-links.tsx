'use client';

import {
  FaTelegramPlane,
  FaGithub,
  FaCode,
  FaRegFileAlt,
  FaEnvelope,
} from 'react-icons/fa';

interface Links {
  telegram: string;
  github: string;
  dev: string;
  policies: string;
  contacts: string;
}

export default function FooterLinks({ links }: { links: Links }) {
  return (
    <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 gap-6 text-gray-400">
      <a
        href={links.telegram}
        aria-label="Telegram"
        className="transition-transform transition-colors hover:scale-110 hover:text-gray-200"
      >
        <FaTelegramPlane className="h-6 w-6" />
      </a>
      <a
        href={links.github}
        aria-label="GitHub"
        className="transition-transform transition-colors hover:scale-110 hover:text-gray-200"
      >
        <FaGithub className="h-6 w-6" />
      </a>
      <a
        href={links.dev}
        aria-label="Dev build"
        className="transition-transform transition-colors hover:scale-110 hover:text-gray-200"
      >
        <FaCode className="h-6 w-6" />
      </a>
      <a
        href={links.policies}
        aria-label="Policies"
        className="transition-transform transition-colors hover:scale-110 hover:text-gray-200"
      >
        <FaRegFileAlt className="h-6 w-6" />
      </a>
      <a
        href={links.contacts}
        aria-label="Contacts"
        className="transition-transform transition-colors hover:scale-110 hover:text-gray-200"
      >
        <FaEnvelope className="h-6 w-6" />
      </a>
    </div>
  );
}

