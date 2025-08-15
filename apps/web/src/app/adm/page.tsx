import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getLandingConfig, saveLandingConfig, type LandingConfig } from '@/lib/landing';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const config = getLandingConfig();

  async function saveConfig(formData: FormData) {
    'use server';

    const newConfig: LandingConfig = {
      title: (formData.get('title') as string) || '',
      subtitle: (formData.get('subtitle') as string) || '',
      description: (formData.get('description') as string) || '',
      bgColor: (formData.get('bgColor') as string) || '#000000',
      titleColor: (formData.get('titleColor') as string) || '#ffffff',
      subtitleColor: (formData.get('subtitleColor') as string) || '#ffffff',
      descriptionColor:
        (formData.get('descriptionColor') as string) || '#ffffff',
      links: {
        telegram: (formData.get('telegram') as string) || '',
        github: (formData.get('github') as string) || '',
        dev: (formData.get('dev') as string) || '',
      },
    };

    await saveLandingConfig(newConfig);
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

