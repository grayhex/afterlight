'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { httpClient } from '@/shared/api/httpClient';
import { buttonClass, inputClass } from '@/shared/ui/classes';
import {
  ApiError,
  MIN_PASSPHRASE,
  claimRecipientKey,
  createRecipientKey,
  formatFingerprint,
  keyFromBackup,
  verifyBackupFile,
} from '@/lib/recipient-flow';

/** Ключ, который можно заявить: новый (резервный файл ещё нужно проверить) или взятый из существующего файла (проверен самим фактом открытия). */
interface Candidate {
  publicKey: string;
  fingerprint: string;
  backupFile?: string;
}

type Claim = { state: 'idle' } | { state: 'sending' } | { state: 'done'; recipients: number } | { state: 'error'; message: string };

const MAX_BACKUP_BYTES = 100_000;

function claimMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Сначала войдите в аккаунт на главной странице: ключ привязывается к адресу, на который вас назначили получателем.';
    if (e.status === 403) return 'Адрес аккаунта не подтверждён. Откройте ссылку из письма подтверждения и повторите.';
    if (e.status === 400) return 'Сервер не принял ключ: допустим только ключ, созданный этой страницей.';
    if (e.status === 429) return 'Слишком много попыток. Подождите немного и повторите.';
  }
  return 'Не удалось заявить ключ. Файл и фраза у вас остались: повторите позже.';
}

