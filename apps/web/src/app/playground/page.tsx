// apps/web/src/app/playground/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import ClientOnly from '../../components/ClientOnly';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export default function PlaygroundPage() {
  const defaultApi = process.env.NEXT_PUBLIC_API_BASE ?? 'https://api.afterl.ru';

  const [apiBase, setApiBase] = useState<string>(defaultApi);
  const [userId, setUserId] = useState<string>('00000000-0000-4000-0000-000000000000');

  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState<string>('/healthz');
  const [body, setBody] = useState<string>('');
  const [pending, setPending] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [output, setOutput] = useState<string>('');

  const url = useMemo(() => {
    const base = (apiBase || '').replace(/\/+$/, '');
    const p = path?.startsWith('/') ? path : `/${path || ''}`;
    return `${base}${p}`;
  }, [apiBase, path]);

  async function runRequest() {
    setPending(true);
    setStatus('');
    setOutput('');
    try {
      let parsed: any = undefined;
      if (body.trim()) {
        try {
          parsed = JSON.parse(body);
        } catch (e: any) {
          setStatus('⚠️ invalid JSON in request body');
          setOutput(e?.message || String(e));
          setPending(false);
          return;
        }
      }

      const res = await fetch(url, {
        method,
        headers: {
          'content-type': parsed ? 'application/json' : undefined,
          'x-user-id': userId || undefined,
        } as any,
        body: parsed ? JSON.stringify(parsed) : undefined,
      });

      setStatus(`${res.status} ${res.statusText}`);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setOutput(JSON.stringify(json, null, 2));
      } catch {
        setOutput(text);
      }
    } catch (e: any) {
      setStatus('network error');
      setOutput(e?.message || String(e));
    } finally {
      setPending(false);
    }
  }

  async function pingHealth() {
    setPath('/healthz');
    setMethod('GET');
    setBody('');
    await runRequest();
  }

  return (
    <ClientOnly>
      <main className="container-narrow py-8 space-y-8">
        <h1 className="text-3xl font-semibold">AfterLight — Playground (MVP)</h1>

        {/* Settings */}
        <section className="card p-6 space-y-3">
          <h2 className="text-xl font-semibold">Настройки сессии</h2>

          <label className="block">
            <span className="text-sm text-muted-foreground">API Base URL</span>
            <input
              className="input mt-1 w-full"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="https://api.afterl.ru"
              inputMode="url"
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted-foreground">User ID (x-user-id)</span>
            <input
              className="input mt-1 w-full"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="00000000-0000-4000-0000-000000000000"
            />
          </label>

          <div className="flex gap-2 pt-2">
            <button className="btn btn-primary" onClick={pingHealth} disabled={pending}>
              Ping /healthz
            </button>
          </div>
        </section>

        {/* Custom request */}
        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Custom request</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <label className="block">
              <span className="text-sm text-muted-foreground">Method</span>
              <select
                className="input mt-1 w-full"
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-muted-foreground">Path</span>
              <input
                className="input mt-1 w-full"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/healthz"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-muted-foreground">Body (JSON)</span>
            <textarea
              className="input mt-1 w-full font-mono min-h-[120px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{"example":"value"}'
            />
          </label>

          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={runRequest} disabled={pending}>
              {pending ? 'Sending…' : 'Send'}
            </button>
            <div className="text-sm text-muted-foreground self-center break-all">
              <span className="font-mono">{url}</span>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-sm text-muted-foreground mb-1">Status: {status || '—'}</div>
            <pre className="bg-muted p-3 rounded overflow-auto text-sm max-h-[420px]">
              {output || '—'}
            </pre>
          </div>
        </section>
      </main>
    </ClientOnly>
  );
}
