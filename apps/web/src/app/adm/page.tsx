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
      headerBgColor:
        (formData.get('headerBgColor') as string) || '#f3f4f6',
      headerTextColor:
        (formData.get('headerTextColor') as string) || '#111827',
      titleColor: (formData.get('titleColor') as string) || '#ffffff',
      subtitleColor: (formData.get('subtitleColor') as string) || '#ffffff',
      descriptionColor:
        (formData.get('descriptionColor') as string) || '#ffffff',
      buttonPrimaryBgColor:
        (formData.get('buttonPrimaryBgColor') as string) || '#2563eb',
      buttonPrimaryTextColor:
        (formData.get('buttonPrimaryTextColor') as string) || '#ffffff',
      buttonSecondaryBorderColor:
        (formData.get('buttonSecondaryBorderColor') as string) || '#2563eb',
      buttonSecondaryTextColor:
        (formData.get('buttonSecondaryTextColor') as string) || '#2563eb',
      links: {
        telegram: (formData.get('telegram') as string) || '',
        github: (formData.get('github') as string) || '',
        dev: (formData.get('dev') as string) || '',
        policies: (formData.get('policies') as string) || '',
        contacts: (formData.get('contacts') as string) || '',
      },
    };

    await saveLandingConfig(newConfig);
    revalidatePath('/');
    revalidatePath('/adm');
    redirect('/adm');
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <h1 className="mb-4 text-2xl">Настройки титульной страницы</h1>
      <form action={saveConfig} className="flex w-full max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Название проекта</span>
          <div className="flex gap-2">
            <input
              name="title"
              defaultValue={config.title}
              className="flex-1 rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
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
              className="flex-1 rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
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
              className="flex-1 rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
            <input
              type="color"
              name="descriptionColor"
              defaultValue={config.descriptionColor}
            />
          </div>
        </label>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span>Цвет фона</span>
            <input type="color" name="bgColor" defaultValue={config.bgColor} />
          </label>
          <label className="flex flex-col gap-1">
            <span>Шапка: фон и текст</span>
            <div className="flex gap-2">
              <input
                type="color"
                name="headerBgColor"
                defaultValue={config.headerBgColor}
              />
              <input
                type="color"
                name="headerTextColor"
                defaultValue={config.headerTextColor}
              />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span>Кнопка: фон и текст</span>
            <div className="flex gap-2">
              <input
                type="color"
                name="buttonPrimaryBgColor"
                defaultValue={config.buttonPrimaryBgColor}
              />
              <input
                type="color"
                name="buttonPrimaryTextColor"
                defaultValue={config.buttonPrimaryTextColor}
              />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span>Вторичная кнопка: рамка и текст</span>
            <div className="flex gap-2">
              <input
                type="color"
                name="buttonSecondaryBorderColor"
                defaultValue={config.buttonSecondaryBorderColor}
              />
              <input
                type="color"
                name="buttonSecondaryTextColor"
                defaultValue={config.buttonSecondaryTextColor}
              />
            </div>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span>Ссылка Telegram</span>
            <input
              name="telegram"
              defaultValue={config.links.telegram}
              placeholder="URL"
              className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
        </label>
        <label className="flex flex-col gap-1">
          <span>Ссылка GitHub</span>
            <input
              name="github"
              defaultValue={config.links.github}
              placeholder="URL"
              className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
        </label>
        <label className="flex flex-col gap-1">
          <span>Ссылка dev build</span>
            <input
              name="dev"
              defaultValue={config.links.dev}
              placeholder="URL"
              className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
        </label>
        <label className="flex flex-col gap-1">
          <span>Ссылка на политики</span>
            <input
              name="policies"
              defaultValue={config.links.policies}
              placeholder="URL"
              className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
        </label>
        <label className="flex flex-col gap-1">
          <span>Ссылка для контактов</span>
            <input
              name="contacts"
              defaultValue={config.links.contacts}
              placeholder="URL"
              className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
        </label>
        <button type="submit" className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg">
          Сохранить
        </button>
      </form>
    </main>
  );
}

