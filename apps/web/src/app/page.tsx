import { promises as fs } from 'fs';
import path from 'path';
import { FaTelegramPlane, FaGithub, FaCode } from 'react-icons/fa';

export const dynamic = 'force-dynamic';

async function getConfig() {
  const filePath = path.join(process.cwd(), 'src', 'config', 'landing.json');
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

export default async function Home() {
  const config = await getConfig();

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center p-6"
      style={{ backgroundColor: config.bgColor }}
    >
      <h1
        className="absolute left-1/2 top-6 -translate-x-1/2 text-5xl font-bold"
        style={{ color: config.titleColor }}
      >
        {config.title}
      </h1>
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-base" style={{ color: config.subtitleColor }}>
          {config.subtitle}
        </p>
        <p className="text-sm" style={{ color: config.descriptionColor }}>
          {config.description}
        </p>
      </div>
      <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 gap-6">
        <a href={config.links.telegram} aria-label="Telegram">
          <FaTelegramPlane className="h-6 w-6" />
        </a>
        <a href={config.links.github} aria-label="GitHub">
          <FaGithub className="h-6 w-6" />
        </a>
        <a href={config.links.dev} aria-label="Dev build">
          <FaCode className="h-6 w-6" />
        </a>
      </div>
    </main>
  );
}
