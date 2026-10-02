'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { httpClient } from '@/shared/api/httpClient';
import { ApiError, OpenDeliveryError, listDeliveries, openDelivery, type DeliveryItem } from '@/lib/recipient-flow';

type Load = { state: 'loading' } | { state: 'ready'; items: DeliveryItem[] } | { state: 'error'; message: string };

const inputClass =
  'rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent';
const buttonClass =
  'rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg disabled:opacity-50';

function loadMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 401) return 'Войдите в аккаунт на главной странице: переданное привязано к вашему адресу.';
  if (e instanceof ApiError && e.status === 403) return 'Адрес аккаунта не подтверждён. Откройте ссылку из письма подтверждения.';
  return 'Не удалось загрузить список. Попробуйте позже.';
}

function openMessage(e: unknown): string {
  if (e instanceof OpenDeliveryError) {
    if (e.reason === 'backup') return 'Файл или парольная фраза не подходят. Нужен резервный файл ключа, созданный на странице «Мой ключ», и фраза, которой он защищён.';
    if (e.reason === 'wrong-key') return 'Этот ключ не расшифровывает данный блок: возможно, файл от другого ключа или ключ был заявлен заново после подготовки доступа.';
    if (e.reason === 'not-available') return 'Блок сейчас недоступен: процесс раскрытия не завершён, ключ не подтверждён владельцем или доступ отозван.';
    return 'Нет связи с сервером. Повторите позже.';
  }
  if (e instanceof ApiError && e.status === 429) return 'Слишком много попыток. Подождите немного.';
  return 'Не удалось открыть блок.';
}

const MAX_BACKUP_BYTES = 100_000;

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru-RU') : '—');

export default function ReceivedPage() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [selected, setSelected] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState<{ blockId: string; value: string } | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    listDeliveries(httpClient)
      .then((items) => alive.current && setLoad({ state: 'ready', items }))
      .catch((e) => alive.current && setLoad({ state: 'error', message: loadMessage(e) }));
    return () => {
      alive.current = false;
    };
  }, []);

  function choose(blockId: string) {
    setSelected(blockId);
    setError('');
    setText(null);
    setPassphrase('');
    setFile(null);
  }

  async function handleOpen(e: FormEvent) {
    e.preventDefault();
    if (!selected || !file) return;
    // резервный файл — это короткий JSON; огромный файл читать в память незачем
    if (file.size > MAX_BACKUP_BYTES) {
      setError(openMessage(new OpenDeliveryError('backup')));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const value = await openDelivery(httpClient, selected, await file.text(), passphrase);
      if (!alive.current) return;
      setText({ blockId: selected, value });
      setPassphrase('');
    } catch (err) {
      if (alive.current) setError(openMessage(err));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <div className="p-6 font-body">
      <h1 className="mb-2 text-2xl">Предназначено мне</h1>
      <p className="mb-4 max-w-prose">
        Здесь появляется то, что владелец сейфа передал лично вам, но только после завершения процесса раскрытия. Содержимое расшифровывается в вашем браузере резервным файлом ключа; сервер видит только зашифрованное.
        Нет ключа? <Link href="/my-key" className="underline">Создайте его на странице «Мой ключ»</Link>.
      </p>

      {load.state === 'loading' && <p role="status">Загружаем…</p>}
      {load.state === 'error' && <p role="alert" className="text-bodaghee-accent">{load.message}</p>}
      {load.state === 'ready' && load.items.length === 0 && (
        <p role="status">
          Пока ничего не передано. Передача начнётся после завершения процесса раскрытия, если владелец подтвердил ваш ключ и подготовил для вас доступ.
        </p>
      )}

      {load.state === 'ready' && load.items.length > 0 && (
        <ul className="flex max-w-xl flex-col gap-3">
          {load.items.map((item, i) => (
            <li key={item.block_id} className="rounded border border-bodaghee-accent/40 p-3">
              <p>Блок {i + 1}: {item.size} байт зашифрованных данных, доступен с {date(item.finalized_at)}</p>
              <button type="button" onClick={() => choose(item.block_id)} aria-expanded={selected === item.block_id} className={`${buttonClass} mt-2`}>
                Открыть
              </button>
              {selected === item.block_id && (
                <form onSubmit={handleOpen} className="mt-3 flex flex-col gap-3" aria-busy={busy}>
                  <label className="flex flex-col gap-1">
                    <span>Резервный файл ключа</span>
                    <input type="file" required accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Парольная фраза файла</span>
                    <input type="password" required autoComplete="off" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className={inputClass} />
                  </label>
                  {error && <p role="alert" className="text-bodaghee-accent">{error}</p>}
                  <button type="submit" disabled={busy || !file} className={buttonClass}>
                    {busy ? 'Расшифровываем…' : 'Расшифровать'}
                  </button>
                </form>
              )}
              {text?.blockId === item.block_id && (
                <div className="mt-3" role="region" aria-label="Расшифрованный текст">
                  <pre className="whitespace-pre-wrap break-words rounded border border-bodaghee-accent/40 p-3" data-testid="plaintext">{text.value}</pre>
                  <button type="button" onClick={() => setText(null)} className={`${buttonClass} mt-2`}>Скрыть</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
