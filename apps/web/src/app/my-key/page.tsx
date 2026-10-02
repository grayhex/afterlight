'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { httpClient } from '@/shared/api/httpClient';
import { ApiError, MIN_PASSPHRASE, claimRecipientKey, createRecipientKey, formatFingerprint, type NewRecipientKey } from '@/lib/recipient-flow';

type Claim = { state: 'idle' } | { state: 'sending' } | { state: 'done'; recipients: number } | { state: 'error'; message: string };

const inputClass =
  'rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent';
const buttonClass =
  'rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg disabled:opacity-50';

function claimMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Сначала войдите в аккаунт на главной странице: ключ привязывается к адресу, на который вас назначили получателем.';
    if (e.status === 403) return 'Адрес аккаунта не подтверждён. Откройте ссылку из письма подтверждения и повторите.';
    if (e.status === 400) return 'Сервер не принял ключ: допустим только ключ, созданный этой страницей.';
    if (e.status === 429) return 'Слишком много попыток. Подождите немного и повторите.';
  }
  return 'Не удалось заявить ключ. Файл и фраза у вас остались: повторите позже.';
}

export default function MyKeyPage() {
  const [passphrase, setPassphrase] = useState('');
  const [repeat, setRepeat] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [key, setKey] = useState<NewRecipientKey | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [claim, setClaim] = useState<Claim>({ state: 'idle' });

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    if (passphrase.length < MIN_PASSPHRASE) {
      setMessage(`Парольная фраза должна быть не короче ${MIN_PASSPHRASE} символов.`);
      return;
    }
    if (passphrase !== repeat) {
      setMessage('Фразы не совпадают.');
      return;
    }
    setCreating(true);
    try {
      setKey(await createRecipientKey(passphrase));
      // фраза нужна только для файла: из состояния страницы убираем сразу
      setPassphrase('');
      setRepeat('');
    } catch {
      setMessage('Не удалось создать ключ в этом браузере. Попробуйте другой браузер.');
    } finally {
      setCreating(false);
    }
  }

  function handleDownload() {
    if (!key) return;
    const url = URL.createObjectURL(new Blob([key.backupFile], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'afterlight-recipient-key-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  async function handleClaim() {
    if (!key) return;
    setClaim({ state: 'sending' });
    try {
      const res = await claimRecipientKey(httpClient, key.publicKey);
      setClaim({ state: 'done', recipients: res.recipients });
    } catch (e) {
      setClaim({ state: 'error', message: claimMessage(e) });
    }
  }

  return (
    <div className="p-6 font-body">
      <h1 className="mb-2 text-2xl">Мой ключ получателя</h1>
      <p className="mb-4 max-w-prose">
        Содержимое сейфа расшифровывается только у вас в браузере. Для этого нужен личный ключ: он создаётся здесь, на сервер уходит только его открытая часть.
        <strong> Без резервного файла и парольной фразы переданное расшифровать нельзя</strong>, а восстановить ключ по почте невозможно: сброс пароля от аккаунта ключ не возвращает.
      </p>

      {!key && (
        <form onSubmit={handleCreate} className="flex max-w-sm flex-col gap-4" aria-busy={creating}>
          <label className="flex flex-col gap-1">
            <span>Парольная фраза для резервного файла (не короче {MIN_PASSPHRASE} символов)</span>
            <input type="password" required minLength={MIN_PASSPHRASE} autoComplete="new-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span>Повторите фразу</span>
            <input type="password" required minLength={MIN_PASSPHRASE} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={inputClass} />
          </label>
          {message && <p role="alert" className="text-bodaghee-accent">{message}</p>}
          <button type="submit" disabled={creating} className={buttonClass}>
            {creating ? 'Создаём ключ… это занимает несколько секунд' : 'Создать ключ'}
          </button>
        </form>
      )}

      {key && claim.state !== 'done' && (
        <section className="flex max-w-xl flex-col gap-4" aria-labelledby="steps">
          <h2 id="steps" className="text-xl">Ключ создан. Осталось три шага</h2>
          <div>
            <p className="mb-2">1. Сохраните резервный файл в надёжном месте (не только в этом браузере).</p>
            <button type="button" onClick={handleDownload} className={buttonClass}>Скачать резервный файл</button>
          </div>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={saved} disabled={!downloaded} onChange={(e) => setSaved(e.target.checked)} className="mt-1" />
            <span>2. Файл сохранён, парольную фразу я запомнил(а). Без них содержимое не открыть{!downloaded && ' (сначала скачайте файл)'}.</span>
          </label>
          <div>
            <p className="mb-2">3. Заявите ключ: он привяжется к вашему адресу во всех сейфах, где вас назначили получателем.</p>
            <button type="button" onClick={handleClaim} disabled={!saved || claim.state === 'sending'} className={buttonClass}>
              {claim.state === 'sending' ? 'Отправляем…' : 'Заявить ключ'}
            </button>
            {claim.state === 'error' && <p role="alert" className="mt-2 text-bodaghee-accent">{claim.message}</p>}
          </div>
        </section>
      )}

      {key && (
        <section className="mt-6 max-w-xl" aria-labelledby="fp">
          <h2 id="fp" className="mb-2 text-xl">Отпечаток ключа</h2>
          <p className="mb-2 break-all font-mono text-sm" data-testid="fingerprint">{formatFingerprint(key.fingerprint)}</p>
          <p className="text-sm">
            Сообщите владельцу этот отпечаток лично, по телефону или другим способом <strong>вне этого сервиса</strong>: владелец сверит его и подтвердит ключ. Пока он не подтверждён, вам ничего не передаётся.
          </p>
        </section>
      )}

      {claim.state === 'done' && (
        <section className="mt-6 max-w-xl" role="status">
          {claim.recipients > 0 ? (
            <p>Ключ заявлен в сейфах: {claim.recipients}. Дальше владелец подтвердит отпечаток и подготовит доступ. Передача возможна только после завершения процесса раскрытия.</p>
          ) : (
            <p>
              Вас пока не назначили получателем ни в одном сейфе, поэтому ключ нигде не сохранён. Когда владелец назначит вас, откройте эту страницу снова и создайте ключ заново или используйте
              уже созданный: файл и фразу сохраните.
            </p>
          )}
          <p className="mt-4"><Link href="/received" className="underline">Перейти к переданному мне</Link></p>
        </section>
      )}
    </div>
  );
}
