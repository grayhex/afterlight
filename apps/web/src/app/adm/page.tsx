import { promises as fs } from 'fs';
import path from 'path';

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
      textColor: String(formData.get('textColor') || '#ffffff'),
      links: [
        {
          text: String(formData.get('link1_text') || ''),
          href: String(formData.get('link1_href') || ''),
        },
        {
          text: String(formData.get('link2_text') || ''),
          href: String(formData.get('link2_href') || ''),
        },
        {
          text: String(formData.get('link3_text') || ''),
          href: String(formData.get('link3_href') || ''),
        },
      ],
    };

    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <h1 className="mb-4 text-2xl font-bold">Настройки титульной страницы</h1>
      <form action={saveConfig} className="flex w-full max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Название проекта</span>
          <input name="title" defaultValue={config.title} className="rounded p-2 text-black" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Подстрочник</span>
          <input name="subtitle" defaultValue={config.subtitle} className="rounded p-2 text-black" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Описание</span>
          <input name="description" defaultValue={config.description} className="rounded p-2 text-black" />
        </label>
        <div className="flex gap-4">
          <label className="flex flex-col gap-1">
            <span>Цвет фона</span>
            <input type="color" name="bgColor" defaultValue={config.bgColor} />
          </label>
          <label className="flex flex-col gap-1">
            <span>Цвет текста</span>
            <input type="color" name="textColor" defaultValue={config.textColor} />
          </label>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <input
              name={`link${i}_text`}
              defaultValue={config.links[i - 1]?.text || ''}
              placeholder={`Текст ссылки ${i}`}
              className="flex-1 rounded p-2 text-black"
            />
            <input
              name={`link${i}_href`}
              defaultValue={config.links[i - 1]?.href || ''}
              placeholder="URL"
              className="flex-1 rounded p-2 text-black"
            />
          </div>
        ))}
        <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white">
          Сохранить
        </button>
      </form>
    </main>
  );
}

