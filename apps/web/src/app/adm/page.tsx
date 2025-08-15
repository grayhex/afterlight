import { promises as fs } from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const configPath = path.join(process.cwd(), 'src', 'config', 'landing.json');

async function readConfig() {
  const data = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(data);
}

export default async function AdminPage() {
  const config = await readConfig();

  async function saveConfig(formData: FormData) {
    'use server';

    const newConfig = {
      title: String(formData.get('title') || ''),
      subtitle: String(formData.get('subtitle') || ''),
      description: String(formData.get('description') || ''),
      bgColor: String(formData.get('bgColor') || '#000000'),
      titleColor: String(formData.get('titleColor') || '#ffffff'),
      subtitleColor: String(formData.get('subtitleColor') || '#ffffff'),
      descriptionColor: String(formData.get('descriptionColor') || '#ffffff'),
      links: {
        telegram: String(formData.get('telegram') || ''),
        github: String(formData.get('github') || ''),
        dev: String(formData.get('dev') || ''),
      },
    };

    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
    revalidatePath('/');
    revalidatePath('/adm');
    redirect('/adm');
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <h1 className="mb-4 text-2xl font-bold">Настройки титульной страницы</h1>
      <form action={saveConfig} className="flex w-full max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Название проекта</span>
          <div className="flex gap-2">
            <input
              name="title"
              defaultValue={config.title}
              className="flex-1 rounded p-2 text-black"
            />
            <input type="color" name="titleColor" defaultValue={config.titleColor} />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span>Подстрочник</span>
          <div className="flex gap-2">
            <input
              name="subtitle"
              defaultValue={config.subtitle}
              className="flex-1 rounded p-2 text-black"
            />
            <input type="color" name="subtitleColor" defaultValue={config.subtitleColor} />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span>Описание</span>
          <div className="flex gap-2">
            <input
              name="description"
              defaultValue={config.description}
              className="flex-1 rounded p-2 text-black"
            />
            <input
              type="color"
              name="descriptionColor"
              defaultValue={config.descriptionColor}
            />
          </div>
        </label>
        <div className="flex gap-4">
          <label className="flex flex-col gap-1">
            <span>Цвет фона</span>
            <input type="color" name="bgColor" defaultValue={config.bgColor} />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span>Ссылка Telegram</span>
          <input
            name="telegram"
            defaultValue={config.links.telegram}
            placeholder="URL"
            className="rounded p-2 text-black"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Ссылка GitHub</span>
          <input
            name="github"
            defaultValue={config.links.github}
            placeholder="URL"
            className="rounded p-2 text-black"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Ссылка dev build</span>
          <input
            name="dev"
            defaultValue={config.links.dev}
            placeholder="URL"
            className="rounded p-2 text-black"
          />
        </label>
        <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white">
          Сохранить
        </button>
      </form>
    </main>
  );
}

