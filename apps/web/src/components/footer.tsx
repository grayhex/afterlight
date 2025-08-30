'use client';

import { FaTelegramPlane, FaGithub, FaRegFileAlt, FaEnvelope } from 'react-icons/fa';

interface Links {
  telegram: string;
  github: string;
  policies: string;
  contacts: string;
}

export default function Footer({ links }: { links: Links }) {
  return (
    <footer className="bg-bodaghee-bg text-white">
      <div className="container mx-auto grid gap-8 px-4 py-8 text-sm sm:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold uppercase">Inquiries</h3>
          <ul className="space-y-2">
            <li>
              <a
                href={links.contacts}
                className="flex items-center gap-2 hover:text-bodaghee-accent"
                aria-label="Contacts"
              >
                <FaEnvelope className="h-4 w-4" />
                <span>Контакты</span>
              </a>
            </li>
            <li>
              <a
                href={links.telegram}
                className="flex items-center gap-2 hover:text-bodaghee-accent"
                aria-label="Telegram"
              >
                <FaTelegramPlane className="h-4 w-4" />
                <span>Telegram</span>
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-semibold uppercase">Links</h3>
          <ul className="space-y-2">
            <li>
              <a
                href={links.policies}
                className="flex items-center gap-2 hover:text-bodaghee-accent"
                aria-label="Policies"
              >
                <FaRegFileAlt className="h-4 w-4" />
                <span>Политики</span>
              </a>
            </li>
            <li>
              <a
                href={links.github}
                className="flex items-center gap-2 hover:text-bodaghee-accent"
                aria-label="GitHub"
              >
                <FaGithub className="h-4 w-4" />
                <span>GitHub</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