function download(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'afterlight-recipient-key-backup.json';
  // в DOM: часть браузеров игнорирует click() у «висящей» ссылки
  document.body.appendChild(a);
  a.click();
  a.remove();
  // не сразу: часть браузеров начинает скачивание после возврата из обработчика
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function MyKeyPage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [verified, setVerified] = useState(false);
  const [claim, setClaim] = useState<Claim>({ state: 'idle' });

  // новый ключ
  const [passphrase, setPassphrase] = useState('');
  const [repeat, setRepeat] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  // проверка файла нового ключа
  const [checkFile, setCheckFile] = useState<File | null>(null);
  const [checkPhrase, setCheckPhrase] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');

  // уже существующий файл
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [oldPhrase, setOldPhrase] = useState('');
  const [opening, setOpening] = useState(false);
  const [oldMessage, setOldMessage] = useState('');

  const [downloaded, setDownloaded] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (creating) return;
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
      const created = await createRecipientKey(passphrase);
      setCandidate(created);
      setVerified(false);
      // фраза нужна только для файла: из состояния страницы убираем сразу, проверка попросит ввести её снова
      setPassphrase('');
      setRepeat('');
    } catch {
      setMessage('Не удалось создать ключ в этом браузере. Попробуйте другой браузер.');
    } finally {
      setCreating(false);
    }
  }

  async function handleCheck(e: FormEvent) {
    e.preventDefault();
    if (checking || !candidate?.backupFile || !checkFile) return;
    if (checkFile.size > MAX_BACKUP_BYTES) {
      setCheckMessage('Это не резервный файл ключа: он слишком большой.');
      return;
    }
    setChecking(true);
    setCheckMessage('');
    try {
      const res = await verifyBackupFile(await checkFile.text(), checkPhrase, candidate.publicKey);
      if (res.ok) {
        setVerified(true);
        setCheckPhrase('');
      } else {
        setCheckMessage('Файл не подходит: он повреждён, это файл другого ключа или фраза не та. Скачайте файл ещё раз и проверьте снова.');
      }
    } catch {
      setCheckMessage('Не удалось проверить файл.');
    } finally {
      setChecking(false);
    }
  }

  async function handleUseExisting(e: FormEvent) {
    e.preventDefault();
    if (opening || !oldFile) return;
    if (oldFile.size > MAX_BACKUP_BYTES) {
      setOldMessage('Это не резервный файл ключа: он слишком большой.');
      return;
    }
    setOpening(true);
    setOldMessage('');
    try {
      const key = await keyFromBackup(await oldFile.text(), oldPhrase);
      setCandidate(key);
      setVerified(true); // ключ получен из самого файла: он заведомо восстанавливается
      setOldPhrase('');
    } catch {
      setOldMessage('Файл или фраза не подходят. Нужен резервный файл, созданный на этой странице, и фраза, которой он защищён.');
    } finally {
      setOpening(false);
    }
  }

  async function handleClaim() {
    if (!candidate || !verified || claim.state === 'sending') return;
    setClaim({ state: 'sending' });
    try {
      const res = await claimRecipientKey(httpClient, candidate.publicKey);
      setClaim({ state: 'done', recipients: res.recipients });
    } catch (e) {
      setClaim({ state: 'error', message: claimMessage(e) });
    }
  }

  const done = claim.state === 'done';

  return (
    <div className="p-6 font-body">
      <h1 className="mb-2 text-2xl">Мой ключ получателя</h1>
      <p className="mb-4 max-w-prose">
        Содержимое сейфа расшифровывается только у вас в браузере. Для этого нужен личный ключ: он создаётся здесь, на сервер уходит только его открытая часть.
        <strong> Без резервного файла и парольной фразы переданное расшифровать нельзя</strong>, а восстановить ключ по почте невозможно: сброс пароля от аккаунта ключ не возвращает.
      </p>

      {!candidate && (
        <div className="flex max-w-xl flex-col gap-8">
          <section aria-labelledby="existing">
            <h2 id="existing" className="mb-2 text-xl">У меня уже есть резервный файл</h2>
            <p className="mb-3 text-sm">Заявит тот же ключ ещё раз: подтверждения владельцев и подготовленный для вас доступ сохранятся.</p>
            <form onSubmit={handleUseExisting} className="flex max-w-sm flex-col gap-3" aria-busy={opening}>
              <label className="flex flex-col gap-1">
                <span>Резервный файл ключа</span>
                <input type="file" required accept="application/json,.json" onChange={(e) => setOldFile(e.target.files?.[0] ?? null)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span>Парольная фраза файла</span>
                <input type="password" required autoComplete="off" value={oldPhrase} onChange={(e) => setOldPhrase(e.target.value)} className={inputClass} />
              </label>
              {oldMessage && <p role="alert" className="text-bodaghee-accent">{oldMessage}</p>}
              <button type="submit" disabled={opening || !oldFile} className={buttonClass}>{opening ? 'Проверяем…' : 'Использовать этот ключ'}</button>
            </form>
          </section>

          <section aria-labelledby="new">
            <h2 id="new" className="mb-2 text-xl">Создать новый ключ</h2>
            <p className="mb-3 max-w-prose border-l-2 border-bodaghee-accent pl-3 text-sm">
              <strong>Новый ключ заменит прежний во всех сейфах.</strong> Владельцам придётся заново сверить отпечаток и подготовить для вас доступ, а прежний резервный файл перестанет подходить к тому,
              что уже было подготовлено. Создавайте новый ключ, только если прежнего у вас нет.
            </p>
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
          </section>
        </div>
      )}

      {candidate && !done && (
        <section className="flex max-w-xl flex-col gap-5" aria-labelledby="steps">
          <h2 id="steps" className="text-xl">{candidate.backupFile ? 'Ключ создан. Осталось три шага' : 'Ключ из файла получен. Остался один шаг'}</h2>

          {candidate.backupFile && (
            <>
              <div>
                <p className="mb-2">1. Скачайте резервный файл и сохраните его в надёжном месте (не только в этом браузере).</p>
                <button type="button" onClick={() => { download(candidate.backupFile as string); setDownloaded(true); }} className={buttonClass}>
                  Скачать резервный файл
                </button>
              </div>
              <div>
                <p className="mb-2">2. Проверьте файл: браузер не сообщает, сохранён ли он, поэтому выберите скачанный файл и введите фразу. Ключ можно будет заявить, только когда файл восстановил именно этот ключ.</p>
                {verified ? (
                  <p role="status" data-testid="backup-verified">Файл проверен: он восстанавливает этот ключ.</p>
                ) : (
                  <form onSubmit={handleCheck} className="flex max-w-sm flex-col gap-3" aria-busy={checking}>
                    <label className="flex flex-col gap-1">
                      <span>Скачанный резервный файл</span>
                      <input type="file" required accept="application/json,.json" disabled={!downloaded} onChange={(e) => setCheckFile(e.target.files?.[0] ?? null)} className={inputClass} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Парольная фраза файла</span>
                      <input type="password" required autoComplete="off" disabled={!downloaded} value={checkPhrase} onChange={(e) => setCheckPhrase(e.target.value)} className={inputClass} />
                    </label>
                    {!downloaded && <p className="text-sm">Сначала скачайте файл.</p>}
                    {checkMessage && <p role="alert" className="text-bodaghee-accent">{checkMessage}</p>}
                    <button type="submit" disabled={!downloaded || checking || !checkFile} className={buttonClass}>{checking ? 'Проверяем…' : 'Проверить файл'}</button>
                  </form>
                )}
              </div>
            </>
          )}

          <div>
            <p className="mb-2">{candidate.backupFile ? '3. ' : ''}Заявите ключ: он привяжется к вашему адресу во всех сейфах, где вас назначили получателем.</p>
            <button type="button" onClick={handleClaim} disabled={!verified || claim.state === 'sending'} className={buttonClass}>
              {claim.state === 'sending' ? 'Отправляем…' : 'Заявить ключ'}
            </button>
            {claim.state === 'error' && <p role="alert" className="mt-2 text-bodaghee-accent">{claim.message}</p>}
          </div>
        </section>
      )}

      {candidate && (
        <section className="mt-6 max-w-xl" aria-labelledby="fp">
          <h2 id="fp" className="mb-2 text-xl">Отпечаток ключа</h2>
          <p className="mb-2 break-all font-mono text-sm" data-testid="fingerprint">{formatFingerprint(candidate.fingerprint)}</p>
          <p className="text-sm">
            Сообщите владельцу этот отпечаток лично, по телефону или другим способом <strong>вне этого сервиса</strong>: владелец сверит его и подтвердит ключ. Пока он не подтверждён, вам ничего не передаётся.
          </p>
        </section>
      )}

      {done && claim.state === 'done' && (
        <section className="mt-6 max-w-xl" role="status">
          {claim.recipients > 0 ? (
            <p>Ключ заявлен в сейфах: {claim.recipients}. Дальше владелец подтвердит отпечаток и подготовит доступ. Передача возможна только после завершения процесса раскрытия.</p>
          ) : (
            <p>
              Вас пока не назначили получателем ни в одном сейфе, поэтому ключ нигде не сохранён. Когда владелец назначит вас, откройте эту страницу снова и выберите «У меня уже есть резервный файл»:
              ключ создавать заново не нужно. Файл и фразу сохраните.
            </p>
          )}
          <p className="mt-4"><Link href="/received" className="underline">Перейти к переданному мне</Link></p>
        </section>
      )}
    </div>
  );
}
