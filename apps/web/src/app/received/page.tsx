'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { httpClient } from '@/shared/api/httpClient';
import { buttonClass, inputClass } from '@/shared/ui/classes';
import { ApiError, OpenDeliveryError, listDeliveries, openDelivery, type DeliveryItem } from '@/lib/recipient-flow';

type Load = { state: 'loading' } | { state: 'ready'; items: DeliveryItem[] } | { state: 'error'; message: string };

const MAX_BACKUP_BYTES = 100_000;

function sessionMessage(e: unknown): string | null {
  if (e instanceof ApiError && e.status === 401) return 'Войдите в аккаунт на главной странице: переданное привязано к вашему адресу.';
  if (e instanceof ApiError && e.status === 403) return 'Адрес аккаунта не подтверждён. Откройте ссылку из письма подтверждения.';
  return null;
}

function loadMessage(e: unknown): string {
  return sessionMessage(e) ?? 'Не удалось загрузить список. Попробуйте позже.';
}

function openMessage(e: unknown): string {
  if (e instanceof OpenDeliveryError) {
    if (e.reason === 'backup') return 'Файл или парольная фраза не подходят. Нужен резервный файл ключа, созданный на странице «Мой ключ», и фраза, которой он защищён.';
    if (e.reason === 'wrong-key') return 'Этот ключ не расшифровывает данный блок: возможно, файл от другого ключа или ключ был заявлен заново после подготовки доступа.';
    if (e.reason === 'mismatch') return 'Сервер вернул не тот блок, который вы открывали. Расшифровка остановлена; обновите страницу и повторите.';
    if (e.reason === 'not-available') return 'Блок сейчас недоступен: процесс раскрытия не завершён, ключ не подтверждён владельцем или доступ отозван.';
    return 'Нет связи с сервером. Повторите позже.';
  }
  const session = sessionMessage(e);
  if (session) return session;
  if (e instanceof ApiError && e.status === 429) return 'Слишком много попыток. Подождите немного.';
  return 'Не удалось открыть блок.';
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru-RU') : '—');

export default function ReceivedPage() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [selected, setSelected] = useState<DeliveryItem | null>(null);
  const [formKey, setFormKey] = useState(0); // новый ключ — новая форма: выбранный файл не остаётся в поле, когда состояние сброшено
  const [passphrase, setPassphrase] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState<{ blockId: string; value: string } | null>(null);
  // Номер текущей попытки: результат прежней (после переключения на другой блок) отбрасывается
  const run = useRef(0);

  const fetchList = useCallback((isCancelled: () => boolean) => {
    listDeliveries(httpClient)
      .then((items) => !isCancelled() && setLoad({ state: 'ready', items }))
      .catch((e) => !isCancelled() && setLoad({ state: 'error', message: loadMessage(e) }));
  }, []);

  // первая загрузка: состояние уже «Загружаем», поэтому эффект ничего синхронно не выставляет
  useEffect(() => {
    let cancelled = false;
    fetchList(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchList]);

  function refresh() {
    setLoad({ state: 'loading' });
    fetchList(() => false);
  }

  function choose(item: DeliveryItem) {
    if (busy) return;
    run.current++;
    setSelected(item);
    setFormKey((k) => k + 1);
    setError('');
    setText(null);
    setPassphrase('');
    setFile(null);
  }

  async function handleOpen(e: FormEvent) {
    e.preventDefault();
    if (busy || !selected || !file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError(openMessage(new OpenDeliveryError('backup')));
      return;
    }
    const attempt = ++run.current;
    const target = selected;
    setBusy(true);
    setError('');
    try {
      const value = await openDelivery(httpClient, target.block_id, await file.text(), passphrase, target.vault_id);
      if (run.current !== attempt) return;
      setText({ blockId: target.block_id, value });
      setPassphrase('');
    } catch (err) {
      if (run.current === attempt) setError(openMessage(err));
    } finally {
      if (run.current === attempt) setBusy(false);
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
      {load.state === 'ready' && (
        <p className="mb-3">
          <button type="button" onClick={refresh} disabled={busy} className={buttonClass}>Обновить список</button>
        </p>
      )}
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
              <button type="button" onClick={() => choose(item)} disabled={busy} aria-expanded={selected?.block_id === item.block_id} className={`${buttonClass} mt-2`}>
                Открыть
              </button>
              {selected?.block_id === item.block_id && (
                <form key={formKey} onSubmit={handleOpen} className="mt-3 flex flex-col gap-3" aria-busy={busy}>
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
