'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Json = any;

function useLocalStorage(key: string, initial: string) {
  const [val, setVal] = useState<string>(() => {
    if (typeof window === 'undefined') return initial;
    try { return window.localStorage.getItem(key) ?? initial; } catch { return initial; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, val); } catch {}
  }, [key, val]);
  return [val, setVal] as const;
}

function Section({title, children}: {title: string, children: React.ReactNode}) {
  return (
    <section className="rounded-xl border p-4 mb-6">
      <h2 className="font-semibold text-lg mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({label, children}: {label: string, children: React.ReactNode}) {
  return (
    <label className="flex flex-col gap-1 mb-3">
      <span className="text-sm text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function Button({children, ...props}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className="px-3 py-2 rounded-lg border hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50" />;
}

function JsonView({data}: {data: Json}) {
  if (data == null) return null;
  return <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto max-h-72">{JSON.stringify(data, null, 2)}</pre>;
}

export default function PlaygroundPage() {
  const defaultBase = process.env.NEXT_PUBLIC_API_BASE || 'https://api.afterl.ru';
  const defaultUser = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || '00000000-0000-4000-8000-000000000001';

  const [baseUrl, setBaseUrl] = useLocalStorage('al.baseUrl', defaultBase);
  const [userId, setUserId] = useLocalStorage('al.userId', defaultUser);

  const [vaultId, setVaultId] = useLocalStorage('al.vaultId', '');
  const [blockId, setBlockId] = useLocalStorage('al.blockId', '');
  const [recipientId, setRecipientId] = useLocalStorage('al.recipientId', '');
  const [verifierId, setVerifierId] = useLocalStorage('al.verifierId', '');

  const [out, setOut] = useState<Json>(null);
  const [busy, setBusy] = useState(false);

  async function api(path: string, init: RequestInit & { formData?: FormData } = {}) {
    const url = baseUrl.replace(/\/$/, '') + path;
    const headers: Record<string,string> = { 'x-user-id': userId };
    if (!init.formData) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: 'GET',
      ...init,
      headers: { ...(init.headers as any), ...headers },
      body: init.formData ? init.formData : init.body,
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) throw { status: res.status, data };
    return data;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AfterLight — Playground (MVP)</h1>
      <Section title="Настройки сессии">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="API Base URL">
            <input className="border rounded px-3 py-2" value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://api.afterl.ru"/>
          </Field>
          <Field label="User ID (x-user-id)">
            <input className="border rounded px-3 py-2" value={userId} onChange={e=>setUserId(e.target.value)} placeholder="uuid"/>
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="vaultId">
            <input className="border rounded px-3 py-2" value={vaultId} onChange={e=>setVaultId(e.target.value)} placeholder="uuid"/>
          </Field>
          <Field label="blockId">
            <input className="border rounded px-3 py-2" value={blockId} onChange={e=>setBlockId(e.target.value)} placeholder="uuid"/>
          </Field>
          <Field label="recipientId">
            <input className="border rounded px-3 py-2" value={recipientId} onChange={e=>setRecipientId(e.target.value)} placeholder="uuid"/>
          </Field>
          <Field label="verifierId">
            <input className="border rounded px-3 py-2" value={verifierId} onChange={e=>setVerifierId(e.target.value)} placeholder="uuid"/>
          </Field>
        </div>
      </Section>

      <Section title="Health">
        <div className="flex gap-2">
          <Button disabled={busy} onClick={async ()=>{
            setBusy(true);
            try { setOut(await api('/healthz')); } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>GET /healthz</Button>
          <Button disabled={busy} onClick={async ()=>{
            setBusy(true);
            try { setOut(await api('/readyz')); } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>GET /readyz</Button>
        </div>
      </Section>

      <Section title="Vaults">
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={async ()=>{
            setBusy(true);
            try {
              const data = await api('/vaults', { method: 'POST', body: JSON.stringify({
                is_demo: true, quorum_threshold: 3, max_verifiers: 5, heartbeat_timeout_days: 60, grace_hours: 24
              })});
              setOut(data);
              if (data?.id) setVaultId(data.id);
            } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>POST /vaults (Create)</Button>
          <Button disabled={busy || !vaultId} onClick={async ()=>{
            setBusy(true);
            try { setOut(await api(`/vaults/${vaultId}`)); } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>GET /vaults/{'{vaultId}'}</Button>
        </div>
      </Section>

      <Section title="Recipients">
        <div className="flex gap-2 items-end">
          <Field label="contact (email/phone)">
            <input id="rec-contact" className="border rounded px-3 py-2" defaultValue="recipient@example.com"/>
          </Field>
          <Field label="pubkey (optional)">
            <input id="rec-pubkey" className="border rounded px-3 py-2" placeholder="base64"/>
          </Field>
          <Button disabled={busy} onClick={async ()=>{
            setBusy(true);
            try {
              const contact = (document.getElementById('rec-contact') as HTMLInputElement).value;
              const pubkey = (document.getElementById('rec-pubkey') as HTMLInputElement).value || null;
              const data = await api('/recipients', { method: 'POST', body: JSON.stringify({ contact, pubkey })});
              setOut(data);
              if (data?.id) setRecipientId(data.id);
            } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>POST /recipients (Create)</Button>
        </div>
      </Section>

      <Section title="Blocks (multipart)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="type">
            <select id="blk-type" className="border rounded px-3 py-2" defaultValue="text">
              <option value="text">text</option>
              <option value="file">file</option>
              <option value="url">url</option>
            </select>
          </Field>
          <Field label="tags (comma-separated)">
            <input id="blk-tags" className="border rounded px-3 py-2" defaultValue="pets,care"/>
          </Field>
          <Field label="metadata (JSON string)">
            <textarea id="blk-meta" className="border rounded px-3 py-2" defaultValue='{"category":"pets","title":"Инструкции по питомцу"}'/>
          </Field>
          <Field label="content (file)">
            <input id="blk-file" type="file" className="border rounded px-3 py-2"/>
          </Field>
        </div>
        <div className="flex gap-2">
          <Button disabled={busy || !vaultId} onClick={async ()=>{
            setBusy(true);
            try {
              const fd = new FormData();
              fd.append('vault_id', vaultId);
              fd.append('type', (document.getElementById('blk-type') as HTMLSelectElement).value);
              fd.append('tags', (document.getElementById('blk-tags') as HTMLInputElement).value);
              fd.append('metadata', (document.getElementById('blk-meta') as HTMLTextAreaElement).value);
              const fileIn = (document.getElementById('blk-file') as HTMLInputElement);
              if (fileIn?.files && fileIn.files.length > 0) fd.append('content', fileIn.files[0]);
              const data = await api('/blocks', { method: 'POST', formData: fd });
              setOut(data);
              if (data?.id) setBlockId(data.id);
            } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>POST /blocks (Create)</Button>
          <Button disabled={busy || !blockId} onClick={async ()=>{
            setBusy(true);
            try { setOut(await api(`/blocks/${blockId}`)); } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>GET /blocks/{'{blockId}'}</Button>
        </div>
      </Section>

      <Section title="Block → Recipients">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="recipient_id">
            <input id="br-recipient" className="border rounded px-3 py-2" value={recipientId} onChange={(e)=>setRecipientId(e.target.value)}/>
          </Field>
          <Field label="dek_wrapped_for_recipient">
            <input id="br-dek" className="border rounded px-3 py-2" placeholder="base64:WRAPPED_DEK"/>
          </Field>
        </div>
        <Button disabled={busy || !blockId || !recipientId} onClick={async ()=>{
          setBusy(true);
          try {
            const dek = (document.getElementById('br-dek') as HTMLInputElement).value || 'base64:ENVELOPE_KEY_FOR_RECIPIENT';
            const data = await api(`/blocks/${blockId}/recipients`, { method: 'POST', body: JSON.stringify({
              recipient_id: recipientId, dek_wrapped_for_recipient: dek
            })});
            setOut(data);
          } catch(e:any){ setOut(e); } finally { setBusy(false); }
        }}>POST /blocks/{'{blockId}'}/recipients</Button>
      </Section>

      <Section title="Public Link for Block">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="enabled">
            <select id="pl-enabled" className="border rounded px-3 py-2" defaultValue="true">
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </Field>
          <Field label="publish_from (ISO)">
            <input id="pl-from" className="border rounded px-3 py-2" defaultValue={new Date().toISOString()}/>
          </Field>
          <Field label="publish_until (ISO or empty)">
            <input id="pl-until" className="border rounded px-3 py-2" placeholder=""/>
          </Field>
          <Field label="max_views (optional)">
            <input id="pl-max" className="border rounded px-3 py-2" placeholder="10"/>
          </Field>
        </div>
        <Button disabled={busy || !blockId} onClick={async ()=>{
          setBusy(true);
          try {
            const enabled = (document.getElementById('pl-enabled') as HTMLSelectElement).value === 'true';
            const publish_from = (document.getElementById('pl-from') as HTMLInputElement).value;
            const publish_until = (document.getElementById('pl-until') as HTMLInputElement).value || null;
            const max_viewsStr = (document.getElementById('pl-max') as HTMLInputElement).value;
            const max_views = max_viewsStr ? Number(max_viewsStr) : null;
            const data = await api(`/blocks/${blockId}/public`, { method: 'PUT', body: JSON.stringify({
              enabled, publish_from, publish_until, max_views
            })});
            setOut(data);
          } catch(e:any){ setOut(e); } finally { setBusy(false); }
        }}>PUT /blocks/{'{blockId}'}/public</Button>
      </Section>

      <Section title="Verifiers & Orchestrator">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Invite verifier (contact)">
            <input id="inv-contact" className="border rounded px-3 py-2" defaultValue="verifier1@example.com"/>
          </Field>
          <Field label="channel">
            <select id="inv-channel" className="border rounded px-3 py-2" defaultValue="email">
              <option value="email">email</option>
              <option value="sms">sms</option>
            </select>
          </Field>
          <Field label="expires_in_hours">
            <input id="inv-expires" className="border rounded px-3 py-2" defaultValue="168"/>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !vaultId} onClick={async ()=>{
            setBusy(true);
            try {
              const contact = (document.getElementById('inv-contact') as HTMLInputElement).value;
              const channel = (document.getElementById('inv-channel') as HTMLSelectElement).value;
              const expires_in_hours = Number((document.getElementById('inv-expires') as HTMLInputElement).value || '168');
              const data = await api('/verifiers/invitations', { method: 'POST', body: JSON.stringify({ vault_id: vaultId, contact, channel, expires_in_hours })});
              setOut(data);
            } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>POST /verifiers/invitations</Button>
          <Button disabled={busy || !vaultId} onClick={async ()=>{
            setBusy(true);
            try { setOut(await api('/orchestration/start', { method: 'POST', body: JSON.stringify({ vault_id: vaultId }) })); }
            catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>POST /orchestration/start</Button>
          <Button disabled={busy || !vaultId || !verifierId} onClick={async ()=>{
            setBusy(true);
            try {
              const data = await api('/orchestration/decision', {
                method: 'POST',
                body: JSON.stringify({ vault_id: vaultId, verifier_id: verifierId, decision: 'Confirm' })
              });
              setOut(data);
            } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>POST decision Confirm</Button>
          <Button disabled={busy || !vaultId || !verifierId} onClick={async ()=>{
            setBusy(true);
            try {
              const data = await api('/orchestration/decision', {
                method: 'POST',
                body: JSON.stringify({ vault_id: vaultId, verifier_id: verifierId, decision: 'Deny' })
              });
              setOut(data);
            } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>POST decision Deny</Button>
        </div>
      </Section>

      <Section title="Heartbeat">
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !vaultId} onClick={async ()=>{
            setBusy(true);
            try { setOut(await api(`/vaults/${vaultId}/heartbeat`)); }
            catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>GET /vaults/{'{vaultId}'}/heartbeat</Button>
          <Button disabled={busy || !vaultId} onClick={async ()=>{
            setBusy(true);
            try { setOut(await api(`/vaults/${vaultId}/heartbeat`, { method: 'PATCH', body: JSON.stringify({ method: 'manual', timeout_days: 60 }) })); }
            catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>PATCH /vaults/{'{vaultId}'}/heartbeat</Button>
          <Button disabled={busy || !vaultId} onClick={async ()=>{
            setBusy(true);
            try { setOut(await api('/heartbeats/ping', { method: 'POST', body: JSON.stringify({ vault_id: vaultId, method: 'manual' }) })); }
            catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>POST /heartbeats/ping</Button>
        </div>
      </Section>

      <Section title="Вывод">
        <JsonView data={out} />
      </Section>

      <p className="text-xs text-gray-500 mt-6">
        Примечание: Playground — вспомогательный UI для ручного теста API. Не содержит авторизации; использует заголовок <code>x-user-id</code>.
      </p>
    </div>
  );
}