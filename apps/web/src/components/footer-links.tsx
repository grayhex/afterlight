'use client';

import { FaTelegramPlane, FaGithub, FaCode } from 'react-icons/fa';

interface Links {
  telegram: string;
  github: string;
  dev: string;
}

export default function FooterLinks({ links }: { links: Links }) {
  return (
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
    </div>
  );
}

