import { promises as fs } from 'fs';
import path from 'path';

async function getConfig() {
  const filePath = path.join(process.cwd(), 'src', 'config', 'landing.json');
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

export default async function Home() {
  const config = await getConfig();

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ backgroundColor: config.bgColor, color: config.textColor }}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-5xl font-bold">{config.title}</h1>
        <p className="text-base">{config.subtitle}</p>
        <p className="text-sm">{config.description}</p>
        <div className="mt-4 flex gap-6">
          {config.links.map((link: { text: string; href: string }, idx: number) => (
            <a key={idx} href={link.href} className="hover:underline">
              {link.text}
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
